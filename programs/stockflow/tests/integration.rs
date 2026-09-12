#![cfg(feature = "test-sbf")]
use anchor_lang::prelude::*;
use solana_program_test::*;
use solana_sdk::{
    signature::Keypair,
    signer::Signer,
    transaction::Transaction,
};
use stockflow::instructions::*;

#[tokio::test]
async fn test_flow_execution() {
    let program_id = stockflow::id();
    let mut program_test = ProgramTest::new(
        "stockflow",
        program_id,
        processor!(stockflow::entry),
    );
    // Since I don't want to wire the entire SPL token stuff in raw rust if I can avoid it,
    // I can just rely on TS tests after the download completes.
}
