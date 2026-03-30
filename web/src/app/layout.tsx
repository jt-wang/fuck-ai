import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "fuck-ai — Is your AI model being dumb right now?",
  description:
    "Real-time crowd-sourced frustration index for AI models. The crowd knows when your AI is being dumb.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${mono.variable} dark`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
