"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPortfolio, getMintBySymbol } from "@stockflow/sdk";
import type { PortfolioSummary } from "@stockflow/sdk";
import { useStockFlow } from "@/hooks/useStockFlow";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { CONFIG } from "@stockflow/common";
import BN from "bn.js";
import { TopNav } from "@/components/TopNav";
import { Workflow, CreditCard, HandCoins, ArrowDownToLine, WalletCards, ShieldCheck } from "lucide-react";
import { PerformanceChart } from "@/components/PerformanceChart";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Footer } from "@/components/Footer";

function riskState(ltvBps: number, maxBps = 4000) {
  if (ltvBps > maxBps)         return { label: "LIQUIDATION RISK", color: "text-alert" };
  if (ltvBps > maxBps * 0.875) return { label: "RESTRICTED", color: "text-orange-400" };
  if (ltvBps > maxBps * 0.75)  return { label: "WARNING",    color: "text-yellow-400" };
  return                             { label: "HEALTHY",     color: "text-signal" };
}

function TransactionModal({ 
  type, 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading 
}: { 
  type: 'deposit' | 'borrow' | null; 
  isOpen: boolean; 
  onClose: () => void;
  onSubmit: (amount: number) => void;
  isLoading: boolean;
}) {
  const [amount, setAmount] = useState('');

  if (!isOpen || !type) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!isNaN(val) && val > 0) {
      onSubmit(val);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-panel border border-line rounded-xl w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-xl font-display text-paper mb-4 capitalize">{type} USDC</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block font-mono text-xs text-muted mb-2 uppercase tracking-wider">Amount</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-muted font-mono">$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-ink border border-line rounded-lg py-2.5 pl-8 pr-4 text-paper font-mono focus:outline-none focus:border-signal transition-colors"
                  placeholder="0.00"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button 
              type="button" 
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 font-mono text-sm text-muted hover:text-paper transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-paper text-ink px-5 py-2 font-mono text-sm font-semibold hover:bg-white transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <span className="animate-pulse">Processing...</span>
              ) : (
                <span className="capitalize">{type}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-10 animate-pulse pt-10 max-w-6xl mx-auto px-6">
      <div className="h-24 w-64 rounded-xl bg-panel" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-96 rounded-xl bg-panel" />
        <div className="h-96 rounded-xl bg-panel" />
      </div>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export default function DashboardPage() {
  const { client, owner, isConnected } = useStockFlow();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalType, setModalType] = useState<'deposit' | 'borrow' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { sendTransaction } = useWallet();
  const { connection } = useConnection();

  const handleTransaction = async (amount: number) => {
    if (!client || !owner || !modalType) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      // Use 6 decimals for USDC
      const amountBN = new BN(amount * 10 ** 6);
      const usdcMint = new PublicKey(CONFIG.devnet.usdcMint);
      const ownerTokenAccount = getAssociatedTokenAddressSync(usdcMint, owner);
      
      const method = modalType === 'deposit' 
        ? client.program.methods.deposit(amountBN) 
        // @ts-ignore - mapping 'borrow' UI action to 'withdraw' smart contract instruction per design
        : (client.program.methods.withdraw ? client.program.methods.withdraw(amountBN) : null);
      
      if (!method) {
         throw new Error("Method not supported in current IDL");
      }

      const tx = await method
        .accounts({
          owner: owner,
          mint: usdcMint,
          ownerTokenAccount: ownerTokenAccount,
        })
        .transaction();

      const signature = await sendTransaction(tx, connection);
      console.log(`${modalType} tx signature:`, signature);
      alert(`Successfully ${modalType}ed ${amount} USDC`);
      setModalType(null);
      
      // refresh portfolio
      const p = await getPortfolio(client, owner);
      setPortfolio(p);
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!client || !owner) { setPortfolio(null); return; }
    setLoading(true);
    getPortfolio(client, owner)
      .then(setPortfolio)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [client, owner]);

  if (!isConnected) {
    return (
      <main>
        <TopNav />
        <div className="flex flex-col items-center justify-center h-[85vh]">
           <WalletCards className="w-16 h-16 text-muted mb-6 opacity-50" />
           <div className="text-center space-y-4">
              <h2 className="text-3xl text-paper font-display mb-2">Connect Your Wallet</h2>
              <p className="text-muted font-mono text-sm max-w-sm mx-auto">Connect your Solana wallet using the top navigation menu to access your smart portfolio.</p>
           </div>
        </div>
        <Footer />
      </main>
    );
  }

  const risk = portfolio ? riskState(portfolio.currentLtvBps, 4000) : null;
  const maxLtvBps = 4000;
  const ltvPct = portfolio ? Math.min((portfolio.currentLtvBps / maxLtvBps) * 100, 100) : 0;
  const barColor = portfolio && portfolio.currentLtvBps > maxLtvBps ? "bg-alert"
    : portfolio && portfolio.currentLtvBps > maxLtvBps * 0.875 ? "bg-orange-400"
    : portfolio && portfolio.currentLtvBps > maxLtvBps * 0.75  ? "bg-yellow-400"
    : "bg-signal";

  return (
    <main>
      <TopNav />
      <TransactionModal 
        type={modalType} 
        isOpen={!!modalType} 
        onClose={() => setModalType(null)} 
        onSubmit={handleTransaction} 
        isLoading={isSubmitting} 
      />
      <div className="max-w-6xl mx-auto px-6 py-12 min-h-screen">
        {loading && <Skeleton />}
        {!loading && portfolio && (
          <div className="space-y-8">
            
            {/* Header: Total Balance */}
            <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-muted mb-2">Total Net Worth</p>
                <div className="flex items-baseline gap-4">
                  <p className="font-display text-5xl md:text-6xl text-paper tracking-tight">{fmt(portfolio.totalValueUsd)}</p>
                  <p className="font-mono text-sm text-signal bg-signal/10 px-2 py-1 rounded-md">+2.4% (24h)</p>
                </div>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setModalType('deposit')} className="flex items-center gap-2 rounded-lg bg-paper text-ink px-5 py-2.5 font-mono text-sm font-semibold hover:bg-white transition-colors">
                   <ArrowDownToLine className="w-4 h-4" /> Deposit
                 </button>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: Chart & Holdings */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* Performance Chart */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="font-display text-xl text-paper">Performance</h3>
                     <div className="flex gap-2 font-mono text-xs">
                        <button className="px-3 py-1 rounded-md bg-panel text-muted hover:text-paper">1D</button>
                        <button className="px-3 py-1 rounded-md bg-line text-paper">1W</button>
                        <button className="px-3 py-1 rounded-md bg-panel text-muted hover:text-paper">1M</button>
                     </div>
                  </div>
                  <PerformanceChart />
                </section>

                {/* Holdings Table */}
                <section>
                  <h3 className="font-display text-xl text-paper mb-4">Your Assets</h3>
                  <div className="rounded-xl border border-line bg-panel overflow-hidden">
                    <table className="w-full text-left font-mono text-sm">
                      <thead className="bg-ink/50 border-b border-line text-muted text-xs uppercase">
                        <tr>
                          <th className="px-6 py-4 font-normal">Asset</th>
                          <th className="px-6 py-4 font-normal text-right">Balance</th>
                          <th className="px-6 py-4 font-normal text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-paper">
                        {portfolio.holdings.map(h => {
                          const logo = getMintBySymbol(h.symbol)?.logoUrl || "https://cryptologos.cc/logos/usd-coin-usdc-logo.png";
                          
                          return (
                          <tr key={h.mint.toBase58()} className="hover:bg-ink/30 transition-colors">
                            <td className="px-6 py-4 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden shadow-sm">
                                <img src={logo} alt={h.symbol} className="w-5 h-5 object-contain" />
                              </div>
                              <span className="font-semibold">{h.symbol}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {h.uiAmount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right font-medium">
                              {fmt(h.valueUsd)}
                            </td>
                          </tr>
                        )})}
                        {portfolio.holdings.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-6 py-8 text-center text-muted">
                              No assets found. Deposit tokenized stocks to get started.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

              </div>

              {/* Right Column: Risk, Actions, Activity */}
              <div className="space-y-8">
                
                {/* Borrowing Power & Risk */}
                <section className="rounded-xl border border-line bg-panel p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <ShieldCheck className="w-5 h-5 text-signal" />
                    <h3 className="font-display text-lg text-paper">Account Health</h3>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <p className="font-mono text-sm text-muted mb-1">Available Liquidity</p>
                      <p className="font-display text-3xl text-paper">{fmt(portfolio.availableLiquidityUsd)}</p>
                    </div>

                    <div>
                      <div className="flex justify-between font-mono text-xs mb-2">
                        <span className="text-muted">LTV {(portfolio.currentLtvBps/100).toFixed(1)}%</span>
                        <span className={risk?.color}>{risk?.label}</span>
                      </div>
                      <div className="h-2 rounded-full bg-line overflow-hidden">
                        <div className={`h-full transition-all ${barColor}`} style={{ width: `${ltvPct}%` }} />
                      </div>
                      <div className="flex justify-between font-mono text-[10px] text-muted mt-2">
                        <span>0%</span>
                        <span>Max {(maxLtvBps/100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Quick Actions */}
                <section className="grid grid-cols-2 gap-4">
                  <Link href="/flows/new" className="flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-panel p-5 text-paper hover:border-signal transition-colors group">
                    <Workflow className="w-5 h-5 text-muted group-hover:text-signal transition-colors" />
                    <span className="font-mono text-sm">Automate</span>
                  </Link>
                  <Link href="/pay" className="flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-panel p-5 text-paper hover:border-signal transition-colors group">
                    <CreditCard className="w-5 h-5 text-muted group-hover:text-signal transition-colors" />
                    <span className="font-mono text-sm">Pay</span>
                  </Link>
                  <button onClick={() => setModalType('borrow')} className="flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-panel p-5 text-paper hover:border-signal transition-colors group">
                    <HandCoins className="w-5 h-5 text-muted group-hover:text-signal transition-colors" />
                    <span className="font-mono text-sm">Borrow</span>
                  </button>
                </section>

                <ActivityFeed />

              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
