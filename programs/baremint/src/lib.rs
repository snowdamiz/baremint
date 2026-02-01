use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
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
}
