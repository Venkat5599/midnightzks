import { addressFromKey, signatureVerifyingKey, signingKeyFromBip340 } from '@midnight-ntwrk/ledger-v8';
import {
  MidnightBech32m,
  UnshieldedAddress,
} from '@midnight-ntwrk/wallet-sdk-address-format';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Derive preprod unshielded (NIGHT) addresses for TWO wallets:
 *  - TRIEN_SEED       (existing deployer seed, reused — preprod derives a
 *                      different address than preview from the same seed)
 *  - TRIEN_USERS_SEED (generated here if absent, persisted to deploy/.env)
 *
 * Prints only addresses + raw hex — never seeds. Run with NETWORK_ID=preprod.
 */

const ENV_PATH = resolve(process.cwd(), '.env');

const readEnv = (): Record<string, string> => {
  if (!existsSync(ENV_PATH)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (t === '' || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
};

const writeEnv = (updated: Record<string, string>): void => {
  const lines = [
    '# Triện deploy keys (preprod). Gitignored — never commit.',
    '# Faucet funds only; never reuse for anything holding real value.',
    ...Object.entries(updated).map(([k, v]) => `${k}=${v}`),
    '',
  ];
  writeFileSync(ENV_PATH, lines.join('\n'), { encoding: 'utf8', mode: 0o600 });
};

const preprodAddress = (seed: string): string => {
  const hd = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hd.type !== 'seedOk') throw new Error(`HD wallet failed: ${String(hd.error)}`);
  const derived = hd.hdWallet.selectAccount(0).selectRole(Roles.NightExternal).deriveKeyAt(0);
  if (derived.type !== 'keyDerived') throw new Error('Night key derivation failed');
  const signingKey = signingKeyFromBip340(derived.key);
  const userAddress = addressFromKey(signatureVerifyingKey(signingKey));
  const bech32 = MidnightBech32m.encode(
    'preprod',
    new UnshieldedAddress(Buffer.from(userAddress, 'hex')),
  ).toString();
  hd.hdWallet.clear();
  return bech32;
};

const main = (): void => {
  const env = readEnv();

  const deployerSeed = env.TRIEN_SEED;
  if (!deployerSeed || !/^[0-9a-f]{64}$/i.test(deployerSeed)) {
    throw new Error('TRIEN_SEED missing from .env — run "npm run new-wallet" first.');
  }

  const usersSeed = env.TRIEN_USERS_SEED ?? randomBytes(32).toString('hex');
  if (usersSeed !== env.TRIEN_USERS_SEED) {
    writeEnv({ ...env, TRIEN_USERS_SEED: usersSeed });
    console.log('[generated new TRIEN_USERS_SEED, persisted to .env]');
  } else {
    console.log('[reusing TRIEN_USERS_SEED from .env]');
  }

  console.log('');
  console.log('  Network            preprod');
  console.log('  Contract wallet    ', preprodAddress(deployerSeed));
  console.log('  Users wallet       ', preprodAddress(usersSeed));
  console.log('');
  console.log('Faucet both at https://midnight-tmnight-preprod.nethermind.dev');
};

main();