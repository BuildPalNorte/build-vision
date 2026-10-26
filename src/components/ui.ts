import { buttonVariants } from "@heroui/react";

/** Shared button shape: 44px minimum height, pill radius, ~20px horizontal padding. */
export const buttonShape = "min-h-11 px-5 rounded-full text-base font-medium";

type LinkButtonVariant = "primary" | "tertiary" | "ghost";

/** Class names that make a Next.js `Link` look like a HeroUI button. */
export function linkButtonClass(variant: LinkButtonVariant = "primary") {
  return buttonVariants({ variant, className: `${buttonShape} no-underline` });
}

export const pageClass = "mx-auto w-full max-w-[960px] pt-12 pb-16";
export const h1Class = "text-[28px] sm:text-[32px] font-semibold leading-tight tracking-tight";
