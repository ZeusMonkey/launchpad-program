use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct WhitelistConfig {
    /// owner address
    pub owner: Pubkey,
}

#[account]
#[derive(Default)]
pub struct WhitelistAccount {
    /// whitelist config address
    pub config: Pubkey,
    /// Account address
    pub account: Pubkey,
    /// Whitelist status
    pub whitelisted: bool,
}
