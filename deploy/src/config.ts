import { NetworkId as ZswapNetworkId } from '@midnight-ntwrk/zswap';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Where the throwaway Preview seed lives. Gitignored — never committed. */
export const ENV_PATH = resolve(here, '..', '.env');

/** Where the resulting contract address is recorded. Committed; not secret. */
export const DEPLOYMENT_PATH = resolve(here, '..', 'deployment.json');

/**
 * Which public network to deploy against.
 *
 * Preview rather than Preprod, for a boring operational reason: at the time of
 * writing the Preprod faucet reports
 * `{"status":"NOT_SERVING","reason":"SYNC_STUCK_RECOVERY"}` and hands out
 * nothing, so a contract cannot be deployed there at all. Preview's faucet is
 * serving. Both are accepted. Override with `NETWORK_ID` if that flips back.
 */
export const NETWORK_ID = process.env.NETWORK_ID ?? 'preview';

/**
 * The same network, as the enum the Zswap wallet expects.
 *
 * The DApp connector names networks with strings ('testnet'), while the wallet
 * SDK uses a numeric enum. Passing the string straight through fails deep
 * inside the WASM layer with an unhelpful message, so map it here, once.
 */
export const ZSWAP_NETWORK_ID: ZswapNetworkId = ((): ZswapNetworkId => {
  switch (NETWORK_ID.toLowerCase()) {
    // Preview and Preprod are both public test networks, and the wallet SDK
    // has one enum member for that whole category.
    case 'testnet':
    case 'preprod':
    case 'preview':
      return ZswapNetworkId.TestNet;
    case 'devnet':
      return ZswapNetworkId.DevNet;
    case 'mainnet':
      return ZswapNetworkId.MainNet;
    case 'undeployed':
      return ZswapNetworkId.Undeployed;
    default:
      throw new Error(`Unknown network id "${NETWORK_ID}".`);
  }
})();

/**
 * Preview service endpoints.
 *
 * These are versioned and they move. The `testnet-02` hosts this repo started
 * with no longer resolve at all, and the indexer's GraphQL path is now
 * `/api/v3/graphql` — `/api/v1` returns 404. A wrong host here fails quietly:
 * the wallet still builds and still reports a correct address, because the
 * address is derived locally from the seed, and simply never syncs. The symptom
 * looks like an empty wallet rather than a bad URL, which is why these are
 * pinned here with a comment instead of being scattered through the scripts.
 */
export const INDEXER_URI =
  process.env.INDEXER_URI ?? 'https://indexer.preview.midnight.network/api/v3/graphql';

export const INDEXER_WS_URI =
  process.env.INDEXER_WS_URI ?? 'wss://indexer.preview.midnight.network/api/v3/graphql/ws';

export const NODE_URI = process.env.NODE_URI ?? 'https://rpc.preview.midnight.network';

export const PROOF_SERVER_URI = process.env.PROOF_SERVER_URI ?? 'http://localhost:6300';

/**
 * Key under which this contract's private state is stored.
 *
 * Must match the value the dApp uses (`frontend/src/config.ts`), or the two
 * would go looking for the operator's secret in different places.
 */
export const PRIVATE_STATE_ID = 'trien';

/** Name of the local LevelDB store holding private state. */
export const PRIVATE_STATE_STORE = 'trien-private-state';

/**
 * Read `KEY=value` pairs out of deploy/.env.
 *
 * Deliberately tiny rather than pulling in dotenv: this file holds one secret,
 * and the fewer things that touch it, the better.
 */
export const readEnvFile = (): Record<string, string> => {
  if (!existsSync(ENV_PATH)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
};

/** A fresh 32-byte seed, hex encoded. */
export const generateSeed = (): string => randomBytes(32).toString('hex');

export const writeSeed = (seed: string): void => {
  writeFileSync(
    ENV_PATH,
    [
      '# Throwaway Preview seed for deploying the Triện registry.',
      '# Faucet funds only. This file is gitignored; do not commit it, and do',
      '# not reuse this seed for anything that holds real value.',
      `TRIEN_SEED=${seed}`,
      '',
    ].join('\n'),
    { encoding: 'utf8', mode: 0o600 },
  );
};

/** The configured seed, or a clear instruction if there is not one yet. */
export const requireSeed = (): string => {
  const seed = process.env.TRIEN_SEED ?? readEnvFile().TRIEN_SEED;
  if (seed === undefined || seed === '') {
    throw new Error(`No seed found. Run "npm run new-wallet" first — it writes one to ${ENV_PATH}.`);
  }
  if (!/^[0-9a-f]{64}$/i.test(seed)) {
    throw new Error('TRIEN_SEED must be 64 hex characters (32 bytes).');
  }
  return seed;
};
