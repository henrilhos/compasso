import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compasso | Agenda de eventos",
  description:
    "Eventos e shows das cidades cobertas, reunidos de vários sites de ingresso.",
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
