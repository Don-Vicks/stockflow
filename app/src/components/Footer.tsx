import Link from "next/link";
import { Globe, MessageCircle, Disc } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-line bg-ink pt-16 pb-8">
      <div className="mx-auto max-w-5xl px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <div className="col-span-1 md:col-span-2">
          <span className="font-display text-2xl text-paper tracking-tight">stockflow</span>
          <p className="mt-4 font-mono text-sm text-muted max-w-sm leading-relaxed">
            The financial operating layer for tokenized equity. Automate your portfolio, unlock liquidity, and spend without selling on Solana.
          </p>
        </div>
        <div>
          <h4 className="font-mono text-xs uppercase tracking-wide text-paper mb-4">Protocol</h4>
          <ul className="space-y-3 font-mono text-sm text-muted">
            <li><Link href="/markets" className="hover:text-signal transition-colors">Markets</Link></li>
            <li><Link href="/developers" className="hover:text-signal transition-colors">Developers</Link></li>
            <li><Link href="/security" className="hover:text-signal transition-colors">Security & Audits</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-mono text-xs uppercase tracking-wide text-paper mb-4">Community</h4>
          <ul className="space-y-3 font-mono text-sm text-muted">
            <li><a href="#" className="flex items-center gap-2 hover:text-signal transition-colors"><MessageCircle className="w-4 h-4" /> Community</a></li>
            <li><a href="#" className="flex items-center gap-2 hover:text-signal transition-colors"><Disc className="w-4 h-4" /> Discord</a></li>
            <li><a href="#" className="flex items-center gap-2 hover:text-signal transition-colors"><Globe className="w-4 h-4" /> Website</a></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-6 pt-8 border-t border-line flex flex-col md:flex-row items-center justify-between font-mono text-xs text-muted">
        <p>© 2026 StockFlow Protocol. All rights reserved.</p>
        <div className="flex gap-4 mt-4 md:mt-0">
          <Link href="/terms" className="hover:text-paper">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-paper">Privacy Policy</Link>
        </div>
      </div>
    </footer>
  );
}
