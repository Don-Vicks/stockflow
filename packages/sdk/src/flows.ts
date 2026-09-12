import { PublicKey, TransactionSignature } from "@solana/web3.js";
import { FlowSpec } from "@stockflow/common";
import { StockFlowClient } from "./client";
import { deriveFlowPda } from "./pda";

/**
 * Compile a structured FlowSpec (already produced by the Policy
 * Compiler — see ./intent.ts for the natural-language entry point)
 * into an on-chain Flow account and submit the create_flow instruction.
 *
 * Mirrors the PRD's developer API: `createFlow()`.
 */
export async function createFlow(
  client: StockFlowClient,
  spec: FlowSpec
): Promise<{ signature: TransactionSignature; flowAddress: PublicKey }> {
  const [flowAddress] = deriveFlowPda(client.programId, spec.owner, spec.flowId);

  // TODO: once `client.program` is wired up post-`anchor build`, replace
  // this stub with the real instruction call, e.g.:
  //
  // const signature = await client.program.methods
  //   .createFlow(new BN(spec.flowId.toString()), toAnchorTrigger(spec.trigger), ...)
  //   .accounts({ owner: client.wallet.publicKey, flow: flowAddress, systemProgram: SystemProgram.programId })
  //   .rpc();

  throw new Error(
    "createFlow: wire up client.program after `anchor build` generates the IDL (see client.ts)."
  );
}

/** Mirrors the PRD's developer API: `executeFlow()`. Called by the
 * automation worker once it has detected the Trigger off-chain, or by
 * the owner for a manual/on-demand run. */
export async function executeFlow(
  client: StockFlowClient,
  flowAddress: PublicKey
): Promise<TransactionSignature> {
  throw new Error("executeFlow: wire up client.program after `anchor build`.");
}

/** Mirrors the PRD's developer API: `pauseFlow()`. */
export async function pauseFlow(
  client: StockFlowClient,
  flowAddress: PublicKey
): Promise<TransactionSignature> {
  throw new Error("pauseFlow: wire up client.program after `anchor build`.");
}

export async function resumeFlow(
  client: StockFlowClient,
  flowAddress: PublicKey
): Promise<TransactionSignature> {
  throw new Error("resumeFlow: wire up client.program after `anchor build`.");
}
