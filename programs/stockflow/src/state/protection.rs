use anchor_lang::prelude::*;

/// One per owner. Independent of individual Flows — this is the
/// account the "Portfolio Intelligence & Protection" pillar reads
/// and writes. When `spending_paused` is true, `execute_flow` refuses
/// to run any Action::Pay or Action::Borrow across ALL of the owner's
/// Flows until protection is cleared or a Repay brings LTV back down.
#[account]
#[derive(InitSpace)]
pub struct ProtectionPolicy {
    pub owner: Pubkey,
    /// LTV (bps) at which discretionary spending is auto-paused.
    pub pause_threshold_bps: u16,
    /// LTV (bps) at which spending is auto re-enabled after having
    /// been paused (hysteresis, so it doesn't flap at the boundary).
    pub resume_threshold_bps: u16,
    pub spending_paused: bool,
    pub updated_at: i64,
    pub bump: u8,
}

impl ProtectionPolicy {
     
}
