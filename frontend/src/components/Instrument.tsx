import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { openRegistry, freshSecret, commitmentOf, privateStateOf, type OpenContract } from '../lib/contract';
import type { WalletSession } from '../lib/lace';

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const abbreviate = (value: string): string =>
  value.length <= 28 ? value : `${value.slice(0, 16)}…${value.slice(-10)}`;

const memberLabel = (): string =>
  `member-${Math.random().toString(36).slice(2, 8)}`;

/**
 * The instrument — real circuit calls against the deployed registry.
 *
 * Operator flow: initialize (bind a secret as admin) → register (insert a
 * member commitment). Member flow: proveAccess with a secret that sits in the
 * tree. Everything proves in the browser via the Lace session; the witness
 * never leaves the machine.
 */
export const Instrument = ({ session }: { session: WalletSession }) => {
  const [contract, setContract] = useState<OpenContract | undefined>(undefined);
  const [operatorSecretHex, setOperatorSecretHex] = useState<string>('');
  const [memberSecretHex, setMemberSecretHex] = useState<string>('');
  const [memberName, setMemberName] = useState<string>(memberLabel());
  const [busy, setBusy] = useState<string | undefined>(undefined);
  const [log, setLog] = useState<string[]>([]);

  const push = useCallback((line: string) => setLog((prev) => [...prev.slice(-8), line]), []);

  /** Attach to the deployed registry with the current session. */
  const attach = useCallback(async () => {
    setBusy('attaching…');
    try {
      const c = await openRegistry(session);
      setContract(c);
      push(`attached to ${abbreviate(location.origin)} registry`);
    } catch (err) {
      push(`attach failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(undefined);
    }
  }, [session, push]);

  useEffect(() => {
    void attach();
  }, [attach]);

  const operatorSecret = useMemo(
    () => (/^[0-9a-f]{64}$/i.test(operatorSecretHex) ? hexToBytes(operatorSecretHex) : undefined),
    [operatorSecretHex],
  );
  const memberSecret = useMemo(
    () => (/^[0-9a-f]{64}$/i.test(memberSecretHex) ? hexToBytes(memberSecretHex) : undefined),
    [memberSecretHex],
  );

  const initialize = useCallback(async () => {
    if (contract === undefined || operatorSecret === undefined) return;
    setBusy('proving initialize…');
    try {
      const reg = await openRegistry(session, privateStateOf(operatorSecret));
      const tx = await reg.callTx.initialize!();
      setContract(reg);
      push(`initialize → tx ${abbreviate(tx.public?.txId ?? 'unknown')}`);
    } catch (err) {
      push(`initialize failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(undefined);
    }
  }, [contract, memberSecret, session, push, operatorSecret]);

  const register = useCallback(async () => {
    if (contract === undefined || operatorSecret === undefined || memberSecret === undefined) return;
    setBusy('proving register…');
    try {
      const commitment = commitmentOf(memberSecret);
      const tx = await contract.callTx.register!(commitment);
      push(`register ${memberName} → member ${abbreviate(hex(commitment))} tx ${abbreviate(tx.public?.txId ?? 'unknown')}`);
    } catch (err) {
      push(`register failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(undefined);
    }
  }, [contract, operatorSecret, memberSecret, memberName, push]);

  const prove = useCallback(async () => {
    if (contract === undefined || memberSecret === undefined || operatorSecret === undefined) return;
    setBusy('proving access…');
    try {
      const reg = await openRegistry(session, privateStateOf(memberSecret));
      const verifierId = new Uint8Array(32);
      const tx = await reg.callTx.proveAccess!(verifierId);
      push(`proveAccess ${memberName} → tx ${abbreviate(tx.public?.txId ?? 'unknown')}`);
    } catch (err) {
      push(`prove failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(undefined);
    }
  }, [contract, memberSecret, operatorSecret, memberName, session, push]);

  const generateOperator = useCallback(() => {
    const s = freshSecret();
    setOperatorSecretHex(hex(s));
    push('generated operator secret (save it — it is the admin key)');
  }, [push]);

  const generateMember = useCallback(() => {
    const s = freshSecret();
    setMemberSecretHex(hex(s));
    setMemberName(memberLabel());
    push(`generated secret for new ${memberName} (save it to prove later)`);
  }, [push]);

  return (
    <section id="instrument" className="border-t border-hair-soft scroll-mt-8">
      <div className="mx-auto max-w-[88rem] px-5 py-20 sm:px-10 lg:px-14 lg:py-28">
        <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-bone-3 uppercase">[ instrument ]</span>
        <h2 className="m-0 mt-4 max-w-[20ch] text-[clamp(1.7rem,1rem+2vw,2.6rem)] leading-[1.08] font-[640] tracking-[-0.032em]">
          Prove it, live.
        </h2>
        <p className="m-0 mt-5 max-w-[62ch] text-bone-2">
          Real circuit calls against the deployed registry — not a simulation. The operator binds a
          secret, registers a member commitment, and the member proves access. Proofs are generated
          in the connected wallet; only the root and a nullifier reach the chain.
        </p>

        <div className="mt-10 grid gap-px bg-hair-soft lg:grid-cols-2">
          {/* Operator pane */}
          <div className="bg-ink p-7 sm:p-9">
            <span className="font-mono text-[0.6875rem] text-clay">operator</span>
            <div className="mt-6 grid gap-4">
              <label className="text-[0.8125rem] text-bone-3">
                Operator secret (64 hex chars — admin key)
                <input
                  value={operatorSecretHex}
                  onChange={(e) => setOperatorSecretHex(e.target.value)}
                  placeholder="0000…"
                  spellCheck={false}
                  className="mt-2 w-full rounded-[4px] border border-hair-soft bg-ink-2 px-3 py-2 font-mono text-[0.8125rem] text-bone"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="quiet" onClick={generateOperator} disabled={busy !== undefined}>
                  {busy === 'generating…' ? '…' : 'Generate secret'}
                </Button>
                <Button
                  type="button"
                  onClick={initialize}
                  disabled={busy !== undefined || operatorSecret === undefined}
                >
                  {busy === 'proving initialize…' ? 'Proving…' : 'Initialize registry'}
                </Button>
              </div>
            </div>

            <div className="mt-8 grid gap-4 border-t border-hair-soft pt-8">
              <label className="text-[0.8125rem] text-bone-3">
                Member secret to register (64 hex chars)
                <input
                  value={memberSecretHex}
                  onChange={(e) => setMemberSecretHex(e.target.value)}
                  placeholder="0000…"
                  spellCheck={false}
                  className="mt-2 w-full rounded-[4px] border border-hair-soft bg-ink-2 px-3 py-2 font-mono text-[0.8125rem] text-bone"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="quiet" onClick={generateMember} disabled={busy !== undefined}>
                  Generate member secret
                </Button>
                <Button
                  type="button"
                  onClick={register}
                  disabled={busy !== undefined || operatorSecret === undefined || memberSecret === undefined}
                >
                  {busy === 'proving register…' ? 'Proving…' : `Register ${memberName}`}
                </Button>
              </div>
            </div>
          </div>

          {/* Member pane */}
          <div className="bg-ink p-7 sm:p-9">
            <span className="font-mono text-[0.6875rem] text-clay">member</span>
            <div className="mt-6 grid gap-4">
              <label className="text-[0.8125rem] text-bone-3">
                Your secret (64 hex chars — must be a registered commitment)
                <input
                  value={memberSecretHex}
                  onChange={(e) => {
                    setMemberSecretHex(e.target.value);
                    setMemberName(memberLabel());
                  }}
                  placeholder="0000…"
                  spellCheck={false}
                  className="mt-2 w-full rounded-[4px] border border-hair-soft bg-ink-2 px-3 py-2 font-mono text-[0.8125rem] text-bone"
                />
              </label>
              <Button
                type="button"
                onClick={prove}
                disabled={busy !== undefined || memberSecret === undefined || operatorSecret === undefined}
              >
                {busy === 'proving access…' ? 'Proving…' : 'Prove access'}
              </Button>
            </div>

            <div className="mt-8 border-t border-hair-soft pt-6">
              <span className="font-mono text-[0.6875rem] text-bone-3">log</span>
              <ol className="m-0 mt-3 grid list-none gap-2 p-0">
                {log.map((line, i) => (
                  <li key={i} className="font-mono text-[0.75rem] break-all text-bone-2">
                    {line}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const hexToBytes = (h: string): Uint8Array => {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
};