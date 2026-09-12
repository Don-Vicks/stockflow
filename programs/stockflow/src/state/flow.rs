use anchor_lang::prelude::*;

/// A Financial Flow: Trigger -> Action -> Source -> Constraints -> Destination.
/// This is the single on-chain object the PRD calls "the core primitive."
#[account]
#[derive(InitSpace)]
pub struct Flow {
    /// Wallet that owns this Flow and the underlying vault.
    pub owner: Pubkey,
    /// Monotonically increasing per-owner nonce used in the PDA seeds so
    /// one owner can have many Flows.
    pub flow_id: u64,

    /// UTF-8 display name, right-padded with zeros (max 32 bytes).
    /// Shown in the Flows dashboard: "Developer Payment", "Portfolio Protection".
    pub name: [u8; 32],
    /// Unix timestamp of the next scheduled execution. Set on create and
    /// after each successful execution. 0 = OnDemand / no schedule.
    pub next_execution: i64,
    /// Total number of successful executions since creation.
    /// Drives the activity-feed execution count shown in the UI.
    pub execution_count: u64,

    pub trigger: Trigger,
    pub action: Action,
    pub source: Source,
    pub constraints: Constraints,
    /// Recipient wallet for Pay actions.
    /// Ignored for Borrow / Repay / PauseSpending.
    pub destination: Pubkey,

    pub status: FlowStatus,
    pub last_executed_at: i64,
    pub created_at: i64,
    pub bump: u8,
}

impl Flow {
    // discriminator(8) + owner(32) + flow_id(8)
    // + name(32) + next_execution(8) + execution_count(8)
    // + Trigger(17) + Action(9) + Source(33) + Constraints(10)
    // + destination(32) + status(1) + last_executed_at(8) + created_at(8) + bump(1)

    /// Compute the timestamp of the next scheduled execution given `now`.
    /// Returns 0 for non-time-based triggers (caller should treat 0 as
    /// "no fixed schedule / on-demand only").
    pub fn compute_next_execution(trigger: &Trigger, now: i64) -> i64 {
        match trigger {
            Trigger::TimeInterval { interval_seconds } => {
                now.saturating_add(*interval_seconds)
            }
            _ => 0,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum FlowStatus {
    Active,
    Paused,
}

/// WHEN a Flow is allowed to run.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum Trigger {
    /// Runs every `interval_seconds`, detected off-chain (automation worker /
    /// Tuk Tuk task) and submitted via `execute_flow`. The program verifies
    /// that enough time has elapsed since `last_executed_at`.
    TimeInterval { interval_seconds: i64 },
    /// Runs whenever the caller (owner or keeper) invokes it on demand —
    /// no time gating beyond MIN_EXECUTION_INTERVAL_SECONDS.
    OnDemand,
    /// Runs when the portfolio's LTV crosses the given threshold.
    /// Used for Protection-style Flows ("if LTV > 35%, repay debt").
    RiskThreshold { ltv_bps: u16 },
}

impl Trigger {
      // enum tag + largest variant payload, padded
}

/// WHAT the Flow does when triggered.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum Action {
    Pay { amount: u64 },
    Borrow { amount: u64 },
    Repay { amount: u64 },
    /// Signals that discretionary spending should be paused across all of
    /// the owner's Flows. Handled by refreshing the ProtectionPolicy
    /// account, not by an on-chain transfer here.
    PauseSpending,
}

impl Action {
     
}

/// WHERE the funds for a Pay action come from, in priority order.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum Source {
    /// Use the vault's USDC balance only. Fails if insufficient.
    StablecoinOnly,
    /// Use vault USDC first; if insufficient, borrow the shortfall against
    /// the given collateral mint via Kamino, subject to `max_ltv_bps`.
    StablecoinThenBorrow { collateral_mint: Pubkey },
}

impl Source {
     
}

/// Guardrails the on-chain program enforces regardless of what the
/// off-chain automation worker submits. This is what makes automation
/// safe per PRD Goal 4.
///
/// `destination` (stored on the Flow itself) is always enforced for Pay
/// actions — there is no separate "locked recipient" field here, which
/// previously meant the check only ran when a caller also set that field.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub struct Constraints {
    /// Hard ceiling on any single execution's amount (source-token smallest unit).
    pub max_amount: u64,
    /// Hard ceiling on portfolio LTV (bps) after this Flow executes.
    pub max_ltv_bps: u16,
}

impl Constraints {
     
}
