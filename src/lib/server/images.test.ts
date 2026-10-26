import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { IMAGE_LIMITS } from "@/lib/contracts";
import { readUpload, validateImage } from "@/lib/server/images";

async function jpeg(width: number, height: number) {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: "#808080" },
  })
    .jpeg()
    .toBuffer();
  return new Blob([new Uint8Array(buffer)], { type: "image/jpeg" });
}

describe("validateImage", () => {
  it("accepts a real JPEG and returns its dimensions", async () => {
    const result = await validateImage(await jpeg(200, 120));
    expect(result).toMatchObject({ width: 200, height: 120, format: "jpeg" });
  });

  it("accepts a real PNG", async () => {
    const png = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    const result = await validateImage(new Blob([new Uint8Array(png)], { type: "image/png" }));
    expect(result.format).toBe("png");
  });

  it("rejects missing, empty and non-image input", async () => {
    await expect(validateImage(null)).rejects.toMatchObject({ status: 400 });
    await expect(validateImage("text")).rejects.toMatchObject({ status: 400 });
    await expect(validateImage(new Blob([]))).rejects.toMatchObject({ status: 422 });
    await expect(
      validateImage(new Blob(["not an image"], { type: "image/jpeg" })),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("rejects images that are too small", async () => {
    await expect(validateImage(await jpeg(40, 40))).rejects.toMatchObject({
      code: "image.invalid",
    });
  });

  it("rejects images over the pixel budget", async () => {
    await expect(validateImage(await jpeg(1600, 1300))).rejects.toMatchObject({
      code: "image.invalid",
    });
  });

  it("rejects oversized payloads before decoding", async () => {
    const big = new Blob([new Uint8Array(IMAGE_LIMITS.maxBytes + 1)], { type: "image/jpeg" });
    await expect(validateImage(big)).rejects.toMatchObject({ status: 413 });
  });

  it("rejects a file with an image header but corrupt pixels", async () => {
    const valid = new Uint8Array(await (await jpeg(200, 200)).arrayBuffer());
    const truncated = valid.slice(0, 200);
    await expect(validateImage(new Blob([truncated]))).rejects.toMatchObject({
      code: "image.invalid",
    });
  });
});

describe("readUpload", () => {
  it("rejects a declared oversized body and malformed form data", async () => {
    const huge = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-length": String(IMAGE_LIMITS.maxBytes * 2) },
      body: "x",
    });
    await expect(readUpload(huge)).rejects.toMatchObject({ status: 413 });

    const malformed = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x" },
      body: "garbage",
    });
    await expect(readUpload(malformed)).rejects.toMatchObject({ status: 400 });
  });
});
