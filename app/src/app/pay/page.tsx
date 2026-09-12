"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { createFlow } from "@stockflow/sdk";
import type { FlowSpec, Source } from "@stockflow/sdk";
import { CONFIG } from "@stockflow/sdk";
import { useStockFlow } from "@/hooks/useStockFlow";

import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";

// The devnet NVDAx mint is unconfirmed — placeholder used until
// KNOWN_DEVNET_XSTOCK_MINTS is populated (Phase 1 of the plan).
// The form still lets the user choose the fallback option; we surface
// the error at submission time rather than hiding the option.
const PLACEHOLDER_NVDAX_MINT = new PublicKey(
  "11111111111111111111111111111111" // System program pubkey — safe placeholder
);

export default function PayPage() {
  const { client, owner, isConnected } = useStockFlow();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [fundingMode, setFundingMode] = useState<"usdc" | "borrow-nvda">("usdc");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validate the recipient pubkey live so the user gets feedback before submit.
  let recipientPubkey: PublicKey | null = null;
  let recipientError: string | null = null;
  if (recipient.trim()) {
    try {
      recipientPubkey = new PublicKey(recipient.trim());
    } catch {
      recipientError = "Invalid Solana wallet address.";
    }
  }

  async function handlePay() {
    if (!client || !owner) return;
    if (!recipientPubkey) {
      setError("Enter a valid recipient wallet address.");
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(false);

    const amountUnits = BigInt(Math.round(amountNum * 1_000_000)); // USDC 6dp

    // Choose the funding source: USDC-only or USDC-then-borrow.
    // The borrow fallback needs a confirmed collateral mint — surfaced as
    // an error at runtime until KNOWN_DEVNET_XSTOCK_MINTS is populated.
    const source: Source =
      fundingMode === "borrow-nvda"
        ? { kind: "StablecoinThenBorrow", collateralMint: PLACEHOLDER_NVDAX_MINT }
        : { kind: "StablecoinOnly" };

    // One-off OnDemand Pay flow — the user intends a single payment here,
    // not a scheduled recurring one (use Create Flow for that).
    const spec: FlowSpec = {
      flowId: BigInt(Date.now()),
      owner,
      trigger: { kind: "OnDemand" },
      action: { kind: "Pay", amount: amountUnits },
      source,
      constraints: {
        maxAmount: amountUnits,
        maxLtvBps: 4000,
      },
      destination: recipientPubkey,
    };

    try {
      await createFlow(client, spec);
      setSuccess(true);
    } catch (e: unknown) {
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
          <h1 className="font-display text-3xl text-paper mb-6 text-center">StockPay</h1>

          {!isConnected && (
            <p className="font-mono text-sm text-muted text-center">
              Connect your wallet to make a payment.
            </p>
          )}

          {error && (
            <div className="rounded-md border border-alert bg-panel px-4 py-3">
              <p className="font-mono text-xs text-alert">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-md border border-signal bg-panel px-4 py-3">
              <p className="font-mono text-xs text-signal">Payment submitted.</p>
            </div>
          )}

          <section className="space-y-6 rounded-xl border border-line bg-panel p-8 shadow-sm">
            <label className="space-y-2 block">
              <span className="block font-mono text-xs text-muted uppercase tracking-wider">Recipient Address</span>
              <input
                className="w-full bg-ink border border-line rounded-lg px-4 py-2.5 text-paper focus:outline-none focus:border-signal font-mono text-sm"
                placeholder="7xK...92P"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
              {recipientError && (
                <p className="font-mono text-xs text-alert mt-1">{recipientError}</p>
              )}
            </label>

            <label className="space-y-2 block">
              <span className="block font-mono text-xs text-muted uppercase tracking-wider">Amount (USDC)</span>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-muted font-mono">$</span>
                </div>
                <input
                  className="w-full bg-ink border border-line rounded-lg pl-8 pr-4 py-2.5 text-paper focus:outline-none focus:border-signal font-mono"
                  type="number"
                  min="0"
                  placeholder="500.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </label>

            <label className="space-y-2 block">
              <span className="block font-mono text-xs text-muted uppercase tracking-wider">Funding Source</span>
              <select
                className="w-full bg-ink border border-line rounded-lg px-4 py-2.5 text-paper focus:outline-none focus:border-signal appearance-none text-sm"
                value={fundingMode}
                onChange={(e) => setFundingMode(e.target.value as typeof fundingMode)}
              >
                <option value="usdc">USDC Balance Only</option>
                <option value="borrow-nvda">
                  USDC, then Borrow vs NVDAx
                </option>
              </select>
            </label>

            <button
              onClick={handlePay}
              disabled={!isConnected || busy || !!recipientError}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-paper text-ink px-5 py-3 font-mono text-sm font-semibold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {busy ? "Submitting…" : "Confirm Payment"}
            </button>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
