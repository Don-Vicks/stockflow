#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;

pub mod constants;
pub mod cpi;
pub mod errors;
pub mod instructions;
pub mod risk;
pub mod state;

use instructions::*;
use state::flow::{Action, Constraints, Trigger};

declare_id!("8BUAepdHuQKHXGav9VbNcenVzZPvUvfNqUzPHTE8cUXx");

#[program]
pub mod stockflow {
    use super::*;

    // --- Vault Lifecycle ---

    pub fn initialize_vault(ctx: Context<InitializeVault>, keeper: Pubkey) -> Result<()> {
        instructions::vault::initialize(ctx, keeper)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::vault::deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::vault::withdraw(ctx, amount)
    }

    // --- Flow Lifecycle ---

    #[allow(clippy::too_many_arguments)]
    pub fn create_flow(
        ctx: Context<CreateFlow>,
        flow_id: u64,
        name: [u8; 32],
        trigger: Trigger,
        action: Action,
        source: crate::state::flow::Source,
        constraints: Constraints,
        destination: Pubkey,
    ) -> Result<()> {
        instructions::create_flow::handler(
            ctx,
            flow_id,
            name,
            trigger,
            action,
            source,
            constraints,
            destination,
        )
    }

    pub fn update_flow(
        ctx: Context<UpdateFlow>,
        name: Option<[u8; 32]>,
        trigger: Option<Trigger>,
        action: Option<Action>,
        source: Option<crate::state::flow::Source>,
        constraints: Option<Constraints>,
        destination: Option<Pubkey>,
    ) -> Result<()> {
        instructions::update_flow::handler(
            ctx,
            name,
            trigger,
            action,
            source,
            constraints,
            destination,
        )
    }

    pub fn execute_flow(ctx: Context<ExecuteFlow>) -> Result<()> {
        instructions::execute_flow::handler(ctx)
    }

    pub fn pause_flow(ctx: Context<SetFlowStatus>) -> Result<()> {
        instructions::pause_flow::pause(ctx)
    }

    pub fn resume_flow(ctx: Context<SetFlowStatus>) -> Result<()> {
        instructions::pause_flow::resume(ctx)
    }

    pub fn close_flow(ctx: Context<CloseFlow>) -> Result<()> {
        instructions::pause_flow::close(ctx)
    }

    // --- Protection Lifecycle ---

    pub fn init_protection_policy(
        ctx: Context<InitProtectionPolicy>,
        pause_threshold_bps: u16,
        resume_threshold_bps: u16,
    ) -> Result<()> {
        instructions::protection::init(ctx, pause_threshold_bps, resume_threshold_bps)
    }

    pub fn refresh_protection_policy(ctx: Context<RefreshProtectionPolicy>) -> Result<()> {
        instructions::protection::refresh(ctx)
    }

    pub fn update_protection_policy(
        ctx: Context<UpdateProtectionPolicy>,
        pause_threshold_bps: u16,
        resume_threshold_bps: u16,
    ) -> Result<()> {
        instructions::protection::update(ctx, pause_threshold_bps, resume_threshold_bps)
    }

    pub fn close_protection_policy(ctx: Context<CloseProtectionPolicy>) -> Result<()> {
        instructions::protection::close_protection(ctx)
    }
}
