use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct CreatorProfile {
    /// Creator's public key
    pub creator: Pubkey,
    /// Timestamp of last token launch (0 = never launched)
    pub last_token_launch_timestamp: i64,
    /// Total number of tokens launched (analytics counter)
    pub tokens_launched: u32,
    /// PDA bump seed
    pub bump: u8,
}
