import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compasso — Agenda de eventos de Joinville",
  description:
    "Eventos e shows de Joinville e região, reunidos de vários sites de ingresso.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
