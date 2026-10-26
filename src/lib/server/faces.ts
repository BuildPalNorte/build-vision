import "server-only";

import type { Face, VisionFace } from "@viso-lol/sdk";
import {
  FALLBACK_NAME,
  type PeoplePage,
  type PersonDto,
  type RecognitionIssue,
  type RecognitionResult,
  type RecognizedFace,
} from "@/lib/contracts";
import { AppError } from "@/lib/server/http";
import type { ValidatedImage } from "@/lib/server/images";
import type { FaceContext } from "@/lib/server/viso";

const PAGE_SIZE = 20;
/** Minimum similarity for a match. Fixed on purpose: not client-controlled. */
const RECOGNITION_THRESHOLD = 90;
const MAX_DETECTED_FACES = 10;
const ENROLLMENT_TIMEOUT_MS = 25_000;
const RECOGNITION_TIMEOUT_MS = 50_000;

export function toPerson(face: Face): PersonDto {
  const name = face.metadata?.name;
  return {
    faceId: face.id,
    externalId: face.externalId,
    name: typeof name === "string" && name.trim() !== "" ? name : FALLBACK_NAME,
  };
}

/**
 * Registers one person. The provider is only asked to index after detection confirms the
 * photo contains exactly one face; `maxFaces: 1` alone would silently pick the largest.
 */
export async function registerPerson(
  { viso, collectionId }: FaceContext,
  input: { image: ValidatedImage; name: string },
): Promise<PersonDto> {
  const { image, name } = input;

  const detection = await viso.face.detect(
    { image: image.bytes },
    { timeoutMs: ENROLLMENT_TIMEOUT_MS },
  );
  if (detection.faces.length === 0) {
    throw new AppError(422, "enrollment.no_face", "No se detectó ningún rostro en la foto.");
  }
  if (detection.faces.length > 1) {
    throw new AppError(
      422,
      "enrollment.multiple_faces",
      "La foto tiene varios rostros. Usa una foto con una sola persona.",
    );
  }

  const result = await viso.face.collections.faces.index(
    collectionId,
    {
      image: image.bytes,
      externalId: crypto.randomUUID(),
      metadata: { name, consentAt: new Date().toISOString() },
      maxFaces: 1,
      qualityFilter: "auto",
    },
    { timeoutMs: ENROLLMENT_TIMEOUT_MS },
  );

  if (result.indexed.length === 1) {
    return toPerson(result.indexed[0]);
  }

  if (result.indexed.length > 1) {
    // Unexpected with maxFaces: 1. Remove what was indexed so no unexpected record remains.
    await Promise.allSettled(
      result.indexed.map((face) => viso.face.collections.faces.delete(collectionId, face.id)),
    );
    throw new AppError(
      502,
      "enrollment.unexpected_result",
      "No se pudo registrar el rostro. Inténtalo de nuevo.",
    );
  }

  throw new AppError(
    422,
    "enrollment.unindexed",
    "El rostro no tiene calidad suficiente para registrarse. Prueba con una foto más nítida, bien iluminada y de frente.",
  );
}

export async function listPeople(
  { viso, collectionId }: FaceContext,
  cursor?: string,
): Promise<PeoplePage> {
  const page = await viso.face.collections.faces.list(collectionId, {
    limit: PAGE_SIZE,
    cursor,
  });
  return { people: page.data.map(toPerson), nextCursor: page.nextCursor };
}

export async function deletePerson(
  { viso, collectionId }: FaceContext,
  faceId: string,
): Promise<{ faceId: string }> {
  const result = await viso.face.collections.faces.delete(collectionId, faceId);
  if (!result.deleted) {
    throw new AppError(502, "delete.unconfirmed", "No se pudo confirmar la eliminación.");
  }
  return { faceId };
}

function toIssue(error: { code: string; requestId: string }): RecognitionIssue {
  return { code: error.code, requestId: error.requestId ?? null };
}

function toRecognizedFace(face: VisionFace): RecognizedFace {
  const base = { detectionIndex: face.detectionIndex, boundingBox: face.boundingBox };
  switch (face.status) {
    case "matched":
      return {
        ...base,
        status: "matched",
        name: face.name ?? FALLBACK_NAME,
        externalId: face.match.face.externalId,
        faceId: face.match.face.id,
        similarity: face.match.similarity,
        error: null,
      };
    case "unknown":
      return {
        ...base,
        status: "unknown",
        name: null,
        externalId: null,
        faceId: null,
        similarity: null,
        error: null,
      };
    case "failed":
      return {
        ...base,
        status: "failed",
        name: null,
        externalId: null,
        faceId: null,
        similarity: null,
        error: toIssue(face.error),
      };
  }
}

/**
 * Face-only group recognition. `objects` is intentionally omitted. Boxes come from the
 * query faces, never from the nested enrollment match.
 */
export async function recognizeFaces(
  { viso, collectionId }: FaceContext,
  image: ValidatedImage,
): Promise<RecognitionResult> {
  const analysis = await viso.vision.analyze(
    {
      image: image.bytes,
      faces: {
        enabled: true,
        collectionId,
        threshold: RECOGNITION_THRESHOLD,
        maxDetectedFaces: MAX_DETECTED_FACES,
      },
    },
    { timeoutMs: RECOGNITION_TIMEOUT_MS },
  );

  return {
    image: { width: analysis.image.width, height: analysis.image.height },
    faces: analysis.faces.map(toRecognizedFace),
    partial: analysis.partial,
    facesStatus: analysis.operations.faces.status,
    issues: analysis.operations.faces.errors.map(toIssue),
  };
}
