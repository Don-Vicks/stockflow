import { PublicKey } from "@solana/web3.js";

/**
 * Known program/mint addresses. Anything marked UNVERIFIED must be
 * confirmed before a devnet demo — see docs/FEASIBILITY.md. Do not
 * ship a mainnet demo pointed at these without re-checking.
 */
export const CONFIG = {
  devnet: {
    // StockFlow's own program — synced with the actual Devnet deployment.
    stockflowProgramId: new PublicKey("8BUAepdHuQKHXGav9VbNcenVzZPvUvfNqUzPHTE8cUXx"),

    // UNVERIFIED — two conflicting candidates were found for Kamino's
    // devnet/staging klend program ID. Confirm against Kamino's docs
    // or Discord before wiring the CPI in programs/stockflow/src/cpi/kamino.rs.
    kaminoProgramIdCandidates: [
      "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD", // reported as devnet == mainnet by one source
      "SLendK7ySfcEzyaFqy93gDnD3RtrpXJcnRwb6zFHJSh", // reported as staging/devnet by another
    ],

    // UNVERIFIED — devnet USDC mint varies by faucet; confirm the one
    // your test wallet is funded with.
    usdcMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  },
} as const;

/**
 * Mint -> display symbol, for the mints this scaffold actually knows
 * about. Deliberately does NOT include NVDAx/AAPLx/etc. — every xStock
 * devnet mint address needs to be confirmed against Kamino/Backed's
 * own devnet deployment rather than guessed, and a wrong hardcoded
 * mint here would silently mislabel a real token account. Add entries
 * only once verified; see docs/FEASIBILITY.md.
 */
export const KNOWN_DEVNET_MINTS: Record<string, string> = {
  [CONFIG.devnet.usdcMint]: "USDC",
};

/**
 * Resolves an xStock ticker (e.g. "NVDA", "NVDAx") to its devnet mint
 * address. Throws rather than returning a guessed/fabricated address —
 * populate this once you've confirmed the real mint from Kamino or
 * the xStocks issuer, then this function (and the intent compiler,
 * which calls it) starts working without further code changes.
 */
export function resolveXStockMint(_ticker: string): PublicKey {
  throw new Error(
    "resolveXStockMint: no xStock devnet mints are configured yet. " +
      "Confirm the real mint address (see docs/FEASIBILITY.md) and add " +
      "it to a KNOWN_DEVNET_XSTOCK_MINTS map before calling this."
  );
}
