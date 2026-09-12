use anchor_lang::prelude::*;

use crate::constants::FLOW_SEED;
use crate::errors::StockFlowError;
use crate::state::flow::*;

#[derive(Accounts)]
pub struct SetFlowStatus<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [FLOW_SEED, flow.owner.as_ref(), &flow.flow_id.to_le_bytes()],
        bump = flow.bump,
        has_one = owner @ StockFlowError::Unauthorized,
    )]
    pub flow: Account<'info, Flow>,
}

pub fn pause(ctx: Context<SetFlowStatus>) -> Result<()> {
    ctx.accounts.flow.status = FlowStatus::Paused;
    Ok(())
}

pub fn resume(ctx: Context<SetFlowStatus>) -> Result<()> {
    ctx.accounts.flow.status = FlowStatus::Active;
    Ok(())
}

/// Reclaims the Flow account's rent back to the owner. Requires the
/// Flow to be Paused first (a separate, explicit transaction) rather
/// than allowing a direct close from Active — this is a deliberate
/// two-step so a Flow can't be closed in the same instant an
/// automation worker is mid-flight on it, and so the pause is visible
/// in the owner's transaction history before the closure.
#[derive(Accounts)]
pub struct CloseFlow<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        close = owner,
        seeds = [FLOW_SEED, flow.owner.as_ref(), &flow.flow_id.to_le_bytes()],
        bump = flow.bump,
        has_one = owner @ StockFlowError::Unauthorized,
    )]
    pub flow: Account<'info, Flow>,
}

pub fn close(ctx: Context<CloseFlow>) -> Result<()> {
    require!(
        ctx.accounts.flow.status == FlowStatus::Paused,
        StockFlowError::FlowMustBePausedToClose
    );
    Ok(())
}
