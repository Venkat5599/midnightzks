import {
  Contract as GatekeeperContractCtor,
  witnesses,
  type GatekeeperPrivateState,
} from '@gatekeeper/contract';
import type { ContractProviders } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import type { Contract as EffectContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js/effect/Contract';
import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import type { Wallet } from '@midnight-ntwrk/wallet-api';
import { createHash } from 'node:crypto';
import { firstValueFrom } from 'rxjs';
import {
  INDEXER_URI,
  INDEXER_WS_URI,
  PRIVATE_STATE_STORE,
  PROOF_SERVER_URI,
} from './config.ts';
import { MANAGED_DIR, NodeZKConfigProvider } from './zk-config.ts';

/**
 * The contract, as the `midnight-js` type system sees it.
 *
 * The SDK's `Contract` interface is structural, so this alias is what lets
 * `deployContract` infer circuit names and argument types from the Compact
 * source rather than having them restated by hand.
 */
export type GatekeeperContract = EffectContract<GatekeeperPrivateState>;

/**
 * The compiled-contract binding: the generated class, the witnesses that supply
 * its private inputs, and where its ZK artifacts live.
 *
 * `withCompiledFileAssets` points straight at the compiler output directory
 * rather than copying artifacts around, so what gets proved against is exactly
 * what `npm run compact` produced.
 */
export const compiledGatekeeper = CompiledContract.make<GatekeeperContract, GatekeeperPrivateState>(
  'gatekeeper',
  GatekeeperContractCtor as never,
).pipe(
  CompiledContract.withWitnesses(witnesses as never),
  CompiledContract.withCompiledFileAssets(MANAGED_DIR),
);

export type GatekeeperProviders = ContractProviders<GatekeeperContract>;

/**
 * Password for the local private-state database.
 *
 * That database holds the operator's root secret, so it is encrypted at rest.
 * The password is derived from the seed rather than stored beside it: anyone
 * who already has the seed has the secret anyway, and anyone who has only the
 * database gets nothing. The domain-separating prefix keeps it from colliding
 * with any other value derived from the same seed, and the mixed alphabet is
 * not decoration — the provider enforces a strength policy on this string.
 */
const privateStatePassword = (seed: string): string => {
  const digest = createHash('sha256')
    .update(`gatekeeper:private-state:${seed}`)
    .digest('base64url');
  return `Gk!${digest.slice(0, 40)}`;
};

/**
 * Bridge the headless wallet to the two provider interfaces `midnight-js` wants.
 *
 * The wallet SDK and the contract SDK describe the same transaction with two
 * separately-branded types. The casts below are that naming mismatch and
 * nothing more: the same object goes in and comes back out unchanged.
 */
export const walletProviders = (
  wallet: Wallet,
  coinPublicKey: string,
  encryptionPublicKey: string,
): WalletProvider & MidnightProvider => ({
  getCoinPublicKey: () => coinPublicKey as never,
  getEncryptionPublicKey: () => encryptionPublicKey as never,

  balanceTx: async (tx) => {
    const recipe = await wallet.balanceTransaction(tx as never, []);
    const proven = await wallet.proveTransaction(recipe);
    return proven as never;
  },

  submitTx: (tx) => wallet.submitTransaction(tx as never),
});

/**
 * Assemble every provider `deployContract` and `findDeployedContract` need.
 *
 * Proving runs against `PROOF_SERVER_URI`, which defaults to localhost. That
 * default is deliberate rather than lazy: a proof server is handed the witness,
 * so pointing this at someone else's host would give them the secret the whole
 * contract exists to protect.
 */
export const buildProviders = async (wallet: Wallet, seed: string): Promise<GatekeeperProviders> => {
  const state = await firstValueFrom(wallet.state());
  const zkConfigProvider = new NodeZKConfigProvider<string>();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: PRIVATE_STATE_STORE,
      accountId: state.address,
      privateStoragePasswordProvider: async () => privateStatePassword(seed),
    }),
    publicDataProvider: indexerPublicDataProvider(INDEXER_URI, INDEXER_WS_URI),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(PROOF_SERVER_URI, zkConfigProvider),
    ...walletProviders(wallet, state.coinPublicKey, state.encryptionPublicKey),
  } as GatekeeperProviders;
};
