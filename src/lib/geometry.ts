import type { BoundingBox } from "@viso-lol/sdk";

export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Maps a normalized `{ left, top, width, height }` box into the pixel space of the
 * analyzed image, which is also the SVG viewBox. Values are clamped to the image.
 */
export function toImageRect(box: BoundingBox, image: Size): Rect {
  const left = clamp01(box.left);
  const top = clamp01(box.top);
  const right = clamp01(box.left + box.width);
  const bottom = clamp01(box.top + box.height);
  return {
    x: left * image.width,
    y: top * image.height,
    width: (right - left) * image.width,
    height: (bottom - top) * image.height,
  };
}

/** Converts a normalized box to CSS percentages for HTML labels over the image. */
export function toPercentBox(box: BoundingBox) {
  const left = clamp01(box.left);
  const top = clamp01(box.top);
  return {
    left: left * 100,
    top: top * 100,
    width: (clamp01(box.left + box.width) - left) * 100,
    height: (clamp01(box.top + box.height) - top) * 100,
  };
}
