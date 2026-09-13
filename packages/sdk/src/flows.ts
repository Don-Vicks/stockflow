import { PublicKey, TransactionSignature, SystemProgram, Transaction } from "@solana/web3.js";
import { FlowSpec, Trigger, Action, Source } from "@stockflow/common";
import { StockFlowClient } from "./client";
import { deriveFlowPda } from "./pda";
import { BN } from "@coral-xyz/anchor";

function mapTrigger(trigger: Trigger) {
  switch (trigger.kind) {
    case "OnDemand":
      return { onDemand: {} };
    case "TimeInterval":
      return { timeInterval: { intervalSeconds: new BN(trigger.intervalSeconds.toString()) } };
    case "RiskThreshold":
      return { riskThreshold: { ltvBps: trigger.ltvBps } };
  }
}

function mapAction(action: Action) {
  switch (action.kind) {
    case "Pay":
      return { pay: { amount: new BN(action.amount.toString()) } };
    case "Borrow":
      return { borrow: { amount: new BN(action.amount.toString()) } };
    case "Repay":
      return { repay: { amount: new BN(action.amount.toString()) } };
    case "PauseSpending":
      return { pauseSpending: {} };
  }
}

function mapSource(source: Source) {
  switch (source.kind) {
    case "StablecoinOnly":
      return { stablecoinOnly: {} };
    case "StablecoinThenBorrow":
      return { stablecoinThenBorrow: { collateralMint: source.collateralMint } };
  }
}

/**
 * Compile a structured FlowSpec into an on-chain Flow account 
 * and submit the create_flow instruction.
 */
export async function createFlow(
  client: StockFlowClient,
  spec: FlowSpec
): Promise<{ signature: TransactionSignature; flowAddress: PublicKey }> {
  const [flowAddress] = deriveFlowPda(client.programId, spec.owner, spec.flowId);
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), spec.owner.toBuffer()],
    client.programId
  );
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority"), spec.owner.toBuffer()],
    client.programId
  );

  const tx = new Transaction();

  // If the vault doesn't exist, initialize it first in the same transaction
  const vaultInfo = await client.connection.getAccountInfo(vault);
  if (!vaultInfo) {
    const initVaultIx = await client.program.methods
      .initializeVault(spec.owner) // Use owner as the keeper for devnet logic by default
      .accounts({
        owner: spec.owner,
        vault,
        vaultAuthority,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    tx.add(initVaultIx);
  }

  const nameArray = Array.from(Buffer.alloc(32));
  
  const createFlowIx = await client.program.methods
    .createFlow(
      new BN(spec.flowId.toString()),
      nameArray,
      mapTrigger(spec.trigger),
      mapAction(spec.action),
      mapSource(spec.source),
      {
        maxAmount: new BN(spec.constraints.maxAmount.toString()),
        maxLtvBps: spec.constraints.maxLtvBps,
      },
      spec.destination
    )
    .accounts({
      owner: spec.owner,
      vault,
      flow: flowAddress,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
    
  tx.add(createFlowIx);

  const signature = await client.provider.sendAndConfirm(tx);
  return { signature, flowAddress };
}

export async function executeFlow(
  client: StockFlowClient,
  flowAddress: PublicKey
): Promise<TransactionSignature> {
  throw new Error("executeFlow: wire up client.program after `anchor build`.");
}

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
