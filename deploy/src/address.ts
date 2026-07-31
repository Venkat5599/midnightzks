import { NETWORK_ID } from './config.ts';
import { feeBalance, openWallet, snapshot } from './wallet.ts';

/**
 * Print the deploy wallet's address and current balance.
 *
 * Funding from the faucet is asynchronous and outside this repo's control, so
 * this exists to be run repeatedly while waiting, without the side effects of
 * `new-wallet` (which writes a seed) or `deploy` (which spends).
 */
const main = async (): Promise<void> => {
  const { wallet } = await openWallet();

  try {
    const state = await snapshot(wallet);
    const balance = feeBalance(state);

    console.log('');
    console.log('  Network     ', NETWORK_ID);
    console.log('  Address     ', state.address);
    console.log('  Coin pub key', state.coinPublicKey);
    console.log('  Fee balance ', balance.toString());
    console.log('');

    if (balance === 0n) {
      console.log(`Unfunded. Paste the address above into the ${NETWORK_ID} faucet:`);
      console.log(`  https://faucet.${NETWORK_ID}.midnight.network/`);
      console.log('Wait for it to settle, then run this again.');
    } else {
      console.log('Funded. Run "npm run deploy".');
    }
  } finally {
    await wallet.close();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
