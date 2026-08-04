import { addressFromKey, signatureVerifyingKey, signingKeyFromBip340 } from '@midnight-ntwrk/ledger-v8';
import {
  MidnightBech32m,
  UnshieldedAddress,
} from '@midnight-ntwrk/wallet-sdk-address-format';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { NETWORK_ID, requireSeed } from './config.ts';

/**
 * Print the deploy wallet's *unshielded* (NIGHT) address.
 *
 * `npm run address` prints the shielded Zswap address, which is what the DUST
 * faucet wants. NIGHT lives on the unshielded side, under a different HD role
 * (`NightExternal`) and a different Bech32m type (`mn_addr_`), so it has to be
 * derived separately from the same seed.
 */
const main = (): void => {
  const seed = requireSeed();

  const hd = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hd.type !== 'seedOk') {
    throw new Error(`Could not build an HD wallet from the seed: ${String(hd.error)}`);
  }

  const derived = hd.hdWallet.selectAccount(0).selectRole(Roles.NightExternal).deriveKeyAt(0);
  if (derived.type !== 'keyDerived') {
    throw new Error('Night key derivation went out of bounds at index 0.');
  }

  const signingKey = signingKeyFromBip340(derived.key);
  const userAddress = addressFromKey(signatureVerifyingKey(signingKey));
  const bech32 = MidnightBech32m.encode(
    NETWORK_ID,
    new UnshieldedAddress(Buffer.from(userAddress, 'hex')),
  ).toString();

  hd.hdWallet.clear();

  console.log('');
  console.log('  Network            ', NETWORK_ID);
  console.log('  Unshielded address ', bech32);
  console.log('  Raw (hex)          ', userAddress);
  console.log('');
};

main();
