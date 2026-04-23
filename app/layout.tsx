import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MERCADO NEGRO",
  description: "Jogo multiplayer em tempo real. Tire itens do saco, evite as ameaças e domine o Mercado Negro.",
  openGraph: {
    title: "MERCADO NEGRO",
    description: "Jogo multiplayer em tempo real. Tire itens do saco, evite as ameaças e domine o Mercado Negro.",
    url: "https://riskbag.netlify.app",
    siteName: "MERCADO NEGRO",
    images: [
      {
        url: "/screenshots/hero-banner.png",
        width: 1200,
        height: 630,
        alt: "Mercado Negro — Gameplay",
      },
    ],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
