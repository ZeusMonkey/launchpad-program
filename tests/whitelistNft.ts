import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import assert from 'assert';
import { WhitelistNft } from '../target/types/whitelist_nft';

describe('whitelist-nft', () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const whitelistProgram = anchor.workspace
    .WhitelistNft as Program<WhitelistNft>;
  let whitelistConfig: anchor.web3.Keypair;
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
  });

  describe('initialize', () => {
    it('Check initialized value', async () => {
      const whitelistAccount =
        await whitelistProgram.account.whitelistConfig.fetch(
          whitelistConfig.publicKey,
        );
      assert.equal(
        whitelistAccount.owner.toString(),
        wallet.publicKey.toString(),
      );
    });
  });

  describe('update_owner', () => {
    it('update new owner', async () => {
      let newOwner = anchor.web3.Keypair.generate();

      await whitelistProgram.rpc.updateOwner(newOwner.publicKey, {
        accounts: {
          config: whitelistConfig.publicKey,
          signer: wallet.publicKey,
        },
      });

      const whitelistAccount =
        await whitelistProgram.account.whitelistConfig.fetch(
          whitelistConfig.publicKey,
        );
      assert.equal(
        whitelistAccount.owner.toString(),
        newOwner.publicKey.toString(),
      );
    });
  });

  describe('add_whitelist', () => {
    it('whitelist user', async () => {
      let user = anchor.web3.Keypair.generate();

      let [whitelistAccount, _] =
        await anchor.web3.PublicKey.findProgramAddress(
          [whitelistConfig.publicKey.toBuffer(), user.publicKey.toBuffer()],
          whitelistProgram.programId,
        );

      await whitelistProgram.rpc.addWhitelist(user.publicKey, {
        accounts: {
          config: whitelistConfig.publicKey,
          whitelistAccount,
          signer: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      });

      const whitelistAccountAccount =
        await whitelistProgram.account.whitelistAccount.fetch(whitelistAccount);
      assert.equal(
        whitelistAccountAccount.config.toString(),
        whitelistConfig.publicKey.toString(),
      );
      assert.equal(
        whitelistAccountAccount.account.toString(),
        user.publicKey.toString(),
      );
      assert.equal(whitelistAccountAccount.whitelisted, true);
    });
  });

  describe('remove_whitelist', () => {
    let user = anchor.web3.Keypair.generate();
    let whitelistAccount: anchor.web3.PublicKey;

    beforeEach(async () => {
      let [whitelistAccount_, _] =
        await anchor.web3.PublicKey.findProgramAddress(
          [whitelistConfig.publicKey.toBuffer(), user.publicKey.toBuffer()],
          whitelistProgram.programId,
        );

      whitelistAccount = whitelistAccount_;

      await whitelistProgram.rpc.addWhitelist(user.publicKey, {
        accounts: {
          config: whitelistConfig.publicKey,
          whitelistAccount,
          signer: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      });
    });

    it('remove whitelist', async () => {
      await whitelistProgram.rpc.removeWhitelist({
        accounts: {
          config: whitelistConfig.publicKey,
          whitelistAccount: whitelistAccount,
          signer: wallet.publicKey,
        },
      });

      try {
        await whitelistProgram.account.whitelistAccount.fetch(whitelistAccount);
        throw Error('Not failed');
      } catch {}
    });
  });
});
