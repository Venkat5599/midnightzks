import { useCallback, useEffect, useState } from 'react';
import { Button } from './ui/button';
import { LogLine, Note } from './ui/field';
import {
  CONFIGURED_CONTRACT_ADDRESS,
  NETWORK_ID,
  READ_ONLY_INDEXER_URI,
  READ_ONLY_INDEXER_WS_URI,
  VERIFIERS,
} from '../config';
import { abbreviate } from '../lib/codec';
import { readRegistryLedger, readRawContractState, summarise, verifierUsage, type RegistrySummary } from '../lib/registry-reader';

/**
 * The registry, read straight from the chain.
 *
 * No wallet, no session, no signature: the ledger is public state, and this
 * panel reads it with nothing of the reader's identity attached. That is the
 * whole public record — how many members, how many accesses, how many of each
 * at which gate — and never who. If the panel cannot read it, it says that
 * instead of showing a number it does not have.
 */
export const LedgerPanel = () => {
  const [summary, setSummary] = useState<RegistrySummary | undefined>(undefined);
  const [usage, setUsage] = useState<{ id: string; count: bigint }[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [rawSize, setRawSize] = useState<number | undefined>(undefined);
  const [reading, setReading] = useState(false);

  const read = useCallback(async () => {
    if (CONFIGURED_CONTRACT_ADDRESS === undefined) return;
    setReading(true);
    setError(undefined);
    setRawSize(undefined);
    try {
      const state = await readRegistryLedger(
        READ_ONLY_INDEXER_URI,
        READ_ONLY_INDEXER_WS_URI,
        CONFIGURED_CONTRACT_ADDRESS,
      );
      if (state === null) {
        setError('the indexer has no state at this address yet');
        setSummary(undefined);
        return;
      }
      setSummary(summarise(state));
      setUsage(verifierUsage(state, VERIFIERS));
    } catch (cause) {
      // A registry deployed from an older source holds a ledger this build
      // cannot lay out. Say what the chain actually holds instead of showing a
      // decoder error and leaving the reader to guess.
      const raw = await readRawContractState(READ_ONLY_INDEXER_URI, CONFIGURED_CONTRACT_ADDRESS);
      setRawSize(raw === null ? undefined : raw.length / 2);
      setError(cause instanceof Error ? cause.message : String(cause));
      setSummary(undefined);
    } finally {
      setReading(false);
    }
  }, []);

  useEffect(() => {
    void read();
  }, [read]);

  return (
    <section id="registry" className="border-t border-hair-soft scroll-mt-8">
      <div className="mx-auto max-w-[88rem] px-5 py-20 sm:px-10 lg:px-14 lg:py-28">
        <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-bone-3 uppercase">
          [ read it without connecting ]
        </span>
        <h2 className="m-0 mt-4 max-w-[20ch] text-[clamp(1.7rem,1rem+2vw,2.6rem)] leading-[1.08] font-[640] tracking-[-0.032em]">
          {summary === undefined ? 'The public record.' : 'This is all of it.'}
        </h2>

        <div className="mt-10 grid gap-px bg-hair-soft lg:grid-cols-2">
          <div className="bg-ink p-7 sm:p-9">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-[0.6875rem] text-clay">ledger</span>
              <Button
                type="button"
                variant="quiet"
                size="bare"
                onClick={() => void read()}
                disabled={reading || CONFIGURED_CONTRACT_ADDRESS === undefined}
              >
                {reading ? 'Reading…' : 'Read again'}
              </Button>
            </div>

            {CONFIGURED_CONTRACT_ADDRESS === undefined ? (
              <Note>
                No registry address is configured for this build, so there is nothing to read. The
                panel does not invent a number.
              </Note>
            ) : error !== undefined ? (
              <div
                role="alert"
                className="mt-6 rounded-[4px] bg-ink-3 px-[1.1rem] py-[0.9rem] text-[0.9375rem] shadow-[inset_0_0_0_1px_var(--color-hair),inset_2px_0_0_0_var(--color-clay-dim)]"
              >
                <p className="m-0">
                  This build could not read the ledger at the configured address.
                </p>
                {rawSize !== undefined && (
                  <p className="m-0 mt-3 font-mono text-[0.8125rem] text-bone-2">
                    The chain holds {rawSize} bytes of state there. A registry deployed from an
                    earlier source lays its ledger out differently, and this build&apos;s decoder
                    will not guess at a layout it does not know — so it reports the size instead of
                    a number that might be wrong.
                  </p>
                )}
                <p className="m-0 mt-3 font-mono text-[0.75rem] break-all text-bone-3">{error}</p>
              </div>
            ) : summary === undefined ? (
              <Note>Reading the registry…</Note>
            ) : (
              <dl className="m-0 mt-6 grid gap-px bg-hair-soft sm:grid-cols-2">
                {(
                  [
                    ['members', `${summary.members} of 1,024 leaves`],
                    ['credentials issued', `${summary.issued}`],
                    ['revocations', `${summary.revocations}`],
                    ['nullifiers spent', `${summary.nullifiers}`],
                    ['accesses', `${summary.accessCount}`],
                    ['verifiers authorized', `${summary.verifiers}`],
                    ['epoch', `${summary.epoch}`],
                    ['access', summary.paused ? 'frozen' : 'open'],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="bg-ink py-4 sm:px-5">
                    <dt className="text-[0.8125rem] text-bone-3">{k}</dt>
                    <dd className="m-0 mt-1 font-mono text-[0.9375rem] text-bone">{v}</dd>
                  </div>
                ))}
              </dl>
            )}

            {summary?.hasPendingAdmin === true && (
              <Note>A handover has been proposed and not yet accepted.</Note>
            )}

            <div className="mt-8 grid gap-2 border-t border-hair-soft pt-6">
              <LogLine>{`network midnight ${NETWORK_ID}`}</LogLine>
              <LogLine>
                {`registry ${
                  CONFIGURED_CONTRACT_ADDRESS === undefined
                    ? 'not configured'
                    : abbreviate(CONFIGURED_CONTRACT_ADDRESS)
                }`}
              </LogLine>
              <LogLine>{`indexer ${READ_ONLY_INDEXER_URI}`}</LogLine>
            </div>
          </div>

          <div className="bg-ink p-7 sm:p-9">
            <span className="font-mono text-[0.6875rem] text-clay">per gate</span>
            <p className="m-0 mt-6 max-w-[46ch] text-bone-2">
              Usage is published per verifier, because a verifier already knows its own traffic —
              publishing an aggregate it could recompute would hide nothing. What stays hidden is
              who walked through.
            </p>
            <ol className="m-0 mt-6 grid list-none gap-px bg-hair-soft p-0">
              {(usage.length > 0 ? usage : VERIFIERS.map((id) => ({ id, count: 0n }))).map((row) => (
                <li key={row.id} className="flex items-baseline justify-between gap-4 bg-ink py-4 sm:px-5">
                  <span className="font-mono text-[0.8125rem] text-bone-2">{row.id}</span>
                  <span className="font-mono text-[0.9375rem] text-bone">{`${row.count}`}</span>
                </li>
              ))}
            </ol>
            <Note>
              A verifier that has not been authorized cannot collect a proof at all, so a gate with
              no traffic may simply be one the operator has not blessed yet.
            </Note>
          </div>
        </div>
      </div>
    </section>
  );
};
