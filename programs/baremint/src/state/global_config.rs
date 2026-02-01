use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    /// Platform admin authority
    pub authority: Pubkey,
    /// Total fee in basis points (e.g., 500 = 5%)
    pub fee_bps: u16,
    /// Platform's share of fees in basis points (e.g., 250 = 2.5%)
    pub platform_fee_bps: u16,
    /// Creator's share of fees in basis points (e.g., 250 = 2.5%)
    pub creator_fee_bps: u16,
    /// Initial virtual token reserves for new bonding curves
    pub initial_virtual_token_reserves: u64,
    /// Initial virtual SOL reserves for new bonding curves
    pub initial_virtual_sol_reserves: u64,
    /// Vesting cliff duration in seconds (default: 2,592,000 = 30 days)
    pub vesting_cliff_seconds: i64,
    /// Vesting total duration in seconds (default: 5,184,000 = 60 days)
    pub vesting_duration_seconds: i64,
    /// Minimum interval between vesting claims in seconds (default: 604,800 = 7 days)
    pub vesting_claim_interval_seconds: i64,
    /// Cooldown between token launches per creator in seconds (default: 7,776,000 = 90 days)
    pub launch_cooldown_seconds: i64,
    /// Creator token allocation in basis points (default: 1000 = 10%)
    pub creator_allocation_bps: u16,
    /// PDA bump seed
    pub bump: u8,
}
