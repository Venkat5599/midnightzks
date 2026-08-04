import {
  DustSecretKey,
  LedgerParameters,
  ZswapSecretKeys,
} from '@midnight-ntwrk/ledger-v8';
import { firstValueFrom } from 'rxjs';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  PublicKey,
  UnshieldedWallet,
  createKeystore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import {
  INDEXER_URI,
  INDEXER_WS_URI,
  NETWORK_ID,
  NODE_URI,
  PROOF_SERVER_URI,
  requireSeed,
} from './config.ts';

/**
 * Register the wallet's Night UTXOs for Dust generation.
 *
 * Fees on Midnight are paid in Dust, and Dust is not transferable — it is
 * *generated* by Night that has been explicitly registered for it. Holding
 * Night does nothing on its own, which is the step that blocked this deploy:
 * the faucet funds Night, and without this transaction the fee balance stays
 * at zero forever.
 *
 * This is the same action Lace exposes as "Generate tDust". Doing it here
 * keeps the whole pipeline headless and on one seed.
 */
const roleKeys = () => {
  const seed = requireSeed();
  const hd = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hd.type !== 'seedOk') {
    throw new Error(`Could not build an HD wallet from the seed: ${String(hd.error)}`);
  }

  const account = hd.hdWallet.selectAccount(0);
  const derive = (role: (typeof Roles)[keyof typeof Roles], label: string): Uint8Array => {
    const result = account.selectRole(role).deriveKeyAt(0);
    if (result.type !== 'keyDerived') {
      throw new Error(`${label} key derivation went out of bounds at index 0.`);
    }
    return result.key;
  };

  const keys = {
    night: derive(Roles.NightExternal, 'Night'),
    dust: derive(Roles.Dust, 'Dust'),
    zswap: derive(Roles.Zswap, 'Zswap'),
  };
  hd.hdWallet.clear();
  return keys;
};

const main = async (): Promise<void> => {
  const keys = roleKeys();
  const keystore = createKeystore(keys.night, NETWORK_ID);
  const dustSecretKey = DustSecretKey.fromSeed(keys.dust);
  const shieldedSecretKeys = ZswapSecretKeys.fromSeed(keys.zswap);
  const dustParameters = LedgerParameters.initialParameters().dust;

  const configuration = {
    networkId: NETWORK_ID,
    indexerClientConnection: {
      indexerHttpUrl: INDEXER_URI,
      indexerWsUrl: INDEXER_WS_URI,
    },
    // Submission goes through a Polkadot WsProvider, which rejects anything not
    // starting with `ws://` or `wss://` — so this is not the same `NODE_URI` the
    // rest of the pipeline uses over HTTPS.
    relayURL: new URL(NODE_URI.replace(/^http/, 'ws')),
    provingServerUrl: new URL(PROOF_SERVER_URI),
    // How many blocks of Dust generation to budget for the fee. Required by the
    // Dust wallet's transacting capability; without it `calculateFee` throws on
    // `feeBlocksMargin` before any transaction is built.
    costParameters: { feeBlocksMargin: 10 },
  };

  const facade = await WalletFacade.init({
    configuration,
    shielded: (config) => ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (config) =>
      UnshieldedWallet(config).startWithPublicKey(PublicKey.fromKeyStore(keystore)),
    dust: (config) => DustWallet(config).startWithSecretKey(dustSecretKey, dustParameters),
  });

  try {
    await facade.start(shieldedSecretKeys, dustSecretKey);
    console.log('Syncing all three wallets against', NETWORK_ID, '…');

    // Report each wallet's progress separately: `waitForSyncedState` resolves
    // only when all three agree, so a single stalled one looks identical to a
    // hung process.
    const ticker = setInterval(() => {
      void (async () => {
        const show = (label: string, p: unknown) =>
          `${label}=${JSON.stringify(p, (_k, v: unknown) =>
            typeof v === 'bigint' ? v.toString() : v,
          )}`;
        const [u, d, s] = await Promise.all([
          firstValueFrom(facade.unshielded.state),
          firstValueFrom(facade.dust.state),
          firstValueFrom(facade.shielded.state),
        ]);
        console.log(
          '  ',
          show('unshielded', u.progress),
          show('dust', d.progress),
          show('shielded', s.progress),
        );
      })();
    }, 15_000);

    let state;
    try {
      state = await facade.waitForSyncedState();
    } finally {
      clearInterval(ticker);
    }

    const nightUtxos = [...state.unshielded.availableCoins];
    console.log(`Night UTXOs available: ${nightUtxos.length}`);
    if (nightUtxos.length === 0) {
      throw new Error('No Night UTXOs to register. Fund the unshielded address first.');
    }

    const estimate = await facade.estimateRegistration(nightUtxos);
    console.log(`Estimated registration fee: ${estimate.fee.toString()}`);

    const now = new Date();
    console.log('Dust balance now:', JSON.stringify(state.dust.balance(now), (_k, v: unknown) =>
      typeof v === 'bigint' ? v.toString() : v,
    ));
    console.log(
      'Dust generation estimates:',
      JSON.stringify(estimate.dustGenerationEstimations, (_k, v: unknown) =>
        typeof v === 'bigint' ? v.toString() : v,
      ).slice(0, 1200),
    );

    // Both the registration payload and the transaction's unshielded offers are
    // signed with the Night key: registering is an assertion about Night this
    // wallet controls, and the same key owns the UTXOs being spent.
    const sign = (payload: Uint8Array) => keystore.signData(payload);

    const recipe = await facade.registerNightUtxosForDustGeneration(
      nightUtxos,
      keystore.getPublicKey(),
      sign,
    );
    const signed = await facade.signRecipe(recipe, sign);
    const finalized = await facade.finalizeRecipe(signed);
    const txId = await facade.submitTransaction(finalized);

    console.log('');
    console.log('  Registration submitted');
    console.log('  Transaction', txId);
    console.log('');
    console.log('  Dust now accrues from the registered Night. Poll with');
    console.log('  "npm run address" until the fee balance is non-zero.');
    console.log('');
  } finally {
    await facade.stop();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
