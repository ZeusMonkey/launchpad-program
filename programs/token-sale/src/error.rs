use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero.")]
    AmountMustBeGreaterThanZero,
    #[msg("Period must be greater than zero.")]
    PeriodMustBeGreaterThanZero,
    #[msg("Token sale not started.")]
    TokenSaleNotStarted,
    #[msg("Token sale ended.")]
    TokenSaleEnded,
    #[msg("Start time must be greater than now.")]
    StartTimeMustBeGreaterThanNow,
    #[msg("No available tokens.")]
    NoAvailableTokens,
    #[msg("Insufficient allocation.")]
    InsufficientAllocation,
    #[msg("Amount must be lower than remaining IDO amount.")]
    AmountMustBeLowerThanRemainingIDOAmount,
}
