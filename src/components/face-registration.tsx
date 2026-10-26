"use client";

import { Button, Checkbox, FieldError, Input, Label, Spinner, TextField } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PhotoPicker } from "@/components/photo-picker";
import { buttonShape } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/client/api";
import { usePhoto } from "@/lib/client/use-photo";
import { nameSchema } from "@/lib/contracts";

export function FaceRegistration() {
  const router = useRouter();
  const { photo, error: photoProcessingError, isProcessing, select } = usePhoto();
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; photo?: string; consent?: string }>({});
  const [requestError, setRequestError] = useState<ApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const parsedName = nameSchema.safeParse(name);
    const nextErrors = {
      name: parsedName.success ? undefined : parsedName.error.issues[0]?.message,
      photo: photo ? undefined : "Elige una foto con un solo rostro.",
      consent: consent ? undefined : "Debes aceptar para registrar el rostro.",
    };
    setErrors(nextErrors);
    setRequestError(null);
    if (!parsedName.success || !photo || !consent) return;

    setIsSubmitting(true);
    try {
      const body = new FormData();
      body.append("image", new File([photo.blob], "portrait.jpg", { type: "image/jpeg" }));
      body.append("name", parsedName.data);
      body.append("consent", "true");
      await apiFetch("/api/people", { method: "POST", body });
      // Keep the form locked while navigating so the registration cannot be repeated.
      router.push("/people");
    } catch (error) {
      setRequestError(
        error instanceof ApiError
          ? error
          : new ApiError("No se pudo registrar el rostro.", "unknown", null),
      );
      setIsSubmitting(false);
    }
  }

  const photoError = errors.photo ?? photoProcessingError;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <TextField
        value={name}
        onChange={(value) => {
          setName(value);
          if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
        }}
        isInvalid={Boolean(errors.name)}
        isDisabled={isSubmitting}
        validationBehavior="aria"
        name="name"
        autoComplete="off"
        fullWidth
      >
        <Label>Nombre</Label>
        <Input className="min-h-11 rounded-[10px] border border-border shadow-none" />
        <FieldError>{errors.name}</FieldError>
      </TextField>

      <div className="flex flex-col gap-3">
        <span id="photo-label" className="text-sm font-medium">
          Foto
        </span>
        {photo ? (
          <div className="flex flex-col items-start gap-3">
            <div className="flex w-full justify-center overflow-hidden rounded-2xl bg-surface-secondary">
              {/* The preview is the exact normalized blob that will be uploaded. */}
              <img
                src={photo.url}
                alt="Vista previa de la foto elegida"
                width={photo.width}
                height={photo.height}
                className="block h-auto max-h-80 w-auto max-w-full"
              />
            </div>
            <PhotoPicker
              label="Cambiar foto"
              variant="ghost"
              isDisabled={isSubmitting || isProcessing}
              onFile={(file) => {
                setErrors((current) => ({ ...current, photo: undefined }));
                void select(file);
              }}
            />
          </div>
        ) : (
          <div
            aria-labelledby="photo-label"
            className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-surface px-6 py-8 text-center"
          >
            <p className="text-sm text-muted">La foto debe contener exactamente un rostro.</p>
            <PhotoPicker
              label={isProcessing ? "Preparando foto…" : "Elegir foto"}
              isDisabled={isSubmitting || isProcessing}
              describedBy={photoError ? "photo-error" : undefined}
              onFile={(file) => {
                setErrors((current) => ({ ...current, photo: undefined }));
                void select(file);
              }}
            />
          </div>
        )}
        {photo ? (
          <p className="text-sm text-muted">La foto debe contener exactamente un rostro.</p>
        ) : null}
        {photoError ? (
          <p id="photo-error" role="alert" className="text-sm text-danger">
            {photoError}
          </p>
        ) : null}
      </div>

      <Checkbox
        isSelected={consent}
        onChange={(value) => {
          setConsent(value);
          if (value) setErrors((current) => ({ ...current, consent: undefined }));
        }}
        isInvalid={Boolean(errors.consent)}
        isDisabled={isSubmitting}
        validationBehavior="aria"
        name="consent"
        value="true"
      >
        <Checkbox.Content>
          <Checkbox.Control className="border border-border shadow-none">
            <Checkbox.Indicator />
          </Checkbox.Control>
          <span className="text-sm leading-snug">
            Acepto registrar este rostro para reconocerlo en esta demo. El nombre aparecerá en la
            lista compartida.
          </span>
        </Checkbox.Content>
        <FieldError className="text-danger">{errors.consent}</FieldError>
      </Checkbox>

      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          variant="primary"
          fullWidth
          isPending={isSubmitting}
          isDisabled={isProcessing}
          className={buttonShape}
        >
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              {isPending ? "Registrando…" : "Registrar rostro"}
            </>
          )}
        </Button>
        <div role="status" aria-live="polite" className="min-h-5 text-sm">
          {isSubmitting ? <span className="text-muted">Registrando el rostro…</span> : null}
        </div>
        {requestError ? (
          <p role="alert" className="text-sm text-danger">
            {requestError.message}
            {requestError.requestId ? (
              <span className="mt-1 block text-muted">
                ID de solicitud: {requestError.requestId}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </form>
  );
}
