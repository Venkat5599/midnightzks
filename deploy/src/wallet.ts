import { WalletBuilder } from '@midnight-ntwrk/wallet';
import type { Wallet } from '@midnight-ntwrk/wallet-api';
import { createHash } from 'node:crypto';
import { filter, firstValueFrom, timeout } from 'rxjs';
import {
  INDEXER_URI,
  INDEXER_WS_URI,
  NETWORK_ID,
  NODE_URI,
  PROOF_SERVER_URI,
  ZSWAP_NETWORK_ID,
  requireSeed,
} from './config.ts';

/** One snapshot of wallet state, as the wallet SDK emits it. */
export type WalletSnapshot = Awaited<ReturnType<typeof snapshot>>;

/** The native token whose balance pays transaction fees. */
export const NATIVE_TOKEN = '0100000000000000000000000000000000000000000000000000000000000000';

/**
 * The operator's root secret, derived from the deploy seed.
 *
 * Deriving rather than generating means the operator credential survives a lost
 * private-state database: re-run any script with the same `.env` and you are
 * the same operator. The domain separator keeps it distinct from every other
 * value derived from that seed, and one-wayness means the commitment published
 * on chain says nothing about the seed.
 */
export const operatorSecret = (seed: string): Uint8Array =>
  new Uint8Array(createHash('sha256').update(`gatekeeper:operator:${seed}`).digest());

/** Build a wallet from the configured seed and start it syncing. */
export const openWallet = async (): Promise<{ wallet: Wallet; seed: string }> => {
  const seed = requireSeed();
  const wallet = await WalletBuilder.build(
    INDEXER_URI,
    INDEXER_WS_URI,
    PROOF_SERVER_URI,
    NODE_URI,
    seed,
    ZSWAP_NETWORK_ID,
    'error',
  );
  wallet.start();
  return { wallet, seed };
};

/** Current wallet state, as one snapshot. */
export const snapshot = (wallet: Wallet) => firstValueFrom(wallet.state());

/** Balance of the fee token, in the smallest unit. */
export const feeBalance = (state: { balances: Record<string, bigint> }): bigint =>
  state.balances[NATIVE_TOKEN] ?? 0n;

/**
 * Block until the wallet has synced far enough to see a non-zero fee balance.
 *
 * Deploying from an empty wallet fails deep inside transaction balancing with a
 * message that never mentions money, so it is worth waiting here and saying
 * plainly what is missing. The wallet emits state continuously while it syncs,
 * so this filters that stream rather than polling.
 */
export const awaitFunds = async (wallet: Wallet, timeoutMs = 300_000): Promise<bigint> => {
  console.log(`Syncing with ${NETWORK_ID} and waiting for a funded balance…`);
  const state = await firstValueFrom(
    wallet.state().pipe(
      filter((s) => feeBalance(s) > 0n),
      timeout({
        first: timeoutMs,
        with: () => {
          throw new Error(
            'Timed out waiting for funds. Run "npm run address", fund that address from the ' +
              'faucet, then try again.',
          );
        },
      }),
    ),
  );
  return feeBalance(state);
};
