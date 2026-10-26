"use client";

import { Button, Spinner } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { FaceOverlay, faceLabel } from "@/components/face-overlay";
import { PhotoPicker } from "@/components/photo-picker";
import { buttonShape } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/client/api";
import { usePhoto } from "@/lib/client/use-photo";
import type { RecognitionResult, RecognizedFace } from "@/lib/contracts";

const formatSimilarity = (value: number) =>
  value.toLocaleString("es", { maximumFractionDigits: 1 });

function RowDetail({ face }: { face: RecognizedFace }) {
  if (face.status === "matched" && face.similarity !== null) {
    return (
      <span className="text-sm text-muted">Similitud: {formatSimilarity(face.similarity)}</span>
    );
  }
  if (face.status === "failed" && face.error) {
    return (
      <span className="break-all text-sm text-muted">
        {face.error.code}
        {face.error.requestId ? ` · ${face.error.requestId}` : ""}
      </span>
    );
  }
  return null;
}

export function RecognitionWorkspace() {
  const { photo, error: photoError, isProcessing, select } = usePhoto();
  // Results are tied to the photo they were computed for, so changing the photo clears them.
  const [outcome, setOutcome] = useState<{ photoUrl: string; result: RecognitionResult } | null>(
    null,
  );
  const [requestError, setRequestError] = useState<{ photoUrl: string; error: ApiError } | null>(
    null,
  );
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    currentUrlRef.current = photo?.url ?? null;
    // Cancel any in-flight request when the photo changes or the component unmounts.
    return () => controllerRef.current?.abort();
  }, [photo]);

  const result = photo && outcome?.photoUrl === photo.url ? outcome.result : null;
  const error = photo && requestError?.photoUrl === photo.url ? requestError.error : null;
  const isRecognizing = photo !== null && pendingUrl === photo.url;

  async function recognize() {
    if (!photo || isRecognizing || result) return;
    const photoUrl = photo.url;
    const controller = new AbortController();
    controllerRef.current = controller;
    setPendingUrl(photoUrl);
    setRequestError(null);
    setSelected(null);

    try {
      const body = new FormData();
      body.append("image", new File([photo.blob], "photo.jpg", { type: "image/jpeg" }));
      const data = await apiFetch<RecognitionResult>("/api/recognize", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      // Ignore late responses for a photo that has since been replaced.
      if (currentUrlRef.current !== photoUrl) return;
      setOutcome({ photoUrl, result: data });
    } catch (caught) {
      if (controller.signal.aborted || currentUrlRef.current !== photoUrl) return;
      setRequestError({
        photoUrl,
        error:
          caught instanceof ApiError
            ? caught
            : new ApiError("No se pudo reconocer la foto.", "unknown", null),
      });
    } finally {
      setPendingUrl((current) => (current === photoUrl ? null : current));
    }
  }

  function changePhoto(file: File) {
    setSelected(null);
    void select(file);
  }

  if (!photo) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
          <p id="recognize-note" className="max-w-[40ch] text-sm text-muted">
            El reconocimiento busca cada rostro en la colección de rostros registrados.
          </p>
          <PhotoPicker
            label={isProcessing ? "Preparando foto…" : "Elegir foto"}
            isDisabled={isProcessing}
            describedBy="recognize-note"
            onFile={changePhoto}
          />
        </div>
        {photoError ? (
          <p role="alert" className="text-sm text-danger">
            {photoError}
          </p>
        ) : null}
      </div>
    );
  }

  const faces = result?.faces ?? [];
  const showResults = result !== null && faces.length > 0;
  const operationFailed = result !== null && result.facesStatus === "failed";
  const firstIssue = result?.issues[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-8">
        <div className="min-w-0 md:flex-1">
          {result && result.faces.length > 0 ? (
            <FaceOverlay
              src={photo.url}
              image={result.image}
              faces={faces}
              selected={selected}
              onSelect={setSelected}
            />
          ) : (
            <div className="flex justify-center overflow-hidden rounded-2xl bg-surface-secondary">
              <img
                src={photo.url}
                alt="Fotografía elegida"
                width={photo.width}
                height={photo.height}
                className="block h-auto max-h-[75vh] w-auto max-w-full"
              />
            </div>
          )}
        </div>

        {showResults ? (
          <aside aria-label="Resultados" className="md:w-[280px] md:shrink-0">
            <ul className="flex flex-col gap-1">
              {faces.map((face, position) => {
                const isSelected = selected === face.detectionIndex;
                return (
                  <li key={face.detectionIndex}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelected(face.detectionIndex)}
                      className={`flex min-h-11 w-full flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors duration-150 ${
                        isSelected
                          ? "border-accent bg-accent/10"
                          : "border-transparent hover:bg-surface-secondary"
                      }`}
                    >
                      <span className="flex w-full items-baseline gap-2">
                        <span className="text-sm text-muted">{position + 1}</span>
                        <span
                          className={`min-w-0 flex-1 truncate ${face.status === "matched" ? "font-medium" : "text-muted"}`}
                        >
                          {faceLabel(face)}
                        </span>
                      </span>
                      <RowDetail face={face} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        ) : null}
      </div>

      <div role="status" aria-live="polite" className="flex flex-col gap-2 text-sm">
        {isRecognizing ? <span className="text-muted">Reconociendo rostros…</span> : null}
        {result && result.faces.length === 0 && !operationFailed ? (
          <p className="text-muted">No se detectaron rostros en esta foto. Prueba con otra.</p>
        ) : null}
        {result && result.partial && !operationFailed ? (
          <p className="text-muted">
            Algunos rostros no se pudieron evaluar. Se muestran los resultados disponibles.
            {firstIssue?.requestId ? ` ID de solicitud: ${firstIssue.requestId}.` : ""}
          </p>
        ) : null}
      </div>

      {operationFailed ? (
        <p role="alert" className="text-sm text-danger">
          No se pudo completar el reconocimiento de rostros.
          {firstIssue
            ? ` (${firstIssue.code}${firstIssue.requestId ? ` · ${firstIssue.requestId}` : ""})`
            : ""}
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="text-sm text-danger">
          <p>{error.message}</p>
          {error.requestId ? (
            <p className="mt-1 text-muted">ID de solicitud: {error.requestId}</p>
          ) : null}
        </div>
      ) : null}
      {photoError ? (
        <p role="alert" className="text-sm text-danger">
          {photoError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {!result ? (
          <Button
            variant="primary"
            isPending={isRecognizing}
            isDisabled={isProcessing}
            className={buttonShape}
            onPress={() => void recognize()}
          >
            {({ isPending }) => (
              <>
                {isPending ? <Spinner color="current" size="sm" /> : null}
                {isPending ? "Reconociendo…" : "Reconocer rostros"}
              </>
            )}
          </Button>
        ) : null}
        <PhotoPicker
          label="Cambiar foto"
          variant="ghost"
          isDisabled={isProcessing}
          onFile={changePhoto}
        />
      </div>
    </div>
  );
}
