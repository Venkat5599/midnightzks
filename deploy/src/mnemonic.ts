import { entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { requireSeed } from './config.ts';

/**
 * Print the deploy seed as a 24-word BIP39 phrase, for importing into Lace.
 *
 * Funding is a two-step flow: the faucet sends tNIGHT to the unshielded
 * address, and that tNIGHT then has to be *delegated* to generate the tDUST
 * that actually pays fees. The delegation step has no headless API in
 * `@midnight-ntwrk/wallet` 5.0.0 — the state object it emits carries shielded
 * Zswap fields only — so it has to happen in Lace.
 *
 * Midnight's seed convention is BIP39 entropy, so the 32 bytes in `.env` and
 * the phrase below are the same secret in two encodings. Importing this phrase
 * into Lace gives it the same wallet these scripts use, which keeps the
 * operator credential in `wallet.ts` stable across the hand-off.
 *
 * This prints a secret. Throwaway testnet key material only.
 */
const main = (): void => {
  const seed = requireSeed();
  const words = entropyToMnemonic(Buffer.from(seed, 'hex'), wordlist).split(' ');

  console.log('');
  console.log('  Import these 24 words into Lace, on the Preview network:');
  console.log('');
  words.forEach((word, i) => {
    const n = String(i + 1).padStart(2, ' ');
    process.stdout.write(`  ${n}. ${word.padEnd(12)}`);
    if ((i + 1) % 4 === 0) process.stdout.write('\n');
  });
  console.log('');
  console.log('  Then, in Lace: request tNIGHT from the faucet, and use');
  console.log('  "Generate tDUST" to delegate it. Run "npm run address" after.');
  console.log('');
};

main();
