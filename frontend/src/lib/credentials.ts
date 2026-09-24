import { bytesOf, expiryInDays } from './codec';
import { commitmentOf, labelOf, privateStateOf } from './contract';
import type { TrienPrivateState } from '@trien/contract';

/**
 * A credential being edited in the browser: the three parts, in the form the
 * instrument's inputs hold them.
 *
 * The secret stays a hex string until the moment a circuit is called, because
 * a hex string is what a person can copy, compare and paste into a scratch
 * file — and it is the only thing here the holder has to keep.
 */
export type CredentialDraft = {
  readonly secretHex: string;
  /** A short role label, resolved to a 32-byte value at call time. */
  readonly role: string;
  /** Deadline, in days from now. */
  readonly expiryDays: number;
};

export const emptyDraft = (role: string, expiryDays: number): CredentialDraft => ({
  secretHex: '',
  role,
  expiryDays,
});

/** Nothing here is complete until all three parts are. */
export const draftIsComplete = (draft: CredentialDraft): boolean =>
  bytesOf(draft.secretHex) !== undefined && draft.role.length > 0 && draft.expiryDays > 0;

/** The deadline as block time, in seconds. */
export const draftExpiry = (draft: CredentialDraft): bigint => expiryInDays(draft.expiryDays);

/** The private state to hand a circuit, or undefined while the draft is incomplete. */
export const draftState = (draft: CredentialDraft): TrienPrivateState | undefined => {
  const secret = bytesOf(draft.secretHex);
  if (secret === undefined || draft.role.length === 0) return undefined;
  return privateStateOf(secret, labelOf(draft.role), draftExpiry(draft));
};

/** The commitment the operator would register for this draft. */
export const draftCommitment = (draft: CredentialDraft): Uint8Array | undefined => {
  const secret = bytesOf(draft.secretHex);
  if (secret === undefined || draft.role.length === 0) return undefined;
  return commitmentOf(secret, labelOf(draft.role), draftExpiry(draft));
};
