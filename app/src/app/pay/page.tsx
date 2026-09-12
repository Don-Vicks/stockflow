"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { createFlow } from "@stockflow/sdk";
import type { FlowSpec, Source } from "@stockflow/sdk";
import { CONFIG } from "@stockflow/sdk";
import { useStockFlow } from "@/hooks/useStockFlow";

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
    <div className="max-w-md space-y-6">
      <h1 className="font-display text-3xl text-paper">Pay</h1>

      {!isConnected && (
        <p className="font-mono text-sm text-muted">
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

      <section className="space-y-4 rounded-md border border-line bg-panel p-5">
        <label className="space-y-1 block">
          <span className="block font-mono text-xs text-muted">To</span>
          <input
            className="field-input"
            placeholder="7xK...92P"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
          {recipientError && (
            <p className="font-mono text-xs text-alert mt-1">{recipientError}</p>
          )}
        </label>

        <label className="space-y-1 block">
          <span className="block font-mono text-xs text-muted">Amount (USDC)</span>
          <input
            className="field-input"
            type="number"
            min="0"
            placeholder="500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>

        <label className="space-y-1 block">
          <span className="block font-mono text-xs text-muted">Funding</span>
          <select
            className="field-input"
            value={fundingMode}
            onChange={(e) => setFundingMode(e.target.value as typeof fundingMode)}
          >
            <option value="usdc">USDC balance only</option>
            <option value="borrow-nvda">
              USDC, then borrow against NVDAx if needed
            </option>
          </select>
        </label>

        <button
          onClick={handlePay}
          disabled={!isConnected || busy || !!recipientError}
          className="btn w-full border-signal text-signal hover:bg-signal hover:text-ink"
        >
          {busy ? "Submitting…" : "Pay"}
        </button>
      </section>
    </div>
  );
}
