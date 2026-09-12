use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::StockFlowError;
use crate::state::flow::*;
use crate::state::vault::Vault;

#[derive(Accounts)]
#[instruction(flow_id: u64)]
pub struct CreateFlow<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The owner's vault must exist before creating a Flow, because
    /// execute_flow draws from the vault's token accounts.
    #[account(
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ StockFlowError::Unauthorized,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = owner,
        space = 8 + Flow::INIT_SPACE,
        seeds = [FLOW_SEED, owner.key().as_ref(), &flow_id.to_le_bytes()],
        bump
    )]
    pub flow: Account<'info, Flow>,

    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<CreateFlow>,
    flow_id: u64,
    name: [u8; 32],
    trigger: Trigger,
    action: Action,
    source: crate::state::flow::Source,
    constraints: Constraints,
    destination: Pubkey,
) -> Result<()> {
    require!(
        constraints.max_ltv_bps <= PROTOCOL_MAX_LTV_BPS,
        StockFlowError::ProtocolLtvCeilingExceeded
    );

    let now = Clock::get()?.unix_timestamp;
    let flow = &mut ctx.accounts.flow;

    flow.owner = ctx.accounts.owner.key();
    flow.flow_id = flow_id;
    flow.name = name;
    flow.next_execution = Flow::compute_next_execution(&trigger, now);
    flow.execution_count = 0;
    flow.trigger = trigger;
    flow.action = action;
    flow.source = source;
    flow.constraints = constraints;
    flow.destination = destination;
    flow.status = FlowStatus::Active;
    flow.last_executed_at = 0;
    flow.created_at = now;
    flow.bump = ctx.bumps.flow;

    // Log a human-readable name for the explorer / automation worker.
    let name_str = std::str::from_utf8(&name)
        .unwrap_or("<invalid utf8>")
        .trim_end_matches('\0');

    msg!(
        "Flow #{} \"{}\" created for owner {}",
        flow_id,
        name_str,
        flow.owner
    );

    Ok(())
}
