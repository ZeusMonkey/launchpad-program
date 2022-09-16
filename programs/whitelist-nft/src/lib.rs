pub mod account;
pub mod context;

use anchor_lang::prelude::*;
use context::*;
use std::convert::Into;

declare_id!("6HiU5wq8x4gSh8GLyN5oxEtubJw1ArPS5gx72zM76FW2");

#[program]
pub mod whitelist_nft {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.owner = ctx.accounts.signer.key();

        Ok(())
    }

    pub fn update_owner(ctx: Context<UpdateOwner>, new_owner: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.owner = new_owner;

        Ok(())
    }

    pub fn add_whitelist(ctx: Context<AddWhitelist>, account: Pubkey) -> Result<()> {
        let whitelist_account = &mut ctx.accounts.whitelist_account;
        whitelist_account.config = ctx.accounts.config.key();
        whitelist_account.account = account;
        whitelist_account.whitelisted = true;

        Ok(())
    }

    pub fn remove_whitelist(ctx: Context<RemoveWhitelist>) -> Result<()> {
        let whitelist_account = &mut ctx.accounts.whitelist_account;
        whitelist_account.whitelisted = false;

        Ok(())
    }
}
