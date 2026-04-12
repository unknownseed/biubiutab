import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/navbar";
import AiOfflineBanner from "@/components/ai-offline-banner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Biubiutab",
  description: "Upload audio and generate a clean, playable chord + tab sheet in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[radial-gradient(900px_circle_at_10%_0%,rgba(37,99,235,0.18),transparent_55%),radial-gradient(900px_circle_at_100%_20%,rgba(249,115,22,0.14),transparent_55%)]">
        <Providers>
          <Navbar />
          <AiOfflineBanner />
          <div className="pt-4">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
