import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { firstValueFrom } from 'rxjs';
import {
  ENV_PATH,
  INDEXER_URI,
  INDEXER_WS_URI,
  NETWORK_ID,
  NODE_URI,
  PROOF_SERVER_URI,
  ZSWAP_NETWORK_ID,
  generateSeed,
  readEnvFile,
  writeSeed,
} from './config.ts';

/**
 * Create (or reuse) a throwaway Preview wallet and print its public addresses.
 *
 * The seed is generated here and written to deploy/.env, which is gitignored.
 * Nothing in this script prints the seed: the whole point is that the address
 * can be shared to receive a faucet airdrop while the key stays put.
 */
const main = async (): Promise<void> => {
  const existing = readEnvFile().GATEKEEPER_SEED;
  const seed = existing ?? generateSeed();

  if (existing === undefined) {
    writeSeed(seed);
    console.log(`Generated a new seed and wrote it to ${ENV_PATH}`);
  } else {
    console.log(`Reusing the seed already in ${ENV_PATH}`);
  }

  console.log(`Building the wallet against ${NETWORK_ID}. This syncs with the indexer…`);

  const wallet = await WalletBuilder.build(
    INDEXER_URI,
    INDEXER_WS_URI,
    PROOF_SERVER_URI,
    NODE_URI,
    seed,
    ZSWAP_NETWORK_ID,
    'error',
  );

  try {
    wallet.start();
    const state = await firstValueFrom(wallet.state());

    console.log('');
    console.log('  Address           ', state.address);
    console.log('  Coin public key   ', state.coinPublicKey);
    console.log('  Encryption pub key', state.encryptionPublicKey);
    console.log('  Legacy address    ', state.addressLegacy);
    console.log('');
    console.log('  Balances          ', JSON.stringify(state.balances));
    console.log('');
    console.log('Fund the address above from the faucet, then run "npm run deploy".');
  } finally {
    await wallet.close();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
