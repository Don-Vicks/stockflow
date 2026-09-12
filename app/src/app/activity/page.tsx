"use client";

import { useEffect, useState } from "react";
import { useStockFlow } from "@/hooks/useStockFlow";
import { CONFIG } from "@stockflow/sdk";

type TxRow = {
  signature: string;
  slot: number;
  blockTime: number | null | undefined;
  err: boolean;
};

/**
 * Activity feed — PRD §34.
 *
 * Reads recent transactions touching the StockFlow program via
 * `getSignaturesForAddress`. No extra indexing infrastructure needed for
 * the MVP — every Flow execution appears here because `execute_flow`
 * emits a transaction signed by the program account.
 *
 * Future: swap the raw signatures for a parsed log from the automation
 * worker or a dedicated transaction indexer once one is available.
 */
export default function ActivityPage() {
  const { client, isConnected } = useStockFlow();
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    setLoading(true);
    setError(null);

    client.connection
      .getSignaturesForAddress(CONFIG.devnet.stockflowProgramId, { limit: 20 })
      .then((sigs) =>
        setTxs(
          sigs.map((s) => ({
            signature: s.signature,
            slot: s.slot,
            blockTime: s.blockTime,
            err: !!s.err,
          }))
        )
      )
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [client]);

  function timeLabel(blockTime: number | null | undefined, slot: number): string {
    if (!blockTime) return `Slot ${slot.toLocaleString()}`;
    const date = new Date(blockTime * 1000);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-paper">Activity</h1>

      {!isConnected && (
        <p className="font-mono text-sm text-muted">
          Connect your wallet to view activity.
        </p>
      )}

      {isConnected && error && (
        <div className="rounded-md border border-alert bg-panel px-4 py-3">
          <p className="font-mono text-xs text-alert">{error}</p>
        </div>
      )}

      {isConnected && loading && (
        <p className="font-mono text-sm text-muted animate-pulse">Loading…</p>
      )}

      {isConnected && !loading && !error && txs.length === 0 && (
        <div className="rounded-md border border-line bg-panel p-8 text-center">
          <p className="font-mono text-sm text-muted">
            No transactions found for the StockFlow program on devnet yet.
          </p>
          <p className="font-mono text-xs text-muted mt-2">
            Transactions will appear here once Flows are created and executed.
          </p>
        </div>
      )}

      {txs.length > 0 && (
        <div className="divide-y divide-line rounded-md border border-line bg-panel">
          {txs.map((tx) => (
            <div
              key={tx.signature}
              className="flex items-start justify-between px-5 py-4"
            >
              <div className="space-y-0.5">
                <p
                  className={`font-mono text-sm ${
                    tx.err ? "text-alert" : "text-paper"
                  }`}
                >
                  {tx.err ? "✗" : "✓"}{" "}
                  {tx.signature.slice(0, 12)}…{tx.signature.slice(-6)}
                </p>
                <p className="font-mono text-xs text-muted">
                  {timeLabel(tx.blockTime, tx.slot)}
                </p>
              </div>
              <a
                href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-signal hover:underline shrink-0 ml-4"
              >
                Explorer ↗
              </a>
            </div>
          ))}
        </div>
      )}

      {isConnected && !loading && txs.length > 0 && (
        <p className="font-mono text-xs text-muted text-center">
          Showing last 20 transactions · Program:{" "}
          {CONFIG.devnet.stockflowProgramId.toBase58().slice(0, 8)}…
        </p>
      )}
    </div>
  );
}
