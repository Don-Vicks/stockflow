//! Vault instructions — the deposit/withdraw custodian layer.
//!
//! Flow:  initialize_vault → deposit (any supported mint) → [create_flow]
//!        → execute_flow (vault_authority PDA signs transfers)
//!        → withdraw (owner only, any time)
//!
//! Security guarantees:
//! - Only the owner can deposit, withdraw, or initialize.
//! - execute_flow moves funds using the vault_authority PDA — the
//!   automation worker never holds token authority.
//! - Depositing a new mint auto-creates the vault's associated token
//!   account for that mint via `init_if_needed`.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::{VAULT_AUTHORITY_SEED, VAULT_SEED};
use crate::errors::StockFlowError;
use crate::state::vault::Vault;

// ── initialize_vault ──────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: Derived PDA — no lamports or data, just used as token authority.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, owner.key().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Creates the Vault PDA for `owner` and records the automation keeper.
/// Must be called once before any deposits or Flow creation.
///
/// `keeper` — the pubkey of the off-chain automation worker that will be
/// allowed to call execute_flow without the owner's signature. Set to
/// `owner` during development if no separate keeper is configured.
pub fn initialize(ctx: Context<InitializeVault>, keeper: Pubkey) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.owner = ctx.accounts.owner.key();
    vault.vault_authority = ctx.accounts.vault_authority.key();
    vault.vault_authority_bump = ctx.bumps.vault_authority;
    vault.keeper = keeper;
    vault.created_at = Clock::get()?.unix_timestamp;
    vault.bump = ctx.bumps.vault;

    msg!(
        "Vault initialized for {} — keeper: {} authority: {}",
        vault.owner,
        vault.keeper,
        vault.vault_authority,
    );
    Ok(())
}

// ── deposit ───────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ StockFlowError::Unauthorized,
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: Vault authority PDA — validated via seeds.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, owner.key().as_ref()],
        bump = vault.vault_authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// Owner's source token account (authority must be the owner).
    #[account(
        mut,
        token::mint = mint,
        constraint = owner_token_account.owner == owner.key()
            @ StockFlowError::Unauthorized,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    /// Vault's token account for this mint. Created automatically if it
    /// doesn't exist yet — one call handles all supported mints (USDC,
    /// NVDAx, AAPLx, etc.).
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, StockFlowError::AmountLimitExceeded);

    let cpi_accounts = Transfer {
        from: ctx.accounts.owner_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts),
        amount,
    )?;

    msg!(
        "Deposited {} units of mint {} into vault",
        amount,
        ctx.accounts.mint.key()
    );
    Ok(())
}

// ── withdraw ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub owner: Signer<'info>,

    #[account(
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ StockFlowError::Unauthorized,
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: Vault authority PDA — signs the outgoing transfer.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, owner.key().as_ref()],
        bump = vault.vault_authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = mint,
        constraint = owner_token_account.owner == owner.key()
            @ StockFlowError::Unauthorized,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    require!(amount > 0, StockFlowError::AmountLimitExceeded);
    require!(
        ctx.accounts.vault_token_account.amount >= amount,
        StockFlowError::AmountLimitExceeded
    );

    let owner_key = ctx.accounts.owner.key();
    let vault_auth_bump = ctx.accounts.vault.vault_authority_bump;
    let seeds: &[&[u8]] = &[
        VAULT_AUTHORITY_SEED,
        owner_key.as_ref(),
        &[vault_auth_bump],
    ];
    let signer_seeds = &[seeds];

    let cpi_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.owner_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            signer_seeds,
        ),
        amount,
    )?;

    msg!(
        "Withdrew {} units of mint {} from vault",
        amount,
        ctx.accounts.mint.key()
    );
    Ok(())
}
