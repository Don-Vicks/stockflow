"use client";

import { useEffect, useState } from "react";
import { getPortfolio, createFlow } from "@stockflow/sdk";
import type { PortfolioSummary, FlowSpec } from "@stockflow/sdk";
import { useStockFlow } from "@/hooks/useStockFlow";

import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";

export default function BorrowPage() {
  const { client, owner, isConnected } = useStockFlow();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [amount, setAmount] = useState("2000");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  // Load live portfolio so we can show real available liquidity + projected
  // LTV — replaces the previous static const.
  useEffect(() => {
    if (!client || !owner) { setPortfolio(null); return; }
    getPortfolio(client, owner)
      .then(setPortfolio)
      .catch(console.error);
  }, [client, owner]);

  const amountNum = Number(amount || 0);
  const ltvAfter = portfolio?.totalValueUsd
    ? (amountNum / portfolio.totalValueUsd) * 100
    : 0;

  // Safe to borrow if projected LTV stays under the protocol limit of 40%.
  const ltvSafe = ltvAfter <= 40;

  async function handleBorrow() {
    if (!client || !owner) return;
    setBusy(true);
    setError(null);
    setSuccess(false);

    // A one-off OnDemand Borrow flow — the user explicitly requests a
    // borrow here rather than scheduling it. The amount is the collateral
    // shortfall the user wants to draw against Kamino.
    const amountUnits = BigInt(Math.round(amountNum * 1_000_000)); // USDC 6dp
    const spec: FlowSpec = {
      flowId: BigInt(Date.now()),
      owner,
      trigger: { kind: "OnDemand" },
      action: { kind: "Borrow", amount: amountUnits },
      source: { kind: "StablecoinOnly" },
      constraints: {
        maxAmount: amountUnits,
        maxLtvBps: 4000, // 40% — protocol ceiling
      },
      destination: owner, // Borrow destination is the owner's own wallet
    };

    try {
      await createFlow(client, spec);
      setSuccess(true);
    } catch (e: unknown) {
      // createFlow throws until the Anchor IDL is generated (Phase 3).
      // Error message is actionable — displayed in the banner.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <TopNav />
      <div className="max-w-4xl mx-auto px-6 py-12 min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          <h1 className="font-display text-3xl text-paper mb-6 text-center">Borrow USDC</h1>

          {!isConnected && (
            <p className="font-mono text-sm text-muted text-center">
              Connect your wallet to borrow.
            </p>
          )}

          {error && (
            <div className="rounded-md border border-alert bg-panel px-4 py-3">
              <p className="font-mono text-xs text-alert">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-md border border-signal bg-panel px-4 py-3">
              <p className="font-mono text-xs text-signal">Borrow submitted.</p>
            </div>
          )}

          {/* Portfolio context */}
          <section className="rounded-xl border border-line bg-panel p-6 shadow-sm mb-6">
            <div className="flex justify-between items-center py-2 border-b border-line">
              <span className="font-mono text-sm text-muted">Portfolio Value</span>
              <span className="font-mono text-sm text-paper font-semibold">
                {portfolio
                  ? `$${portfolio.totalValueUsd.toLocaleString()}`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 pt-4">
              <span className="font-mono text-sm text-muted">Available Liquidity</span>
              <span className="font-mono text-sm text-signal font-semibold">
                {portfolio
                  ? `$${portfolio.availableLiquidityUsd.toLocaleString()}`
                  : "—"}
              </span>
            </div>
          </section>

          {/* Borrow form */}
          <section className="space-y-6 rounded-xl border border-line bg-panel p-8 shadow-sm">
            <label className="space-y-2 block">
              <span className="block font-mono text-xs text-muted uppercase tracking-wider">
                Amount to Borrow (USDC)
              </span>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-muted font-mono">$</span>
                </div>
                <input
                  className="w-full bg-ink border border-line rounded-lg pl-8 pr-4 py-2.5 text-paper focus:outline-none focus:border-signal font-mono"
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </label>

            <div className="flex justify-between items-center py-2">
              <span className="font-mono text-sm text-muted">LTV after borrow</span>
              <span
                className={`font-mono text-sm font-semibold ${ltvSafe ? "text-paper" : "text-alert"}`}
              >
                {ltvAfter.toFixed(1)}%{!ltvSafe && " (Exceeds Limit)"}
              </span>
            </div>

            <button
              onClick={handleBorrow}
              disabled={!isConnected || busy || !ltvSafe || amountNum <= 0}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-paper text-ink px-5 py-3 font-mono text-sm font-semibold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {busy ? "Submitting…" : `Borrow $${amount || 0} USDC`}
            </button>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
