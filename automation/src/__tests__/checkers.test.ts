import { test } from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";
import { FlowAccount } from "@stockflow/common";
import { isTimeIntervalDue } from "../checkers/timeInterval";
import { isRiskThresholdCrossed } from "../checkers/riskThreshold";

function baseFlow(overrides: Partial<FlowAccount> = {}): FlowAccount {
  return {
    address: PublicKey.default,
    flowId: 1n,
    owner: PublicKey.default,
    trigger: { kind: "TimeInterval", intervalSeconds: 3600 },
    action: { kind: "Pay", amount: 500_000_000n },
    source: { kind: "StablecoinOnly" },
    constraints: { maxAmount: 500_000_000n, maxLtvBps: 4000 },
    destination: PublicKey.default,
    status: "Active",
    lastExecutedAt: 0,
    createdAt: 0,
    ...overrides,
  };
}

test("isTimeIntervalDue: never-executed Flow is due immediately", () => {
  const flow = baseFlow({ lastExecutedAt: 0 });
  assert.equal(isTimeIntervalDue(flow, 1_000_000), true);
});

test("isTimeIntervalDue: not due before the interval elapses", () => {
  const flow = baseFlow({ lastExecutedAt: 1_000, trigger: { kind: "TimeInterval", intervalSeconds: 3600 } });
  assert.equal(isTimeIntervalDue(flow, 1_000 + 1800), false);
});

test("isTimeIntervalDue: due once the interval elapses", () => {
  const flow = baseFlow({ lastExecutedAt: 1_000, trigger: { kind: "TimeInterval", intervalSeconds: 3600 } });
  assert.equal(isTimeIntervalDue(flow, 1_000 + 3600), true);
});

test("isTimeIntervalDue: a paused Flow is never due", () => {
  const flow = baseFlow({ lastExecutedAt: 0, status: "Paused" });
  assert.equal(isTimeIntervalDue(flow, 999_999), false);
});

test("isTimeIntervalDue: ignores Flows with a different trigger kind", () => {
  const flow = baseFlow({ trigger: { kind: "OnDemand" } });
  assert.equal(isTimeIntervalDue(flow, 999_999), false);
});

test("isRiskThresholdCrossed: fires once current LTV reaches the threshold", () => {
  const flow = baseFlow({ trigger: { kind: "RiskThreshold", ltvBps: 3500 } });
  assert.equal(isRiskThresholdCrossed(flow, 3499), false);
  assert.equal(isRiskThresholdCrossed(flow, 3500), true);
  assert.equal(isRiskThresholdCrossed(flow, 5000), true);
});

test("isRiskThresholdCrossed: a paused Flow never fires", () => {
  const flow = baseFlow({ trigger: { kind: "RiskThreshold", ltvBps: 3500 }, status: "Paused" });
  assert.equal(isRiskThresholdCrossed(flow, 9000), false);
});
