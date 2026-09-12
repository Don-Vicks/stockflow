import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { EvmPriceServiceConnection } from '@pythnetwork/price-service-client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

// The StockFlow program ID on devnet
const STOCKFLOW_PROGRAM_ID = new PublicKey('8BUAepdHuQKHXGav9VbNcenVzZPvUvfNqUzPHTE8cUXx');

// Pyth Hermes endpoint for live prices
const PYTH_HERMES_URL = 'https://hermes.pyth.network';

// Load keypair from file or env
function loadKeypair(): Keypair {
  const secretKeyString = process.env.KEEPER_SECRET_KEY;
  if (secretKeyString) {
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    return Keypair.fromSecretKey(secretKey);
  }
  
  const keypairPath = process.env.KEEPER_KEYPAIR_PATH || `${process.env.HOME}/.config/solana/id.json`;
  if (fs.existsSync(keypairPath)) {
    const secretKeyString = fs.readFileSync(keypairPath, 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    return Keypair.fromSecretKey(secretKey);
  }
  
  throw new Error("Could not find keeper keypair. Set KEEPER_SECRET_KEY or KEEPER_KEYPAIR_PATH.");
}

async function main() {
  console.log("Starting StockFlow Keeper...");
  
  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');
  
  const keeperKeypair = loadKeypair();
  console.log(`Keeper Wallet: ${keeperKeypair.publicKey.toBase58()}`);
  
  // Set up Anchor provider
  const wallet = new anchor.Wallet(keeperKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);
  
  // Load the IDL dynamically (assuming target/idl/stockflow.json exists locally)
  const idlPath = './target/idl/stockflow.json';
  if (!fs.existsSync(idlPath)) {
      throw new Error(`IDL not found at ${idlPath}. Please run 'anchor build'.`);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8')) as anchor.Idl;
  const program = new anchor.Program(idl, STOCKFLOW_PROGRAM_ID, provider);
  
  // Set up Pyth Price Service
  const pythConnection = new EvmPriceServiceConnection(PYTH_HERMES_URL);
  
  console.log("Listening for flows to execute...");
  
  // Polling loop
  while (true) {
    try {
      // 1. Fetch all active Flow accounts
      const allFlows = await program.account.flow.all();
      
      const currentTime = Math.floor(Date.now() / 1000);
      
      for (const flowAccount of allFlows) {
        const flowData = flowAccount.account;
        
        // Skip paused flows
        if (flowData.status.paused) {
           continue;
        }
        
        let shouldExecute = false;
        
        // 2. Evaluate Triggers
        const trigger = flowData.trigger as any;
        
        if (trigger.timeInterval) {
           // Time-based trigger
           const nextExecutionTime = flowData.nextExecution.toNumber();
           if (currentTime >= nextExecutionTime) {
               shouldExecute = true;
               console.log(`[TimeInterval] Flow ${flowAccount.publicKey.toBase58()} is due for execution.`);
           }
        } else if (trigger.riskThreshold) {
           // Risk-based trigger
           // In a full implementation, we'd fetch the Pyth prices here to calculate LTV.
           // For this script, we'll demonstrate fetching prices:
           
           // E.g., AAPL/USD price feed id on Pyth
           const aaplFeedId = '0x49f6b65cb1df6dfacbfcb3cb42e471d87e07eb54f15ddf9e612a4505f0de3fb5';
           const priceFeeds = await pythConnection.getLatestPriceFeeds([aaplFeedId]);
           
           if (priceFeeds && priceFeeds.length > 0) {
               const price = priceFeeds[0].getPriceUnchecked();
               console.log(`Fetched AAPL price: ${price.price} x 10^${price.expo}`);
               
               // ... calculate LTV using the price and vault balances ...
               // If LTV > trigger.riskThreshold.ltvBps, set shouldExecute = true
           }
           
           // Dummy trigger for demonstration if we want to run it:
           // shouldExecute = currentLtv > trigger.riskThreshold.ltvBps;
        } else if (trigger.onDemand) {
            // OnDemand flows are triggered explicitly by user or backend, usually not polled by keeper.
            // Though we could execute it if we want.
        }
        
        // 3. Execute Flow if condition met
        if (shouldExecute) {
            console.log(`Executing Flow: ${flowAccount.publicKey.toBase58()}...`);

            try {
              const owner = flowData.owner as PublicKey;

              // --- Derive PDAs ---
              // Vault PDA — seeds: ["vault", owner]
              const [vault] = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), owner.toBuffer()],
                STOCKFLOW_PROGRAM_ID
              );

              // Vault Authority PDA — seeds: ["vault_authority", owner]
              const [vaultAuthority] = PublicKey.findProgramAddressSync(
                [Buffer.from("vault_authority"), owner.toBuffer()],
                STOCKFLOW_PROGRAM_ID
              );

              // Protection Policy PDA — seeds: ["protection_policy", owner]
              const [protectionPolicy] = PublicKey.findProgramAddressSync(
                [Buffer.from("protection_policy"), owner.toBuffer()],
                STOCKFLOW_PROGRAM_ID
              );

              // --- Resolve token accounts from the flow's stored mints ---
              // The flow stores the source and destination mints so the keeper
              // can derive the vault's associated token accounts at runtime.
              const TOKEN_PROGRAM_ID = new PublicKey(
                "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
              );
              const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
                "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1brs"
              );

              // Derive the vault's ATA for the source mint (collateral token).
              const sourceMint = (flowData as any).sourceMint as PublicKey | undefined;
              const destinationMint = (flowData as any).destinationMint as PublicKey | undefined;

              if (!sourceMint || !destinationMint) {
                console.warn(`Flow ${flowAccount.publicKey.toBase58()} is missing mint data — skipping.`);
                continue;
              }

              const [sourceTokenAccount] = PublicKey.findProgramAddressSync(
                [vault.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), sourceMint.toBuffer()],
                ASSOCIATED_TOKEN_PROGRAM_ID
              );

              // Destination ATA — owned by the flow's destination pubkey
              const destination = flowData.destination as PublicKey;
              const [destinationTokenAccount] = PublicKey.findProgramAddressSync(
                [destination.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), destinationMint.toBuffer()],
                ASSOCIATED_TOKEN_PROGRAM_ID
              );

              // --- Submit the execute_flow transaction ---
              const tx = await (program.methods as any).executeFlow()
                .accounts({
                  caller: keeperKeypair.publicKey,
                  vault,
                  vaultAuthority,
                  flow: flowAccount.publicKey,
                  protectionPolicy,
                  sourceTokenAccount,
                  destinationTokenAccount,
                  tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

              console.log(`✅ Flow executed. Tx: ${tx}`);
            } catch (execErr) {
              // Log and continue — do not crash the keeper on a single failed execution.
              console.error(
                `❌ Failed to execute flow ${flowAccount.publicKey.toBase58()}:`,
                execErr instanceof Error ? execErr.message : execErr
              );
            }
        }
      }
      
    } catch (err) {
      console.error("Error in polling loop:", err);
    }
    
    // Wait for a reasonable polling interval (e.g., 30 seconds)
    await new Promise(resolve => setTimeout(resolve, 30_000));
  }
}

main().catch(err => {
  console.error("Keeper script failed:", err);
  process.exit(1);
});
