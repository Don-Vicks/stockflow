//! update_flow — lets the owner modify a Flow's configuration.
//!
//! Security: the Flow MUST be Paused before it can be edited. This prevents
//! a mid-flight automation execution from racing with a config change.
//! The owner pauses → edits → resumes as three separate, visible txs.

use anchor_lang::prelude::*;

use crate::constants::{FLOW_SEED, PROTOCOL_MAX_LTV_BPS};
use crate::errors::StockFlowError;
use crate::state::flow::*;

#[derive(Accounts)]
pub struct UpdateFlow<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [FLOW_SEED, flow.owner.as_ref(), &flow.flow_id.to_le_bytes()],
        bump = flow.bump,
        has_one = owner @ StockFlowError::Unauthorized,
        // Must be paused to edit — prevents race with automation worker.
        constraint = flow.status == FlowStatus::Paused
            @ StockFlowError::FlowPaused,
    )]
    pub flow: Account<'info, Flow>,
}

/// All parameters are `Option<_>` — only fields that are `Some(...)` will
/// be updated. Pass `None` to leave a field unchanged.
pub fn handler(
    ctx: Context<UpdateFlow>,
    name: Option<[u8; 32]>,
    trigger: Option<Trigger>,
    action: Option<Action>,
    source: Option<crate::state::flow::Source>,
    constraints: Option<Constraints>,
    destination: Option<Pubkey>,
) -> Result<()> {
    let flow = &mut ctx.accounts.flow;
    let now = Clock::get()?.unix_timestamp;

    if let Some(n) = name {
        flow.name = n;
    }
    if let Some(t) = trigger {
        // Recompute next_execution when the trigger changes so the UI
        // can display "Next run: <date>" immediately after the edit.
        flow.next_execution = Flow::compute_next_execution(&t, now);
        flow.trigger = t;
    }
    if let Some(a) = action {
        flow.action = a;
    }
    if let Some(s) = source {
        flow.source = s;
    }
    if let Some(c) = constraints {
        require!(
            c.max_ltv_bps <= PROTOCOL_MAX_LTV_BPS,
            StockFlowError::ProtocolLtvCeilingExceeded
        );
        flow.constraints = c;
    }
    if let Some(d) = destination {
        flow.destination = d;
    }

    msg!("Flow {} updated by owner {}", flow.flow_id, flow.owner);
    Ok(())
}
