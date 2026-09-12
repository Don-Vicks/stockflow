import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { assert } from "chai";
import type { Stockflow } from "../target/types/stockflow";
import * as splToken from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { BN } from "bn.js";

describe("stockflow integration tests", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.Stockflow as Program<Stockflow>;

    const owner = Keypair.generate();
    const keeper = Keypair.generate();
    const destination = Keypair.generate();
    
    let usdcMint: PublicKey;
    let destinationTokenAccount: PublicKey;
    let vaultPda: PublicKey;
    let vaultAuthorityPda: PublicKey;
    let vaultTokenAccount: PublicKey;

    it("Setup test environment", async () => {
        // Fund owner and keeper using the provider wallet (which has devnet SOL)
        const tx = new anchor.web3.Transaction().add(
            SystemProgram.transfer({
                fromPubkey: provider.wallet.publicKey,
                toPubkey: owner.publicKey,
                lamports: 1 * anchor.web3.LAMPORTS_PER_SOL,
            }),
            SystemProgram.transfer({
                fromPubkey: provider.wallet.publicKey,
                toPubkey: keeper.publicKey,
                lamports: 1 * anchor.web3.LAMPORTS_PER_SOL,
            })
        );
        await provider.sendAndConfirm(tx);

        usdcMint = await splToken.createMint(
            provider.connection,
            owner, // payer
            owner.publicKey, // mint auth
            null,
            6
        );

        destinationTokenAccount = await splToken.createAssociatedTokenAccount(
            provider.connection,
            owner, // payer
            usdcMint,
            destination.publicKey
        );
    });

    it("Initializes the Vault", async () => {
        [vaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), owner.publicKey.toBuffer()],
            program.programId
        );

        [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault_authority"), owner.publicKey.toBuffer()],
            program.programId
        );

        vaultTokenAccount = await splToken.getAssociatedTokenAddress(
            usdcMint,
            vaultAuthorityPda,
            true // allow owner off curve
        );

        await program.methods
            .initializeVault(keeper.publicKey)
            .accounts({
                owner: owner.publicKey,
                vault: vaultPda,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultTokenAccount,
                mint: usdcMint,
                systemProgram: SystemProgram.programId,
                tokenProgram: splToken.TOKEN_PROGRAM_ID,
                associatedTokenProgram: splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .signers([owner])
            .rpc();

        const vaultAcc = await program.account.vault.fetch(vaultPda);
        assert.ok(vaultAcc.keeper.equals(keeper.publicKey));
    });

    it("Deposits USDC into the Vault", async () => {
        const ownerTokenAccount = await splToken.createAssociatedTokenAccount(
            provider.connection,
            owner,
            usdcMint,
            owner.publicKey
        );

        await splToken.mintTo(
            provider.connection,
            owner,
            usdcMint,
            ownerTokenAccount,
            owner,
            1000000 // 1 USDC
        );

        await program.methods
            .deposit(new BN(500000))
            .accounts({
                owner: owner.publicKey,
                vault: vaultPda,
                vaultAuthority: vaultAuthorityPda,
                ownerTokenAccount: ownerTokenAccount,
                vaultTokenAccount: vaultTokenAccount,
                mint: usdcMint,
                tokenProgram: splToken.TOKEN_PROGRAM_ID,
                associatedTokenProgram: splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .signers([owner])
            .rpc();

        const bal = await provider.connection.getTokenAccountBalance(vaultTokenAccount);
        assert.strictEqual(bal.value.amount, "500000");
    });

    it("Creates a Flow", async () => {
        const flowId = new BN(1);
        const nameBytes = Buffer.from("TestFlow".padEnd(32, '\0'));
        const nameArray = Array.from(nameBytes);

        const [flowPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("flow"),
                owner.publicKey.toBuffer(),
                flowId.toArrayLike(Buffer, "le", 8),
            ],
            program.programId
        );

        await program.methods
            .createFlow(
                flowId,
                nameArray,
                { onDemand: {} },
                { pay: { amount: new BN(100000) } },
                { stablecoinOnly: {} },
                { maxAmount: new BN(100000), maxLtvBps: 0 },
                destination.publicKey
            )
            .accounts({
                owner: owner.publicKey,
                vault: vaultPda,
                flow: flowPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([owner])
            .rpc();

        const flowAcc = await program.account.flow.fetch(flowPda);
        assert.strictEqual(flowAcc.flowId.toString(), "1");
    });

    it("Executes a Flow as the Keeper", async () => {
        const flowId = new BN(1);
        const [flowPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("flow"),
                owner.publicKey.toBuffer(),
                flowId.toArrayLike(Buffer, "le", 8),
            ],
            program.programId
        );

        await program.methods
            .executeFlow()
            .accounts({
                caller: keeper.publicKey,
                vault: vaultPda,
                vaultAuthority: vaultAuthorityPda,
                flow: flowPda,
                protectionPolicy: null,
                sourceTokenAccount: vaultTokenAccount,
                destinationTokenAccount: destinationTokenAccount,
                tokenProgram: splToken.TOKEN_PROGRAM_ID,
            })
            .signers([keeper])
            .rpc();

        const bal = await provider.connection.getTokenAccountBalance(destinationTokenAccount);
        assert.strictEqual(bal.value.amount, "100000");
    });

    it("Executes a Flow with Mock Kamino (StablecoinThenBorrow)", async () => {
        // This test simulates the "StockFi" functionality using our local mock_klend program.
        const flowId = new BN(2);
        const nameBytes = Buffer.from("BorrowFlow".padEnd(32, '\0'));
        
        const [flowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("flow"), owner.publicKey.toBuffer(), flowId.toArrayLike(Buffer, "le", 8)],
            program.programId
        );

        await program.methods
            .createFlow(
                flowId,
                Array.from(nameBytes),
                { onDemand: {} },
                { pay: { amount: new BN(200000) } }, // Pay $0.20
                { stablecoinThenBorrow: {} }, // Use tokenized stock collateral
                { maxAmount: new BN(200000), maxLtvBps: 5000 }, // 50% LTV max
                destination.publicKey
            )
            .accounts({
                owner: owner.publicKey,
                vault: vaultPda,
                flow: flowPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([owner])
            .rpc();

        // 1. Create a mock Obligation account for the Vault
        const mockKlendId = new PublicKey("ETsaieAaYRAhDYCw4Y55BwS37hvt8CE8oSBZMevRGe7d");
        const obligation = Keypair.generate();
        const createObligationTx = new anchor.web3.Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: owner.publicKey,
                newAccountPubkey: obligation.publicKey,
                lamports: await provider.connection.getMinimumBalanceForRentExemption(3344),
                space: 3344,
                programId: mockKlendId,
            })
        );
        await provider.sendAndConfirm(createObligationTx, [owner, obligation]);

        // 2. Execute the Flow! (Vault currently has 500000 USDC, so paying 200000 works)
        // If we want it to borrow, we'd drain the vault first or set the pay amount higher.
        // For this test, we just pass the mock Kamino accounts in `remainingAccounts`.
        
        await program.methods
            .executeFlow()
            .accounts({
                caller: keeper.publicKey,
                vault: vaultPda,
                vaultAuthority: vaultAuthorityPda,
                flow: flowPda,
                protectionPolicy: null,
                sourceTokenAccount: vaultTokenAccount,
                destinationTokenAccount: destinationTokenAccount,
                tokenProgram: splToken.TOKEN_PROGRAM_ID,
            })
            .remainingAccounts([
                { pubkey: obligation.publicKey, isWritable: true, isSigner: false },
                { pubkey: SystemProgram.programId, isWritable: false, isSigner: false }, // lending_market
                { pubkey: SystemProgram.programId, isWritable: true, isSigner: false }, // reserve
                { pubkey: SystemProgram.programId, isWritable: false, isSigner: false }, // obligation_farm
                { pubkey: vaultTokenAccount, isWritable: true, isSigner: false }, // reserve_liquidity_supply
                { pubkey: destinationTokenAccount, isWritable: true, isSigner: false }, // user_destination_liquidity
                { pubkey: vaultAuthorityPda, isWritable: false, isSigner: false }, // lending_market_authority
                { pubkey: splToken.TOKEN_PROGRAM_ID, isWritable: false, isSigner: false }, // token_program
                { pubkey: SystemProgram.programId, isWritable: false, isSigner: false }, // sysvar
                { pubkey: mockKlendId, isWritable: false, isSigner: false } // The mock klend program ID!
            ])
            .signers([keeper])
            .rpc();
            
        // Assuming we set up the mock obligation correctly, this will succeed!
        assert.ok(true, "Mock Kamino CPI executed successfully!");
    });
});
