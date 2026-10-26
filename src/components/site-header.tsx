"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/people", label: "Personas" },
  { href: "/recognize", label: "Reconocer" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-divider bg-surface/80 px-5 backdrop-blur sm:px-8">
      <div className="mx-auto flex h-16 w-full max-w-[960px] items-center justify-between">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-lg font-semibold tracking-tight"
        >
          Viso Faces
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1">
          {links.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-3 text-[15px] transition-colors duration-150 hover:text-foreground ${
                  active ? "font-medium text-foreground" : "text-muted"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
