import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { NETWORK_ID } from '../config';

/** Lace announces itself under this reverse-DNS identifier. */
const LACE_RDNS = 'io.midnight.lace';

export type WalletSession = {
  readonly api: ConnectedAPI;
  readonly name: string;
  readonly shieldedAddress: string;
  readonly coinPublicKey: string;
  readonly encryptionPublicKey: string;
  readonly indexerUri: string;
  readonly indexerWsUri: string;
  readonly proofServerUri: string | undefined;
  readonly networkId: string;
};

/**
 * Every connector instance the browser has injected.
 *
 * A wallet may inject several instances (one per API version), and other
 * wallets may be present too, so we enumerate rather than assume.
 */
export const availableWallets = (): InitialAPI[] => Object.values(window.midnight ?? {});

/** The injected Lace connector, or whatever single wallet is present. */
export const findLace = (): InitialAPI | undefined => {
  const wallets = availableWallets();
  return wallets.find((w) => w.rdns === LACE_RDNS) ?? wallets[0];
};

/**
 * Wallets inject themselves asynchronously, so a connector missing on first
 * paint does not mean it is absent. Poll briefly before giving up.
 */
export const waitForWallet = async (timeoutMs = 3_000): Promise<InitialAPI | undefined> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const wallet = findLace();
    if (wallet !== undefined) return wallet;
    if (Date.now() >= deadline) return undefined;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
};

export class WalletError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WalletError';
  }
}

/**
 * Ask the wallet for a connection and collect everything the providers need.
 *
 * `connect` is what triggers Lace's approval prompt; until the user accepts,
 * this promise does not settle. `hintUsage` is called immediately afterwards so
 * the wallet can gather every permission this dApp needs in one prompt rather
 * than interrupting the user again mid-flow.
 */
export const connectWallet = async (): Promise<WalletSession> => {
  const wallet = await waitForWallet();
  if (wallet === undefined) {
    throw new WalletError(
      'No Midnight wallet found. Install the Lace extension and reload this page.',
    );
  }

  let api: ConnectedAPI;
  try {
    api = await wallet.connect(NETWORK_ID);
  } catch (cause) {
    throw new WalletError('Wallet connection was refused.', { cause });
  }

  await api.hintUsage([
    'getShieldedAddresses',
    'getConfiguration',
    'balanceUnsealedTransaction',
    'submitTransaction',
    'getProvingProvider',
  ]);

  const [addresses, configuration] = await Promise.all([
    api.getShieldedAddresses(),
    api.getConfiguration(),
  ]);

  if (configuration.networkId !== NETWORK_ID) {
    throw new WalletError(
      `Wallet is on "${configuration.networkId}" but this dApp targets "${NETWORK_ID}". ` +
        'Switch networks in Lace and reconnect.',
    );
  }

  return {
    api,
    name: wallet.name,
    shieldedAddress: addresses.shieldedAddress,
    coinPublicKey: addresses.shieldedCoinPublicKey,
    encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
    indexerUri: configuration.indexerUri,
    indexerWsUri: configuration.indexerWsUri,
    proofServerUri: configuration.proverServerUri,
    networkId: configuration.networkId,
  };
};

/**
 * Drop the connection.
 *
 * The connector API has no revoke method — permission lives in the extension,
 * and only the user can withdraw it there. What this dApp can honestly do is
 * forget the session, which is what disconnect means here. The UI says exactly
 * that rather than implying a revocation that did not happen.
 */
export const disconnectWallet = (): void => {
  /* Nothing to tear down: the session lives in React state and is dropped by
     the caller. This function exists to make that explicit, and to give the
     disconnect path one place to grow if the connector gains a revoke API. */
};

/** True if the wallet still considers the connection live. */
export const isStillConnected = async (session: WalletSession): Promise<boolean> => {
  try {
    const status = await session.api.getConnectionStatus();
    return status.status === 'connected';
  } catch {
    return false;
  }
};
