import { createOperatorState, pureCircuits, roleFromString } from '@trien/contract';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { writeFileSync } from 'node:fs';
import { DEPLOYMENT_PATH, NETWORK_ID, PRIVATE_STATE_ID, PROOF_SERVER_URI } from './config.ts';
import { buildProviders, compiledTrien } from './providers.ts';
import { awaitFunds, openWallet, operatorSecret } from './wallet.ts';

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Deploy the Triện registry and bind it to an operator.
 *
 * Two transactions, because they are two different things. Deployment puts the
 * circuits and an empty ledger on chain; `initialize` then writes the operator
 * commitment into `admin`. Splitting them means the registry is inert until
 * somebody proves they hold the operator secret, rather than the contract
 * trusting whoever happened to submit the deployment.
 */
const main = async (): Promise<void> => {
  const { wallet, seed } = await openWallet();

  try {
    const balance = await awaitFunds(wallet);
    console.log(`Funded: ${balance.toString()} (fee token).`);
    console.log(`Proving locally against ${PROOF_SERVER_URI}. This takes a few minutes.`);

    const providers = await buildProviders(wallet, seed);
    const secret = operatorSecret(seed);
    // The operator's identity hash lives in its own domain ("gk:admin"), so it
    // is a different value from any member credential built over this secret.
    const commitment = pureCircuits.adminCommitmentOf(secret);

    const deployed = await deployContract(providers, {
      compiledContract: compiledTrien,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: createOperatorState(secret),
    });

    const { contractAddress, txId: deployTxId } = deployed.deployTxData.public;

    console.log('');
    console.log('  Contract address', contractAddress);
    console.log('  Deploy tx       ', deployTxId);
    console.log('');
    console.log('Binding the registry to the operator…');

    // What lands on chain is a hash of a secret that never leaves this machine.
    // It identifies nobody; it only lets the contract recognise later
    // administrative calls as coming from the same holder.
    const initTx = await deployed.callTx.initialize();

    console.log('  initialize tx   ', initTx.public.txId);

    /**
     * Authorize the verifiers named in the environment.
     *
     * `proveAccess` refuses any identifier the operator has not blessed, so a
     * freshly deployed registry admits nobody until this runs. Naming them at
     * deploy time (TRIEN_VERIFIERS="verifier:newsroom,verifier:clinic") is the
     * difference between a registry that works and one that refuses everything
     * for reasons that are correct but not obvious.
     */
    const verifiers = (process.env.TRIEN_VERIFIERS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    for (const id of verifiers) {
      const tx = await deployed.callTx.authorizeVerifier!(roleFromString(id));
      console.log(`  authorize ${id.padEnd(20)} ${tx.public.txId}`);
    }
    if (verifiers.length === 0) {
      console.log('  no verifiers named — set TRIEN_VERIFIERS to authorize gates at deploy time');
    }

    const record = {
      network: NETWORK_ID,
      contractAddress,
      deployTxId,
      initializeTxId: initTx.public.txId,
      operatorCommitment: hex(commitment),
      authorizedVerifiers: verifiers,
      deployedAt: new Date().toISOString(),
    };
    writeFileSync(DEPLOYMENT_PATH, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

    console.log('');
    console.log(`Wrote ${DEPLOYMENT_PATH}`);
    console.log('');
    console.log('Set this in the dApp environment to have it join the registry on load:');
    console.log(`  VITE_CONTRACT_ADDRESS=${contractAddress}`);
  } finally {
    await wallet.close();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
