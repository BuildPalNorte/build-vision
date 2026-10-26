"use client";

import { toImageRect, toPercentBox } from "@/lib/geometry";
import type { RecognizedFace } from "@/lib/contracts";

export function faceLabel(face: RecognizedFace): string {
  if (face.status === "matched") return face.name ?? "Persona sin nombre";
  if (face.status === "unknown") return "Sin coincidencia";
  return "No se pudo evaluar";
}

type FaceOverlayProps = {
  src: string;
  /** Dimensions of the analyzed image; this is also the SVG coordinate space. */
  image: { width: number; height: number };
  faces: RecognizedFace[];
  selected: number | null;
  onSelect: (detectionIndex: number) => void;
};

/**
 * Draws query-face boxes over the photograph. Boxes come from `faces[i].boundingBox`,
 * which is expressed on the query image, and are mapped into the analyzed image's pixel
 * space. The SVG sits on a wrapper that shrinks to the displayed image so both stay aligned.
 */
export function FaceOverlay({ src, image, faces, selected, onSelect }: FaceOverlayProps) {
  return (
    <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-2xl bg-surface-secondary">
      {/* The exact normalized blob that was analyzed. */}
      <img
        src={src}
        alt="Fotografía analizada"
        width={image.width}
        height={image.height}
        className="block h-auto max-h-[75vh] w-auto max-w-full"
      />
      <svg
        viewBox={`0 0 ${image.width} ${image.height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        aria-hidden="true"
      >
        {faces.map((face) => {
          const rect = toImageRect(face.boundingBox, image);
          const isSelected = selected === face.detectionIndex;
          return (
            <rect
              key={face.detectionIndex}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={4}
              fill={isSelected ? "rgba(0, 113, 227, 0.12)" : "transparent"}
              stroke={isSelected ? "#0071e3" : "rgba(255, 255, 255, 0.92)"}
              strokeWidth={isSelected ? 3 : 2}
              strokeDasharray={face.status === "failed" ? "6 4" : undefined}
              vectorEffect="non-scaling-stroke"
              className="pointer-events-auto cursor-pointer transition-[stroke,fill] duration-150"
              style={{ filter: "drop-shadow(0 0 1px rgba(0, 0, 0, 0.55))" }}
              onClick={() => onSelect(face.detectionIndex)}
            />
          );
        })}
      </svg>
      {faces.map((face, position) => {
        const box = toPercentBox(face.boundingBox);
        const isSelected = selected === face.detectionIndex;
        const anchorRight = box.left > 55;
        const nearTop = box.top < 9;
        return (
          <span
            key={face.detectionIndex}
            aria-hidden="true"
            onClick={() => onSelect(face.detectionIndex)}
            className={`absolute max-w-[55%] cursor-pointer truncate rounded-full px-2 py-0.5 text-xs font-medium leading-5 transition-colors duration-150 ${
              isSelected ? "z-10 bg-accent text-accent-foreground" : "bg-black/60 text-white"
            }`}
            style={{
              top: `${box.top}%`,
              ...(anchorRight
                ? { right: `${100 - box.left - box.width}%` }
                : { left: `${box.left}%` }),
              transform: nearTop ? "translateY(4px)" : "translateY(calc(-100% - 4px))",
            }}
          >
            {position + 1} · {faceLabel(face)}
          </span>
        );
      })}
    </div>
  );
}
