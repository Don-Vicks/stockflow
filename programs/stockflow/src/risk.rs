use anchor_lang::prelude::*;

use crate::errors::StockFlowError;

/// Snapshot of an owner's Kamino obligation, denominated in a common
/// USD-equivalent smallest unit (e.g. 6-decimal, matching USDC) so the
/// math below doesn't need to know about individual asset decimals.
/// Populated by `cpi::kamino::read_obligation_usd` — stubbed at zero
/// until the real CPI/account read is wired in (see docs/FEASIBILITY.md).
#[derive(Clone, Copy, Debug, Default)]
pub struct ObligationSnapshot {
    pub collateral_value_usd: u64,
    pub debt_value_usd: u64,
}

/// Projects LTV (in bps) after applying `delta_debt_usd` to the given
/// obligation snapshot. `delta_debt_usd` is positive for a Borrow (or
/// the borrowed shortfall in a Pay-with-fallback), negative for a
/// Repay, and zero to just read the *current* LTV — this makes "current"
/// and "projected" the same code path instead of two separate
/// (and previously inconsistent) reads.
///
/// This is deliberately a pure function with no CPI/account access, so
/// it's testable and auditable independent of the Kamino integration
/// being finished — see the tests below.
pub fn project_ltv_bps(
    obligation: ObligationSnapshot,
    delta_debt_usd: i64,
) -> Result<u16> {
    let projected_debt: u64 = if delta_debt_usd >= 0 {
        obligation
            .debt_value_usd
            .checked_add(delta_debt_usd as u64)
            .ok_or(StockFlowError::MathOverflow)?
    } else {
        obligation
            .debt_value_usd
            .saturating_sub(delta_debt_usd.unsigned_abs())
    };

    if projected_debt == 0 {
        return Ok(0);
    }

    require!(
        obligation.collateral_value_usd > 0,
        StockFlowError::NoCollateralForBorrow
    );

    let bps = (projected_debt as u128)
        .checked_mul(10_000u128)
        .ok_or(StockFlowError::MathOverflow)?
        .checked_div(obligation.collateral_value_usd as u128)
        .ok_or(StockFlowError::MathOverflow)?;

    // Saturate rather than overflow u16 in pathological cases (e.g. debt
    // far exceeding collateral after a price crash) — callers compare
    // this against max_ltv_bps and PROTOCOL_MAX_LTV_BPS, both of which
    // are far below u16::MAX, so saturating here is safe and simpler
    // than propagating another error variant for an already-unsafe state.
    Ok(bps.min(u16::MAX as u128) as u16)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snapshot(collateral: u64, debt: u64) -> ObligationSnapshot {
        ObligationSnapshot {
            collateral_value_usd: collateral,
            debt_value_usd: debt,
        }
    }

    #[test]
    fn zero_debt_and_zero_delta_is_zero_ltv() {
        let ltv = project_ltv_bps(snapshot(25_000_000_000, 0), 0).unwrap();
        assert_eq!(ltv, 0);
    }

    #[test]
    fn current_ltv_matches_hand_calculation() {
        // $25,000 collateral, $2,000 debt -> 8.00% -> 800 bps.
        let ltv = project_ltv_bps(snapshot(25_000, 2_000), 0).unwrap();
        assert_eq!(ltv, 800);
    }

    #[test]
    fn projects_forward_for_a_borrow_not_backward() {
        // This is the bug this module exists to fix: checking the
        // CURRENT ltv against max_ltv_bps before a borrow would let an
        // origination through that pushes LTV over the limit. The
        // projection must include delta_debt_usd.
        let before = project_ltv_bps(snapshot(25_000, 0), 0).unwrap();
        let after_borrowing_10k = project_ltv_bps(snapshot(25_000, 0), 10_000).unwrap();
        assert_eq!(before, 0);
        assert_eq!(after_borrowing_10k, 4_000); // 40.00%
        assert!(after_borrowing_10k > before);
    }

    #[test]
    fn repay_reduces_projected_ltv() {
        let ltv = project_ltv_bps(snapshot(25_000, 5_000), -2_000).unwrap();
        assert_eq!(ltv, 1_200); // (5000-2000)/25000 = 12.00%
    }

    #[test]
    fn repay_never_goes_negative() {
        let ltv = project_ltv_bps(snapshot(25_000, 1_000), -5_000).unwrap();
        assert_eq!(ltv, 0);
    }

    #[test]
    fn borrowing_against_zero_collateral_errors() {
        let result = project_ltv_bps(snapshot(0, 0), 500);
        assert!(result.is_err());
    }
}
