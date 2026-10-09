import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

// The design system ships no font files; latin-ext covers Czech diacritics.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

const metadata: Metadata = {
  title: "MDRepo",
  description: "Molecular dynamics repository",
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en" className={inter.variable}>
    <body className="bg-background text-text min-h-screen antialiased">
      <Providers>{children}</Providers>
    </body>
  </html>
);

export { metadata };
export default RootLayout;
