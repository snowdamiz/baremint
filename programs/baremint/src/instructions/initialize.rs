use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::GlobalConfig;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [b"global_config"],
        bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Initialize>,
    fee_bps: u16,
    platform_fee_bps: u16,
    creator_fee_bps: u16,
    initial_virtual_token_reserves: u64,
    initial_virtual_sol_reserves: u64,
) -> Result<()> {
    // Validate fee configuration
    require!(
        fee_bps == platform_fee_bps + creator_fee_bps,
        ErrorCode::InvalidFeeConfiguration
    );
    require!(fee_bps <= 1000, ErrorCode::InvalidFeeConfiguration);

    // Validate reserve configuration
    require!(
        initial_virtual_token_reserves > 0,
        ErrorCode::InvalidReserveConfiguration
    );
    require!(
        initial_virtual_sol_reserves > 0,
        ErrorCode::InvalidReserveConfiguration
    );

    let config = &mut ctx.accounts.global_config;
    config.authority = ctx.accounts.authority.key();
    config.fee_bps = fee_bps;
    config.platform_fee_bps = platform_fee_bps;
    config.creator_fee_bps = creator_fee_bps;
    config.initial_virtual_token_reserves = initial_virtual_token_reserves;
    config.initial_virtual_sol_reserves = initial_virtual_sol_reserves;
    config.vesting_cliff_seconds = 2_592_000; // 30 days
    config.vesting_duration_seconds = 5_184_000; // 60 days
    config.vesting_claim_interval_seconds = 604_800; // 7 days
    config.launch_cooldown_seconds = 7_776_000; // 90 days
    config.creator_allocation_bps = 1000; // 10%
    config.bump = ctx.bumps.global_config;

    Ok(())
}
