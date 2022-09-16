pub mod account;
pub mod context;
pub mod error;

use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar;
use anchor_spl::token::{self};
use context::*;
use error::ErrorCode;
use std::convert::Into;
use std::convert::TryInto;

declare_id!("CKtaZDifHb9EbhW9StG42FuR673mQykFFPDEST4h2rhB");

#[program]
pub mod token_sale {
    use super::*;

    pub fn initialize_sale(
        ctx: Context<InitializeSale>,
        nonce: u8,
        amount: u64,
        start_time: u64,
        period: u64,
        staking_allocation_0: [u64; 7],
        staking_allocation_1: [u64; 7],
        nft_allocation: u64,
    ) -> Result<()> {
        if amount == 0 {
            return Err(ErrorCode::AmountMustBeGreaterThanZero.into());
        }
        if start_time
            < sysvar::clock::Clock::get()
                .unwrap()
                .unix_timestamp
                .try_into()
                .unwrap()
        {
            return Err(ErrorCode::StartTimeMustBeGreaterThanNow.into());
        }
        if period == 0 {
            return Err(ErrorCode::PeriodMustBeGreaterThanZero.into());
        }

        let config = &mut ctx.accounts.config;
        config.owner = ctx.accounts.signer.key();
        config.nonce = nonce;
        config.staking_pool_0 = ctx.accounts.staking_pool_0.key();
        config.staking_pool_1 = ctx.accounts.staking_pool_1.key();
        config.whitelist_config = ctx.accounts.whitelist_config.key();
        config.payment_token_mint = ctx.accounts.payment_token_mint.key();
        config.payment_token_vault = ctx.accounts.payment_token_vault.key();
        config.amount = amount;
        config.paid_amount = 0;
        config.withdrawn_amount = 0;
        config.start_time = start_time;
        config.period = period;
        config.staking_allocation_0 = staking_allocation_0;
        config.staking_allocation_1 = staking_allocation_1;
        config.nft_allocation = nft_allocation;

        Ok(())
    }

    pub fn whitelist(ctx: Context<Whitelist>, user: Pubkey, allocation: u64) -> Result<()> {
        if allocation == 0 {
            return Err(ErrorCode::AmountMustBeGreaterThanZero.into());
        }

        let whitelist_alloc = &mut ctx.accounts.whitelist_alloc;
        whitelist_alloc.config = ctx.accounts.config.key();
        whitelist_alloc.user = user;
        whitelist_alloc.allocation = allocation;
        whitelist_alloc.nonce = *ctx.bumps.get("whitelist_alloc").unwrap();

        Ok(())
    }

    pub fn remove_whitelist(ctx: Context<RemoveWhitelist>, _user: Pubkey) -> Result<()> {
        let whitelist_alloc = &mut ctx.accounts.whitelist_alloc;
        whitelist_alloc.allocation = 0;

        Ok(())
    }

    pub fn create_token_sale_account(ctx: Context<CreateTokenSaleAccount>) -> Result<()> {
        let user_token_sale = &mut ctx.accounts.user_token_sale;
        user_token_sale.user = ctx.accounts.signer.key();
        user_token_sale.config = ctx.accounts.config.key();
        user_token_sale.paid_amount = 0;
        user_token_sale.used_staking0_alloc = 0;
        user_token_sale.used_staking1_alloc = 0;
        user_token_sale.used_whitelist_alloc = 0;
        user_token_sale.nonce = *ctx.bumps.get("user_token_sale").unwrap();

        Ok(())
    }

    pub fn create_nft_sale_account(ctx: Context<CreateNftSaleAccount>) -> Result<()> {
        let nft_ido_info = &mut ctx.accounts.nft_ido_info;
        nft_ido_info.config = ctx.accounts.config.key();
        nft_ido_info.used_allocation = 0;
        nft_ido_info.nonce = *ctx.bumps.get("nft_ido_info").unwrap();

        Ok(())
    }

    pub fn deposit_with_staking(ctx: Context<DepositWithStaking>, amount: u64) -> Result<()> {
        if amount == 0 {
            return Err(ErrorCode::AmountMustBeGreaterThanZero.into());
        }
        let current_time = sysvar::clock::Clock::get()
            .unwrap()
            .unix_timestamp
            .try_into()
            .unwrap();

        let config = &mut ctx.accounts.config;

        if config.start_time > current_time {
            return Err(ErrorCode::TokenSaleNotStarted.into());
        }
        if config.start_time + config.period < current_time {
            return Err(ErrorCode::TokenSaleEnded.into());
        }

        if config.amount < config.paid_amount + amount {
            return Err(ErrorCode::AmountMustBeLowerThanRemainingIDOAmount.into());
        }

        let user_token_sale = &mut ctx.accounts.user_token_sale;

        let mut allocation: u64 = 0;
        let mut used_allocation: u64 = 0;
        if ctx.accounts.staking_account.pool == config.staking_pool_0 {
            let tier = ctx.accounts.staking_account.tier;
            allocation = config.staking_allocation_0[(tier - 1) as usize];
            used_allocation = user_token_sale.used_staking0_alloc;
            user_token_sale.used_staking0_alloc += amount;
        } else if ctx.accounts.staking_account.pool == config.staking_pool_1 {
            let tier = ctx.accounts.staking_account.tier;
            allocation = config.staking_allocation_1[(tier - 1) as usize];
            used_allocation = user_token_sale.used_staking1_alloc;
            user_token_sale.used_staking1_alloc += amount;
        }

        if allocation < used_allocation + amount {
            return Err(ErrorCode::InsufficientAllocation.into());
        }

        user_token_sale.paid_amount += amount;
        config.paid_amount += amount;

        // Transfer tokens into the IDO vault.
        {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_vault.to_account_info(),
                    to: ctx.accounts.payment_token_vault.to_account_info(),
                    authority: ctx.accounts.signer.to_account_info(),
                },
            );
            token::transfer(cpi_ctx, amount)?;
        }

        Ok(())
    }

    pub fn deposit_with_whitelist(ctx: Context<DepositWithWhitelist>, amount: u64) -> Result<()> {
        if amount == 0 {
            return Err(ErrorCode::AmountMustBeGreaterThanZero.into());
        }
        let current_time = sysvar::clock::Clock::get()
            .unwrap()
            .unix_timestamp
            .try_into()
            .unwrap();

        let config = &mut ctx.accounts.config;

        if config.start_time > current_time {
            return Err(ErrorCode::TokenSaleNotStarted.into());
        }
        if config.start_time + config.period < current_time {
            return Err(ErrorCode::TokenSaleEnded.into());
        }

        if config.amount < config.paid_amount + amount {
            return Err(ErrorCode::AmountMustBeLowerThanRemainingIDOAmount.into());
        }

        let user_token_sale = &mut ctx.accounts.user_token_sale;

        if user_token_sale.used_whitelist_alloc + amount > ctx.accounts.whitelist_alloc.allocation {
            return Err(ErrorCode::InsufficientAllocation.into());
        }

        user_token_sale.used_whitelist_alloc += amount;

        user_token_sale.paid_amount += amount;
        config.paid_amount += amount;

        // Transfer tokens into the IDO vault.
        {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_vault.to_account_info(),
                    to: ctx.accounts.payment_token_vault.to_account_info(),
                    authority: ctx.accounts.signer.to_account_info(),
                },
            );
            token::transfer(cpi_ctx, amount)?;
        }

        Ok(())
    }

    pub fn deposit_with_nft(ctx: Context<DepositWithNft>, amount: u64) -> Result<()> {
        if amount == 0 {
            return Err(ErrorCode::AmountMustBeGreaterThanZero.into());
        }
        let current_time = sysvar::clock::Clock::get()
            .unwrap()
            .unix_timestamp
            .try_into()
            .unwrap();

        let config = &mut ctx.accounts.config;

        if config.amount < config.paid_amount + amount {
            return Err(ErrorCode::AmountMustBeLowerThanRemainingIDOAmount.into());
        }

        if config.start_time > current_time {
            return Err(ErrorCode::TokenSaleNotStarted.into());
        }
        if config.start_time + config.period < current_time {
            return Err(ErrorCode::TokenSaleEnded.into());
        }

        let nft_ido_info = &mut ctx.accounts.nft_ido_info;
        if config.nft_allocation - nft_ido_info.used_allocation < amount {
            return Err(ErrorCode::InsufficientAllocation.into());
        }
        if config.amount < config.paid_amount + amount {
            return Err(ErrorCode::AmountMustBeLowerThanRemainingIDOAmount.into());
        }
        let user_token_sale = &mut ctx.accounts.user_token_sale;

        user_token_sale.paid_amount += amount;
        config.paid_amount += amount;
        nft_ido_info.used_allocation += amount;

        // Transfer tokens into the IDO vault.
        {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_vault.to_account_info(),
                    to: ctx.accounts.payment_token_vault.to_account_info(),
                    authority: ctx.accounts.signer.to_account_info(),
                },
            );
            token::transfer(cpi_ctx, amount)?;
        }

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let config = &mut ctx.accounts.config;

        config.withdrawn_amount += ctx.accounts.payment_token_vault.amount;

        // Transfer tokens from the vault to recipient
        {
            let seeds = &[
                ctx.accounts.config.to_account_info().key.as_ref(),
                &[ctx.accounts.config.nonce],
            ];
            let sale_signer = &[&seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.payment_token_vault.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                    authority: ctx.accounts.sale_signer.to_account_info(),
                },
                sale_signer,
            );
            token::transfer(cpi_ctx, ctx.accounts.payment_token_vault.amount)?;
        }

        Ok(())
    }
}
