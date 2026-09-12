import { FlowAccount } from "@stockflow/common";

/**
 * Pure trigger-detection logic — no enforcement here. This just decides
 * "should we attempt execute_flow right now?" The Anchor program
 * re-checks everything when the transaction actually lands, so a false
 * positive here just wastes a transaction, never funds.
 */
export function isTimeIntervalDue(flow: FlowAccount, nowUnix: number): boolean {
  if (flow.trigger.kind !== "TimeInterval") return false;
  if (flow.status !== "Active") return false;
  if (flow.lastExecutedAt === 0) return true;
  return nowUnix - flow.lastExecutedAt >= flow.trigger.intervalSeconds;
}
