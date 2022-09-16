use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero.")]
    AmountMustBeGreaterThanZero,
    #[msg("Period must be greater than zero.")]
    PeriodMustBeGreaterThanZero,
    #[msg("Claim period cannot be greater than period.")]
    ClaimPeriodCannotBeGreaterThanPeriod,
    #[msg("Tge percentage cannot be greater than 100%.")]
    TgePctCannotBeGreater100,
    #[msg("Start time must be greater than zero.")]
    StartTimeMustBeGreaterThanZero,
    #[msg("Cannot claim before start time.")]
    CannotClaimBeforeStartTime,
    #[msg("No claimable tokens.")]
    NoClaimableTokens,
    #[msg("Cannot withdraw before IDO ends.")]
    CannotWithdrawBeforeIdoEnds,
    #[msg("Already withdrawn.")]
    AlreadyWithdrawn,
}
