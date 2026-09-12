use anchor_lang::prelude::*;

/// Policy Vault — a PDA-controlled token custodian, one per owner.
///
/// Holds the owner's tokenized stocks and USDC so the program can sign
/// token transfers on their behalf via the `vault_authority` PDA. This
/// is the "smart-contract-controlled account" the PRD (§8.5) describes:
///
///   "A Policy Vault prevents the automation layer from having
///    unrestricted custody."
///
/// User flow: initialize_vault → deposit → create_flow → execute_flow.
#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,

    /// PDA that is set as the SPL token authority for all vault token
    /// accounts. Seeds: [VAULT_AUTHORITY_SEED, owner]. The program uses
    /// this PDA to sign transfers in execute_flow so the automation
    /// worker never holds direct authority over user assets.
    pub vault_authority: Pubkey,
    pub vault_authority_bump: u8,

    /// Pubkey of the registered automation keeper (e.g. the off-chain
    /// worker's keypair, or a Tuk Tuk task signer). Stored here so
    /// execute_flow can verify: caller == owner OR caller == keeper.
    /// The owner can update this via update_vault_keeper.
    pub keeper: Pubkey,

    pub created_at: i64,
    pub bump: u8,
}

impl Vault {
    // discriminator(8) + owner(32) + vault_authority(32)
    // + vault_authority_bump(1) + keeper(32) + created_at(8) + bump(1)
     
}
