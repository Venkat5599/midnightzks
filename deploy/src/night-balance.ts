import { signingKeyFromBip340 } from '@midnight-ntwrk/ledger-v8';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import {
  PublicKey,
  UnshieldedWallet,
  createKeystore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { INDEXER_URI, INDEXER_WS_URI, NETWORK_ID, requireSeed } from './config.ts';

/**
 * Report the Night (unshielded) balance of the deploy wallet.
 *
 * `npm run address` reads the shielded Zswap side and will print zero forever
 * no matter how much Night arrives — the two live in different state trees, and
 * `@midnight-ntwrk/wallet` 5.0.0 models only the shielded one. That made a
 * funded wallet indistinguishable from an empty one. This closes that gap.
 */
export const nightKeystore = () => {
  const seed = requireSeed();
  const hd = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hd.type !== 'seedOk') {
    throw new Error(`Could not build an HD wallet from the seed: ${String(hd.error)}`);
  }

  const derived = hd.hdWallet.selectAccount(0).selectRole(Roles.NightExternal).deriveKeyAt(0);
  if (derived.type !== 'keyDerived') {
    throw new Error('Night key derivation went out of bounds at index 0.');
  }
  hd.hdWallet.clear();

  return {
    keystore: createKeystore(derived.key, NETWORK_ID),
    signingKey: signingKeyFromBip340(derived.key),
  };
};

/** Build an unshielded wallet for the deploy seed and sync it against the indexer. */
export const openNightWallet = async () => {
  const { keystore, signingKey } = nightKeystore();

  const walletClass = UnshieldedWallet({
    networkId: NETWORK_ID,
    indexerClientConnection: {
      indexerHttpUrl: INDEXER_URI,
      indexerWsUrl: INDEXER_WS_URI,
    },
  });

  const wallet = walletClass.startWithPublicKey(PublicKey.fromKeyStore(keystore));
  await wallet.start();

  return { wallet, keystore, signingKey };
};

const main = async (): Promise<void> => {
  const { wallet, keystore } = await openNightWallet();

  try {
    // Not `firstValueFrom(wallet.state)`: the first emission lands before the
    // indexer connection is up (`isConnected: false`), so it reports an empty
    // wallet whether or not one is funded — the same false negative that made
    // the shielded script so misleading.
    const state = await wallet.waitForSyncedState();

    console.log('');
    console.log('  Network   ', NETWORK_ID);
    console.log('  Address   ', keystore.getBech32Address().toString());
    console.log(
      '  Progress  ',
      JSON.stringify(state.progress, (_k, v: unknown) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    );
    console.log('  UTXOs     ', state.availableCoins.length);
    console.log('  Balances  ');
    const entries = Object.entries(state.balances);
    if (entries.length === 0) {
      console.log('    (none)');
    } else {
      for (const [token, amount] of entries) {
        console.log(`    ${token}  ${amount.toString()}`);
      }
    }
    console.log('');
  } finally {
    await wallet.stop();
  }
};

if (import.meta.filename === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
    process.exitCode = 1;
  });
}
