use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct TokenSaleConfig {
    /// owner address
    pub owner: Pubkey,
    /// Nonce to derive the program-derived address owning the vaults.
    pub nonce: u8,
    /// 7 days lock staking pool
    pub staking_pool_0: Pubkey,
    /// 2 months lock staking pool
    pub staking_pool_1: Pubkey,
    /// Whitelist config address
    pub whitelist_config: Pubkey,
    /// Payment token mint (USDC)
    pub payment_token_mint: Pubkey,
    /// Payment token account
    pub payment_token_vault: Pubkey,
    /// Maximum payment token amount for sale
    pub amount: u64,
    /// Current paid amount
    pub paid_amount: u64,
    /// Withdrawn amount
    pub withdrawn_amount: u64,
    /// IDO start time
    pub start_time: u64,
    /// IDO period
    pub period: u64,
    /// staking 0 allocation per tier
    pub staking_allocation_0: [u64; 7],
    /// staking 1 allocation per tier
    pub staking_allocation_1: [u64; 7],
    /// NFT allocation
    pub nft_allocation: u64,
}

#[account]
#[derive(Default)]
pub struct WhitelistAlloc {
    /// Token sale config
    pub config: Pubkey,
    /// User address
    pub user: Pubkey,
    /// Allocation
    pub allocation: u64,
    /// Nonce
    pub nonce: u8,
}

#[account]
#[derive(Default)]
pub struct UserTokenSale {
    /// User address
    pub user: Pubkey,
    /// Token sale config
    pub config: Pubkey,
    /// Paid amount
    pub paid_amount: u64,
    /// Used allocation from staking 0
    pub used_staking0_alloc: u64,
    /// Used allocation from staking 1
    pub used_staking1_alloc: u64,
    /// Used allocation from whitelist
    pub used_whitelist_alloc: u64,
    /// nonce
    pub nonce: u8,
}

#[account]
#[derive(Default)]
pub struct NftIdoInfo {
    /// Token sale config
    pub config: Pubkey,
    /// Used allocation
    pub used_allocation: u64,
    /// nonce
    pub nonce: u8,
}
