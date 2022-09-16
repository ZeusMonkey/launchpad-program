import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import assert from 'assert';
import { Token } from '@solana/spl-token';
import { TokenSale } from '../target/types/token_sale';
import { Staking } from '../target/types/staking';
import { WhitelistNft } from '../target/types/whitelist_nft';
import {
  createMint,
  createStakingPool,
  createStakingUser,
  stake,
  createTokenSaleAccount,
  createTokenSaleAccountWithNFT,
  whitelistNFT,
  depositWithStaking,
  depositWithNft,
  StakingInfo,
  wait,
  withdraw,
} from './utils';

describe('tokensale', () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

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
  let wallet: anchor.Wallet = provider.wallet as anchor.Wallet;
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
  });

  describe('initialize sale config', () => {
    it('check initialized config values', async () => {
      const configAccount =
        await tokenSaleProgram.account.tokenSaleConfig.fetch(
          tokenSaleConfig.publicKey,
        );

      assert.equal(configAccount.nonce, saleNonce);
      assert.equal(
        configAccount.stakingPool0.toString(),
        stakingInfo_7days.pool.publicKey.toString(),
      );
      assert.equal(
        configAccount.stakingPool1.toString(),
        stakingInfo_2months.pool.publicKey.toString(),
      );
      assert.equal(
        configAccount.whitelistConfig.toString(),
        whitelistConfig.publicKey.toString(),
      );
      assert.equal(
        configAccount.paymentTokenMint.toString(),
        usdcMint.publicKey.toString(),
      );
      assert.equal(
        configAccount.paymentTokenVault.toString(),
        paymentTokenVault.toString(),
      );
      assert.equal(configAccount.amount.toString(), saleAmount.toString());
      assert.equal(configAccount.paidAmount.toString(), '0');
      assert.equal(configAccount.withdrawnAmount.toString(), '0');
      assert.equal(configAccount.startTime.toString(), startTime.toString());
      assert.equal(configAccount.period.toString(), period.toString());
      assert.equal(
        configAccount.nftAllocation.toString(),
        nftAllocation.toString(),
      );
      for (let i = 0; i < 7; i += 1) {
        assert.equal(
          configAccount.stakingAllocation0[i].toString(),
          stakingAllocation0[i].toString(),
        );
        assert.equal(
          configAccount.stakingAllocation1[i].toString(),
          stakingAllocation1[i].toString(),
        );
      }
    });
  });

  describe('Create Token Sale Account', () => {
    it('Create Token Sale Account', async () => {
      let [userTokenSale, nonce] =
        await anchor.web3.PublicKey.findProgramAddress(
          [tokenSaleConfig.publicKey.toBuffer(), wallet.publicKey.toBuffer()],
          tokenSaleProgram.programId,
        );

      await tokenSaleProgram.rpc.createTokenSaleAccount({
        accounts: {
          config: tokenSaleConfig.publicKey,
          userTokenSale,
          signer: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      });

      const configAccount = await tokenSaleProgram.account.userTokenSale.fetch(
        userTokenSale,
      );

      assert.equal(
        configAccount.config.toString(),
        tokenSaleConfig.publicKey.toString(),
      );
      assert.equal(configAccount.paidAmount.toString(), '0');
      assert.equal(configAccount.usedStaking0Alloc.toString(), '0');
      assert.equal(configAccount.usedStaking1Alloc.toString(), '0');
      assert.equal(configAccount.usedWhitelistAlloc.toString(), '0');
      assert.equal(configAccount.nonce, nonce);
    });
  });

  describe('Deposit with staking', () => {
    let userTokenSale: anchor.web3.PublicKey;
    let userVault: anchor.web3.PublicKey;
    let fconTokenAccount: anchor.web3.PublicKey;
    let userStakingAccount: anchor.web3.PublicKey;

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
    });

    it('it fails if amount is 0', async () => {
      try {
        await depositWithStaking(
          provider,
          tokenSaleProgram,
          tokenSaleConfig.publicKey,
          userTokenSale,
          usdcMint.publicKey,
          paymentTokenVault,
          userVault,
          userStakingAccount,
          new anchor.BN(0),
        );
        assert.fail('DO NOT ENTER HERE');
      } catch (err) {
        assert.equal(err.msg, 'Amount must be greater than zero.');
      }
    });

    it('it fails if amount is higher than remaining IDO sale amount', async () => {
      try {
        await depositWithStaking(
          provider,
          tokenSaleProgram,
          tokenSaleConfig.publicKey,
          userTokenSale,
          usdcMint.publicKey,
          paymentTokenVault,
          userVault,
          userStakingAccount,
          saleAmount.add(new anchor.BN(1)),
        );
        assert.fail('DO NOT ENTER HERE');
      } catch (err) {
        assert.equal(
          err.msg,
          'Amount must be lower than remaining IDO amount.',
        );
      }
    });

    it('it fails if sale not started', async () => {
      tokenSaleConfig = anchor.web3.Keypair.generate();

      let [_saleSigner, nonce] = await anchor.web3.PublicKey.findProgramAddress(
        [tokenSaleConfig.publicKey.toBuffer()],
        tokenSaleProgram.programId,
      );
      saleSigner = _saleSigner;
      saleNonce = nonce;

      paymentTokenVault = await usdcMint.createAccount(saleSigner);

      startTime = new anchor.BN(Math.floor(Date.now() / 1000) + 100);
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

      userTokenSale = await createTokenSaleAccount(
        provider,
        tokenSaleProgram,
        tokenSaleConfig.publicKey,
      );

      try {
        await depositWithStaking(
          provider,
          tokenSaleProgram,
          tokenSaleConfig.publicKey,
          userTokenSale,
          usdcMint.publicKey,
          paymentTokenVault,
          userVault,
          userStakingAccount,
          new anchor.BN(10000),
        );
        assert.fail('DO NOT ENTER HERE');
      } catch (err) {
        assert.equal(err.msg, 'Token sale not started.');
      }
    });

    it('it fails if sale ended', async () => {
      await wait(period.toNumber() + 3);

      try {
        await depositWithStaking(
          provider,
          tokenSaleProgram,
          tokenSaleConfig.publicKey,
          userTokenSale,
          usdcMint.publicKey,
          paymentTokenVault,
          userVault,
          userStakingAccount,
          new anchor.BN(10000),
        );
        assert.fail('DO NOT ENTER HERE');
      } catch (err) {
        assert.equal(err.msg, 'Token sale ended.');
      }
    });

    it('it fails no enough allocation', async () => {
      try {
        await depositWithStaking(
          provider,
          tokenSaleProgram,
          tokenSaleConfig.publicKey,
          userTokenSale,
          usdcMint.publicKey,
          paymentTokenVault,
          userVault,
          userStakingAccount,
          new anchor.BN(30_000_000),
        );
        assert.fail('DO NOT ENTER HERE');
      } catch (err) {
        assert.equal(err.msg, 'Insufficient allocation.');
      }
    });

    it('buy tokens', async () => {
      wait(1);

      await depositWithStaking(
        provider,
        tokenSaleProgram,
        tokenSaleConfig.publicKey,
        userTokenSale,
        usdcMint.publicKey,
        paymentTokenVault,
        userVault,
        userStakingAccount,
        new anchor.BN(10000),
      );

      const userTokenSaleAccount =
        await tokenSaleProgram.account.userTokenSale.fetch(userTokenSale);
      const tokenSaleConfigAccount =
        await tokenSaleProgram.account.tokenSaleConfig.fetch(
          tokenSaleConfig.publicKey,
        );
      assert.equal(userTokenSaleAccount.paidAmount.toString(), '10000');
      assert.equal(userTokenSaleAccount.usedStaking0Alloc.toString(), '10000');
      assert.equal(tokenSaleConfigAccount.paidAmount.toString(), '10000');
      const paymentTokenVaultAccount = await usdcMint.getAccountInfo(
        paymentTokenVault,
      );
      assert.equal(paymentTokenVaultAccount.amount.toString(), '10000');
    });
  });

  describe('Create NFT Sale Account', () => {
    it('Create NFT Sale Account', async () => {
      let nftMint = await createMint(provider, 0);
      let whitelistNftAccount = await whitelistNFT(
        provider,
        whitelistProgram,
        whitelistConfig.publicKey,
        nftMint.publicKey,
      );

      let [nftIdoInfo, nonce] = await anchor.web3.PublicKey.findProgramAddress(
        [tokenSaleConfig.publicKey.toBuffer(), nftMint.publicKey.toBuffer()],
        tokenSaleProgram.programId,
      );

      await tokenSaleProgram.rpc.createNftSaleAccount({
        accounts: {
          config: tokenSaleConfig.publicKey,
          nftMint: nftMint.publicKey,
          whitelistNftAccount,
          nftIdoInfo,
          signer: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      });

      const configAccount = await tokenSaleProgram.account.nftIdoInfo.fetch(
        nftIdoInfo,
      );

      assert.equal(
        configAccount.config.toString(),
        tokenSaleConfig.publicKey.toString(),
      );
      assert.equal(configAccount.usedAllocation.toString(), '0');
      assert.equal(configAccount.nonce, nonce);
    });
  });

  describe('Deposit With NFT', () => {
    let userTokenSale: anchor.web3.PublicKey;
    let userVault: anchor.web3.PublicKey;
    let nftIdoInfo: anchor.web3.PublicKey;
    let nftMint: Token;
    let nftAccount: anchor.web3.PublicKey;
    let whitelistNftAccount: anchor.web3.PublicKey;

    beforeEach(async () => {
      userTokenSale = await createTokenSaleAccount(
        provider,
        tokenSaleProgram,
        tokenSaleConfig.publicKey,
      );

      nftMint = await createMint(provider, 0);
      nftAccount = await nftMint.createAccount(wallet.publicKey);
      await nftMint.mintTo(nftAccount, wallet.payer, [], 1);

      whitelistNftAccount = await whitelistNFT(
        provider,
        whitelistProgram,
        whitelistConfig.publicKey,
        nftMint.publicKey,
      );
      nftIdoInfo = await createTokenSaleAccountWithNFT(
        provider,
        tokenSaleProgram,
        tokenSaleConfig.publicKey,
        nftMint.publicKey,
        whitelistNftAccount,
      );

      userVault = await usdcMint.createAccount(wallet.publicKey);
      await usdcMint.mintTo(userVault, wallet.payer, [], 10000000000000);
    });

    it('it fails if amount is 0', async () => {
      try {
        await depositWithNft(
          provider,
          tokenSaleProgram,
          tokenSaleConfig.publicKey,
          userTokenSale,
          usdcMint.publicKey,
          paymentTokenVault,
          userVault,
          nftAccount,
          nftIdoInfo,
          whitelistNftAccount,
          new anchor.BN(0),
        );
        assert.fail('DO NOT ENTER HERE');
      } catch (err) {
        assert.equal(err.msg, 'Amount must be greater than zero.');
      }
    });

    it('it fails if sale ended', async () => {
      await wait(period.toNumber() + 3);

      try {
        await depositWithNft(
          provider,
          tokenSaleProgram,
          tokenSaleConfig.publicKey,
          userTokenSale,
          usdcMint.publicKey,
          paymentTokenVault,
          userVault,
          nftAccount,
          nftIdoInfo,
          whitelistNftAccount,
          new anchor.BN(100),
        );
        assert.fail('DO NOT ENTER HERE');
      } catch (err) {
        assert.equal(err.msg, 'Token sale ended.');
      }
    });

    it('it fails no enough allocation', async () => {
      try {
        await depositWithNft(
          provider,
          tokenSaleProgram,
          tokenSaleConfig.publicKey,
          userTokenSale,
          usdcMint.publicKey,
          paymentTokenVault,
          userVault,
          nftAccount,
          nftIdoInfo,
          whitelistNftAccount,
          nftAllocation.add(new anchor.BN(1)),
        );
        assert.fail('DO NOT ENTER HERE');
      } catch (err) {
        assert.equal(err.msg, 'Insufficient allocation.');
      }
    });

    it('buy tokens with nft', async () => {
      wait(1);

      await depositWithNft(
        provider,
        tokenSaleProgram,
        tokenSaleConfig.publicKey,
        userTokenSale,
        usdcMint.publicKey,
        paymentTokenVault,
        userVault,
        nftAccount,
        nftIdoInfo,
        whitelistNftAccount,
        new anchor.BN(10000),
      );

      const userTokenSaleAccount =
        await tokenSaleProgram.account.userTokenSale.fetch(userTokenSale);
      const tokenSaleConfigAccount =
        await tokenSaleProgram.account.tokenSaleConfig.fetch(
          tokenSaleConfig.publicKey,
        );
      const nftIdoInfoAccount = await tokenSaleProgram.account.nftIdoInfo.fetch(
        nftIdoInfo,
      );
      assert.equal(userTokenSaleAccount.paidAmount.toString(), '10000');
      assert.equal(tokenSaleConfigAccount.paidAmount.toString(), '10000');
      assert.equal(nftIdoInfoAccount.usedAllocation.toString(), '10000');
      const paymentTokenVaultAccount = await usdcMint.getAccountInfo(
        paymentTokenVault,
      );
      assert.equal(paymentTokenVaultAccount.amount.toString(), '10000');
    });
  });

  describe('Withdraw', () => {
    let userTokenSale: anchor.web3.PublicKey;
    let userVault: anchor.web3.PublicKey;
    let fconTokenAccount: anchor.web3.PublicKey;
    let userStakingAccount: anchor.web3.PublicKey;

    beforeEach(async () => {
      userTokenSale = await createTokenSaleAccount(
        provider,
        tokenSaleProgram,
        tokenSaleConfig.publicKey,
      );

      userVault = await usdcMint.createAccount(wallet.publicKey);
      await usdcMint.mintTo(userVault, wallet.payer, [], 10000000000000);

      wait(1);

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
        new anchor.BN(10000),
      );
    });

    it('withdraw', async () => {
      const recipient = await usdcMint.createAccount(wallet.publicKey);
      await withdraw(
        provider,
        tokenSaleProgram,
        tokenSaleConfig.publicKey,
        usdcMint.publicKey,
        paymentTokenVault,
        recipient,
        saleSigner,
      );

      const tokenSaleConfigAccount =
        await tokenSaleProgram.account.tokenSaleConfig.fetch(
          tokenSaleConfig.publicKey,
        );
      assert.equal(tokenSaleConfigAccount.withdrawnAmount.toString(), '10000');
      const paymentTokenVaultAccount = await usdcMint.getAccountInfo(
        paymentTokenVault,
      );
      assert.equal(paymentTokenVaultAccount.amount.toString(), '0');
    });
  });
});
