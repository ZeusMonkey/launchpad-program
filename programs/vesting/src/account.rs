use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Vesting {
    /// Nonce to derive the program-derived address owning the vaults.
    pub nonce: u8,
    /// IDO config address
    pub ido_config: Pubkey,
    /// Mint of the vesting token
    pub token_mint: Pubkey,
    /// Vault to store vesting tokens.
    pub token_vault: Pubkey,
    /// start time
    pub start_time: u64,
    /// vesting period
    pub period: u64,
    /// The period which can claim
    pub claim_period: u64,
    /// Percentage to be claimed at TGE
    pub tge_pct: u64,
    /// Total vesting amount (TGE amount is inclued in amount)
    pub amount: u64,
    /// Withdrawn amount for unallocated funds
    pub withdrawn_amount: u64,
}

#[account]
#[derive(Default)]
pub struct UserVestingAccount {
    /// Vesting address
    pub vesting: Pubkey,
    /// Nonce to derive the program-derived address owning the vaults.
    pub nonce: u8,
    /// claimed amount
    pub claimed: u64,
}
