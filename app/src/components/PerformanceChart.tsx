"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DataPoint = {
  date: string;
  value: number;
};

// Pyth Benchmarks TradingView-compatible history API.
// Docs: https://benchmarks.pyth.network/docs
const BENCHMARKS_BASE = "https://benchmarks.pyth.network/v1/shims/tradingview/history";

// Mock portfolio weights — percentage each asset contributes to the user's
// total tracked portfolio. Replace with real on-chain holdings when available.
const PORTFOLIO_WEIGHTS: Record<string, number> = {
  "Equity.US.AAPL/USD": 0.40,
  "Equity.US.NVDA/USD": 0.35,
  "Equity.US.TSLA/USD": 0.25,
};

type OHLCVResponse = {
  t: number[];   // unix timestamps
  c: number[];   // close prices
  s: string;     // "ok" | "no_data"
};

async function fetchSymbolHistory(
  symbol: string,
  from: number,
  to: number
): Promise<{ t: number[]; c: number[] }> {
  const url = `${BENCHMARKS_BASE}?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pyth Benchmarks error: ${res.status}`);
  const json: OHLCVResponse = await res.json();
  if (json.s !== "ok" || !json.t?.length) return { t: [], c: [] };
  return { t: json.t, c: json.c };
}

async function buildPortfolioHistory(): Promise<DataPoint[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 30 * 24 * 60 * 60; // 30 days ago

  // Fetch all symbols in parallel
  const entries = Object.entries(PORTFOLIO_WEIGHTS);
  const results = await Promise.all(
    entries.map(([symbol]) => fetchSymbolHistory(symbol, from, now).catch(() => ({ t: [], c: [] })))
  );

  // Build a date-keyed map of weighted price contributions
  const dateMap: Record<number, number> = {};

  results.forEach(({ t, c }, idx) => {
    const weight = entries[idx][1];
    t.forEach((ts, i) => {
      // Normalize to start-of-day (midnight UTC) to align across symbols
      const dayTs = Math.floor(ts / 86400) * 86400;
      dateMap[dayTs] = (dateMap[dayTs] ?? 0) + c[i] * weight;
    });
  });

  // Sort and convert to chart format. Scale to a $10k starting portfolio value
  // so the Y axis is in familiar dollar terms.
  const sorted = Object.entries(dateMap)
    .sort(([a], [b]) => Number(a) - Number(b));

  if (sorted.length === 0) return [];

  const firstValue = Number(sorted[0][1]);
  const portfolioStart = 10_000;

  return sorted.map(([ts, weightedPrice]) => ({
    date: new Date(Number(ts) * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    value: (weightedPrice / firstValue) * portfolioStart,
  }));
}

export function PerformanceChart() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    buildPortfolioHistory()
      .then((points) => {
        setData(points);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="w-full h-48 border border-line bg-panel rounded-xl flex items-center justify-center">
        <p className="font-mono text-xs text-muted animate-pulse">Fetching price history…</p>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="w-full h-48 border border-line bg-panel rounded-xl flex items-center justify-center">
        <p className="font-mono text-xs text-muted">Price history unavailable.</p>
      </div>
    );
  }

  const latest = data[data.length - 1]?.value ?? 0;
  const first = data[0]?.value ?? 0;
  const change = ((latest - first) / first) * 100;
  const isPositive = change >= 0;

  return (
    <div className="w-full border border-line bg-panel rounded-xl overflow-hidden">
      {/* Mini header inside the chart card */}
      <div className="flex items-end justify-between px-4 pt-4 pb-2">
        <div>
          <p className="font-mono text-xs text-muted uppercase tracking-wider mb-1">30-Day Portfolio</p>
          <p className="font-display text-2xl text-paper">
            ${latest.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
        </div>
        <span className={`font-mono text-sm px-2 py-1 rounded-md ${isPositive ? "text-signal bg-signal/10" : "text-alert bg-alert/10"}`}>
          {isPositive ? "+" : ""}{change.toFixed(2)}%
        </span>
      </div>
      <div className="h-36 px-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0.25} />
                <stop offset="95%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={["dataMin - 200", "dataMax + 200"]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#151A22",
                border: "1px solid #232A35",
                borderRadius: "8px",
                color: "#E9ECEF",
              }}
              itemStyle={{ color: isPositive ? "#10b981" : "#ef4444" }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any) => [`$${Number(value ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, "Portfolio"]) as any}
              labelStyle={{ color: "#8891A1", marginBottom: "4px" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={isPositive ? "#10b981" : "#ef4444"}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
