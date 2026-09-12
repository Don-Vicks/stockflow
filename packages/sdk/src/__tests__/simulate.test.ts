import { test } from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";
import { PortfolioSummary } from "@stockflow/common";
import { classify, computeSimulation } from "../simulate";

function portfolio(overrides: Partial<PortfolioSummary> = {}): PortfolioSummary {
  return {
    owner: PublicKey.default,
    totalValueUsd: 25_000,
    holdings: [],
    availableLiquidityUsd: 8_000,
    currentLtvBps: 0,
    ...overrides,
  };
}

test("classify: SAFE below 80% of the max", () => {
  assert.equal(classify(1000, 4000), "SAFE");
});

test("classify: WARNING between 80% and 100% of the max", () => {
  assert.equal(classify(3500, 4000), "WARNING");
});

test("classify: UNSAFE above the max", () => {
  assert.equal(classify(4500, 4000), "UNSAFE");
});

test("computeSimulation: zero-debt portfolio, a $500 pay projects a small LTV", () => {
  const result = computeSimulation(portfolio(), {
    action: { kind: "Pay", amount: 500_000_000n }, // $500 in 6-decimal units
    constraints: { maxAmount: 500_000_000n, maxLtvBps: 4000 },
  });
  assert.equal(result.currentLtvBps, 0);
  // $500 debt against $25,000 collateral = 2.00% = 200 bps
  assert.equal(result.projectedLtvBps, 200);
  assert.equal(result.riskStatus, "SAFE");
});

test("computeSimulation: stress scenarios get worse as the shock deepens", () => {
  const result = computeSimulation(portfolio(), {
    action: { kind: "Pay", amount: 500_000_000n },
    constraints: { maxAmount: 500_000_000n, maxLtvBps: 4000 },
  });
  const byLabel = Object.fromEntries(result.stressScenarios.map((s) => [s.label, s.projectedLtvBps]));
  assert.ok(byLabel["Normal"] < byLabel["-10% stocks"]);
  assert.ok(byLabel["-10% stocks"] < byLabel["-30% stocks"]);
  assert.ok(byLabel["-30% stocks"] < byLabel["-50% stocks"]);
});

test("computeSimulation: a large borrow against a small portfolio is flagged UNSAFE", () => {
  const result = computeSimulation(portfolio({ totalValueUsd: 1_000 }), {
    action: { kind: "Borrow", amount: 900_000_000n }, // $900 against $1,000
    constraints: { maxAmount: 900_000_000n, maxLtvBps: 4000 },
  });
  assert.equal(result.riskStatus, "UNSAFE");
});

test("computeSimulation: zero total value doesn't throw (divide-by-zero guard)", () => {
  const result = computeSimulation(portfolio({ totalValueUsd: 0 }), {
    action: { kind: "Pay", amount: 100_000_000n },
    constraints: { maxAmount: 100_000_000n, maxLtvBps: 4000 },
  });
  assert.equal(result.projectedLtvBps, 0);
});
