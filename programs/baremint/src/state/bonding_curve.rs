use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct BondingCurve {
    /// SPL token mint for this bonding curve
    pub token_mint: Pubkey,
    /// Creator who launched this token
    pub creator: Pubkey,
    /// Virtual token reserves (used in price calculation)
    pub virtual_token_reserves: u64,
    /// Virtual SOL reserves (used in price calculation)
    pub virtual_sol_reserves: u64,
    /// Real token reserves held by the program
    pub real_token_reserves: u64,
    /// Real SOL reserves held in PDA lamports
    pub real_sol_reserves: u64,
    /// Total token supply minted
    pub token_total_supply: u64,
    /// SOL-denominated burn cost set by creator (0 = burns disabled)
    pub burn_sol_price: u64,
    /// Platform's share of accrued fees (tracked in PDA lamports)
    pub platform_fees_accrued: u64,
    /// Creator's share of accrued fees (tracked in PDA lamports)
    pub creator_fees_accrued: u64,
    /// PDA bump seed
    pub bump: u8,
}
