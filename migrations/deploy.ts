import { PublicKey } from '@solana/web3.js';
// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.

import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Staking } from '../target/types/staking';
import { WhitelistNft } from '../target/types/whitelist_nft';
import { createStakingPool } from './createStakingPools';
import { createWhitelistConfig } from './createWhitelistConfig';
import nfts from './nfts.json';

module.exports = async function (provider: anchor.Provider) {
  // Configure client to use the provider.
  anchor.setProvider(provider);

  let wallet: anchor.Wallet = provider.wallet as anchor.Wallet;

  const stakingProgram = anchor.workspace.Staking as Program<Staking>;
  const whitelistNftProgram = anchor.workspace
    .WhitelistNft as Program<WhitelistNft>;

  // console.log('Deploy no lock pool...');
  // await createStakingPool(
  //   stakingProgram,
  //   provider,
  //   wallet,
  //   new anchor.BN(0),
  //   true,
  // );
  // console.log('Deploy 7 days lock pool...');
  // await createStakingPool(
  //   stakingProgram,
  //   provider,
  //   wallet,
  //   new anchor.BN(600),
  //   false,
  // );
  // console.log('Deploy 2 months lock pool...');
  // await createStakingPool(
  //   stakingProgram,
  //   provider,
  //   wallet,
  //   new anchor.BN(3600),
  //   false,
  // );

  // await createWhitelistConfig(whitelistNftProgram, wallet);

  // const whitelistConfig = new PublicKey(
  //   'JAJtaqMicGt9kzi61eAAHBJHHvmSY3FR1MeiaVRetPzP',
  // );
  // for (let i = 0; i < nfts.devnet.length; i += 1) {
  //   const nftPubKey = new PublicKey(nfts.devnet[i]);

  //   let [whitelistAccount, _] = await anchor.web3.PublicKey.findProgramAddress(
  //     [whitelistConfig.toBuffer(), nftPubKey.toBuffer()],
  //     whitelistNftProgram.programId,
  //   );

  //   await whitelistNftProgram.rpc.addWhitelist(nftPubKey, {
  //     accounts: {
  //       config: whitelistConfig,
  //       whitelistAccount,
  //       signer: wallet.publicKey,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //     },
  //   });

  //   console.log('Acc: ', whitelistAccount.toString());
  // }
};
