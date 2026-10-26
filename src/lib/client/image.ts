import { IMAGE_LIMITS } from "@/lib/contracts";

export type NormalizedImage = {
  blob: Blob;
  width: number;
  height: number;
};

export class ImageNormalizationError extends Error {}

const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
/** Guard against decoding absurdly large files in the browser. */
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

function fitSize(width: number, height: number, scale = 1) {
  const areaScale = Math.min(1, Math.sqrt(IMAGE_LIMITS.maxPixels / (width * height)));
  const axisScale = Math.min(1, IMAGE_LIMITS.maxSide / Math.max(width, height));
  const factor = Math.min(areaScale, axisScale) * scale;
  return {
    width: Math.max(1, Math.floor(width * factor)),
    height: Math.max(1, Math.floor(height * factor)),
  };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Decodes a JPEG/PNG, applies EXIF orientation, flattens it on white, limits it to
 * 2 megapixels and re-encodes it as a JPEG of at most 3 MiB. The returned blob is the
 * exact file that is previewed and uploaded.
 */
export async function normalizeImage(file: File): Promise<NormalizedImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImageNormalizationError("Elige una foto JPEG o PNG.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImageNormalizationError("La foto es demasiado grande.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageNormalizationError("No se pudo leer la foto. Prueba con otra imagen.");
  }

  const canvas = document.createElement("canvas");
  try {
    if (bitmap.width < IMAGE_LIMITS.minSide || bitmap.height < IMAGE_LIMITS.minSide) {
      throw new ImageNormalizationError("La foto debe medir al menos 80×80 píxeles.");
    }

    const context = canvas.getContext("2d");
    if (!context) throw new ImageNormalizationError("Tu navegador no puede procesar la foto.");

    // Shrink progressively until the encoded JPEG fits the size limit.
    for (const scale of [1, 0.85, 0.7, 0.55]) {
      const size = fitSize(bitmap.width, bitmap.height, scale);
      if (size.width < IMAGE_LIMITS.minSide || size.height < IMAGE_LIMITS.minSide) break;

      canvas.width = size.width;
      canvas.height = size.height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size.width, size.height);
      context.drawImage(bitmap, 0, 0, size.width, size.height);

      for (const quality of [0.92, 0.82, 0.7]) {
        const blob = await toBlob(canvas, quality);
        if (!blob) throw new ImageNormalizationError("No se pudo preparar la foto.");
        if (blob.size <= IMAGE_LIMITS.maxBytes) {
          return { blob, width: size.width, height: size.height };
        }
      }
    }
    throw new ImageNormalizationError("La foto es demasiado pesada. Prueba con otra.");
  } finally {
    bitmap.close();
    // Release the canvas backing store.
    canvas.width = 0;
    canvas.height = 0;
  }
}
