import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { ledger, type Ledger } from '@trien/contract';

/**
 * Read the registry straight from the chain.
 *
 * No wallet, no signature, no session: the ledger is public state, so anyone
 * with the address can read it. That is the point of the design — the whole
 * public record is a count of members, a count of accesses, and a set of
 * opaque hashes — and this reads exactly that, with nothing of the reader's
 * identity attached to the request.
 *
 * Returns null when the indexer has no state for the address (a wrong address,
 * or a registry that has never been written to).
 */
export const readRegistryLedger = async (
  indexerUri: string,
  indexerWsUri: string,
  contractAddress: string,
): Promise<Ledger | null> => {
  const provider = indexerPublicDataProvider(indexerUri, indexerWsUri);
  const state = await provider.queryContractState(contractAddress as never);
  if (state === null) return null;
  // `ContractState.data` is the contract's primary state value, which is what
  // the generated `ledger()` decoder reads. Nothing else in the queried state
  // (balances, maintenance authority) is part of this registry's ledger.
  return ledger(state.data);
};

/**
 * Everything an observer can learn, as plain numbers.
 *
 * Deliberately a flat shape: if a field here is not in the contract's ledger,
 * it cannot be shown, and the panel that renders this cannot silently grow a
 * claim the chain does not support.
 */
export type RegistrySummary = {
  readonly members: bigint;
  readonly nullifiers: bigint;
  readonly verifiers: bigint;
  readonly epoch: bigint;
  readonly accessCount: bigint;
  readonly issued: bigint;
  readonly revocations: bigint;
  readonly paused: boolean;
  readonly hasPendingAdmin: boolean;
};

export const summarise = (ledgerState: Ledger): RegistrySummary => ({
  members: ledgerState.members.firstFree(),
  nullifiers: ledgerState.nullifiers.size(),
  verifiers: ledgerState.verifiers.size(),
  epoch: ledgerState.epoch,
  accessCount: ledgerState.accessCount,
  issued: ledgerState.issued,
  revocations: ledgerState.revocations,
  paused: ledgerState.paused,
  hasPendingAdmin: ledgerState.pendingAdmin.some((b) => b !== 0),
});

/** Per-verifier access counts, as displayed labels plus numbers. */
export const verifierUsage = (
  ledgerState: Ledger,
  verifierIds: readonly string[],
): { id: string; count: bigint }[] =>
  verifierIds.map((id) => ({
    id,
    count: ledgerState.verifierAccesses.member(roleBytesOf(id))
      ? ledgerState.verifierAccesses.lookup(roleBytesOf(id))
      : 0n,
  }));

/** Verifier ids are 32-byte labels, exactly like roles. */
const roleBytesOf = (label: string): Uint8Array => {
  const out = new Uint8Array(32);
  out.set(new TextEncoder().encode(label).subarray(0, 32));
  return out;
};
