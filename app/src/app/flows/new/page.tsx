"use client";

import React, { useState } from 'react';
import { ArrowLeft, Save, ArrowRight, Settings2, Sparkles, Activity } from 'lucide-react';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { Footer } from '@/components/Footer';

export default function FlowCreatorPage() {
  const [condition, setCondition] = useState({
    asset: 'xNVDA',
    operator: 'GREATER_THAN',
    threshold: '150',
  });

  const [action, setAction] = useState({
    type: 'SELL',
    amount: '10',
    secondaryAction: 'REPAY_USDC'
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Flow saved:", { condition, action });
    // Final on-chain submission logic goes here
  };

  return (
    <main>
      <TopNav />
      <div className="max-w-4xl mx-auto px-6 py-12 min-h-screen">
        <div className="space-y-8">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/flows" className="p-2 hover:bg-panel rounded-full transition-colors border border-line">
                <ArrowLeft className="w-5 h-5 text-signal" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
                  <span>Create New Flow</span>
                  <Sparkles className="w-5 h-5 text-signal" />
                </h1>
                <p className="text-signal text-sm mt-1 font-mono">Define programmable rules for your portfolio</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Condition Section */}
            <div className="bg-panel rounded-xl border border-line p-6 space-y-6 shadow-sm">
              <div className="flex items-center space-x-2 border-b border-line pb-4">
                <Activity className="w-5 h-5 text-signal" />
                <h2 className="text-lg font-semibold text-white">1. Trigger Condition</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted font-mono uppercase tracking-wide">Asset</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-ink border border-line rounded-lg px-4 py-2.5 text-paper focus:outline-none focus:border-signal appearance-none"
                      value={condition.asset}
                      onChange={(e) => setCondition({...condition, asset: e.target.value})}
                    >
                      <option value="xNVDA">xNVDA</option>
                      <option value="xAAPL">xAAPL</option>
                      <option value="xTSLA">xTSLA</option>
                      <option value="xBTC">xBTC</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted font-mono uppercase tracking-wide">Condition</label>
                  <select 
                    className="w-full bg-ink border border-line rounded-lg px-4 py-2.5 text-paper focus:outline-none focus:border-signal appearance-none"
                    value={condition.operator}
                    onChange={(e) => setCondition({...condition, operator: e.target.value})}
                  >
                    <option value="GREATER_THAN">Price &gt;</option>
                    <option value="LESS_THAN">Price &lt;</option>
                    <option value="EQUALS">Price =</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted font-mono uppercase tracking-wide">Threshold ($)</label>
                  <input 
                    type="number" 
                    className="w-full bg-ink border border-line rounded-lg px-4 py-2.5 text-paper focus:outline-none focus:border-signal placeholder:text-muted/50"
                    placeholder="150"
                    value={condition.threshold}
                    onChange={(e) => setCondition({...condition, threshold: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Action Section */}
            <div className="bg-panel rounded-xl border border-line p-6 space-y-6 shadow-sm">
              <div className="flex items-center space-x-2 border-b border-line pb-4">
                <Settings2 className="w-5 h-5 text-signal" />
                <h2 className="text-lg font-semibold text-white">2. Execution Action</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm text-muted font-mono uppercase tracking-wide">Action</label>
                  <select 
                    className="w-full bg-ink border border-line rounded-lg px-4 py-2.5 text-paper focus:outline-none focus:border-signal appearance-none"
                    value={action.type}
                    onChange={(e) => setAction({...action, type: e.target.value})}
                  >
                    <option value="SELL">Sell Asset</option>
                    <option value="BUY">Buy Asset</option>
                    <option value="SWAP">Swap Asset</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted font-mono uppercase tracking-wide">Amount</label>
                  <input 
                    type="number" 
                    className="w-full bg-ink border border-line rounded-lg px-4 py-2.5 text-paper focus:outline-none focus:border-signal placeholder:text-muted/50"
                    placeholder="10"
                    value={action.amount}
                    onChange={(e) => setAction({...action, amount: e.target.value})}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm text-muted font-mono uppercase tracking-wide">Secondary Action (Optional)</label>
                  <select 
                    className="w-full bg-ink border border-line rounded-lg px-4 py-2.5 text-paper focus:outline-none focus:border-signal appearance-none"
                    value={action.secondaryAction}
                    onChange={(e) => setAction({...action, secondaryAction: e.target.value})}
                  >
                    <option value="NONE">None</option>
                    <option value="REPAY_USDC">Repay USDC Debt</option>
                    <option value="STAKE_USDC">Stake USDC</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Summary / Footer */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4">
              <div className="text-sm text-signal bg-panel px-6 py-4 rounded-xl border border-line flex-1">
                <span className="font-medium text-white block mb-2 font-display text-lg">Rule Preview</span>
                <span className="font-mono leading-relaxed">
                  When <span className="font-semibold text-white px-1 bg-ink rounded">{condition.asset}</span> is {condition.operator === 'GREATER_THAN' ? '>' : condition.operator === 'LESS_THAN' ? '<' : '='} <span className="font-semibold text-white px-1 bg-ink rounded">${condition.threshold}</span>, 
                  then <span className="font-semibold text-white px-1 bg-ink rounded">{action.type.toLowerCase()} {action.amount}</span> 
                  {action.secondaryAction !== 'NONE' && <span> and <span className="font-semibold text-white px-1 bg-ink rounded">{action.secondaryAction.toLowerCase().replace('_', ' ')}</span></span>}.
                </span>
              </div>
              
              <button 
                type="submit"
                className="flex items-center space-x-2 bg-white text-ink px-8 py-4 rounded-xl font-mono text-sm font-semibold hover:bg-white/90 transition-colors shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>Create Flow</span>
              </button>
            </div>
          </form>

        </div>
      </div>
      <Footer />
    </main>
  );
}
