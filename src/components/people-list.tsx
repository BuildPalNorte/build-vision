"use client";

import { AlertDialog, Button, Spinner } from "@heroui/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonShape, linkButtonClass } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/client/api";
import type { PeoplePage, PersonDto } from "@/lib/contracts";

function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

function asApiError(error: unknown, fallback: string): ApiError {
  return error instanceof ApiError ? error : new ApiError(fallback, "unknown", null);
}

export function PeopleList() {
  const [people, setPeople] = useState<PersonDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<ApiError | null>(null);

  const [target, setTarget] = useState<PersonDto | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const page = await apiFetch<PeoplePage>("/api/people", { signal });
      setPeople(page.people);
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (signal?.aborted) return;
      setLoadError(asApiError(error, "No se pudo cargar la lista."));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setMoreError(null);
    try {
      const page = await apiFetch<PeoplePage>(
        `/api/people?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setPeople((current) => {
        const known = new Set(current.map((person) => person.faceId));
        return [...current, ...page.people.filter((person) => !known.has(person.faceId))];
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      setMoreError(asApiError(error, "No se pudo cargar más."));
    } finally {
      setIsLoadingMore(false);
    }
  }

  function askToDelete(person: PersonDto) {
    setTarget(person);
    setDeleteError(null);
    setIsDialogOpen(true);
  }

  async function confirmDelete() {
    if (!target || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(`/api/people/${encodeURIComponent(target.faceId)}`, { method: "DELETE" });
      // The list changes only after the server confirms the deletion.
      setPeople((current) => current.filter((person) => person.faceId !== target.faceId));
      setNotice(`Se eliminó el registro de ${target.name}.`);
      setIsDialogOpen(false);
      requestAnimationFrame(() => listRef.current?.focus());
    } catch (error) {
      setDeleteError(asApiError(error, "No se pudo eliminar el registro."));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div ref={listRef} tabIndex={-1} className="outline-none">
      <div role="status" aria-live="polite" className="sr-only">
        {notice}
      </div>

      {isLoading ? (
        <div role="status" className="flex items-center gap-3 py-8 text-muted">
          <Spinner size="sm" color="current" />
          <span>Cargando personas…</span>
        </div>
      ) : loadError ? (
        <div role="alert" className="flex flex-col items-start gap-4 border-y border-divider py-8">
          <p>{loadError.message}</p>
          {loadError.requestId ? (
            <p className="text-sm text-muted">ID de solicitud: {loadError.requestId}</p>
          ) : null}
          <Button variant="tertiary" className={buttonShape} onPress={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : people.length === 0 && !nextCursor ? (
        <div className="flex flex-col items-start gap-6 border-y border-divider py-12">
          <p className="text-muted">Todavía no hay rostros registrados.</p>
          <Link href="/people/new" className={linkButtonClass("primary")}>
            Registrar rostro
          </Link>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-divider border-y border-divider">
            {people.map((person) => (
              <li key={person.faceId} className="flex min-h-16 items-center gap-4 py-2">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-sm font-medium text-muted"
                >
                  {initials(person.name)}
                </span>
                <span className="min-w-0 flex-1 truncate">{person.name}</span>
                <Button
                  variant="ghost"
                  className="min-h-11 rounded-full px-4 text-sm text-danger"
                  aria-label={`Eliminar a ${person.name}`}
                  onPress={() => askToDelete(person)}
                >
                  Eliminar
                </Button>
              </li>
            ))}
          </ul>
          {nextCursor ? (
            <div className="mt-6 flex flex-col items-start gap-3">
              <Button
                variant="tertiary"
                isPending={isLoadingMore}
                className={buttonShape}
                onPress={() => void loadMore()}
              >
                {({ isPending }) => (
                  <>
                    {isPending ? <Spinner color="current" size="sm" /> : null}
                    Cargar más
                  </>
                )}
              </Button>
              {moreError ? (
                <p role="alert" className="text-sm text-danger">
                  {moreError.message}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <AlertDialog.Backdrop
        isOpen={isDialogOpen}
        onOpenChange={(open) => {
          if (!open && isDeleting) return;
          setIsDialogOpen(open);
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="rounded-[20px] shadow-xl sm:max-w-[400px]">
            <AlertDialog.Header>
              <AlertDialog.Heading className="text-lg font-semibold">
                ¿Eliminar a {target?.name}?
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                Ya no se reconocerá este rostro en otras fotos. Esta acción no se puede deshacer.
              </p>
              {deleteError ? (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {deleteError.message}
                  {deleteError.requestId ? ` (ID de solicitud: ${deleteError.requestId})` : ""}
                </p>
              ) : null}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                slot="close"
                variant="tertiary"
                isDisabled={isDeleting}
                className={buttonShape}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                isPending={isDeleting}
                className={buttonShape}
                onPress={() => void confirmDelete()}
              >
                {({ isPending }) => (
                  <>
                    {isPending ? <Spinner color="current" size="sm" /> : null}
                    Eliminar
                  </>
                )}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
