import "server-only";

import sharp from "sharp";
import { IMAGE_LIMITS } from "@/lib/contracts";
import { AppError } from "@/lib/server/http";

export type ValidatedImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
  format: "jpeg" | "png";
};

const invalid = (message: string, status = 422) => new AppError(status, "image.invalid", message);

function detectFormat(bytes: Uint8Array): "jpeg" | "png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((value, index) => bytes[index] === value)) {
    return "png";
  }
  return null;
}

/** Reads multipart form data, rejecting oversized or malformed bodies early. */
export async function readUpload(request: Request): Promise<FormData> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  // Leave room for the multipart envelope and the small text fields.
  if (declared > IMAGE_LIMITS.maxBytes + 64 * 1024) {
    throw invalid("La foto supera el tamaño máximo de 3 MB.", 413);
  }
  try {
    return await request.formData();
  } catch {
    throw invalid("La solicitud no es válida.", 400);
  }
}

/**
 * Validates an uploaded multipart entry before any provider call: real format, size,
 * dimensions and a full pixel decode. The declared MIME type is not trusted.
 */
export async function validateImage(entry: unknown): Promise<ValidatedImage> {
  if (typeof entry === "string" || entry === null || entry === undefined) {
    throw invalid("Falta la foto.", 400);
  }
  if (typeof (entry as Blob).arrayBuffer !== "function") {
    throw invalid("Falta la foto.", 400);
  }

  const blob = entry as Blob;
  if (blob.size === 0) throw invalid("La foto está vacía.");
  if (blob.size > IMAGE_LIMITS.maxBytes) {
    throw invalid("La foto supera el tamaño máximo de 3 MB.", 413);
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const format = detectFormat(bytes);
  if (!format) throw invalid("Usa una foto JPEG o PNG.");

  try {
    const pipeline = sharp(bytes, {
      limitInputPixels: IMAGE_LIMITS.maxPixels,
      failOn: "error",
    });
    const metadata = await pipeline.metadata();
    const { width, height } = metadata;
    if (!width || !height) throw invalid("No se pudo leer la foto.");
    if (metadata.format !== format)
      throw invalid("El contenido de la foto no coincide con su formato.");
    if (width < IMAGE_LIMITS.minSide || height < IMAGE_LIMITS.minSide) {
      throw invalid("La foto debe medir al menos 80×80 píxeles.");
    }
    if (width > IMAGE_LIMITS.maxSide || height > IMAGE_LIMITS.maxSide) {
      throw invalid("La foto es demasiado grande.");
    }
    if (width * height > IMAGE_LIMITS.maxPixels) {
      throw invalid("La foto tiene demasiados píxeles.");
    }

    // Metadata alone does not decode; force a full decode to catch corrupt files.
    await pipeline.clone().raw().toBuffer();

    return { bytes, width, height, format };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw invalid("No se pudo leer la foto. Prueba con otra imagen JPEG o PNG.");
  }
}
