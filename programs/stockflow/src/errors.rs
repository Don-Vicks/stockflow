use anchor_lang::prelude::*;

#[error_code]
pub enum StockFlowError {
    #[msg("Requested LTV exceeds the Flow's configured maximum LTV.")]
    LtvLimitExceeded,

    #[msg("Requested LTV exceeds the protocol-wide hard LTV ceiling.")]
    ProtocolLtvCeilingExceeded,

    #[msg("Requested amount exceeds the Flow's configured max amount.")]
    AmountLimitExceeded,

    #[msg("Destination does not match the Flow's allowed recipient.")]
    UnauthorizedRecipient,

    #[msg("This Flow is paused and cannot be executed.")]
    FlowPaused,

    #[msg("Trigger conditions for this Flow have not been met yet.")]
    TriggerConditionsNotMet,

    #[msg("Minimum execution interval has not elapsed since the last run.")]
    ExecutionTooSoon,

    #[msg("Portfolio protection policy has paused discretionary spending.")]
    ProtectionActive,

    #[msg("Numeric overflow while evaluating Flow constraints.")]
    MathOverflow,

    #[msg("Cannot borrow against zero collateral value.")]
    NoCollateralForBorrow,

    #[msg("Only the Flow owner may perform this action.")]
    Unauthorized,

    #[msg("Unsupported source configuration for this action.")]
    UnsupportedSource,

    #[msg("Flow must be paused before it can be closed.")]
    FlowMustBePausedToClose,

    #[msg("Resume threshold must be strictly less than the pause threshold.")]
    InvalidProtectionThresholds,
}
