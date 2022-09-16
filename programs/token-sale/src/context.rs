use crate::account::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use staking::account::{Pool as StakingPool, User as UserStaking};
use std::convert::Into;
use whitelist_nft::account::*;

#[derive(Accounts)]
#[instruction(nonce: u8)]
pub struct InitializeSale<'info> {
    #[account(init, payer=signer)]
    pub config: Box<Account<'info, TokenSaleConfig>>,
    pub staking_pool_0: Box<Account<'info, StakingPool>>,
    pub staking_pool_1: Box<Account<'info, StakingPool>>,
    pub whitelist_config: Box<Account<'info, WhitelistConfig>>,
    pub payment_token_mint: Box<Account<'info, Mint>>,
    #[account(
        constraint = payment_token_vault.mint == payment_token_mint.key(),
        constraint = payment_token_vault.owner == sale_signer.key(),
    )]
    pub payment_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        seeds = [
            config.to_account_info().key.as_ref()
        ],
        bump = nonce,
    )]
    /// CHECK: nothing to check.
    pub sale_signer: AccountInfo<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,

    // Misc
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct Whitelist<'info> {
    #[account(
        constraint = config.owner == signer.key()
    )]
    pub config: Box<Account<'info, TokenSaleConfig>>,
    #[account(
        init,
        payer=signer,
        seeds = [
            "whitelist".as_bytes(),
            config.to_account_info().key.as_ref(),
            user.as_ref()
        ],
        bump,
    )]
    pub whitelist_alloc: Box<Account<'info, WhitelistAlloc>>,
    #[account(mut)]
    pub signer: Signer<'info>,

    // Misc
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_user: Pubkey)]
pub struct RemoveWhitelist<'info> {
    #[account(
        constraint = config.owner == signer.key()
    )]
    pub config: Box<Account<'info, TokenSaleConfig>>,
    #[account(
        mut,
        seeds = [
            "whitelist".as_bytes(),
            config.to_account_info().key.as_ref(),
            _user.as_ref()
        ],
        bump=whitelist_alloc.nonce,
        close=signer,
        has_one=config
    )]
    pub whitelist_alloc: Box<Account<'info, WhitelistAlloc>>,
    #[account(mut)]
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateTokenSaleAccount<'info> {
    pub config: Box<Account<'info, TokenSaleConfig>>,
    #[account(
        init,
        payer=signer,
        seeds = [
            config.to_account_info().key.as_ref(),
            signer.to_account_info().key.as_ref()
        ],
        bump,
    )]
    pub user_token_sale: Box<Account<'info, UserTokenSale>>,
    #[account(mut)]
    pub signer: Signer<'info>,

    // Misc
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositWithStaking<'info> {
    #[account(
        mut,
        has_one = payment_token_mint,
        has_one = payment_token_vault,
    )]
    pub config: Box<Account<'info, TokenSaleConfig>>,
    #[account(
        mut,
        constraint = user_token_sale.config == config.key(),
        seeds = [
            config.to_account_info().key.as_ref(),
            signer.to_account_info().key.as_ref()
        ],
        bump = user_token_sale.nonce,
    )]
    pub user_token_sale: Box<Account<'info, UserTokenSale>>,
    pub payment_token_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub payment_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_vault.mint == payment_token_mint.key(),
    )]
    pub user_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        constraint = staking_account.tier > 0,
    )]
    pub staking_account: Box<Account<'info, UserStaking>>,
    #[account(mut)]
    pub signer: Signer<'info>,

    // Misc.
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DepositWithWhitelist<'info> {
    #[account(
        mut,
        has_one = payment_token_mint,
        has_one = payment_token_vault,
    )]
    pub config: Box<Account<'info, TokenSaleConfig>>,
    #[account(
        mut,
        constraint = user_token_sale.config == config.key(),
        seeds = [
            config.to_account_info().key.as_ref(),
            signer.to_account_info().key.as_ref()
        ],
        bump = user_token_sale.nonce,
    )]
    pub user_token_sale: Box<Account<'info, UserTokenSale>>,
    pub payment_token_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub payment_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_vault.mint == payment_token_mint.key(),
    )]
    pub user_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        seeds = [
            "whitelist".as_bytes(),
            config.to_account_info().key.as_ref(),
            signer.to_account_info().key.as_ref()
        ],
        bump=whitelist_alloc.nonce,
    )]
    pub whitelist_alloc: Box<Account<'info, WhitelistAlloc>>,
    pub signer: Signer<'info>,

    // Misc.
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreateNftSaleAccount<'info> {
    pub config: Box<Account<'info, TokenSaleConfig>>,
    pub nft_mint: Box<Account<'info, Mint>>,
    #[account(
        constraint = whitelist_nft_account.whitelisted,
        constraint = whitelist_nft_account.account == nft_mint.key(),
        constraint = whitelist_nft_account.config == config.whitelist_config,
    )]
    pub whitelist_nft_account: Box<Account<'info, WhitelistAccount>>,
    #[account(
        init,
        payer=signer,
        seeds = [
            config.to_account_info().key.as_ref(),
            nft_mint.to_account_info().key.as_ref()
        ],
        bump,
    )]
    pub nft_ido_info: Box<Account<'info, NftIdoInfo>>,
    #[account(mut)]
    pub signer: Signer<'info>,

    // Misc
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositWithNft<'info> {
    #[account(
        mut,
        has_one = payment_token_mint,
        has_one = payment_token_vault,
    )]
    pub config: Box<Account<'info, TokenSaleConfig>>,
    #[account(
        mut,
        constraint = user_token_sale.config == config.key(),
        seeds = [
            config.to_account_info().key.as_ref(),
            signer.to_account_info().key.as_ref()
        ],
        bump = user_token_sale.nonce,
    )]
    pub user_token_sale: Box<Account<'info, UserTokenSale>>,
    #[account(
        mut,
        constraint = nft_ido_info.config == config.key(),
        seeds = [
            config.to_account_info().key.as_ref(),
            nft_account.mint.as_ref()
        ],
        bump = nft_ido_info.nonce,
    )]
    pub nft_ido_info: Box<Account<'info, NftIdoInfo>>,
    pub payment_token_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub payment_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_vault.mint == payment_token_mint.key(),
    )]
    pub user_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = nft_account.owner == signer.key(),
        constraint = nft_account.amount > 0,
    )]
    pub nft_account: Box<Account<'info, TokenAccount>>,
    #[account(
        constraint = whitelist_nft_account.whitelisted,
        constraint = whitelist_nft_account.account == nft_account.mint,
        constraint = whitelist_nft_account.config == config.whitelist_config,
    )]
    pub whitelist_nft_account: Box<Account<'info, WhitelistAccount>>,
    pub signer: Signer<'info>,

    // Misc.
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        has_one = payment_token_mint,
        has_one = payment_token_vault,
        constraint = signer.key() == config.owner
    )]
    pub config: Box<Account<'info, TokenSaleConfig>>,
    pub payment_token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = payment_token_vault.amount > 0
    )]
    pub payment_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = recipient.mint == payment_token_mint.key(),
    )]
    pub recipient: Box<Account<'info, TokenAccount>>,
    #[account(
        seeds = [
            config.to_account_info().key.as_ref()
        ],
        bump = config.nonce,
    )]
    /// CHECK: nothing to check.
    pub sale_signer: AccountInfo<'info>,
    pub signer: Signer<'info>,

    // Misc.
    pub token_program: Program<'info, Token>,
}
