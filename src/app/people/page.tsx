import Link from "next/link";
import { PeopleList } from "@/components/people-list";
import { h1Class, linkButtonClass, pageClass } from "@/components/ui";

export default function PeoplePage() {
  return (
    <section className={pageClass}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className={h1Class}>Personas</h1>
        <Link href="/people/new" className={linkButtonClass("primary")}>
          Registrar rostro
        </Link>
      </div>
      <div className="mt-12">
        <PeopleList />
      </div>
    </section>
  );
}
