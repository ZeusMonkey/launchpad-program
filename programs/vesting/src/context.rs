use crate::account::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_option::COption;
use anchor_spl::token::{Mint, Token, TokenAccount};
use std::convert::Into;
use token_sale::account::*;

#[derive(Accounts)]
#[instruction(nonce: u8)]
pub struct InitializeVesting<'info> {
    pub ido_config: Box<Account<'info, TokenSaleConfig>>,
    #[account(init, payer=signer)]
    pub vesting: Box<Account<'info, Vesting>>,
    pub token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = token_vault.mint == token_mint.key(),
        constraint = token_vault.owner == vesting_signer.key(),
        constraint = token_vault.close_authority == COption::None,
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = fund_vault.mint == token_mint.key(),
    )]
    pub fund_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        seeds = [
            vesting.to_account_info().key.as_ref()
        ],
        bump
    )]
    /// CHECK: nothing to check.
    pub vesting_signer: AccountInfo<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,

    // Misc
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawUnallocatedToken<'info> {
    #[account(
        constraint = ido_config.owner == signer.key(),
        constraint = ido_config.paid_amount < ido_config.amount,
    )]
    pub ido_config: Box<Account<'info, TokenSaleConfig>>,
    #[account(
        mut,
        has_one = token_mint,
        has_one = token_vault
    )]
    pub vesting: Box<Account<'info, Vesting>>,
    pub token_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = recipient_vault.mint == token_mint.key(),
        constraint = recipient_vault.owner == ido_config.owner,
    )]
    pub recipient_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        seeds = [
            vesting.to_account_info().key.as_ref()
        ],
        bump = vesting.nonce,
    )]
    /// CHECK: nothing to check.
    pub vesting_signer: AccountInfo<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,

    // Misc
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateVestingAccount<'info> {
    pub vesting: Box<Account<'info, Vesting>>,
    #[account(
        init,
        payer=signer,
        seeds = [
            vesting.to_account_info().key.as_ref(),
            signer.to_account_info().key.as_ref()
        ],
        bump,
    )]
    pub user_vesting: Box<Account<'info, UserVestingAccount>>,
    #[account(mut)]
    pub signer: Signer<'info>,

    // Misc.
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    pub ido_config: Box<Account<'info, TokenSaleConfig>>,
    #[account(
        has_one=token_mint,
        has_one=token_vault,
        has_one=ido_config,
    )]
    pub vesting: Box<Account<'info, Vesting>>,
    #[account(
        mut,
        seeds = [
            vesting.to_account_info().key.as_ref(),
            signer.to_account_info().key.as_ref()
        ],
        bump = user_vesting.nonce,
    )]
    pub user_vesting: Box<Account<'info, UserVestingAccount>>,
    #[account(
        constraint = user_token_sale.config == ido_config.key(),
        constraint = user_token_sale.user == signer.key(),
    )]
    pub user_token_sale: Box<Account<'info, UserTokenSale>>,
    pub token_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = claim_recipient.mint == token_mint.key(),
        constraint = claim_recipient.owner == signer.key(),
    )]
    pub claim_recipient: Box<Account<'info, TokenAccount>>,
    #[account(
        seeds = [
            vesting.to_account_info().key.as_ref()
        ],
        bump = vesting.nonce,
    )]
    /// CHECK: nothing to check.
    pub vesting_signer: AccountInfo<'info>,
    pub signer: Signer<'info>,

    // Misc.
    pub token_program: Program<'info, Token>,
}
