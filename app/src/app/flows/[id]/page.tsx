"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { pauseFlow, resumeFlow } from "@stockflow/sdk";
import { useStockFlow } from "@/hooks/useStockFlow";
import Link from "next/link";

// Canonical Flow status — read from the status byte once IDL deserialization
// lands in Phase 3. Until then we optimistically show "Active" and let the
// pause / resume calls update local state.
type FlowStatus = "Active" | "Paused";

export default function FlowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { client, isConnected } = useStockFlow();

  const [exists, setExists] = useState<boolean | null>(null);
  const [status, setStatus] = useState<FlowStatus>("Active");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Validate the address param before doing any RPC calls.
  let flowAddress: PublicKey | null = null;
  try {
    flowAddress = new PublicKey(id);
  } catch {
    // id is not a valid base58/32-byte pubkey.
  }

  // Confirm the account exists on-chain.
  useEffect(() => {
    if (!client || !flowAddress) return;
    client.connection
      .getAccountInfo(flowAddress)
      .then((info) => setExists(info !== null))
      .catch(() => setExists(false));
  }, [client, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── actions ────────────────────────────────────────────────────────────────

  async function handlePause() {
    if (!client || !flowAddress) return;
    setBusy(true);
    setError(null);
    try {
      await pauseFlow(client, flowAddress);
      setStatus("Paused");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleResume() {
    if (!client || !flowAddress) return;
    setBusy(true);
    setError(null);
    try {
      await resumeFlow(client, flowAddress);
      setStatus("Active");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // ── guard: invalid address ─────────────────────────────────────────────────

  if (!flowAddress) {
    return (
      <div className="space-y-4">
        <Link href="/flows" className="font-mono text-xs text-muted hover:text-paper">
          ← Flows
        </Link>
        <p className="font-mono text-sm text-alert">
          Invalid Flow address: {id}
        </p>
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Back nav */}
      <div className="flex items-center gap-4">
        <Link href="/flows" className="font-mono text-xs text-muted hover:text-paper">
          ← Flows
        </Link>
        <h1 className="font-display text-3xl text-paper">Flow</h1>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-alert bg-panel px-4 py-3">
          <p className="font-mono text-xs text-alert">{error}</p>
        </div>
      )}

      {/* Not connected */}
      {!isConnected && (
        <div className="rounded-md border border-line bg-panel px-4 py-3">
          <p className="font-mono text-xs text-muted">
            Connect your wallet to manage this Flow.
          </p>
        </div>
      )}

      {/* On-chain summary */}
      <section className="rounded-md border border-line bg-panel px-5">
        <div className="ledger-row">
          <span className="font-mono text-sm text-muted">Address</span>
          <span className="font-mono text-xs text-paper">
            {id.slice(0, 8)}…{id.slice(-8)}
          </span>
        </div>
        <div className="ledger-row">
          <span className="font-mono text-sm text-muted">Status</span>
          <span
            className={`font-mono text-sm ${
              status === "Active" ? "text-signal" : "text-muted"
            }`}
          >
            ● {status.toUpperCase()}
          </span>
        </div>
        <div className="ledger-row">
          <span className="font-mono text-sm text-muted">On-chain account</span>
          <span
            className={`font-mono text-xs ${
              exists === null
                ? "text-muted"
                : exists
                ? "text-signal"
                : "text-alert"
            }`}
          >
            {exists === null ? "checking…" : exists ? "confirmed" : "not found"}
          </span>
        </div>
      </section>

      {/* Phase 3 notice — shown while the IDL isn't yet generated */}
      {exists !== null && (
        <div className="rounded-md border border-line bg-panel px-4 py-3">
          <p className="font-mono text-xs text-muted">
            Full Flow details (trigger schedule, amount, recipient, LTV, execution
            history) require the Anchor IDL. Run{" "}
            <code className="text-signal">anchor build</code> and wire the SDK
            (Phase 3 of the plan) to unlock account deserialization.
          </p>
        </div>
      )}

      {/* Actions — PRD §31: every Flow must have Pause / Edit / Revoke */}
      {isConnected && (
        <section className="flex gap-3 flex-wrap">
          {status === "Active" ? (
            <button onClick={handlePause} disabled={busy} className="btn">
              {busy ? "…" : "Pause"}
            </button>
          ) : (
            <button onClick={handleResume} disabled={busy} className="btn">
              {busy ? "…" : "Resume"}
            </button>
          )}
          <a
            href={`https://explorer.solana.com/address/${id}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
          >
            View on Explorer ↗
          </a>
        </section>
      )}
    </div>
  );
}
