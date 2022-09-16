import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID, Token } from '@solana/spl-token';
import { sleep } from '@project-serum/common';
import { Staking } from '../target/types/staking';
import { TokenSale } from './../target/types/token_sale';
import { WhitelistNft } from '../target/types/whitelist_nft';
import { Vesting } from '../target/types/vesting';

export type StakingInfo = {
  pool: anchor.web3.Keypair;
  poolSigner: anchor.web3.PublicKey;
  nonce: number;
  stakingVault: anchor.web3.PublicKey;
  rewardVault: anchor.web3.PublicKey;
};

export const createMint = async (
  provider: anchor.Provider,
  decimals: number,
): Promise<Token> => {
  const mint = await Token.createMint(
    provider.connection,
    (provider.wallet as anchor.Wallet).payer,
    provider.wallet.publicKey,
    null,
    decimals,
    TOKEN_PROGRAM_ID,
  );
  return mint;
};

export const createStakingPool = async (
  provider: anchor.Provider,
  stakingProgram: Program<Staking>,
  mint: Token,
  lockPeriod: anchor.BN,
): Promise<StakingInfo> => {
  const pool = anchor.web3.Keypair.generate();

  let [poolSigner, nonce] = await anchor.web3.PublicKey.findProgramAddress(
    [pool.publicKey.toBuffer()],
    stakingProgram.programId,
  );

  const stakingVault = await mint.createAccount(poolSigner);
  const rewardVault = await mint.createAccount(poolSigner);

  await stakingProgram.rpc.initializePool(
    nonce,
    new anchor.BN(86400 * 30),
    lockPeriod,
    false,
    {
      accounts: {
        authority: provider.wallet.publicKey,
        stakingMint: mint.publicKey,
        stakingVault,
        rewardMint: mint.publicKey,
        rewardVault,
        poolSigner: poolSigner,
        pool: pool.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [pool],
      instructions: [await stakingProgram.account.pool.createInstruction(pool)],
    },
  );

  return {
    pool,
    poolSigner,
    nonce,
    stakingVault,
    rewardVault,
  };
};

export const createStakingUser = async (
  provider: anchor.Provider,
  stakingProgram: Program<Staking>,
  stakingInfo: StakingInfo,
): Promise<anchor.web3.PublicKey> => {
  let [userAccount, _] = await anchor.web3.PublicKey.findProgramAddress(
    [
      provider.wallet.publicKey.toBuffer(),
      stakingInfo.pool.publicKey.toBuffer(),
    ],
    stakingProgram.programId,
  );

  await stakingProgram.rpc.createUser({
    accounts: {
      pool: stakingInfo.pool.publicKey,
      user: userAccount,
      owner: provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    },
  });

  return userAccount;
};

export const stake = async (
  provider: anchor.Provider,
  stakingProgram: Program<Staking>,
  stakingInfo: StakingInfo,
  userAccount: anchor.web3.PublicKey,
  userTokenVault: anchor.web3.PublicKey,
  amount: anchor.BN,
) => {
  await stakingProgram.rpc.stake(amount, {
    accounts: {
      pool: stakingInfo.pool.publicKey,
      stakingVault: stakingInfo.stakingVault,
      user: userAccount,
      owner: provider.wallet.publicKey,
      stakeFromAccount: userTokenVault,
      poolSigner: stakingInfo.poolSigner,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
  });
};

export const unstake = async (
  provider: anchor.Provider,
  stakingProgram: Program<Staking>,
  stakingInfo: StakingInfo,
  userAccount: anchor.web3.PublicKey,
  userTokenVault: anchor.web3.PublicKey,
  amount: anchor.BN,
) => {
  await stakingProgram.rpc.unstake(amount, {
    accounts: {
      pool: stakingInfo.pool.publicKey,
      stakingVault: stakingInfo.stakingVault,
      user: userAccount,
      owner: provider.wallet.publicKey,
      stakeFromAccount: userTokenVault,
      poolSigner: stakingInfo.poolSigner,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
  });
};

export const createTokenSaleAccount = async (
  provider: anchor.Provider,
  tokenSaleProgram: Program<TokenSale>,
  tokenSaleConfig: anchor.web3.PublicKey,
): Promise<anchor.web3.PublicKey> => {
  let [idoAccount, _] = await anchor.web3.PublicKey.findProgramAddress(
    [tokenSaleConfig.toBuffer(), provider.wallet.publicKey.toBuffer()],
    tokenSaleProgram.programId,
  );

  await tokenSaleProgram.rpc.createTokenSaleAccount({
    accounts: {
      config: tokenSaleConfig,
      userTokenSale: idoAccount,
      signer: provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    },
  });

  return idoAccount;
};

export const createTokenSaleAccountWithNFT = async (
  provider: anchor.Provider,
  tokenSaleProgram: Program<TokenSale>,
  tokenSaleConfig: anchor.web3.PublicKey,
  nftMint: anchor.web3.PublicKey,
  whitelistNftAccount: anchor.web3.PublicKey,
): Promise<anchor.web3.PublicKey> => {
  let [nftIdoInfo, _] = await anchor.web3.PublicKey.findProgramAddress(
    [tokenSaleConfig.toBuffer(), nftMint.toBuffer()],
    tokenSaleProgram.programId,
  );

  await tokenSaleProgram.rpc.createNftSaleAccount({
    accounts: {
      config: tokenSaleConfig,
      nftMint,
      whitelistNftAccount,
      nftIdoInfo,
      signer: provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    },
  });

  return nftIdoInfo;
};

export const whitelistNFT = async (
  provider: anchor.Provider,
  whitelistProgram: Program<WhitelistNft>,
  whitelistConfig: anchor.web3.PublicKey,
  mint: anchor.web3.PublicKey,
): Promise<anchor.web3.PublicKey> => {
  let [whitelistAccount, _] = await anchor.web3.PublicKey.findProgramAddress(
    [whitelistConfig.toBuffer(), mint.toBuffer()],
    whitelistProgram.programId,
  );

  await whitelistProgram.rpc.addWhitelist(mint, {
    accounts: {
      config: whitelistConfig,
      whitelistAccount,
      signer: provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    },
  });

  return whitelistAccount;
};

export const depositWithStaking = async (
  provider: anchor.Provider,
  tokenSaleProgram: Program<TokenSale>,
  tokenSaleConfig: anchor.web3.PublicKey,
  userTokenSale: anchor.web3.PublicKey,
  paymentTokenMint: anchor.web3.PublicKey,
  paymentTokenVault: anchor.web3.PublicKey,
  userVault: anchor.web3.PublicKey,
  stakingAccount: anchor.web3.PublicKey,
  amount: anchor.BN,
) => {
  await tokenSaleProgram.rpc.depositWithStaking(amount, {
    accounts: {
      config: tokenSaleConfig,
      userTokenSale,
      paymentTokenMint,
      paymentTokenVault,
      userVault,
      stakingAccount,
      signer: provider.wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
  });
};

export const depositWithNft = async (
  provider: anchor.Provider,
  tokenSaleProgram: Program<TokenSale>,
  tokenSaleConfig: anchor.web3.PublicKey,
  userTokenSale: anchor.web3.PublicKey,
  paymentTokenMint: anchor.web3.PublicKey,
  paymentTokenVault: anchor.web3.PublicKey,
  userVault: anchor.web3.PublicKey,
  nftAccount: anchor.web3.PublicKey,
  nftIdoInfo: anchor.web3.PublicKey,
  whitelistNftAccount: anchor.web3.PublicKey,
  amount: anchor.BN,
) => {
  await tokenSaleProgram.rpc.depositWithNft(amount, {
    accounts: {
      config: tokenSaleConfig,
      userTokenSale,
      nftIdoInfo,
      paymentTokenMint,
      paymentTokenVault,
      userVault,
      nftAccount,
      whitelistNftAccount,
      signer: provider.wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
  });
};

export const withdraw = async (
  provider: anchor.Provider,
  tokenSaleProgram: Program<TokenSale>,
  tokenSaleConfig: anchor.web3.PublicKey,
  paymentTokenMint: anchor.web3.PublicKey,
  paymentTokenVault: anchor.web3.PublicKey,
  recipient: anchor.web3.PublicKey,
  saleSigner: anchor.web3.PublicKey,
) => {
  await tokenSaleProgram.rpc.withdraw({
    accounts: {
      config: tokenSaleConfig,
      paymentTokenMint,
      paymentTokenVault,
      recipient,
      saleSigner,
      signer: provider.wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
  });
};

export const createUserVestingACcount = async (
  provider: anchor.Provider,
  vestingProgram: Program<Vesting>,
  vesting: anchor.web3.PublicKey,
) => {
  let [userVestingAccount, userVestingNonce] =
    await anchor.web3.PublicKey.findProgramAddress(
      [vesting.toBuffer(), provider.wallet.publicKey.toBuffer()],
      vestingProgram.programId,
    );

  await vestingProgram.rpc.createVestingAccount({
    accounts: {
      vesting: vesting,
      userVesting: userVestingAccount,
      signer: provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    },
  });

  return userVestingAccount;
};

export const wait = async (seconds: number) => {
  await sleep(seconds * 1000);
};
