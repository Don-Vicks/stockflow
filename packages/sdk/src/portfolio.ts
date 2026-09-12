import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { KNOWN_DEVNET_MINTS, PortfolioSummary } from "@stockflow/common";
import { StockFlowClient } from "./client";

/**
 * Mirrors the PRD's developer API: `getPortfolio()`.
 *
 * This does a REAL read: it fetches every SPL token account the owner
 * holds via `getParsedTokenAccountsByOwner` and reports actual
 * balances. What it does NOT do yet:
 *
 *  - Price them in USD (`valueUsd` is 0 for every holding, and
 *    `totalValueUsd` is 0) — that needs a price feed (Chainlink or
 *    Jupiter's price API), not wired up in this scaffold.
 *  - Read Kamino obligation debt/collateral (`availableLiquidityUsd`
 *    and `currentLtvBps` are 0) — that needs the @solana/kit bridge
 *    documented in docs/FEASIBILITY.md.
 *
 * Both gaps are real integration work, not placeholders standing in
 * for something trivial — this function does everything that's
 * possible without them.
 */
export async function getPortfolio(
  client: StockFlowClient,
  owner: PublicKey
): Promise<PortfolioSummary> {
  const { value: tokenAccounts } = await client.connection.getParsedTokenAccountsByOwner(
    owner,
    { programId: TOKEN_PROGRAM_ID }
  );

  const holdings = tokenAccounts
    .map(({ account }) => {
      const info = account.data.parsed.info;
      const uiAmount: number = info.tokenAmount.uiAmount ?? 0;
      const mint = info.mint as string;
      return {
        mint: new PublicKey(mint),
        symbol: KNOWN_DEVNET_MINTS[mint] ?? `${mint.slice(0, 4)}…${mint.slice(-4)}`,
        uiAmount,
        valueUsd: 0, // TODO: price feed integration — see docs/FEASIBILITY.md
      };
    })
    // Empty (closed but not garbage-collected) token accounts are noise.
    .filter((holding) => holding.uiAmount > 0);

  return {
    owner,
    totalValueUsd: 0, // TODO: sum of holdings once priced
    holdings,
    availableLiquidityUsd: 0, // TODO: Kamino obligation read
    currentLtvBps: 0, // TODO: Kamino obligation read
  };
}

/** Mirrors the PRD's developer API: `getRisk()`. */
export async function getRisk(
  client: StockFlowClient,
  owner: PublicKey
): Promise<{ ltvBps: number; status: "SAFE" | "WARNING" | "UNSAFE" }> {
  const portfolio = await getPortfolio(client, owner);
  return { ltvBps: portfolio.currentLtvBps, status: "SAFE" };
}

/** Mirrors the PRD's developer API: `getLiquidity()`. */
export async function getLiquidity(
  client: StockFlowClient,
  owner: PublicKey
): Promise<number> {
  const portfolio = await getPortfolio(client, owner);
  return portfolio.availableLiquidityUsd;
}
