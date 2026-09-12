import { FlowAccount } from "@stockflow/common";

/**
 * Checks Protection-style Flows (Trigger::RiskThreshold) against a
 * freshly-read LTV. `currentLtvBps` should come from
 * `@stockflow/sdk`'s `getRisk()`, which itself reads the owner's
 * Kamino obligation.
 */
export function isRiskThresholdCrossed(flow: FlowAccount, currentLtvBps: number): boolean {
  if (flow.trigger.kind !== "RiskThreshold") return false;
  if (flow.status !== "Active") return false;
  return currentLtvBps >= flow.trigger.ltvBps;
}
