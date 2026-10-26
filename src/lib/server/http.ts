import "server-only";

import { VisoConnectionError, VisoError } from "@viso-lol/sdk";
import { ZodError } from "zod";
import type { ApiErrorBody } from "@/lib/contracts";

/** An error whose message is safe to show to users. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;

  constructor(status: number, code: string, message: string, requestId: string | null = null) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export type NotFoundSubject = "collection" | "face";

/**
 * Maps an SDK error to a safe app error. Known SDK codes and request IDs are preserved;
 * raw provider messages are never forwarded.
 */
export function mapProviderError(
  error: unknown,
  notFound: NotFoundSubject = "collection",
): AppError {
  if (error instanceof VisoConnectionError) {
    return error.timeout
      ? new AppError(504, "viso.timeout", "Viso tardó demasiado en responder. Inténtalo de nuevo.")
      : new AppError(502, "viso.connection", "No se pudo conectar con Viso. Inténtalo de nuevo.");
  }

  if (!(error instanceof VisoError)) {
    return new AppError(500, "internal", "Ocurrió un error inesperado. Inténtalo de nuevo.");
  }

  const { code, requestId } = error;
  const make = (status: number, message: string) => new AppError(status, code, message, requestId);

  switch (code) {
    case "auth.missing_api_key":
    case "auth.invalid_api_key":
    case "auth.api_key_revoked":
    case "auth.api_key_expired":
    case "auth.unauthenticated":
      return make(503, "La clave de API de Viso no es válida. Revisa VISO_API_KEY.");
    case "auth.insufficient_scope":
    case "auth.forbidden":
      return make(
        403,
        "La clave de API no tiene permisos suficientes. Necesita face:read y face:write (y vision:read para detectar objetos).",
      );
    case "face.not_enabled":
      return make(409, "Face no está habilitado en el proyecto de Viso.");
    case "vision.not_configured":
      return make(503, "El reconocimiento no está disponible en este proyecto de Viso.");
    case "request.not_found":
    case "resource.not_found":
      return notFound === "face"
        ? make(404, "Este rostro ya no está registrado.")
        : make(404, "La colección de Viso no está disponible. Revisa VISO_COLLECTION_ID.");
    case "resource.conflict":
      return make(409, "La colección de Viso todavía no está activa. Inténtalo en unos minutos.");
    case "quota.exceeded":
    case "plan.limit_reached":
      return make(429, "Se alcanzó el límite de uso de Viso.");
    case "rate_limit.exceeded":
      return make(429, "Demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.");
    case "face.no_face_detected":
      return make(422, "No se detectó ningún rostro en la foto.");
    case "face.image_too_small":
      return make(422, "La foto es demasiado pequeña.");
    case "face.image_too_large":
    case "request.body_too_large":
    case "images.file_too_large":
      return make(413, "La foto es demasiado grande.");
    case "face.unsupported_format":
    case "face.invalid_image":
    case "request.unsupported_media_type":
    case "images.unsupported_type":
    case "vision.image_too_complex":
      return make(422, "Viso no pudo procesar esa foto. Prueba con otra imagen JPEG o PNG.");
    case "vision.too_many_faces":
      return make(422, "La foto tiene demasiados rostros. El máximo es 10.");
    case "vision.timeout":
      return make(504, "Viso tardó demasiado en responder. Inténtalo de nuevo.");
    default:
      return make(
        error.status >= 400 && error.status < 500 ? 422 : 502,
        "Viso no pudo completar la solicitud. Inténtalo de nuevo.",
      );
  }
}

/** Converts any thrown value into a JSON response without leaking internals. */
export function errorResponse(error: unknown, notFound: NotFoundSubject = "collection"): Response {
  let appError: AppError;
  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = new AppError(
      400,
      "request.invalid",
      error.issues[0]?.message ?? "La solicitud no es válida.",
    );
  } else {
    appError = mapProviderError(error, notFound);
  }

  if (appError.status >= 500) {
    // Log only safe metadata: never image bytes, secrets or raw provider messages.
    console.error("[viso-faces]", appError.code, appError.status, appError.requestId ?? "");
  }

  const body: ApiErrorBody = {
    error: { code: appError.code, message: appError.message, requestId: appError.requestId },
  };
  return Response.json(body, { status: appError.status, headers: noStore });
}

export const noStore = { "Cache-Control": "no-store" } as const;

export function jsonResponse<T>(data: T, status = 200): Response {
  return Response.json(data, { status, headers: noStore });
}
