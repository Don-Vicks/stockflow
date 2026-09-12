use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("ETsaieAaYRAhDYCw4Y55BwS37hvt8CE8oSBZMevRGe7d");

#[program]
pub mod mock_klend {
    use super::*;

    pub fn init_obligation(
        ctx: Context<InitObligation>,
        deposited_usd: u64,
        borrowed_usd: u64,
    ) -> Result<()> {
        let deposited_sf = (deposited_usd as u128) << 60;
        let borrowed_sf = (borrowed_usd as u128) << 60;

        let mut data = ctx.accounts.obligation.try_borrow_mut_data()?;
        data[1272..1288].copy_from_slice(&deposited_sf.to_le_bytes());
        data[2344..2360].copy_from_slice(&borrowed_sf.to_le_bytes());

        Ok(())
    }

    pub fn borrow_obligation_liquidity(
        ctx: Context<BorrowObligationLiquidity>,
        amount: u64,
    ) -> Result<()> {
        // Mock borrow: just transfer USDC from the reserve to the user's destination
        let seeds = &[
            b"lending_market_authority".as_ref(),
            &[ctx.bumps.lending_market_authority],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.reserve_liquidity_supply.to_account_info(),
            to: ctx.accounts.user_destination_liquidity.to_account_info(),
            authority: ctx.accounts.lending_market_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program.key(), cpi_accounts, signer_seeds);

        token::transfer(cpi_ctx, amount)?;

        // Update obligation debt
        let mut data = ctx.accounts.obligation.try_borrow_mut_data()?;
        let mut borrowed_bytes = [0u8; 16];
        borrowed_bytes.copy_from_slice(&data[2344..2360]);
        let borrowed_sf = u128::from_le_bytes(borrowed_bytes);
        
        let borrowed_usd = (borrowed_sf >> 60) as u64;
        let new_borrowed_usd = borrowed_usd.saturating_add(amount / 1_000_000); // assume 6 decimals
        let new_borrowed_sf = (new_borrowed_usd as u128) << 60;
        
        data[2344..2360].copy_from_slice(&new_borrowed_sf.to_le_bytes());

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitObligation<'info> {
    /// CHECK: Obligation account for Mock Klend
    #[account(
        init,
        payer = owner,
        space = 3344, // Exact OBLIGATION_SIZE from Kamino + 8
    )]
    pub obligation: UncheckedAccount<'info>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BorrowObligationLiquidity<'info> {
    pub owner: Signer<'info>, // Vault PDA
    
    /// CHECK: Obligation account for Mock Klend
    #[account(mut)]
    pub obligation: UncheckedAccount<'info>,
    
    /// CHECK: Mock ignores
    pub lending_market: UncheckedAccount<'info>,
    
    /// CHECK: Mock ignores
    #[account(mut)]
    pub reserve: UncheckedAccount<'info>,
    
    /// CHECK: Mock ignores
    pub obligation_farm: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub reserve_liquidity_supply: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_destination_liquidity: Account<'info, TokenAccount>,
    
    /// CHECK: PDA that owns reserve_liquidity_supply
    #[account(
        seeds = [b"lending_market_authority"],
        bump
    )]
    pub lending_market_authority: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    
    /// CHECK: Mock ignores sysvar
    pub instruction_sysvar: UncheckedAccount<'info>,
}

// Removed Obligation struct to use raw byte slicing
