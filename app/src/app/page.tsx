"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPortfolio } from "@stockflow/sdk";
import type { PortfolioSummary } from "@stockflow/sdk";
import { useStockFlow } from "@/hooks/useStockFlow";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

type RiskState = {
  label: "HEALTHY" | "WARNING" | "RESTRICTED" | "PAUSED";
  textColor: string;
  barColor: string;
};

/** PRD §17 — four risk states driven by LTV vs. the user's configured max. */
function classifyRisk(ltvBps: number, maxLtvBps: number): RiskState {
  if (ltvBps > maxLtvBps)
    return { label: "PAUSED", textColor: "text-alert", barColor: "bg-alert" };
  if (ltvBps > maxLtvBps * 0.875)
    return { label: "RESTRICTED", textColor: "text-orange-400", barColor: "bg-orange-400" };
  if (ltvBps > maxLtvBps * 0.75)
    return { label: "WARNING", textColor: "text-yellow-400", barColor: "bg-yellow-400" };
  return { label: "HEALTHY", textColor: "text-signal", barColor: "bg-signal" };
}

// ── sub-components ────────────────────────────────────────────────────────────

function RiskBar({
  ltvBps,
  maxLtvBps,
}: {
  ltvBps: number;
  maxLtvBps: number;
}) {
  const pct = Math.min((ltvBps / maxLtvBps) * 100, 100);
  const { barColor } = classifyRisk(ltvBps, maxLtvBps);
  return (
    <div className="space-y-1">
      <div className="flex justify-between font-mono text-xs text-muted">
        <span>0%</span>
        <span>
          {(ltvBps / 100).toFixed(1)}% / {(maxLtvBps / 100).toFixed(0)}% LTV
        </span>
      </div>
      <div className="h-1 rounded-full bg-line">
        <div
          className={`h-1 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="h-16 w-48 rounded bg-panel" />
      <div className="h-32 rounded-md bg-panel" />
      <div className="h-24 rounded-md bg-panel" />
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

const MAX_LTV_BPS = 4000; // 40% — matches the PRD's demo throughout

export default function DashboardPage() {
  const { client, owner, isConnected } = useStockFlow();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !owner) {
      setPortfolio(null);
      return;
    }
    setLoading(true);
    setError(null);
    getPortfolio(client, owner)
      .then(setPortfolio)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [client, owner]);

  // ── disconnected ──────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="font-mono text-sm text-muted">
          Connect your wallet to view your portfolio.
        </p>
      </div>
    );
  }

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="rounded-md border border-alert bg-panel px-4 py-3">
        <p className="font-mono text-xs text-alert">Error loading portfolio: {error}</p>
      </div>
    );
  }

  if (!portfolio) return null;

  const risk = classifyRisk(portfolio.currentLtvBps, MAX_LTV_BPS);

  // ── connected + loaded ────────────────────────────────────────────────────
  return (
    <div className="space-y-10">
      {/* Price-feed notice — honest about the $0 USD values until Phase 3
          wires Chainlink / Jupiter pricing. Never shows fake numbers. */}
      {portfolio.totalValueUsd === 0 && portfolio.holdings.length > 0 && (
        <div className="rounded-md border border-line bg-panel px-4 py-3">
          <p className="font-mono text-xs text-muted">
            ⚠ Price feed pending — token balances are live, USD values will
            appear after the price integration is wired (Phase 3 of the
            implementation plan).
          </p>
        </div>
      )}

      {/* Total portfolio value */}
      <section>
        <p className="font-mono text-xs uppercase tracking-wide text-muted">
          Your portfolio
        </p>
        <p className="font-display text-6xl text-paper">
          {fmt(portfolio.totalValueUsd)}
        </p>
      </section>

      {/* Holdings */}
      <section className="rounded-md border border-line bg-panel px-5">
        {portfolio.holdings.length === 0 ? (
          <div className="ledger-row">
            <span className="font-mono text-sm text-muted">
              No token accounts found for this wallet on devnet.
            </span>
          </div>
        ) : (
          portfolio.holdings.map((h) => (
            <div key={h.mint.toBase58()} className="ledger-row">
              <span className="font-mono text-sm text-muted">{h.symbol}</span>
              <span className="font-mono text-sm text-paper">
                {h.uiAmount.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                {h.valueUsd > 0 && (
                  <span className="text-muted ml-2">· {fmt(h.valueUsd)}</span>
                )}
              </span>
            </div>
          ))
        )}
      </section>

      {/* Liquidity + risk */}
      <section className="rounded-md border border-line bg-panel px-5">
        <div className="ledger-row">
          <span className="font-mono text-sm text-muted">Liquidity available</span>
          <span className="font-mono text-sm text-signal">
            {fmt(portfolio.availableLiquidityUsd)}
          </span>
        </div>
        <div className="ledger-row">
          <span className="font-mono text-sm text-muted">Current LTV</span>
          <span className="font-mono text-sm text-paper">
            {(portfolio.currentLtvBps / 100).toFixed(1)}%
          </span>
        </div>
        <div className="ledger-row">
          <span className="font-mono text-sm text-muted">Risk state</span>
          <span className={`font-mono text-sm ${risk.textColor}`}>
            {risk.label}
          </span>
        </div>
      </section>

      {/* LTV bar — PRD §17 */}
      <RiskBar ltvBps={portfolio.currentLtvBps} maxLtvBps={MAX_LTV_BPS} />

      {/* CTAs — PRD §9.1 */}
      <section className="flex gap-3 flex-wrap">
        <Link href="/flows/new" className="btn">
          Create Flow
        </Link>
        <Link href="/pay" className="btn">
          Pay
        </Link>
        <Link href="/borrow" className="btn">
          Borrow
        </Link>
      </section>
    </div>
  );
}
