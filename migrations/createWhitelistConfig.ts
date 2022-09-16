import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { WhitelistNft } from '../target/types/whitelist_nft';

export const createWhitelistConfig = async (
  whitelistProgram: Program<WhitelistNft>,
  wallet: anchor.Wallet,
) => {
  const whitelistConfig = anchor.web3.Keypair.generate();

  console.log('Create whitelist nft config...');

  await whitelistProgram.rpc.initialize({
    accounts: {
      config: whitelistConfig.publicKey,
      signer: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    },
    signers: [whitelistConfig],
  });

  console.log('Whitelist config: ', whitelistConfig.publicKey.toString());

  return whitelistConfig.publicKey;
};
