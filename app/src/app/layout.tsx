import type { Metadata } from "next";
// Requires network access to fonts.googleapis.com at build time. If
// you're building on a restricted network (some hackathon venues lock
// this down), switch to next/font/local with self-hosted .woff2 files
// instead — verified against this exact failure mode while building
// this scaffold (see docs/FEASIBILITY.md).
import { Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletContextProvider } from "@/components/WalletContextProvider";

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "StockFlow",
  description:
    "A financial operating layer for tokenized stocks — access liquidity, spend without selling, automate financial behavior, and protect your portfolio.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="bg-ink text-paper antialiased">
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
      </body>
    </html>
  );
}
