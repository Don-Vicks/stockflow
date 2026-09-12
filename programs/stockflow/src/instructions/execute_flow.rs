use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::cpi::kamino;
use crate::errors::StockFlowError;
use crate::risk::project_ltv_bps;
use crate::state::flow::*;
use crate::state::protection::ProtectionPolicy;
use crate::state::vault::Vault;

#[derive(Accounts)]
pub struct ExecuteFlow<'info> {
    /// Owner or the automation worker's keeper keypair.
    pub caller: Signer<'info>,

    #[account(
        seeds = [VAULT_SEED, flow.owner.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: PDA, no data — signs token transfers.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, flow.owner.as_ref()],
        bump = vault.vault_authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [FLOW_SEED, flow.owner.as_ref(), &flow.flow_id.to_le_bytes()],
        bump = flow.bump,
    )]
    pub flow: Account<'info, Flow>,

    /// Optional: present only when a Protection policy exists for this owner.
    #[account(
        seeds = [PROTECTION_SEED, flow.owner.as_ref()],
        bump,
    )]
    pub protection_policy: Option<Account<'info, ProtectionPolicy>>,

    /// Source USDC token account held by the vault (authority = vault_authority).
    #[account(
        mut,
        constraint = source_token_account.owner == vault_authority.key()
    )]
    pub source_token_account: Account<'info, TokenAccount>,

    /// Destination token account for Pay actions.
    #[account(mut)]
    pub destination_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ExecuteFlow>) -> Result<()> {
    let flow = &mut ctx.accounts.flow;

    require!(
        ctx.accounts.caller.key() == flow.owner
            || ctx.accounts.caller.key() == ctx.accounts.vault.keeper,
        StockFlowError::Unauthorized
    );

    let now = Clock::get()?.unix_timestamp;

    require!(flow.status == FlowStatus::Active, StockFlowError::FlowPaused);

    let obligation = kamino::read_obligation_usd(ctx.remaining_accounts)?;

    // --- Trigger check ---
    match flow.trigger {
        Trigger::TimeInterval { interval_seconds } => {
            let elapsed = now
                .checked_sub(flow.last_executed_at)
                .ok_or(StockFlowError::MathOverflow)?;
            require!(
                flow.last_executed_at == 0 || elapsed >= interval_seconds,
                StockFlowError::TriggerConditionsNotMet
            );
        }
        Trigger::OnDemand => {}
        Trigger::RiskThreshold { ltv_bps } => {
            let current_ltv = project_ltv_bps(obligation, 0)?;
            require!(current_ltv >= ltv_bps, StockFlowError::TriggerConditionsNotMet);
        }
    }

    let since_last = now.checked_sub(flow.last_executed_at).unwrap_or(i64::MAX);
    require!(
        flow.last_executed_at == 0 || since_last >= MIN_EXECUTION_INTERVAL_SECONDS,
        StockFlowError::ExecutionTooSoon
    );

    // --- Portfolio Protection check ---
    if let Some(policy) = &ctx.accounts.protection_policy {
        let blocks_spending = matches!(flow.action, Action::Pay { .. } | Action::Borrow { .. });
        require!(
            !(policy.spending_paused && blocks_spending),
            StockFlowError::ProtectionActive
        );
    }

    // --- Action + constraints enforcement ---
    let owner_key = flow.owner;
    let vault_auth_bump = ctx.accounts.vault.vault_authority_bump;
    let seeds: &[&[u8]] = &[
        VAULT_AUTHORITY_SEED,
        owner_key.as_ref(),
        &[vault_auth_bump],
    ];
    let signer_seeds = &[seeds];

    match flow.action {
        Action::Pay { amount } => {
            require!(
                amount <= flow.constraints.max_amount,
                StockFlowError::AmountLimitExceeded
            );
            require!(
                ctx.accounts.destination_token_account.owner == flow.destination,
                StockFlowError::UnauthorizedRecipient
            );

            let available = ctx.accounts.source_token_account.amount;
            let shortfall = amount.saturating_sub(available);

            if shortfall > 0 {
                match flow.source {
                    crate::state::flow::Source::StablecoinThenBorrow { .. } => {
                        let projected_ltv = project_ltv_bps(obligation, shortfall as i64)?;
                        require!(
                            projected_ltv <= flow.constraints.max_ltv_bps,
                            StockFlowError::LtvLimitExceeded
                        );
                        kamino::borrow(shortfall, ctx.accounts.vault_authority.to_account_info(), ctx.remaining_accounts, signer_seeds)?;
                    }
                    crate::state::flow::Source::StablecoinOnly => {
                        return err!(StockFlowError::AmountLimitExceeded);
                    }
                }
            }

            let cpi_accounts = Transfer {
                from: ctx.accounts.source_token_account.to_account_info(),
                to: ctx.accounts.destination_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                cpi_accounts,
                signer_seeds,
            );
            token::transfer(cpi_ctx, amount)?;
        }
        Action::Borrow { amount } => {
            require!(
                amount <= flow.constraints.max_amount,
                StockFlowError::AmountLimitExceeded
            );
            let projected_ltv = project_ltv_bps(obligation, amount as i64)?;
            require!(
                projected_ltv <= flow.constraints.max_ltv_bps,
                StockFlowError::LtvLimitExceeded
            );
            kamino::borrow(amount, ctx.accounts.vault_authority.to_account_info(), ctx.remaining_accounts, signer_seeds)?;
        }
        Action::Repay { amount } => {
            require!(
                amount <= flow.constraints.max_amount,
                StockFlowError::AmountLimitExceeded
            );
            kamino::repay(amount)?;
        }
        Action::PauseSpending => {
            return Ok(());
        }
    }

    flow.last_executed_at = now;
    flow.execution_count = flow.execution_count.saturating_add(1);
    flow.next_execution = Flow::compute_next_execution(&flow.trigger, now);

    Ok(())
}
