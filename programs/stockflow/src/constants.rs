pub const FLOW_SEED: &[u8] = b"flow";
pub const PROTECTION_SEED: &[u8] = b"protection";
pub const VAULT_SEED: &[u8] = b"vault";
pub const VAULT_AUTHORITY_SEED: &[u8] = b"vault_authority";

/// Basis points denominator (100_00 = 100.00%)
pub const BPS_DENOMINATOR: u16 = 10_000;

/// Hard ceiling the protocol will never let a Flow exceed, regardless
/// of what the user configures. A per-Flow `max_ltv_bps` is additionally
/// enforced and must be <= this value.
pub const PROTOCOL_MAX_LTV_BPS: u16 = 7_500; // 75%

/// Minimum gap between two executions of the same Flow, even if the
/// user's trigger interval is shorter. Guards against a misbehaving
/// or compromised keeper spamming executions.
pub const MIN_EXECUTION_INTERVAL_SECONDS: i64 = 60;
