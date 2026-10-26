import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Viso Faces",
  description: "Registra un rostro y encuéntralo en otra fotografía.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="light" data-theme="light">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <SiteHeader />
        <main className="px-5 sm:px-8">{children}</main>
      </body>
    </html>
  );
}
