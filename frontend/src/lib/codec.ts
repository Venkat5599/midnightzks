/**
 * Byte/hex helpers the instrument needs at its edges.
 *
 * Everything here is presentation glue: the contract never sees a hex string,
 * and the witnesses never see anything else.
 */

/** Lowercase hex for a byte array. */
export const hexOf = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** Bytes from exactly 64 hex characters, or undefined for anything else. */
export const bytesOf = (hex: string): Uint8Array | undefined => {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return undefined;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

/** A short form for display: enough to recognise, not enough to paste. */
export const abbreviate = (value: string): string =>
  value.length <= 28 ? value : `${value.slice(0, 16)}…${value.slice(-10)}`;

/** Block time, in seconds, `days` from now — the deadline a new credential gets. */
export const expiryInDays = (days: number): bigint =>
  BigInt(Math.floor(Date.now() / 1000) + Math.round(days * 86_400));

/** A date for a block time, so a deadline reads as a deadline. */
export const expiryLabel = (expiry: bigint): string =>
  new Date(Number(expiry) * 1000).toISOString().slice(0, 10);

/** A short, human label for a freshly generated credential. */
export const credentialLabel = (): string => `member-${Math.random().toString(36).slice(2, 8)}`;
