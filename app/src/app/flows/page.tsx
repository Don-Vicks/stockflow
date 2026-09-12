"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStockFlow } from "@/hooks/useStockFlow";
import { CONFIG } from "@stockflow/sdk";

import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";

// Flow::SIZE constant mirrors the Rust program's account size so we can
// filter accounts by data length — discriminator(8) + owner(32) + flow_id(8)
// + Trigger(17) + Action(9) + Source(33) + Constraints(10) + destination(32)
// + status(1) + last_executed_at(8) + created_at(8) + bump(1) = 167.
// Must be kept in sync with state/flow.rs Flow::SIZE.
const FLOW_ACCOUNT_SIZE = 167;

type FlowRow = {
  address: string;
  /** Whether the account is active — stubbed to true until the IDL
   *  deserialization lands in Phase 3 and we can read the status field. */
  active: boolean;
};

export default function FlowsPage() {
  const { client, owner, isConnected } = useStockFlow();
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !owner) {
      setFlows([]);
      return;
    }
    setLoading(true);
    setError(null);

    client.connection
      .getProgramAccounts(CONFIG.devnet.stockflowProgramId, {
        filters: [
          // Match accounts of exactly Flow::SIZE bytes.
          { dataSize: FLOW_ACCOUNT_SIZE },
          // Match the owner field at offset 8 (past the 8-byte discriminator).
          // This is the most efficient on-chain filter available before the
          // IDL's named type filters become usable post-anchor-build.
          { memcmp: { offset: 8, bytes: owner.toBase58() } },
        ],
      })
      .then((accounts) => {
        setFlows(
          accounts.map(({ pubkey }) => ({
            address: pubkey.toBase58(),
            // Full status deserialization requires the IDL — defaulting to
            // active and reading the real field once Phase 3 is complete.
            active: true,
          }))
        );
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [client, owner]);

  return (
    <main>
      <TopNav />
      <div className="max-w-4xl mx-auto px-6 py-12 min-h-screen">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-3xl text-paper">My Flows</h1>
            <Link href="/flows/new" className="flex items-center gap-2 rounded-lg bg-paper text-ink px-5 py-2.5 font-mono text-sm font-semibold hover:bg-white transition-colors">
              + Create Flow
            </Link>
          </div>

          {!isConnected && (
            <p className="font-mono text-sm text-muted">
              Connect your wallet to view your Flows.
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

          {isConnected && !loading && !error && flows.length === 0 && (
            <div className="rounded-md border border-dashed border-line bg-panel p-16 text-center space-y-3 mt-12">
              <p className="font-mono text-sm text-muted">No Flows yet.</p>
              <Link
                href="/flows/new"
                className="font-mono text-sm text-signal hover:underline inline-block"
              >
                Create your first Flow →
              </Link>
            </div>
          )}

          {flows.length > 0 && (
            <div className="divide-y divide-line rounded-md border border-line bg-panel">
              {flows.map((flow) => (
                <Link
                  key={flow.address}
                  href={`/flows/${flow.address}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-panel/80 transition-colors"
                >
                  <div>
                    {/* Address displayed until IDL deserialization gives us a
                        human-readable name / trigger description (Phase 3). */}
                    <p className="font-mono text-sm text-paper">
                      {flow.address.slice(0, 8)}…{flow.address.slice(-8)}
                    </p>
                    <p className="font-mono text-xs text-muted">
                      {flow.address}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-xs ${
                      flow.active ? "text-signal" : "text-muted"
                    }`}
                  >
                    ● {flow.active ? "ACTIVE" : "PAUSED"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </main>
  );
}
