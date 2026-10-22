import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "katex/dist/katex.min.css";

// Same Plus Jakarta Sans family, bundled locally to make builds reproducible.
const fontSans = localFont({
  src: "../public/fonts/plus-jakarta-sans-latin.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AET AI — Asisten Cerdas Mahasiswa AET PCR",
  description:
    "Platform AI Himpunan Mahasiswa AET Politeknik Caltex Riau. Chat cerdas untuk coding, penulisan akademik, dan diskusi sehari-hari.",
  keywords: [
    "AET PCR",
    "AI Assistant",
    "Politeknik Caltex Riau",
    "himpunan mahasiswa",
  ],
  authors: [{ name: "AET PCR", url: "https://tet.pcr.ac.id" }],
  openGraph: {
    title: "AET AI — Asisten Cerdas Mahasiswa AET PCR",
    description: "Platform AI Himpunan Mahasiswa AET Politeknik Caltex Riau.",
    type: "website",
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: "AET AI — Asisten Cerdas Mahasiswa AET PCR",
    description: "Platform AI Himpunan Mahasiswa AET Politeknik Caltex Riau.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${fontSans.variable} font-sans antialiased bg-slate-50 text-slate-900`}
      >
        {children}
      </body>
    </html>
  );
}
