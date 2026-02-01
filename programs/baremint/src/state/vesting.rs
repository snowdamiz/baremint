use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VestingAccount {
    /// Creator who owns this vesting schedule
    pub creator: Pubkey,
    /// Token mint this vesting is for
    pub token_mint: Pubkey,
    /// Total tokens allocated for vesting
    pub total_allocation: u64,
    /// Tokens already claimed
    pub claimed_amount: u64,
    /// Timestamp when vesting started
    pub start_timestamp: i64,
    /// Whether vesting has been revoked
    pub is_revoked: bool,
    /// PDA bump seed
    pub bump: u8,
}
