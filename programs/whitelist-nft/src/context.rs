use crate::account::*;
use anchor_lang::prelude::*;
use std::convert::Into;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer=signer)]
    pub config: Box<Account<'info, WhitelistConfig>>,
    #[account(mut)]
    pub signer: Signer<'info>,

    //Misc
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateOwner<'info> {
    #[account(
        mut,
        constraint = config.owner == signer.key(),
    )]
    pub config: Box<Account<'info, WhitelistConfig>>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct AddWhitelist<'info> {
    #[account(
        constraint = config.owner == signer.key(),
    )]
    pub config: Box<Account<'info, WhitelistConfig>>,
    #[account(
        init,
        payer=signer,
        seeds = [
            config.to_account_info().key.as_ref(),
            user.as_ref(),
        ],
        bump,
    )]
    pub whitelist_account: Box<Account<'info, WhitelistAccount>>,
    #[account(mut)]
    pub signer: Signer<'info>,

    //Misc
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveWhitelist<'info> {
    #[account(
        constraint = config.owner == signer.key(),
    )]
    pub config: Box<Account<'info, WhitelistConfig>>,
    #[account(
        mut,
        close=signer,
        constraint = whitelist_account.config == config.key(),
    )]
    pub whitelist_account: Box<Account<'info, WhitelistAccount>>,
    #[account(mut)]
    pub signer: Signer<'info>,
}
