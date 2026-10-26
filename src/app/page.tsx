import Link from "next/link";
import { linkButtonClass } from "@/components/ui";

export default function HomePage() {
  return (
    <section className="mx-auto w-full max-w-[960px] pt-16 pb-24 sm:pt-28">
      <h1 className="max-w-[20ch] text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-[56px]">
        Caras conocidas. Sin complicaciones.
      </h1>
      <p className="mt-6 max-w-[44ch] text-lg text-muted">
        Registra un rostro y encuéntralo en otra fotografía.
      </p>
      <div className="mt-12 flex flex-wrap items-center gap-3">
        <Link href="/recognize" className={linkButtonClass("primary")}>
          Reconocer rostros
        </Link>
        <Link href="/people/new" className={linkButtonClass("ghost")}>
          Registrar un rostro
        </Link>
      </div>
    </section>
  );
}
