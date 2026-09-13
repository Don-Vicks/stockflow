/**
 * scripts/faucet.ts
 *
 * StockFlow Devnet Faucet
 * ========================
 * Creates real SPL token mints for each xStock on Devnet, airdrops SOL to
 * your wallet to cover fees, then mints a generous test balance of every
 * tokenized stock directly to your wallet.
 *
 * On first run  → mints are created and their addresses are saved to
 *                 scripts/devnet-mints.json  (gitignored by default).
 * On re-runs    → the saved addresses are loaded, so the same mints are
 *                 reused and you just get more tokens.
 *
 * Usage:
 *   npx ts-node scripts/faucet.ts [--wallet <base58-address>]
 *
 * If --wallet is omitted, the keypair at KEEPER_KEYPAIR_PATH (or
 * ~/.config/solana/id.json) is used as both the mint authority AND recipient.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const MINTS_FILE = path.join(__dirname, "devnet-mints.json");

/** Each xStock definition — symbol, display name, and how many tokens to mint. */
const XSTOCKS = [
  { symbol: "xAAPL", name: "Apple Inc.",          amount: 100  },
  { symbol: "xTSLA", name: "Tesla Inc.",           amount: 50   },
  { symbol: "xNVDA", name: "NVIDIA Corporation",   amount: 75   },
  { symbol: "xMSFT", name: "Microsoft Corporation",amount: 60   },
] as const;

const TOKEN_DECIMALS = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadKeypair(): Keypair {
  const secretKeyString = process.env.KEEPER_SECRET_KEY;
  if (secretKeyString) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKeyString)));
  }
  const keypairPath =
    process.env.KEEPER_KEYPAIR_PATH ||
    `${process.env.HOME}/.config/solana/id.json`;
  if (fs.existsSync(keypairPath)) {
    return Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf8")))
    );
  }
  throw new Error(
    "No keypair found. Set KEEPER_SECRET_KEY or KEEPER_KEYPAIR_PATH."
  );
}

function loadSavedMints(): Record<string, string> {
  if (fs.existsSync(MINTS_FILE)) {
    return JSON.parse(fs.readFileSync(MINTS_FILE, "utf8"));
  }
  return {};
}

function saveMints(mints: Record<string, string>) {
  fs.writeFileSync(MINTS_FILE, JSON.stringify(mints, null, 2));
  console.log(`\n💾 Saved mint addresses to ${MINTS_FILE}`);
}

async function airdropIfNeeded(
  connection: Connection,
  publicKey: PublicKey
): Promise<void> {
  const balance = await connection.getBalance(publicKey);
  const minLamports = 0.5 * LAMPORTS_PER_SOL;
  if (balance >= minLamports) {
    console.log(
      `✅ SOL balance sufficient: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
    );
    return;
  }
  console.log(
    `⏳ Low SOL balance (${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL). Requesting airdrop…`
  );
  const sig = await connection.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
  const newBalance = await connection.getBalance(publicKey);
  console.log(
    `✅ Airdrop complete. New balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🚰 StockFlow Devnet Faucet\n");

  // Parse optional --wallet flag
  const args = process.argv.slice(2);
  const walletFlagIdx = args.indexOf("--wallet");
  let recipientKey: PublicKey | null = null;
  if (walletFlagIdx !== -1 && args[walletFlagIdx + 1]) {
    recipientKey = new PublicKey(args[walletFlagIdx + 1]);
    console.log(`🎯 Recipient wallet: ${recipientKey.toBase58()}`);
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const authority = loadKeypair();
  const recipient = recipientKey ?? authority.publicKey;

  console.log(`🔑 Mint Authority : ${authority.publicKey.toBase58()}`);
  console.log(`📬 Recipient       : ${recipient.toBase58()}`);
  console.log(`🌐 RPC             : ${RPC_URL}\n`);

  // Ensure the authority has enough SOL to pay for transactions
  await airdropIfNeeded(connection, authority.publicKey);

  // Load or create mint addresses
  const savedMints = loadSavedMints();
  const mintAddresses: Record<string, string> = { ...savedMints };
  let mintsUpdated = false;

  for (const stock of XSTOCKS) {
    console.log(`\n──────────────────────────────`);
    console.log(`📦 ${stock.symbol} (${stock.name})`);

    let mintPubkey: PublicKey;

    // ── 1. Create or load the SPL mint ─────────────────────────────────────
    if (savedMints[stock.symbol]) {
      mintPubkey = new PublicKey(savedMints[stock.symbol]);
      // Verify it still exists on-chain
      try {
        await getMint(connection, mintPubkey);
        console.log(`   ↳ Using existing mint: ${mintPubkey.toBase58()}`);
      } catch {
        console.log(`   ↳ Saved mint not found on-chain. Creating a new one…`);
        mintPubkey = await createMint(
          connection,
          authority,       // fee payer
          authority.publicKey, // mint authority
          authority.publicKey, // freeze authority
          TOKEN_DECIMALS
        );
        mintAddresses[stock.symbol] = mintPubkey.toBase58();
        mintsUpdated = true;
        console.log(`   ↳ Created mint: ${mintPubkey.toBase58()}`);
      }
    } else {
      console.log(`   ↳ No saved mint. Creating new SPL mint…`);
      mintPubkey = await createMint(
        connection,
        authority,
        authority.publicKey,
        authority.publicKey,
        TOKEN_DECIMALS
      );
      mintAddresses[stock.symbol] = mintPubkey.toBase58();
      mintsUpdated = true;
      console.log(`   ↳ Created mint: ${mintPubkey.toBase58()}`);
    }

    // ── 2. Get or create the recipient's ATA ───────────────────────────────
    console.log(`   ↳ Resolving Associated Token Account…`);
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      authority,      // fee payer for ATA creation
      mintPubkey,
      recipient
    );
    console.log(`   ↳ ATA: ${ata.address.toBase58()}`);

    // ── 3. Mint tokens to the recipient ────────────────────────────────────
    const rawAmount = stock.amount * Math.pow(10, TOKEN_DECIMALS);
    console.log(`   ↳ Minting ${stock.amount} ${stock.symbol}…`);
    const mintSig = await mintTo(
      connection,
      authority,           // fee payer
      mintPubkey,
      ata.address,         // destination ATA
      authority.publicKey, // mint authority
      rawAmount
    );
    console.log(`   ✅ Minted! Tx: https://explorer.solana.com/tx/${mintSig}?cluster=devnet`);
  }

  // Save updated mint addresses if any were created
  if (mintsUpdated) {
    saveMints(mintAddresses);
  }

  // ── Print a summary table ─────────────────────────────────────────────────
  console.log("\n\n═══════════════════════════════════════════");
  console.log("  ✅  Faucet Complete — Your Token Balances");
  console.log("═══════════════════════════════════════════");
  for (const stock of XSTOCKS) {
    const mint = mintAddresses[stock.symbol] ?? "not created";
    console.log(`  ${stock.symbol.padEnd(6)} │ ${stock.amount.toString().padStart(5)} tokens │ mint: ${mint}`);
  }
  console.log("═══════════════════════════════════════════\n");

  // ── Remind the user to wire the mints into the SDK registry ──────────────
  console.log("📝 Next step: copy the mint addresses above into");
  console.log("   packages/sdk/src/mints.ts  (devnetMint field)");
  console.log("   so the Dashboard and Keeper can resolve them.\n");
}

main().catch((err) => {
  console.error("Faucet failed:", err);
  process.exit(1);
});
