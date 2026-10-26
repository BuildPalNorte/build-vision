import type { ApiErrorBody } from "@/lib/contracts";

export class ApiError extends Error {
  readonly code: string;
  readonly requestId: string | null;

  constructor(message: string, code: string, requestId: string | null) {
    super(message);
    this.code = code;
    this.requestId = requestId;
  }

  /** True when the server reports a configuration problem rather than a user mistake. */
  get isSetup() {
    return this.code.startsWith("setup.");
  }
}

/** Fetches JSON from the app API and converts failures into `ApiError`. */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, { ...init, cache: "no-store" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("No hay conexión con el servidor. Inténtalo de nuevo.", "network", null);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON responses (for example a platform-level payload limit) are handled below.
  }

  if (!response.ok) {
    const error = (body as Partial<ApiErrorBody> | null)?.error;
    if (error?.message) {
      throw new ApiError(error.message, error.code ?? "unknown", error.requestId ?? null);
    }
    throw new ApiError(
      response.status === 413
        ? "La foto es demasiado grande."
        : "El servidor no pudo completar la solicitud. Inténtalo de nuevo.",
      "http." + response.status,
      null,
    );
  }

  return body as T;
}
