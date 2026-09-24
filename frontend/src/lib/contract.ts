import {
  Contract as TrienContractCtor,
  witnesses,
  pureCircuits,
  createOperatorState,
  createPrivateState,
  randomPrivateState,
  roleFromString,
  type TrienPrivateState,
} from '@trien/contract';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { HttpZKConfigProvider } from './zk-config';
import type { Contract as EffectContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js/effect/Contract';
import {
  CONFIGURED_CONTRACT_ADDRESS,
  NETWORK_ID,
  PRIVATE_STATE_ID,
  PRIVATE_STATE_STORE,
  ZK_ASSETS_BASE,
} from '../config';
import type { WalletSession } from './lace';

/**
 * The Triện registry, reachable from the browser.
 *
 * The witness never leaves the machine: proof generation goes through the
 * wallet's own proving provider when the connector exposes one
 * (`getProvingProvider`), falling back to the configured proof server — the
 * wallet is the authority on which services to use.
 *
 * Private state is a credential — a secret, a role and a deadline — stored in a
 * per-account browser store, keyed by the connected wallet address so two
 * wallets on one machine cannot read each other's credentials.
 */

const zkConfigProvider = new HttpZKConfigProvider(`.${ZK_ASSETS_BASE}`);

/** The contract as the midnight-js type system sees it. */
export type TrienContract = EffectContract<TrienPrivateState>;

const providersFor = (session: WalletSession, accountId: string) => {
  const walletProvider = {
    getCoinPublicKey: () => session.coinPublicKey as never,
    getEncryptionPublicKey: () => session.encryptionPublicKey as never,
    balanceTx: async (tx: unknown) => {
      const balanced = await session.api.balanceUnsealedTransaction(tx as never);
      return balanced as never;
    },
    submitTx: (tx: unknown) => session.api.submitTransaction(tx as never) as never,
  };
  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: PRIVATE_STATE_STORE,
      accountId,
      privateStoragePasswordProvider: async () =>
        window.sessionStorage.getItem('trien:private-state:password') ??
        'Trien-Local-Browser-Private-State-1',
    }),
    publicDataProvider: indexerPublicDataProvider(session.indexerUri, session.indexerWsUri),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(
      session.proofServerUri ?? 'http://localhost:6300',
      zkConfigProvider,
    ),
    walletProvider,
    midnightProvider: walletProvider,
  };
};

/** The compiled contract binding, pointed at the shipped ZK artifacts. */
export const compiledTrien = CompiledContract.make<TrienContract, TrienPrivateState>(
  'trien',
  TrienContractCtor as never,
).pipe(
  CompiledContract.withWitnesses(witnesses as never),
  CompiledContract.withCompiledFileAssets(`.${ZK_ASSETS_BASE}`),
);

/**
 * Commitment of a credential — the only thing the operator ever sees.
 *
 * Role and deadline are inside the hash, so the operator registers a single
 * opaque value and the chain never learns either.
 */
export const commitmentOf = (
  secret: Uint8Array,
  role: Uint8Array,
  expiry: bigint,
): Uint8Array => pureCircuits.commitmentOf(secret, role, expiry);

/**
 * Attach to the deployed registry with a connected session.
 *
 * When `privateState` is given it is stored at `PRIVATE_STATE_ID` for this
 * account before the contract is looked up, so the caller's witnesses read the
 * right credential. When omitted, the existing stored state is used (a
 * returning holder re-attaches with the same credential).
 */
export const openRegistry = async (session: WalletSession, privateState?: TrienPrivateState) => {
  if (CONFIGURED_CONTRACT_ADDRESS === undefined) {
    throw new Error('No registry address configured — set VITE_CONTRACT_ADDRESS at build time.');
  }
  const accountId = session.shieldedAddress;
  const providers = providersFor(session, accountId);
  return findDeployedContract(providers as never, {
    privateStateId: PRIVATE_STATE_ID,
    ...(privateState !== undefined ? { initialPrivateState: privateState } : {}),
  } as never);
};

export type OpenContract = Awaited<ReturnType<typeof openRegistry>>;

/** A fresh random secret — the holder never reveals it to anyone. */
export const freshSecret = (): Uint8Array => randomPrivateState(roleFromString(''), 0n).secret;

/** A member credential, from the three parts that define it. */
export const privateStateOf = (
  secret: Uint8Array,
  role: Uint8Array,
  expiry: bigint,
): TrienPrivateState => createPrivateState(secret, role, expiry);

/** An operator state. Its role and deadline are placeholders; admin circuits read neither. */
export const operatorStateOf = (secret: Uint8Array): TrienPrivateState =>
  createOperatorState(secret);

/** A 32-byte label (a role, or a verifier id) from a short string. */
export const labelOf = (label: string): Uint8Array => roleFromString(label);

/** The commitment an operator secret owns — the value `initialize` binds. */
export { NETWORK_ID };
