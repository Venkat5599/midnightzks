/**
 * Local, per-user state. This never leaves the machine it was created on and
 * is never part of a transaction. The chain only ever sees values derived
 * from `secret` through a hash, inside a proof.
 */
export type GatekeeperPrivateState = {
  /**
   * The holder's root secret, 32 bytes of local entropy.
   *
   * For the registry operator this is the secret whose commitment was bound to
   * `admin` by `initialize`. For a member it is the secret whose commitment the
   * operator inserted into the `members` tree via `register`.
   */
  readonly secret: Uint8Array;
};

/** Build a private state from a caller-supplied secret. */
export const createPrivateState = (secret: Uint8Array): GatekeeperPrivateState => {
  if (secret.length !== 32) {
    throw new Error(`secret must be exactly 32 bytes, got ${secret.length}`);
  }
  return { secret };
};

/** Build a private state from fresh cryptographic randomness. */
export const randomPrivateState = (): GatekeeperPrivateState =>
  createPrivateState(crypto.getRandomValues(new Uint8Array(32)));
