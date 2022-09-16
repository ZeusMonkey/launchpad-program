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

declare_id!("2btf863eSGk6bhBTm4GQ628uBsHJdfS86iWkDA9GfqzB");

pub const DENOMINATOR: u64 = 100000;

#[program]
pub mod vesting {
    use super::*;

    pub fn initialize_vesting(
        ctx: Context<InitializeVesting>,
        amount: u64,
        tge_pct: u64,
        start_time: u64,
        period: u64,
        claim_period: u64,
    ) -> Result<()> {
        if amount == 0 {
            return Err(ErrorCode::AmountMustBeGreaterThanZero.into());
        }
        if start_time == 0 {
            return Err(ErrorCode::StartTimeMustBeGreaterThanZero.into());
        }
        if period == 0 || claim_period == 0 {
            return Err(ErrorCode::PeriodMustBeGreaterThanZero.into());
        }
        if claim_period > period {
            return Err(ErrorCode::ClaimPeriodCannotBeGreaterThanPeriod.into());
        }
        if tge_pct > DENOMINATOR {
            return Err(ErrorCode::TgePctCannotBeGreater100.into());
        }
        // Transfer tokens into the vault.
        {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.fund_vault.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.signer.to_account_info(),
                },
            );
            token::transfer(cpi_ctx, amount)?;
        }

        let vesting = &mut ctx.accounts.vesting;
        vesting.ido_config = ctx.accounts.ido_config.key();
        vesting.token_mint = ctx.accounts.token_mint.key();
        vesting.token_vault = ctx.accounts.token_vault.key();
        vesting.start_time = start_time;
        vesting.period = period;
        vesting.amount = amount;
        vesting.claim_period = claim_period;
        vesting.tge_pct = tge_pct;
        vesting.nonce = *ctx.bumps.get("vesting_signer").unwrap();
        vesting.withdrawn_amount = 0;

        Ok(())
    }

    pub fn create_vesting_account(ctx: Context<CreateVestingAccount>) -> Result<()> {
        let user_vesting = &mut ctx.accounts.user_vesting;
        user_vesting.vesting = ctx.accounts.vesting.key();
        user_vesting.claimed = 0;
        user_vesting.nonce = *ctx.bumps.get("user_vesting").unwrap();

        Ok(())
    }

    pub fn withdraw_unallocated_token(ctx: Context<WithdrawUnallocatedToken>) -> Result<()> {
        let ido_config = &ctx.accounts.ido_config;

        let current_time: u64 = sysvar::clock::Clock::get()
            .unwrap()
            .unix_timestamp
            .try_into()
            .unwrap();

        if ido_config.start_time + ido_config.period > current_time {
            return Err(ErrorCode::CannotWithdrawBeforeIdoEnds.into());
        }

        let vesting = &mut ctx.accounts.vesting;

        if vesting.withdrawn_amount > 0 {
            return Err(ErrorCode::AlreadyWithdrawn.into());
        }

        let required_amount = vesting.amount * ido_config.paid_amount / ido_config.amount;

        vesting.withdrawn_amount = vesting.amount - required_amount;

        // Transfer tokens from the vault to creator

        let seeds = &[vesting.to_account_info().key.as_ref(), &[vesting.nonce]];
        let vesting_signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_vault.to_account_info(),
                to: ctx.accounts.recipient_vault.to_account_info(),
                authority: ctx.accounts.vesting_signer.to_account_info(),
            },
            vesting_signer,
        );
        token::transfer(cpi_ctx, vesting.withdrawn_amount)?;

        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let vesting = &ctx.accounts.vesting;
        let current_time: u64 = sysvar::clock::Clock::get()
            .unwrap()
            .unix_timestamp
            .try_into()
            .unwrap();

        if vesting.start_time > current_time {
            return Err(ErrorCode::CannotClaimBeforeStartTime.into());
        }

        let user_amount = vesting.amount * ctx.accounts.user_token_sale.paid_amount
            / ctx.accounts.ido_config.amount;

        let tge_amount = user_amount * vesting.tge_pct / DENOMINATOR;

        let vested_amount = (user_amount - tge_amount)
            * ((current_time - vesting.start_time) / vesting.claim_period * vesting.claim_period)
            / vesting.period;
        let mut total_claimable = vested_amount + tge_amount;
        if total_claimable > user_amount {
            total_claimable = user_amount;
        }

        let user_vesting = &mut ctx.accounts.user_vesting;
        if total_claimable <= user_vesting.claimed {
            return Err(ErrorCode::NoClaimableTokens.into());
        }

        let claimable = total_claimable - user_vesting.claimed;
        user_vesting.claimed = total_claimable;

        // Transfer tokens from the vault to user
        {
            let seeds = &[vesting.to_account_info().key.as_ref(), &[vesting.nonce]];
            let vesting_signer = &[&seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.token_vault.to_account_info(),
                    to: ctx.accounts.claim_recipient.to_account_info(),
                    authority: ctx.accounts.vesting_signer.to_account_info(),
                },
                vesting_signer,
            );
            token::transfer(cpi_ctx, claimable)?;
        }

        Ok(())
    }
}
