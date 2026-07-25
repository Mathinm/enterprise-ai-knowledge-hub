import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Enterprise AI Knowledge Hub",
  description:
    "RAG-powered enterprise knowledge retrieval using Google Gemini and ChromaDB",
  keywords: ["RAG", "enterprise AI", "knowledge base", "Gemini", "ChromaDB"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-inter antialiased`}>
        {children}
      </body>
    </html>
  );
}
