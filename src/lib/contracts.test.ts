import { describe, expect, it } from "vitest";
import { enrollmentInputSchema, faceIdSchema, nameSchema } from "@/lib/contracts";
import { toImageRect } from "@/lib/geometry";

describe("enrollment input", () => {
  it("trims the name and requires the literal consent string", () => {
    expect(enrollmentInputSchema.parse({ name: "  Ada  ", consent: "true" })).toEqual({
      name: "Ada",
      consent: "true",
    });
    for (const consent of ["on", "1", "True", "", undefined]) {
      expect(enrollmentInputSchema.safeParse({ name: "Ada", consent }).success).toBe(false);
    }
  });

  it("limits names to 64 Unicode characters", () => {
    expect(nameSchema.safeParse("   ").success).toBe(false);
    expect(nameSchema.safeParse("a".repeat(64)).success).toBe(true);
    expect(nameSchema.safeParse("a".repeat(65)).success).toBe(false);
    // 64 emoji are 128 UTF-16 units but 64 characters.
    expect(nameSchema.safeParse("😀".repeat(64)).success).toBe(true);
  });

  it("validates face identifiers", () => {
    expect(faceIdSchema.safeParse("face_01abc").success).toBe(true);
    expect(faceIdSchema.safeParse("../x").success).toBe(false);
  });
});

describe("toImageRect", () => {
  it("maps normalized boxes into the analyzed image's pixel space", () => {
    expect(
      toImageRect({ left: 0.25, top: 0.5, width: 0.5, height: 0.25 }, { width: 800, height: 600 }),
    ).toEqual({
      x: 200,
      y: 300,
      width: 400,
      height: 150,
    });
  });

  it("clamps boxes that extend past the image", () => {
    const rect = toImageRect(
      { left: 0.9, top: -0.1, width: 0.3, height: 0.5 },
      { width: 100, height: 100 },
    );
    expect(rect.x).toBeCloseTo(90);
    expect(rect.y).toBe(0);
    expect(rect.width).toBeCloseTo(10);
    expect(rect.height).toBeCloseTo(40);
  });
});
