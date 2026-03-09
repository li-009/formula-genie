import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FormulaGenie - Natural Language to Excel Formulas",
  description:
    "Type what you want in plain language, get a working Excel or Google Sheets formula instantly. Free, fast, no signup.",
  keywords: [
    "excel formula",
    "google sheets formula",
    "natural language",
    "formula converter",
    "VLOOKUP",
    "INDEX MATCH",
    "spreadsheet",
  ],
  openGraph: {
    title: "FormulaGenie - Natural Language to Excel Formulas",
    description:
      "Stop Googling formulas. Just describe what you need and get a working formula instantly.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#0a0a0f] text-gray-100">
        {children}
      </body>
    </html>
  );
}
