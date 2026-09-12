use anchor_lang::prelude::*;

use crate::constants::PROTECTION_SEED;
use crate::cpi::kamino;
use crate::risk::project_ltv_bps;
use crate::state::protection::ProtectionPolicy;

#[derive(Accounts)]
pub struct InitProtectionPolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + ProtectionPolicy::INIT_SPACE,
        seeds = [PROTECTION_SEED, owner.key().as_ref()],
        bump
    )]
    pub protection_policy: Account<'info, ProtectionPolicy>,

    pub system_program: Program<'info, System>,
}

pub fn init(
    ctx: Context<InitProtectionPolicy>,
    pause_threshold_bps: u16,
    resume_threshold_bps: u16,
) -> Result<()> {
    let policy = &mut ctx.accounts.protection_policy;
    policy.owner = ctx.accounts.owner.key();
    policy.pause_threshold_bps = pause_threshold_bps;
    policy.resume_threshold_bps = resume_threshold_bps;
    policy.spending_paused = false;
    policy.updated_at = Clock::get()?.unix_timestamp;
    policy.bump = ctx.bumps.protection_policy;
    Ok(())
}

#[derive(Accounts)]
pub struct RefreshProtectionPolicy<'info> {
    #[account(
        mut,
        seeds = [PROTECTION_SEED, protection_policy.owner.as_ref()],
        bump = protection_policy.bump,
    )]
    pub protection_policy: Account<'info, ProtectionPolicy>,
}

/// Callable by anyone (including the automation worker) — this only
/// ever moves the policy based on the owner's own on-chain LTV, so
/// there's nothing unsafe about it being permissionless. This is what
/// lets "if LTV > 35%, stop spending" run without the owner present.
pub fn refresh(ctx: Context<RefreshProtectionPolicy>) -> Result<()> {
    let policy = &mut ctx.accounts.protection_policy;
    let obligation = kamino::read_obligation_usd(ctx.remaining_accounts)?;
    let current_ltv = project_ltv_bps(obligation, 0)?;

    if !policy.spending_paused && current_ltv >= policy.pause_threshold_bps {
        policy.spending_paused = true;
    } else if policy.spending_paused && current_ltv <= policy.resume_threshold_bps {
        policy.spending_paused = false;
    }

    policy.updated_at = Clock::get()?.unix_timestamp;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateProtectionPolicy<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [PROTECTION_SEED, protection_policy.owner.as_ref()],
        bump = protection_policy.bump,
        has_one = owner @ crate::errors::StockFlowError::Unauthorized,
    )]
    pub protection_policy: Account<'info, ProtectionPolicy>,
}

pub fn update(
    ctx: Context<UpdateProtectionPolicy>,
    pause_threshold_bps: u16,
    resume_threshold_bps: u16,
) -> Result<()> {
    require!(
        resume_threshold_bps < pause_threshold_bps,
        crate::errors::StockFlowError::InvalidProtectionThresholds
    );
    let policy = &mut ctx.accounts.protection_policy;
    policy.pause_threshold_bps = pause_threshold_bps;
    policy.resume_threshold_bps = resume_threshold_bps;
    policy.updated_at = Clock::get()?.unix_timestamp;
    Ok(())
}

#[derive(Accounts)]
pub struct CloseProtectionPolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        close = owner,
        seeds = [PROTECTION_SEED, protection_policy.owner.as_ref()],
        bump = protection_policy.bump,
        has_one = owner @ crate::errors::StockFlowError::Unauthorized,
    )]
    pub protection_policy: Account<'info, ProtectionPolicy>,
}

pub fn close_protection(_ctx: Context<CloseProtectionPolicy>) -> Result<()> {
    Ok(()) // Anchor's `close = owner` handles rent reclamation
}
