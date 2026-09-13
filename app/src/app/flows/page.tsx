"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStockFlow } from "@/hooks/useStockFlow";
import { CONFIG } from "@stockflow/sdk";
import { Zap, Hand, ChevronRight } from "lucide-react";

import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";

type FlowRow = {
  address: string;
  trigger: any;
  action: any;
  status: any;
  createdAt: number;
};

function formatRelativeTime(unixSeconds: number) {
  const diffInSeconds = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diffInSeconds < 60) return "just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
}

function buildRuleSummary(trigger: any, action: any): string {
  let triggerStr = "";
  if (trigger.onDemand) {
    triggerStr = "On Demand";
  } else if (trigger.timeInterval) {
    const secs = trigger.timeInterval.intervalSeconds.toNumber();
    if (secs % 86400 === 0) triggerStr = `Every ${secs / 86400} days`;
    else if (secs % 3600 === 0) triggerStr = `Every ${secs / 3600} hours`;
    else triggerStr = `Every ${secs} seconds`;
  } else if (trigger.riskThreshold) {
    triggerStr = `If LTV > ${trigger.riskThreshold.ltvBps / 100}%`;
  }

  let actionStr = "";
  if (action.pay) actionStr = `Pay ${action.pay.amount.toNumber() / 1e6} USDC`;
  else if (action.borrow) actionStr = `Borrow ${action.borrow.amount.toNumber() / 1e6} USDC`;
  else if (action.repay) actionStr = `Repay ${action.repay.amount.toNumber() / 1e6} USDC`;
  else if (action.pauseSpending) actionStr = "Pause Spending";

  return `${triggerStr} → ${actionStr}`;
}

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

    (client.program.account as any).flow.all([
      { memcmp: { offset: 8, bytes: owner.toBase58() } },
    ])
      .then((accounts: any[]) => {
        setFlows(
          accounts.map(({ publicKey, account }: any) => ({
            address: publicKey.toBase58(),
            trigger: account.trigger,
            action: account.action,
            status: account.status,
            createdAt: account.createdAt.toNumber(),
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
            <div className="rounded-md border border-dashed border-line bg-panel p-16 text-center space-y-4 mt-12 flex flex-col items-center justify-center">
              <div className="h-12 w-12 rounded-full bg-panel border border-line flex items-center justify-center mb-2">
                <Zap className="h-6 w-6 text-muted" />
              </div>
              <p className="font-mono text-lg text-paper">No Flows yet</p>
              <p className="font-mono text-sm text-muted max-w-md mx-auto">
                Automate your portfolio with powerful on-chain rules.
              </p>
              <Link
                href="/flows/new"
                className="mt-4 flex items-center gap-2 rounded-lg bg-paper text-ink px-6 py-3 font-mono text-sm font-semibold hover:bg-white transition-colors"
              >
                Create your first Flow →
              </Link>
            </div>
          )}

          {flows.length > 0 && (
            <div className="divide-y divide-line rounded-md border border-line bg-panel">
              {flows.map((flow) => {
                const isAutomated = !flow.trigger.onDemand;
                
                let statusText = "ACTIVE";
                let statusColor = "text-signal";
                if (flow.status.paused) {
                  statusText = "PAUSED";
                  statusColor = "text-muted";
                } else if (flow.status.executed) {
                  statusText = "EXECUTED";
                  statusColor = "text-paper";
                }

                return (
                  <Link
                    key={flow.address}
                    href={`/flows/${flow.address}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-panel/80 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-[#1A1A1A] border border-line flex items-center justify-center">
                        {isAutomated ? (
                          <Zap className="h-4 w-4 text-paper" />
                        ) : (
                          <Hand className="h-4 w-4 text-paper" />
                        )}
                      </div>
                      <div>
                        <p className="font-mono text-sm text-paper font-semibold">
                          {buildRuleSummary(flow.trigger, flow.action)}
                        </p>
                        <p className="font-mono text-xs text-muted mt-1">
                          Created {formatRelativeTime(flow.createdAt)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className={`font-mono text-xs px-2.5 py-1 rounded-full border border-line/50 bg-[#1A1A1A] ${statusColor} flex items-center gap-1.5`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${statusColor === 'text-signal' ? 'bg-signal' : statusColor === 'text-paper' ? 'bg-paper' : 'bg-muted'}`} />
                        {statusText}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted group-hover:text-paper transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </main>
  );
}
