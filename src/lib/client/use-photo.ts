"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageNormalizationError, normalizeImage } from "@/lib/client/image";

export type Photo = {
  blob: Blob;
  url: string;
  width: number;
  height: number;
};

/**
 * Holds one temporary, normalized photo. The previous object URL is revoked when the photo
 * is replaced or the component unmounts; late normalizations of older files are ignored.
 */
export function usePhoto() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const attempt = useRef(0);

  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.url);
  }, [photo]);

  useEffect(
    () => () => {
      attempt.current += 1;
    },
    [],
  );

  const select = useCallback(async (file: File) => {
    const current = ++attempt.current;
    setError(null);
    setIsProcessing(true);
    try {
      const normalized = await normalizeImage(file);
      if (current !== attempt.current) return;
      setPhoto({ ...normalized, url: URL.createObjectURL(normalized.blob) });
    } catch (caught) {
      if (current !== attempt.current) return;
      setError(
        caught instanceof ImageNormalizationError ? caught.message : "No se pudo preparar la foto.",
      );
    } finally {
      if (current === attempt.current) setIsProcessing(false);
    }
  }, []);

  return { photo, error, isProcessing, select };
}
