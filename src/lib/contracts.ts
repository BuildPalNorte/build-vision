import type { BoundingBox } from "@viso-lol/sdk";
import { z } from "zod";

// Image limits shared by the browser normalizer and the server validator.
export const IMAGE_LIMITS = {
  maxBytes: 3 * 1024 * 1024,
  maxPixels: 2_000_000,
  minSide: 80,
  maxSide: 8192,
} as const;

export const NAME_MAX_LENGTH = 64;
export const FALLBACK_NAME = "Persona sin nombre";

/** Counts Unicode characters (code points), not UTF-16 units. */
function charCount(value: string): number {
  return Array.from(value).length;
}

export const nameSchema = z
  .string({ error: "Escribe un nombre." })
  .trim()
  .min(1, "Escribe un nombre.")
  .refine((value) => charCount(value) <= NAME_MAX_LENGTH, {
    message: `El nombre no puede superar ${NAME_MAX_LENGTH} caracteres.`,
  });

/** Consent must be the literal submitted string "true", not general truthiness. */
export const enrollmentInputSchema = z.object({
  name: nameSchema,
  consent: z.literal("true", {
    error: "Debes aceptar el consentimiento para registrar el rostro.",
  }),
});

export const faceIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Identificador de rostro no válido.");

export const cursorSchema = z.string().min(1).max(512).optional();

export type EnrollmentInput = z.infer<typeof enrollmentInputSchema>;

// App DTOs. They contain no portraits, only what the UI needs.

export type PersonDto = {
  faceId: string;
  externalId: string | null;
  name: string;
};

export type PeoplePage = {
  people: PersonDto[];
  nextCursor: string | null;
};

export type RecognizedFaceStatus = "matched" | "unknown" | "failed";

export type RecognitionIssue = {
  code: string;
  requestId: string | null;
};

export type RecognizedFace = {
  detectionIndex: number;
  /** Normalized box on the query image. */
  boundingBox: BoundingBox;
  status: RecognizedFaceStatus;
  name: string | null;
  externalId: string | null;
  faceId: string | null;
  /** Similarity score reported by the provider; not a calibrated probability. */
  similarity: number | null;
  error: RecognitionIssue | null;
};

export type RecognitionResult = {
  image: { width: number; height: number };
  faces: RecognizedFace[];
  partial: boolean;
  /** Overall status of the face operation. */
  facesStatus: "succeeded" | "partial" | "failed" | "disabled";
  issues: RecognitionIssue[];
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId: string | null;
  };
};
