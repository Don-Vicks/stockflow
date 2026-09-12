use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use crate::errors::StockFlowError;
use crate::risk::ObligationSnapshot;

pub mod klend_program_id {
    use anchor_lang::declare_id;
    // Updated to the local mock_klend program ID for testing!
    declare_id!("ETsaieAaYRAhDYCw4Y55BwS37hvt8CE8oSBZMevRGe7d");
}

pub fn borrow<'info1, 'info2>(
    amount: u64,
    vault_authority_info: AccountInfo<'info1>,
    remaining_accounts: &[AccountInfo<'info2>],
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    require!(!remaining_accounts.is_empty(), StockFlowError::UnsupportedSource);

    // sha256("global:borrow_obligation_liquidity")[..8]
    let mut data = vec![121, 127, 18, 204, 73, 245, 225, 65];
    data.extend_from_slice(&amount.to_le_bytes());

    let mut accounts = Vec::with_capacity(remaining_accounts.len() + 1);
    // 1st account for Kamino is the owner/signer of the obligation
    accounts.push(AccountMeta::new(vault_authority_info.key(), true));
    
    // The rest (obligation, lending_market, reserve, sysvars, etc.) are in remaining_accounts
    for acc in remaining_accounts {
        if acc.is_writable {
            accounts.push(AccountMeta::new(acc.key(), false)); // we don't pass them as signers since vault is the only signer
        } else {
            accounts.push(AccountMeta::new_readonly(acc.key(), false));
        }
    }

    let ix = Instruction {
        program_id: klend_program_id::ID,
        accounts,
        data,
    };

    let mut account_infos = Vec::with_capacity(remaining_accounts.len() + 1);
    let vault_info: AccountInfo<'info2> = unsafe { std::mem::transmute(vault_authority_info.clone()) };
    account_infos.push(vault_info);
    account_infos.extend_from_slice(remaining_accounts);

    anchor_lang::solana_program::program::invoke_signed(
        &ix,
        &account_infos,
        signer_seeds,
    ).map_err(|e| {
        msg!("Kamino CPI failed: {:?}", e);
        StockFlowError::UnsupportedSource.into()
    })
}

pub fn repay(_amount: u64) -> Result<()> {
    err!(StockFlowError::UnsupportedSource)
}

pub fn read_obligation_usd<'info>(remaining_accounts: &[AccountInfo<'info>]) -> Result<ObligationSnapshot> {
    if remaining_accounts.is_empty() {
        // If not using Kamino logic (e.g. StablecoinOnly), just return 0 to bypass LTV check.
        return Ok(ObligationSnapshot::default());
    }
    
    // Assume the first account in remaining_accounts is the Kamino Obligation account.
    let obligation_info = &remaining_accounts[0];
    let data = obligation_info.try_borrow_data()?;
    
    // Minimum size check (OBLIGATION_SIZE is 3336 + 8 = 3344)
    require!(data.len() >= 3344, StockFlowError::UnsupportedSource);

    let mut dep_bytes = [0u8; 16];
    dep_bytes.copy_from_slice(&data[1272..1288]);
    let deposited_value_sf = u128::from_le_bytes(dep_bytes);

    let mut bor_bytes = [0u8; 16];
    bor_bytes.copy_from_slice(&data[2344..2360]);
    let borrowed_assets_market_value_sf = u128::from_le_bytes(bor_bytes);

    // Convert SF (Scaled Fractions) to USD (typically SF shifts by 2^60, but we can just use the upper bits for projection accuracy)
    // The actual conversion is usually `amount / 2^60` for USD.
    let collateral_value_usd = (deposited_value_sf >> 60) as u64;
    let debt_value_usd = (borrowed_assets_market_value_sf >> 60) as u64;

    Ok(ObligationSnapshot {
        collateral_value_usd,
        debt_value_usd,
    })
}
