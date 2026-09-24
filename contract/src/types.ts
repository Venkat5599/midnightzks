/**
 * Local, per-user state. This never leaves the machine it was created on and
 * is never part of a transaction. The chain only ever sees values derived from
 * these fields through a hash, inside a proof.
 *
 * A credential is the triple (secret, role, expiry). All three are bound into
 * the commitment the operator registers, so a holder can only ever prove the
 * exact triple they were issued — they cannot present a long-lived credential
 * at a gate that asked for a short-lived one, or a member credential at a gate
 * reserved for editors.
 */
export type TrienPrivateState = {
  /**
   * The holder's root secret, 32 bytes of local entropy.
   *
   * For the registry operator this is the secret behind `admin`. For a member
   * it is the secret whose commitment the operator inserted into the `members`
   * tree via `register`.
   */
  readonly secret: Uint8Array;

  /**
   * The role this credential was issued for. Compared against the role a
   * verifier asks for, inside the proof; never disclosed to anyone.
   */
  readonly role: Uint8Array;

  /**
   * Block time (seconds) after which this credential is dead. Checked against
   * the chain's own clock, not the caller's.
   */
  readonly expiry: bigint;
};

/** Roles are 32-byte labels. */
export const roleFromString = (label: string): Uint8Array => {
  const out = new Uint8Array(32);
  const encoded = new TextEncoder().encode(label);
  if (encoded.length > 32) {
    throw new Error(`role label must be at most 32 bytes, got ${encoded.length}`);
  }
  out.set(encoded);
  return out;
};

/**
 * The role an operator private state carries.
 *
 * Administrative circuits never read `memberRole` or `memberExpiry`, but the
 * state type is uniform, so an operator state still needs both fields to exist.
 */
export const OPERATOR_ROLE = roleFromString('gk:role:none');

/**
 * Build a credential from its three parts.
 *
 * `expiry` is compared with the chain's block time, so callers normally pass
 * something well in the future for a credential that should stay valid.
 */
export const createPrivateState = (
  secret: Uint8Array,
  role: Uint8Array,
  expiry: bigint,
): TrienPrivateState => {
  if (secret.length !== 32) {
    throw new Error(`secret must be exactly 32 bytes, got ${secret.length}`);
  }
  if (role.length !== 32) {
    throw new Error(`role must be exactly 32 bytes, got ${role.length}`);
  }
  if (expiry < 0n) {
    throw new Error(`expiry must not be negative, got ${expiry}`);
  }
  return { secret, role, expiry };
};

/**
 * Build an operator private state.
 *
 * The role and expiry are placeholders: no administrative circuit reads them,
 * and the operator's identity hash uses its own domain (`gk:admin`), so holding
 * a member credential can never be mistaken for holding the operator key.
 */
export const createOperatorState = (secret: Uint8Array): TrienPrivateState =>
  createPrivateState(secret, OPERATOR_ROLE, 0n);

/** Build a fresh credential from cryptographic randomness. */
export const randomPrivateState = (role: Uint8Array, expiry: bigint): TrienPrivateState =>
  createPrivateState(crypto.getRandomValues(new Uint8Array(32)), role, expiry);
