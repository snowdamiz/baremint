use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized: signer is not the expected authority")]
    Unauthorized,
    #[msg("Math overflow occurred")]
    MathOverflow,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Insufficient SOL funds")]
    InsufficientFunds,
    #[msg("Insufficient token balance")]
    InsufficientTokens,
    #[msg("Insufficient reserves for this operation")]
    InsufficientReserves,
    #[msg("Creator must wait for cooldown period to elapse before launching another token")]
    CooldownNotElapsed,
    #[msg("Vesting cliff period has not been reached")]
    VestingCliffNotReached,
    #[msg("Vesting allocation has been fully claimed")]
    VestingFullyClaimed,
    #[msg("Vesting has been revoked")]
    VestingRevoked,
    #[msg("Token burning is disabled for this bonding curve")]
    BurnDisabled,
    #[msg("Invalid fee configuration: fee_bps must equal platform_fee_bps + creator_fee_bps")]
    InvalidFeeConfiguration,
    #[msg("Invalid reserve configuration: reserves must be greater than zero")]
    InvalidReserveConfiguration,
    #[msg("Token supply does not match expected value")]
    TokenSupplyMismatch,
}
