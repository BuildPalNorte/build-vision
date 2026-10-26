import "server-only";

import { Viso } from "@viso-lol/sdk";
import { AppError } from "@/lib/server/http";

const DEFAULT_BASE_URL = "https://api.viso.lol/v1";

export type FaceContext = {
  viso: Viso;
  collectionId: string;
};

function setupError(missing: string[]): AppError {
  return new AppError(
    503,
    "setup.required",
    `Falta configurar Viso: ${missing.join(", ")}. Consulta el README para completar la configuración.`,
  );
}

/**
 * Reads and validates configuration while handling a request, never at import time, so the
 * app builds and renders without credentials.
 */
export function getFaceContext(): FaceContext {
  const apiKey = process.env.VISO_API_KEY?.trim();
  const collectionId = process.env.VISO_COLLECTION_ID?.trim();
  const baseUrl = process.env.VISO_BASE_URL?.trim() || DEFAULT_BASE_URL;

  const missing: string[] = [];
  if (!apiKey) missing.push("VISO_API_KEY");
  if (!collectionId) missing.push("VISO_COLLECTION_ID");
  if (!apiKey || !collectionId) throw setupError(missing);

  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
  } catch {
    throw new AppError(503, "setup.invalid_base_url", "VISO_BASE_URL no es una URL válida.");
  }

  return {
    viso: new Viso({ apiKey, baseUrl, maxRetries: 0 }),
    collectionId,
  };
}
