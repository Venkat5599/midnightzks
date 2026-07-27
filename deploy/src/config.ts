import { NetworkId as ZswapNetworkId } from '@midnight-ntwrk/zswap';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Where the throwaway Preprod seed lives. Gitignored — never committed. */
export const ENV_PATH = resolve(here, '..', '.env');

/** Where the resulting contract address is recorded. Committed; not secret. */
export const DEPLOYMENT_PATH = resolve(here, '..', 'deployment.json');

export const NETWORK_ID = process.env.NETWORK_ID ?? 'testnet';

/**
 * The same network, as the enum the Zswap wallet expects.
 *
 * The DApp connector names networks with strings ('testnet'), while the wallet
 * SDK uses a numeric enum. Passing the string straight through fails deep
 * inside the WASM layer with an unhelpful message, so map it here, once.
 */
export const ZSWAP_NETWORK_ID: ZswapNetworkId = ((): ZswapNetworkId => {
  switch (NETWORK_ID.toLowerCase()) {
    case 'testnet':
    case 'preprod':
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

export const INDEXER_URI =
  process.env.INDEXER_URI ?? 'https://indexer.testnet-02.midnight.network/api/v1/graphql';

export const INDEXER_WS_URI =
  process.env.INDEXER_WS_URI ?? 'wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws';

export const NODE_URI = process.env.NODE_URI ?? 'https://rpc.testnet-02.midnight.network';

export const PROOF_SERVER_URI = process.env.PROOF_SERVER_URI ?? 'http://localhost:6300';

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
      '# Throwaway Preprod seed for deploying the Gatekeeper registry.',
      '# Faucet funds only. This file is gitignored; do not commit it, and do',
      '# not reuse this seed for anything that holds real value.',
      `GATEKEEPER_SEED=${seed}`,
      '',
    ].join('\n'),
    { encoding: 'utf8', mode: 0o600 },
  );
};

/** The configured seed, or a clear instruction if there is not one yet. */
export const requireSeed = (): string => {
  const seed = process.env.GATEKEEPER_SEED ?? readEnvFile().GATEKEEPER_SEED;
  if (seed === undefined || seed === '') {
    throw new Error(`No seed found. Run "npm run new-wallet" first — it writes one to ${ENV_PATH}.`);
  }
  if (!/^[0-9a-f]{64}$/i.test(seed)) {
    throw new Error('GATEKEEPER_SEED must be 64 hex characters (32 bytes).');
  }
  return seed;
};
