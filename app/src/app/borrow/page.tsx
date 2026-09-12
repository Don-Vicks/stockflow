"use client";

import { useEffect, useState } from "react";
import { getPortfolio, createFlow } from "@stockflow/sdk";
import type { PortfolioSummary, FlowSpec } from "@stockflow/sdk";
import { useStockFlow } from "@/hooks/useStockFlow";

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
    <div className="max-w-md space-y-6">
      <h1 className="font-display text-3xl text-paper">Borrow</h1>

      {!isConnected && (
        <p className="font-mono text-sm text-muted">
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
      <section className="rounded-md border border-line bg-panel px-5">
        <div className="ledger-row">
          <span className="font-mono text-sm text-muted">Portfolio value</span>
          <span className="font-mono text-sm text-paper">
            {portfolio
              ? `$${portfolio.totalValueUsd.toLocaleString()}`
              : "—"}
          </span>
        </div>
        <div className="ledger-row">
          <span className="font-mono text-sm text-muted">Available liquidity</span>
          <span className="font-mono text-sm text-signal">
            {portfolio
              ? `$${portfolio.availableLiquidityUsd.toLocaleString()}`
              : "—"}
          </span>
        </div>
      </section>

      {/* Borrow form */}
      <section className="space-y-4 rounded-md border border-line bg-panel p-5">
        <label className="space-y-1 block">
          <span className="block font-mono text-xs text-muted">
            Amount to borrow (USDC)
          </span>
          <input
            className="field-input"
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>

        <div className="ledger-row">
          <span className="font-mono text-sm text-muted">LTV after borrow</span>
          <span
            className={`font-mono text-sm ${ltvSafe ? "text-paper" : "text-alert"}`}
          >
            {ltvAfter.toFixed(1)}%{!ltvSafe && " — exceeds 40% limit"}
          </span>
        </div>

        <button
          onClick={handleBorrow}
          disabled={!isConnected || busy || !ltvSafe || amountNum <= 0}
          className="btn w-full border-signal text-signal hover:bg-signal hover:text-ink"
        >
          {busy ? "Submitting…" : `Borrow $${amount || 0} USDC`}
        </button>
      </section>
    </div>
  );
}
