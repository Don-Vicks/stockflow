import { PublicKey } from "@solana/web3.js";

import { BN } from "@coral-xyz/anchor";

const FLOW_SEED = Buffer.from("flow");
const PROTECTION_SEED = Buffer.from("protection");

function u64LeBytes(value: bigint): Buffer {
  return new BN(value.toString()).toArrayLike(Buffer, "le", 8);
}

export function deriveFlowPda(
  programId: PublicKey,
  owner: PublicKey,
  flowId: bigint
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [FLOW_SEED, owner.toBuffer(), u64LeBytes(flowId)],
    programId
  );
}

export function deriveProtectionPda(
  programId: PublicKey,
  owner: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PROTECTION_SEED, owner.toBuffer()], programId);
}
