import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import assert from 'assert';
import { Vesting } from '../target/types/vesting';
import { TokenSale } from '../target/types/token_sale';
import { Staking } from '../target/types/staking';
import { WhitelistNft } from '../target/types/whitelist_nft';
import {
  createMint,
  wait,
  StakingInfo,
  createStakingPool,
  createTokenSaleAccount,
  stake,
  createStakingUser,
  depositWithStaking,
  createUserVestingACcount,
} from './utils';

describe('vesting', () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const vestingProgram = anchor.workspace.Vesting as Program<Vesting>;
  const tokenSaleProgram = anchor.workspace.TokenSale as Program<TokenSale>;
  const stakingProgram = anchor.workspace.Staking as Program<Staking>;
  const whitelistProgram = anchor.workspace
    .WhitelistNft as Program<WhitelistNft>;

  let tokenSaleConfig: anchor.web3.Keypair;
  let saleSigner: anchor.web3.PublicKey;
  let saleNonce: number;
  let whitelistConfig: anchor.web3.Keypair;
  let fconMint: Token;
  let usdcMint: Token;
  let paymentTokenVault: anchor.web3.PublicKey;
  let stakingInfo_7days: StakingInfo;
  let stakingInfo_2months: StakingInfo;
  let saleAmount = new anchor.BN(10000000000);
  let startTime: anchor.BN;
  let period = new anchor.BN('10');
  let stakingAllocation0 = [
    new anchor.BN(20_000_000),
    new anchor.BN(100_000_000),
    new anchor.BN(200_000_000),
    new anchor.BN(400_000_000),
    new anchor.BN(900_000_000),
    new anchor.BN(30_320_000_000),
    new anchor.BN(60_640_000_000),
  ];
  let stakingAllocation1 = [
    new anchor.BN(60_000_000),
    new anchor.BN(300_000_000),
    new anchor.BN(600_000_000),
    new anchor.BN(1_200_000_000),
    new anchor.BN(2_100_000_000),
    new anchor.BN(30_320_000_000),
    new anchor.BN(60_640_000_000),
  ];
  let nftAllocation = new anchor.BN(20_000_000);
  let tokenMint: Token;
  let vesting: anchor.web3.Keypair;
  let vestingSigner: anchor.web3.PublicKey;
  let vestingNonce: number;
  let tokenVault: anchor.web3.PublicKey;
  let userVesting: anchor.web3.Keypair;
  let fundVault: anchor.web3.PublicKey;
  let tgePercentage = new anchor.BN(10000); // 10%
  let vestingAmount = new anchor.BN(10000000000);
  let vestingPeriod = new anchor.BN(86400);
  let vestingClaimPeriod = new anchor.BN(20);
  let vestingStartTime: anchor.BN;
  let wallet: anchor.Wallet = provider.wallet as anchor.Wallet;

  beforeEach(async () => {
    whitelistConfig = anchor.web3.Keypair.generate();

    await whitelistProgram.rpc.initialize({
      accounts: {
        config: whitelistConfig.publicKey,
        signer: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [whitelistConfig],
    });

    fconMint = await createMint(provider, 4);
    stakingInfo_7days = await createStakingPool(
      provider,
      stakingProgram,
      fconMint,
      new anchor.BN(86400 * 7),
    );
    stakingInfo_2months = await createStakingPool(
      provider,
      stakingProgram,
      fconMint,
      new anchor.BN(86400 * 60),
    );

    usdcMint = await createMint(provider, 6);

    tokenSaleConfig = anchor.web3.Keypair.generate();

    let [_saleSigner, nonce] = await anchor.web3.PublicKey.findProgramAddress(
      [tokenSaleConfig.publicKey.toBuffer()],
      tokenSaleProgram.programId,
    );
    saleSigner = _saleSigner;
    saleNonce = nonce;

    paymentTokenVault = await usdcMint.createAccount(saleSigner);

    startTime = new anchor.BN(Math.floor(Date.now() / 1000));
    await tokenSaleProgram.rpc.initializeSale(
      saleNonce,
      saleAmount,
      startTime,
      period,
      stakingAllocation0,
      stakingAllocation1,
      nftAllocation,
      {
        accounts: {
          config: tokenSaleConfig.publicKey,
          stakingPool0: stakingInfo_7days.pool.publicKey,
          stakingPool1: stakingInfo_2months.pool.publicKey,
          whitelistConfig: whitelistConfig.publicKey,
          paymentTokenMint: usdcMint.publicKey,
          paymentTokenVault,
          saleSigner,
          signer: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [tokenSaleConfig],
      },
    );

    tokenMint = await createMint(provider, 6);

    vesting = anchor.web3.Keypair.generate();
    let [_vestingSigner, _vestingNonce] =
      await anchor.web3.PublicKey.findProgramAddress(
        [vesting.publicKey.toBuffer()],
        vestingProgram.programId,
      );
    vestingSigner = _vestingSigner;
    vestingNonce = _vestingNonce;

    tokenVault = await tokenMint.createAccount(vestingSigner);
    fundVault = await tokenMint.createAccount(wallet.publicKey);
    await tokenMint.mintTo(fundVault, wallet.payer, [], 100000000000000);

    vestingStartTime = new anchor.BN(Math.floor(Date.now() / 1000));

    await vestingProgram.rpc.initializeVesting(
      vestingAmount,
      tgePercentage,
      vestingStartTime,
      vestingPeriod,
      vestingClaimPeriod,
      {
        accounts: {
          idoConfig: tokenSaleConfig.publicKey,
          vesting: vesting.publicKey,
          tokenMint: tokenMint.publicKey,
          tokenVault,
          fundVault,
          vestingSigner,
          signer: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [vesting],
      },
    );
  });

  describe('initialize_vesting', () => {
    it('Check initialized vesting', async () => {
      const vestingAccount = await vestingProgram.account.vesting.fetch(
        vesting.publicKey,
      );
      assert.equal(vestingAccount.nonce, vestingNonce);
      assert.equal(
        vestingAccount.idoConfig.toString(),
        tokenSaleConfig.publicKey.toString(),
      );
      assert.equal(
        vestingAccount.tokenMint.toString(),
        tokenMint.publicKey.toString(),
      );
      assert.equal(vestingAccount.tokenVault.toString(), tokenVault.toString());
      assert.equal(
        vestingAccount.startTime.toString(),
        vestingStartTime.toString(),
      );
      assert.equal(vestingAccount.period.toString(), vestingPeriod.toString());
      assert.equal(
        vestingAccount.claimPeriod.toString(),
        vestingClaimPeriod.toString(),
      );
      assert.equal(vestingAccount.tgePct.toString(), tgePercentage.toString());
      assert.equal(vestingAccount.amount.toString(), vestingAmount.toString());
      assert.equal(vestingAccount.withdrawnAmount.toString(), '0');

      const tokenVaultAccount = await tokenMint.getAccountInfo(tokenVault);
      assert.equal(
        tokenVaultAccount.amount.toString(),
        vestingAmount.toString(),
      );
    });
  });

  describe('create_vesting_account', () => {
    it('create vesting account', async () => {
      let [userVestingAccount, userVestingNonce] =
        await anchor.web3.PublicKey.findProgramAddress(
          [vesting.publicKey.toBuffer(), wallet.publicKey.toBuffer()],
          vestingProgram.programId,
        );

      await vestingProgram.rpc.createVestingAccount({
        accounts: {
          vesting: vesting.publicKey,
          userVesting: userVestingAccount,
          signer: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      });

      const vestingAccount =
        await vestingProgram.account.userVestingAccount.fetch(
          userVestingAccount,
        );
      assert.equal(
        vestingAccount.vesting.toString(),
        vesting.publicKey.toString(),
      );
      assert.equal(
        vestingAccount.nonce.toString(),
        userVestingNonce.toString(),
      );
      assert.equal(vestingAccount.claimed.toString(), '0');
    });
  });

  describe('claim', () => {
    let claimRecipient: anchor.web3.PublicKey;
    let userTokenSale: anchor.web3.PublicKey;
    let userVault: anchor.web3.PublicKey;
    let fconTokenAccount: anchor.web3.PublicKey;
    let userStakingAccount: anchor.web3.PublicKey;
    let userVestingAccount: anchor.web3.PublicKey;
    let userAmount = new anchor.BN(10000);

    beforeEach(async () => {
      userTokenSale = await createTokenSaleAccount(
        provider,
        tokenSaleProgram,
        tokenSaleConfig.publicKey,
      );

      userVault = await usdcMint.createAccount(wallet.publicKey);
      await usdcMint.mintTo(userVault, wallet.payer, [], 10000000000000);

      userStakingAccount = await createStakingUser(
        provider,
        stakingProgram,
        stakingInfo_7days,
      );
      fconTokenAccount = await fconMint.createAccount(wallet.publicKey);
      await fconMint.mintTo(fconTokenAccount, wallet.payer, [], 2_000_000_000);
      await stake(
        provider,
        stakingProgram,
        stakingInfo_7days,
        userStakingAccount,
        fconTokenAccount,
        new anchor.BN(2_000_000_000),
      );

      await depositWithStaking(
        provider,
        tokenSaleProgram,
        tokenSaleConfig.publicKey,
        userTokenSale,
        usdcMint.publicKey,
        paymentTokenVault,
        userVault,
        userStakingAccount,
        userAmount,
      );

      userVestingAccount = await createUserVestingACcount(
        provider,
        vestingProgram,
        vesting.publicKey,
      );

      claimRecipient = await tokenMint.createAccount(wallet.publicKey);
    });

    it('claim tgeAmount from start time', async () => {
      await wait(10);

      await vestingProgram.rpc.claim({
        accounts: {
          idoConfig: tokenSaleConfig.publicKey,
          vesting: vesting.publicKey,
          userVesting: userVestingAccount,
          userTokenSale,
          tokenMint: tokenMint.publicKey,
          tokenVault,
          claimRecipient,
          vestingSigner,
          signer: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      });

      const tgeAmount = vestingAmount
        .mul(userAmount)
        .div(saleAmount)
        .mul(tgePercentage)
        .div(new anchor.BN('100000'));
      const recipientAccount = await tokenMint.getAccountInfo(claimRecipient);
      assert.equal(recipientAccount.amount.toString(), tgeAmount.toString());

      const vestingAccount =
        await vestingProgram.account.userVestingAccount.fetch(
          userVestingAccount,
        );
      assert.equal(vestingAccount.claimed.toString(), tgeAmount.toString());
    });

    it('claim available amounts', async () => {
      await wait(35);

      await vestingProgram.rpc.claim({
        accounts: {
          idoConfig: tokenSaleConfig.publicKey,
          vesting: vesting.publicKey,
          userVesting: userVestingAccount,
          userTokenSale,
          tokenMint: tokenMint.publicKey,
          tokenVault,
          claimRecipient,
          vestingSigner,
          signer: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      });

      const userVestingAmount = vestingAmount.mul(userAmount).div(saleAmount);

      const tgeAmount = userVestingAmount
        .mul(tgePercentage)
        .div(new anchor.BN('100000'));
      const batchAmount = userVestingAmount
        .sub(tgeAmount)
        .mul(vestingClaimPeriod)
        .div(vestingPeriod);

      const recipientAccount = await tokenMint.getAccountInfo(claimRecipient);
      assert.equal(
        recipientAccount.amount.toString(),
        tgeAmount.add(batchAmount).toString(),
      );

      const vestingAccount =
        await vestingProgram.account.userVestingAccount.fetch(
          userVestingAccount,
        );
      assert.equal(
        vestingAccount.claimed.toString(),
        tgeAmount.add(batchAmount).toString(),
      );
    });
  });
});
