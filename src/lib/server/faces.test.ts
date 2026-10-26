import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Face, VisionFace } from "@viso-lol/sdk";
import { AppError } from "@/lib/server/http";
import { deletePerson, listPeople, recognizeFaces, registerPerson } from "@/lib/server/faces";
import type { ValidatedImage } from "@/lib/server/images";
import type { FaceContext } from "@/lib/server/viso";

const COLLECTION_ID = "col_test";
const image: ValidatedImage = {
  bytes: new Uint8Array([0xff, 0xd8, 0xff]),
  width: 640,
  height: 480,
  format: "jpeg",
};

const box = { left: 0.1, top: 0.2, width: 0.3, height: 0.4 };
const enrollmentBox = { left: 0.5, top: 0.5, width: 0.1, height: 0.1 };

function storedFace(overrides: Partial<Face> = {}): Face {
  return {
    object: "face",
    id: "face_1",
    collectionId: COLLECTION_ID,
    externalId: "ext-1",
    metadata: { name: "Ada Lovelace" },
    sourceFileId: null,
    boundingBox: enrollmentBox,
    confidence: 99,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeContext(overrides: {
  detect?: unknown;
  index?: unknown;
  list?: unknown;
  remove?: unknown;
  analyze?: unknown;
}) {
  const detect = vi.fn().mockResolvedValue(overrides.detect ?? { faces: [{}] });
  const index = vi
    .fn()
    .mockResolvedValue(
      overrides.index ?? { object: "face_index_result", indexed: [storedFace()], unindexed: [] },
    );
  const list = vi.fn().mockResolvedValue(overrides.list ?? { data: [], nextCursor: null });
  const remove = vi.fn().mockResolvedValue(overrides.remove ?? { id: "face_1", deleted: true });
  const analyze = vi.fn().mockResolvedValue(overrides.analyze);

  const context = {
    collectionId: COLLECTION_ID,
    viso: {
      face: { detect, collections: { faces: { index, list, delete: remove } } },
      vision: { analyze },
    },
  } as unknown as FaceContext;

  return { context, detect, index, list, remove, analyze };
}

describe("registerPerson", () => {
  it("does not index when no face is detected", async () => {
    const { context, index } = makeContext({ detect: { faces: [] } });
    await expect(registerPerson(context, { image, name: "Ada" })).rejects.toMatchObject({
      code: "enrollment.no_face",
    });
    expect(index).not.toHaveBeenCalled();
  });

  it("does not index when several faces are detected", async () => {
    const { context, index } = makeContext({ detect: { faces: [{}, {}] } });
    await expect(registerPerson(context, { image, name: "Ada" })).rejects.toMatchObject({
      code: "enrollment.multiple_faces",
    });
    expect(index).not.toHaveBeenCalled();
  });

  it("indexes one face into the configured collection and keeps name and externalId", async () => {
    const { context, index } = makeContext({});
    const person = await registerPerson(context, { image, name: "Ada Lovelace" });

    expect(person).toEqual({ faceId: "face_1", externalId: "ext-1", name: "Ada Lovelace" });
    expect(index).toHaveBeenCalledTimes(1);
    const [collectionId, params] = index.mock.calls[0];
    expect(collectionId).toBe(COLLECTION_ID);
    expect(params).toMatchObject({
      image: image.bytes,
      maxFaces: 1,
      qualityFilter: "auto",
      metadata: { name: "Ada Lovelace" },
    });
    expect(params.externalId).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(params.metadata.consentAt).toISOString()).toBe(params.metadata.consentAt);
  });

  it("reports failure instead of a fake person when nothing was indexed", async () => {
    const { context } = makeContext({
      index: {
        object: "face_index_result",
        indexed: [],
        unindexed: [{ boundingBox: box, reasons: ["LOW_QUALITY"] }],
      },
    });
    const promise = registerPerson(context, { image, name: "Ada" });
    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({ code: "enrollment.unindexed" });
  });
});

describe("listPeople and deletePerson", () => {
  it("lists with the page size and cursor and falls back when the name is missing", async () => {
    const { context, list } = makeContext({
      list: {
        data: [storedFace(), storedFace({ id: "face_2", externalId: null, metadata: {} })],
        nextCursor: "next",
      },
    });
    const page = await listPeople(context, "abc");

    expect(list).toHaveBeenCalledWith(COLLECTION_ID, { limit: 20, cursor: "abc" });
    expect(page.nextCursor).toBe("next");
    expect(page.people.map((person) => person.name)).toEqual([
      "Ada Lovelace",
      "Persona sin nombre",
    ]);
    expect(page.people[1].externalId).toBeNull();
  });

  it("deletes through the configured collection", async () => {
    const { context, remove } = makeContext({});
    await expect(deletePerson(context, "face_9")).resolves.toEqual({ faceId: "face_9" });
    expect(remove).toHaveBeenCalledWith(COLLECTION_ID, "face_9");
  });
});

describe("recognizeFaces", () => {
  const faces: VisionFace[] = [
    {
      detectionIndex: 0,
      boundingBox: box,
      status: "matched",
      name: "Ada Lovelace",
      match: { face: storedFace(), similarity: 97.4 },
    },
    { detectionIndex: 1, boundingBox: box, status: "unknown", name: null, match: null },
    {
      detectionIndex: 2,
      boundingBox: box,
      status: "failed",
      name: null,
      match: null,
      error: {
        code: "face.provider_unavailable",
        message: "raw provider text",
        requestId: "req_1",
      },
    },
  ];

  it("runs a face-only analysis with the fixed collection and no objects", async () => {
    const { context, analyze } = makeContext({
      analyze: {
        image: { width: 640, height: 480, format: "jpeg" },
        faces: [],
        objects: [],
        operations: {
          faces: { status: "succeeded", errors: [] },
          objects: { status: "disabled", errors: [] },
        },
        partial: false,
      },
    });
    await recognizeFaces(context, image);

    const [params] = analyze.mock.calls[0];
    expect(params.faces).toEqual({
      enabled: true,
      collectionId: COLLECTION_ID,
      threshold: 90,
      maxDetectedFaces: 10,
    });
    expect("objects" in params).toBe(false);
  });

  it("keeps matched, unknown, failed and partial states distinct and uses query boxes", async () => {
    const { context } = makeContext({
      analyze: {
        image: { width: 640, height: 480, format: "jpeg" },
        faces,
        objects: [],
        operations: {
          faces: {
            status: "partial",
            errors: [{ code: "face.provider_unavailable", message: "raw", requestId: "req_1" }],
          },
          objects: { status: "disabled", errors: [] },
        },
        partial: true,
      },
    });
    const result = await recognizeFaces(context, image);

    expect(result.partial).toBe(true);
    expect(result.facesStatus).toBe("partial");
    expect(result.issues).toEqual([{ code: "face.provider_unavailable", requestId: "req_1" }]);
    expect(result.faces.map((face) => face.status)).toEqual(["matched", "unknown", "failed"]);

    const [matched, unknown, failed] = result.faces;
    expect(matched).toMatchObject({
      name: "Ada Lovelace",
      externalId: "ext-1",
      similarity: 97.4,
      boundingBox: box,
    });
    expect(matched.boundingBox).not.toEqual(enrollmentBox);
    expect(unknown).toMatchObject({ name: null, error: null, similarity: null });
    expect(failed).toMatchObject({
      name: null,
      error: { code: "face.provider_unavailable", requestId: "req_1" },
    });
    // Raw provider messages are not forwarded.
    expect(JSON.stringify(result)).not.toContain("raw provider text");
  });

  it("treats an empty face list as a successful result", async () => {
    const { context } = makeContext({
      analyze: {
        image: { width: 640, height: 480, format: "jpeg" },
        faces: [],
        objects: [],
        operations: {
          faces: { status: "succeeded", errors: [] },
          objects: { status: "disabled", errors: [] },
        },
        partial: false,
      },
    });
    const result = await recognizeFaces(context, image);
    expect(result).toMatchObject({ faces: [], partial: false, facesStatus: "succeeded" });
  });
});
