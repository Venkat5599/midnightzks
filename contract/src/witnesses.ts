import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import { type Ledger, pureCircuits } from './managed/trien/contract/index.js';
import type { TrienPrivateState } from './types.ts';

/**
 * Witness implementations.
 *
 * A witness is the bridge between the proof and the caller's local machine.
 * Whatever these functions return is consumed *inside* the circuit and is
 * discarded afterwards. Nothing here is transmitted; only the values the
 * circuit explicitly `disclose()`s ever reach the chain.
 *
 * Four witnesses, one credential: the secret is what membership means, the role
 * and the expiry are what the credential is good for, and the path is the proof
 * that the commitment built from all three is in the tree.
 */
export const witnesses = {
  /**
   * Hand the circuit the caller's root secret.
   *
   * Used to recompute the credential commitment, to derive the nullifier, and —
   * for an operator — to prove knowledge of the secret behind `admin`.
   * Never disclosed.
   */
  memberSecret: ({
    privateState,
  }: WitnessContext<Ledger, TrienPrivateState>): [TrienPrivateState, Uint8Array] => [
    privateState,
    privateState.secret,
  ],

  /**
   * Hand the circuit the role this credential was issued for.
   *
   * `proveAccess` asserts it equals the role the verifier asked for. That
   * equality is checked inside the proof and nothing about the role leaves the
   * circuit, so a verifier learns only that the holder has the role it required
   * — not which other roles they hold, and not which member they are.
   */
  memberRole: ({
    privateState,
  }: WitnessContext<Ledger, TrienPrivateState>): [TrienPrivateState, Uint8Array] => [
    privateState,
    privateState.role,
  ],

  /**
   * Hand the circuit the block time after which this credential is dead.
   *
   * `blockTimeLt` discloses the bound it is given, so the deadline becomes
   * public in the transaction. A deadline is not an identity; the README lists
   * it as the one field beyond the nullifier and the root this circuit makes
   * visible.
   */
  memberExpiry: ({
    privateState,
  }: WitnessContext<Ledger, TrienPrivateState>): [TrienPrivateState, bigint] => [
    privateState,
    privateState.expiry,
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
    const commitment = pureCircuits.commitmentOf(
      privateState.secret,
      privateState.role,
      privateState.expiry,
    );
    const path = ledger.members.findPathForLeaf(commitment);
    if (path === undefined) {
      throw new Error(
        'no Merkle path for this credential: the holder is not registered, was revoked, or is presenting a different role or expiry than the one that was registered',
      );
    }
    return [privateState, path];
  },
};

export type TrienWitnesses = typeof witnesses;
