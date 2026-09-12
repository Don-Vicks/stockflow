/**
 * Wrapper around Helium's Tuk Tuk on-chain automation engine — the
 * maintained successor to Clockwork (which stopped being supported in
 * August 2023; do not build against Clockwork tutorials).
 *
 * UNVERIFIED before use (see docs/FEASIBILITY.md item 2): confirm the
 * current `@helium/tuktuk-*` package name/version and whether its task
 * queue program has an active devnet deployment before wiring this in.
 * Tuk Tuk supports both time-based schedules and on-chain-event
 * triggers with TypeScript + Rust SDKs, and recursive tasks for
 * cron-like recurring execution — which is what backs Flow::Trigger's
 * TimeInterval variant in production, rather than this repo's simple
 * setInterval-based poller (see index.ts), which is a devnet-friendly
 * stand-in until Tuk Tuk is wired in.
 */

export interface TukTukTaskConfig {
  /** The transaction to submit once the trigger fires — an
   * execute_flow instruction targeting a specific Flow PDA. */
  instructionData: Buffer;
  triggerSeconds?: number;
}

export async function registerRecurringTask(_config: TukTukTaskConfig): Promise<string> {
  throw new Error(
    "registerRecurringTask: Tuk Tuk integration not wired up yet. " +
      "Confirm package + devnet deployment status, then replace the " +
      "poller in index.ts with a real Tuk Tuk task registration."
  );
}
