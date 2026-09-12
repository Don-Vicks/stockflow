import { PublicKey } from "@solana/web3.js";

/** Mirrors state::flow::Trigger in the Anchor program. */
export type Trigger =
  | { kind: "TimeInterval"; intervalSeconds: number }
  | { kind: "OnDemand" }
  | { kind: "RiskThreshold"; ltvBps: number };

/** Mirrors state::flow::Action. Amounts are in the source token's
 * smallest unit (e.g. USDC has 6 decimals). */
export type Action =
  | { kind: "Pay"; amount: bigint }
  | { kind: "Borrow"; amount: bigint }
  | { kind: "Repay"; amount: bigint }
  | { kind: "PauseSpending" };

/** Mirrors state::flow::Source. */
export type Source =
  | { kind: "StablecoinOnly" }
  | { kind: "StablecoinThenBorrow"; collateralMint: PublicKey };

/** Mirrors state::flow::Constraints. Note there's no separate
 * "locked recipient" here — `FlowSpec.destination` is what the
 * on-chain program enforces for every Pay action (always, not
 * conditionally — see execute_flow.rs). */
export interface Constraints {
  maxAmount: bigint;
  maxLtvBps: number;
}

export type FlowStatus = "Active" | "Paused";

export interface FlowSpec {
  flowId: bigint;
  owner: PublicKey;
  trigger: Trigger;
  action: Action;
  source: Source;
  constraints: Constraints;
  destination: PublicKey;
}

export interface FlowAccount extends FlowSpec {
  address: PublicKey;
  status: FlowStatus;
  lastExecutedAt: number;
  createdAt: number;
}

/** Result of `simulateFlow` — client-side projection before the user
 * signs anything, per PRD section on the Simulation Engine. */
export interface SimulationResult {
  currentPortfolioValueUsd: number;
  currentDebtUsd: number;
  currentLtvBps: number;
  projectedDebtUsd: number;
  projectedLtvBps: number;
  riskStatus: "SAFE" | "WARNING" | "UNSAFE";
  stressScenarios: Array<{
    label: string;
    priceShockPct: number;
    projectedLtvBps: number;
    status: "SAFE" | "WARNING" | "UNSAFE";
  }>;
}

export interface PortfolioSummary {
  owner: PublicKey;
  totalValueUsd: number;
  holdings: Array<{
    mint: PublicKey;
    symbol: string;
    /** Actual on-chain token balance, human-readable (already divided
     * by the mint's decimals). Real and fetched live — unlike
     * `valueUsd`, which needs a price feed this scaffold doesn't wire
     * up yet and is 0 until it does. See docs/FEASIBILITY.md. */
    uiAmount: number;
    valueUsd: number;
  }>;
  availableLiquidityUsd: number;
  currentLtvBps: number;
}
