use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod math;
pub mod state;

use instructions::*;

declare_id!("FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG");

#[program]
pub mod baremint {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        fee_bps: u16,
        platform_fee_bps: u16,
        creator_fee_bps: u16,
        initial_virtual_token_reserves: u64,
        initial_virtual_sol_reserves: u64,
    ) -> Result<()> {
        instructions::initialize::handler(
            ctx,
            fee_bps,
            platform_fee_bps,
            creator_fee_bps,
            initial_virtual_token_reserves,
            initial_virtual_sol_reserves,
        )
    }

    pub fn create_token(ctx: Context<CreateToken>, burn_sol_price: u64) -> Result<()> {
        instructions::create_token::handler(ctx, burn_sol_price)
    }

    pub fn buy(ctx: Context<Buy>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
        instructions::buy::handler(ctx, sol_amount, min_tokens_out)
    }

    pub fn sell(ctx: Context<Sell>, token_amount: u64, min_sol_out: u64) -> Result<()> {
        instructions::sell::handler(ctx, token_amount, min_sol_out)
    }

    pub fn burn_for_access(ctx: Context<BurnAccess>) -> Result<()> {
        instructions::burn_access::handler(ctx)
    }

    pub fn withdraw_platform_fees(ctx: Context<WithdrawPlatformFees>) -> Result<()> {
        instructions::withdraw_fees::handler_withdraw_platform_fees(ctx)
    }

    pub fn withdraw_creator_fees(ctx: Context<WithdrawCreatorFees>) -> Result<()> {
        instructions::withdraw_fees::handler_withdraw_creator_fees(ctx)
    }
}
