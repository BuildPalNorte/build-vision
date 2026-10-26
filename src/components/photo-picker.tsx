"use client";

import { Button } from "@heroui/react";
import { useRef } from "react";
import { buttonShape } from "@/components/ui";

type PhotoPickerProps = {
  label: string;
  variant?: "primary" | "tertiary" | "ghost";
  isDisabled?: boolean;
  describedBy?: string;
  onFile: (file: File) => void;
};

/** A button that opens the native file chooser for one JPEG or PNG photo. */
export function PhotoPicker({
  label,
  variant = "tertiary",
  isDisabled,
  describedBy,
  onFile,
}: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset so choosing the same file again still fires a change event.
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button
        variant={variant}
        isDisabled={isDisabled}
        aria-describedby={describedBy}
        className={variant === "ghost" ? `${buttonShape} -ml-5` : buttonShape}
        onPress={() => inputRef.current?.click()}
      >
        {label}
      </Button>
    </>
  );
}
