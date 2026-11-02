import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Upcoded CRM",
  description: "Operación comercial y prospección de Upcoded."
};

// viewport-fit=cover habilita env(safe-area-inset-*) para la barra inferior en móvil.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
