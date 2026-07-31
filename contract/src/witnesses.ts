import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import { type Ledger, pureCircuits } from './managed/trien/contract/index.js';
import type { TrienPrivateState } from './types.js';

/**
 * Witness implementations.
 *
 * A witness is the bridge between the proof and the caller's local machine.
 * Whatever these functions return is consumed *inside* the circuit and is
 * discarded afterwards. Nothing here is transmitted; only the values the
 * circuit explicitly `disclose()`s ever reach the chain.
 */
export const witnesses = {
  /**
   * Hand the circuit the caller's root secret.
   *
   * `proveAccess` uses it twice: once to recompute the caller's commitment and
   * match it against the Merkle path leaf, and once to derive the nullifier.
   * Neither use discloses the secret itself.
   */
  memberSecret: ({
    privateState,
  }: WitnessContext<Ledger, TrienPrivateState>): [TrienPrivateState, Uint8Array] => [
    privateState,
    privateState.secret,
  ],

  /**
   * Hand the circuit a Merkle authentication path from the caller's commitment
   * up to a currently-valid root.
   *
   * The path is reconstructed locally from public ledger state, so producing it
   * requires no coordination with the operator and leaks nothing: the operator
   * is never told when, or to whom, a member proves access.
   *
   * If the caller has been revoked their leaf is no longer in the tree, so
   * there is no path to find and we fail here rather than producing a proof
   * that the circuit would reject anyway.
   */
  memberPath: ({
    ledger,
    privateState,
  }: WitnessContext<Ledger, TrienPrivateState>): [
    TrienPrivateState,
    ReturnType<Ledger['members']['pathForLeaf']>,
  ] => {
    const commitment = pureCircuits.commitmentOf(privateState.secret);
    const path = ledger.members.findPathForLeaf(commitment);
    if (path === undefined) {
      throw new Error(
        'no Merkle path for this secret: the caller is not a registered member, or has been revoked',
      );
    }
    return [privateState, path];
  },
};

export type TrienWitnesses = typeof witnesses;
