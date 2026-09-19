import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Upcoded CRM",
  description: "Operación comercial y prospección de Upcoded."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
