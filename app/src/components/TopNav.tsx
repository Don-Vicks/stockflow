"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

// Wallet button touches browser wallet extensions — client-only.
const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/flows", label: "Flows" },
  { href: "/pay", label: "Pay" },
  { href: "/borrow", label: "Borrow" },
  { href: "/activity", label: "Activity" },
];

export function TopNav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-line bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="font-mono text-sm tracking-tight text-paper">stockflow</span>
        <nav className="flex items-center gap-6 font-mono text-sm text-muted">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-paper">
              {link.label}
            </Link>
          ))}
        </nav>
        <WalletMultiButton />
      </div>
    </header>
  );
}
