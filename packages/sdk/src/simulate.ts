import { PublicKey } from "@solana/web3.js";
import { FlowSpec, PortfolioSummary, SimulationResult } from "@stockflow/common";
import { StockFlowClient } from "./client";
import { getPortfolio } from "./portfolio";

const STRESS_SCENARIOS: Array<{ label: string; priceShockPct: number }> = [
  { label: "Normal", priceShockPct: 0 },
  { label: "-10% stocks", priceShockPct: -10 },
  { label: "-30% stocks", priceShockPct: -30 },
  { label: "-50% stocks", priceShockPct: -50 },
];

export function classify(ltvBps: number, maxLtvBps: number): "SAFE" | "WARNING" | "UNSAFE" {
  if (ltvBps > maxLtvBps) return "UNSAFE";
  if (ltvBps > maxLtvBps * 0.8) return "WARNING";
  return "SAFE";
}

/**
 * Pure simulation math, deliberately separated from `simulateFlow`'s
 * network call so it can be unit tested directly with a fabricated
 * PortfolioSummary — see src/__tests__/simulate.test.ts. This is the
 * function to change if/when the projection logic moves from the
 * current linear approximation to a real
 * @kamino-finance/klend-sdk-backed calculation.
 */
export function computeSimulation(
  portfolio: PortfolioSummary,
  spec: Pick<FlowSpec, "action" | "constraints">
): SimulationResult {
  const amount =
    spec.action.kind === "Pay" || spec.action.kind === "Borrow"
      ? Number(spec.action.amount)
      : 0;

  // Simplified projection: assumes `amount` (in USD-equivalent smallest
  // units) is borrowed against collateral. Real implementation should
  // use @kamino-finance/klend-sdk's KaminoMarket/KaminoObligation
  // stats (borrowLimit, simulated post-action LTV) rather than this
  // linear approximation.
  const currentDebtUsd = (portfolio.currentLtvBps / 10_000) * portfolio.totalValueUsd;
  const projectedDebtUsd = currentDebtUsd + amount / 1_000_000;

  const projectedLtvBps = portfolio.totalValueUsd
    ? Math.round((projectedDebtUsd / portfolio.totalValueUsd) * 10_000)
    : 0;

  const stressScenarios = STRESS_SCENARIOS.map((scenario) => {
    const shockedValue = portfolio.totalValueUsd * (1 + scenario.priceShockPct / 100);
    const shockedLtvBps = shockedValue
      ? Math.round((projectedDebtUsd / shockedValue) * 10_000)
      : 0;
    return {
      ...scenario,
      projectedLtvBps: shockedLtvBps,
      status: classify(shockedLtvBps, spec.constraints.maxLtvBps),
    };
  });

  return {
    currentPortfolioValueUsd: portfolio.totalValueUsd,
    currentDebtUsd,
    currentLtvBps: portfolio.currentLtvBps,
    projectedDebtUsd,
    projectedLtvBps,
    riskStatus: classify(projectedLtvBps, spec.constraints.maxLtvBps),
    stressScenarios,
  };
}

/**
 * Mirrors the PRD's Simulation Engine: projects the effect of a
 * not-yet-created Flow on the user's LTV, including stress scenarios,
 * BEFORE they sign anything. No on-chain transaction — just a read
 * (getPortfolio) plus the pure computation above.
 */
export async function simulateFlow(
  client: StockFlowClient,
  owner: PublicKey,
  spec: Pick<FlowSpec, "action" | "source" | "constraints">
): Promise<SimulationResult> {
  const portfolio = await getPortfolio(client, owner);
  return computeSimulation(portfolio, spec);
}
