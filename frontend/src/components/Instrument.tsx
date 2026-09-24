import { useCallback, useState } from 'react';
import { LogLine } from './ui/field';
import { GatePanel } from './GatePanel';
import { OperatorPanel } from './OperatorPanel';
import { openRegistry, type OpenContract } from '../lib/contract';
import type { TrienPrivateState } from '@trien/contract';
import type { WalletSession } from '../lib/lace';

const abbreviate = (value: string): string =>
  value.length <= 28 ? value : `${value.slice(0, 16)}…${value.slice(-10)}`;

/**
 * The instrument — real circuit calls against the deployed registry.
 *
 * One wallet, two roles. The operator pane binds the registry, adds members,
 * authorizes the gates and can freeze access; the gate pane presents a
 * credential and proves membership to a named verifier. Both run the real
 * circuits through the connected wallet, and the private state each call runs
 * with is chosen per call — so the same wallet can hold an operator secret and
 * a member credential without either pane seeing the other's.
 */
export const Instrument = ({ session }: { session: WalletSession }) => {
  const [contract, setContract] = useState<OpenContract | undefined>(undefined);
  const [busy, setBusy] = useState<string | undefined>(undefined);
  const [log, setLog] = useState<string[]>([]);

  const push = useCallback((line: string) => setLog((prev) => [...prev.slice(-11), line]), []);

  /**
   * Attach to the deployed registry as whoever the private state says.
   *
   * Every circuit call goes through here, because the witness reads the
   * private state of the session it is attached with: attaching as the
   * operator and attaching as a member are the same operation with a different
   * credential.
   */
  const attach = useCallback(
    async (privateState?: TrienPrivateState) => {
      try {
        const reg = await openRegistry(session, privateState);
        setContract(reg);
        return reg;
      } catch (err) {
        push(`attach failed: ${err instanceof Error ? err.message : String(err)}`);
        return undefined;
      }
    },
    [session, push],
  );

  const panelProps = { session, contract, attach, push, busy, setBusy };

  return (
    <section id="instrument" className="border-t border-hair-soft scroll-mt-8">
      <div className="mx-auto max-w-[88rem] px-5 py-20 sm:px-10 lg:px-14 lg:py-28">
        <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-bone-3 uppercase">
          [ instrument ]
        </span>
        <h2 className="m-0 mt-4 max-w-[20ch] text-[clamp(1.7rem,1rem+2vw,2.6rem)] leading-[1.08] font-[640] tracking-[-0.032em]">
          Prove it, live.
        </h2>
        <p className="m-0 mt-5 max-w-[62ch] text-bone-2">
          Real circuit calls against the deployed registry — not a simulation. Eleven circuits
          compile from{' '}
          <span className="font-mono text-[0.9375rem] text-bone-2">trien.compact</span>: bind the
          registry, register one member or a cohort, revoke, authorize and withdraw verifiers,
          freeze access, hand the registry over, and prove membership for a role at a named gate.
          Proofs are generated in the connected wallet; the witness never leaves this machine.
        </p>

        <div className="mt-10 grid gap-px bg-hair-soft lg:grid-cols-2">
          <OperatorPanel {...panelProps} />
          <GatePanel {...panelProps} />
        </div>

        <div className="mt-px bg-ink p-7 sm:p-9">
          <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-bone-3 uppercase">
            [ instrument log ]
          </span>
          {log.length === 0 ? (
            <p className="m-0 mt-3 text-[0.8125rem] text-bone-3">
              {contract === undefined
                ? `attached to ${abbreviate(location.origin)} — nothing has been proved yet`
                : 'attached; nothing has been proved yet'}
            </p>
          ) : (
            <ol className="m-0 mt-3 grid list-none gap-2 p-0">
              {log.map((line, i) => (
                <LogLine key={i}>{line}</LogLine>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
};
