import type { Metadata, Viewport } from "next";
import { Cinzel, Manrope } from "next/font/google";
import { BUSINESS } from "@/lib/business";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${BUSINESS.name} · Barbería en Baruta, Caracas`,
    template: `%s · ${BUSINESS.name}`,
  },
  description: `${BUSINESS.slogan}. Reserva tu cita en línea. ${BUSINESS.address}.`,
  openGraph: {
    title: BUSINESS.name,
    description: `${BUSINESS.slogan}. Reserva tu cita en línea.`,
    locale: "es_VE",
    type: "website",
    images: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${manrope.variable} ${cinzel.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
