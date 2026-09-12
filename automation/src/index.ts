import "dotenv/config";
import { Connection } from "@solana/web3.js";
import { isTimeIntervalDue } from "./checkers/timeInterval";
import { isRiskThresholdCrossed } from "./checkers/riskThreshold";
import { FlowAccount } from "@stockflow/common";

const RPC_URL = process.env.STOCKFLOW_RPC_URL ?? "https://api.devnet.solana.com";
const POLL_INTERVAL_MS = 15_000;

/**
 * Devnet-friendly stand-in for the production automation layer.
 *
 * Production should replace this poll loop with Tuk Tuk tasks (see
 * ./tuktuk.ts) so trigger detection is itself decentralized rather
 * than run from a single process. For a hackathon demo, a poller is
 * fine and easier to debug — the important architectural property
 * (off-chain detects, on-chain enforces) holds either way, since
 * `execute_flow` re-validates every constraint regardless of which
 * process submitted the transaction.
 */
async function pollOnce(connection: Connection): Promise<void> {
  const flows = await fetchActiveFlows(connection);
  const now = Math.floor(Date.now() / 1000);

  for (const flow of flows) {
    const due =
      isTimeIntervalDue(flow, now) ||
      (flow.trigger.kind === "RiskThreshold" &&
        isRiskThresholdCrossed(flow, await fetchCurrentLtvBps(connection, flow.owner)));

    if (due) {
      console.log(`[worker] Flow ${flow.address.toBase58()} trigger due — submitting execute_flow`);
      await submitExecuteFlow(connection, flow);
    }
  }
}

// --- Stubs below: wire to @stockflow/sdk once the program is deployed
// and the IDL is generated (see packages/sdk/src/client.ts). ---

async function fetchActiveFlows(_connection: Connection): Promise<FlowAccount[]> {
  return [];
}

async function fetchCurrentLtvBps(_connection: Connection, _owner: unknown): Promise<number> {
  return 0;
}

async function submitExecuteFlow(_connection: Connection, _flow: FlowAccount): Promise<void> {
  // await executeFlow(client, flow.address)
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  console.log(`[worker] StockFlow automation worker starting against ${RPC_URL}`);
  setInterval(() => {
    pollOnce(connection).catch((err) => console.error("[worker] poll error", err));
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
