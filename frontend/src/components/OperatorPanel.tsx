import { useCallback, useState } from 'react';
import { Button } from './ui/button';
import { Group, Labelled, LogLine, Note, TextInput } from './ui/field';
import { CredentialFields, newDraft } from './CredentialFields';
import { VERIFIERS, DEFAULT_VERIFIER } from '../config';
import { abbreviate, hexOf } from '../lib/codec';
import { draftCommitment, type CredentialDraft } from '../lib/credentials';
import { operatorCommitmentOf, operatorStateOf, labelOf } from '../lib/contract';
import type { PanelProps } from './panel';

/**
 * The operator pane.
 *
 * Every administrative circuit the contract exposes, in the order an operator
 * would reach for them: bind the registry, add members (one or a cohort),
 * revoke, authorize the sites allowed to check credentials, freeze access when
 * something is wrong, and hand the registry to a successor without ever
 * handing over a secret.
 */
export const OperatorPanel = ({ session, attach, push, busy, setBusy }: PanelProps) => {
  const [operatorSecretHex, setOperatorSecretHex] = useState('');
  const [member, setMember] = useState<CredentialDraft>(newDraft());
  const [revokeIndex, setRevokeIndex] = useState('0');
  const [verifier, setVerifier] = useState<string>(DEFAULT_VERIFIER);
  const [successorSecretHex, setSuccessorSecretHex] = useState('');

  /** Run one administrative circuit as the operator, then report the tx. */
  const asOperator = useCallback(
    async (what: string, secretHex: string, call: (reg: Awaited<ReturnType<typeof attach>>) => Promise<{ public?: { txId?: string } }>) => {
      const secret = hexToBytes(secretHex);
      if (secret === undefined) return;
      setBusy(what);
      try {
        const reg = await attach(operatorStateOf(secret));
        if (reg === undefined) return;
        const tx = await call(reg);
        push(`${what} → tx ${abbreviate(tx.public?.txId ?? 'unknown')}`);
      } catch (err) {
        push(`${what} failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusy(undefined);
      }
    },
    [attach, push, setBusy],
  );

  const generateOperator = useCallback(() => {
    const secret = freshHex();
    setOperatorSecretHex(secret);
    push(
      `generated operator secret ${abbreviate(secret)} — its commitment ${abbreviate(
        hexOf(operatorCommitmentOf(hexToBytes(secret)!)),
      )} is what initialize binds`,
    );
  }, [push]);

  const generateMember = useCallback(() => {
    const secret = freshHex();
    setMember((prev) => ({ ...prev, secretHex: secret }));
    push(`generated a ${member.role} credential ${abbreviate(secret)} — keep the secret to prove later`);
  }, [member.role, push]);

  const register = useCallback(() => {
    const commitment = draftCommitment(member);
    if (commitment === undefined) return;
    void asOperator(`register ${abbreviate(hexOf(commitment))}`, operatorSecretHex, (reg) =>
      reg!.callTx.register!(commitment),
    );
  }, [asOperator, member, operatorSecretHex]);

  /**
   * Onboarding a cohort: four credentials in one transaction.
   *
   * The secrets are generated here and logged, because the operator has to hand
   * them to the people they belong to — the registry only ever stores the
   * commitments.
   */
  const registerCohort = useCallback(() => {
    const secrets = [0, 1, 2, 3].map(() => hexToBytes(freshHex())!);
    const commitments = secrets.map((secret) =>
      draftCommitment({ ...member, secretHex: hexOf(secret) }),
    );
    if (commitments.some((c) => c === undefined)) return;
    push(`cohort secrets: ${secrets.map((s) => abbreviate(hexOf(s))).join(', ')}`);
    void asOperator('registerMany (4)', operatorSecretHex, (reg) =>
      reg!.callTx.registerMany!(commitments as Uint8Array[]),
    );
  }, [asOperator, member, operatorSecretHex, push]);

  const revoke = useCallback(() => {
    void asOperator(`revoke index ${revokeIndex}`, operatorSecretHex, (reg) =>
      reg!.callTx.revoke!(BigInt(revokeIndex)),
    );
  }, [asOperator, operatorSecretHex, revokeIndex]);

  const authorizeVerifier = useCallback(() => {
    void asOperator(`authorize ${verifier}`, operatorSecretHex, (reg) =>
      reg!.callTx.authorizeVerifier!(labelOf(verifier)),
    );
  }, [asOperator, operatorSecretHex, verifier]);

  const withdrawVerifier = useCallback(() => {
    void asOperator(`withdraw ${verifier}`, operatorSecretHex, (reg) =>
      reg!.callTx.revokeVerifier!(labelOf(verifier)),
    );
  }, [asOperator, operatorSecretHex, verifier]);

  const freeze = useCallback(
    (paused: boolean) => {
      void asOperator(paused ? 'pause' : 'unpause', operatorSecretHex, (reg) =>
        paused ? reg!.callTx.pause!() : reg!.callTx.unpause!(),
      );
    },
    [asOperator, operatorSecretHex],
  );

  const propose = useCallback(() => {
    const successor = hexToBytes(successorSecretHex);
    if (successor === undefined) return;
    const commitment = operatorCommitmentOf(successor);
    void asOperator(`propose ${abbreviate(hexOf(commitment))}`, operatorSecretHex, (reg) =>
      reg!.callTx.proposeAdmin!(commitment),
    );
  }, [asOperator, operatorSecretHex, successorSecretHex]);

  const accept = useCallback(() => {
    const successor = hexToBytes(successorSecretHex);
    if (successor === undefined) return;
    setBusy('accept handover');
    void (async () => {
      try {
        const reg = await attach(operatorStateOf(successor));
        if (reg === undefined) return;
        const tx = await reg.callTx.acceptAdmin!();
        push(`accept handover → tx ${abbreviate(tx.public?.txId ?? 'unknown')}`);
      } catch (err) {
        push(`accept failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusy(undefined);
      }
    })();
  }, [attach, push, setBusy, successorSecretHex]);

  const disabled = busy !== undefined;

  return (
    <div className="bg-ink p-7 sm:p-9">
      <span className="font-mono text-[0.6875rem] text-clay">operator</span>

      <Group label="bind the registry">
        <Labelled label="Operator secret (64 hex chars — the admin key)">
          <TextInput
            value={operatorSecretHex}
            onChange={(e) => setOperatorSecretHex(e.target.value)}
            placeholder="0000…"
            disabled={disabled}
          />
        </Labelled>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="quiet" onClick={generateOperator} disabled={disabled}>
            Generate secret
          </Button>
          <Button
            type="button"
            onClick={() => void asOperator('initialize', operatorSecretHex, (reg) => reg!.callTx.initialize!())}
            disabled={disabled || hexToBytes(operatorSecretHex) === undefined}
          >
            {busy === 'initialize' ? 'Proving…' : 'Initialize registry'}
          </Button>
        </div>
        <Note>
          Initializing binds the commitment of this secret as the registry&apos;s operator. It can
          only ever run once, and whoever runs it owns the registry.
        </Note>
      </Group>

      <Group label="add a member">
        <CredentialFields draft={member} onChange={setMember} disabled={disabled} />
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="quiet" onClick={generateMember} disabled={disabled}>
            Generate credential
          </Button>
          <Button
            type="button"
            onClick={register}
            disabled={disabled || operatorSecretHex.length !== 64 || draftCommitment(member) === undefined}
          >
            {busy?.startsWith('register ') ? 'Proving…' : 'Register'}
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={registerCohort}
            disabled={disabled || operatorSecretHex.length !== 64}
          >
            {busy === 'registerMany (4)' ? 'Proving…' : 'Register a cohort of 4'}
          </Button>
        </div>
        <Note>
          The operator registers a commitment, never a secret. Role and deadline ride inside that
          commitment, so a single leaf tells an observer nothing about who holds it or what for.
        </Note>
      </Group>

      <Group label="revoke a member">
        <Labelled label="Leaf index">
          <TextInput
            type="number"
            min={0}
            value={revokeIndex}
            onChange={(e) => setRevokeIndex(e.target.value)}
            disabled={disabled}
          />
        </Labelled>
        <Button type="button" onClick={revoke} disabled={disabled || operatorSecretHex.length !== 64}>
          {busy?.startsWith('revoke') ? 'Proving…' : 'Revoke'}
        </Button>
        <Note>
          Revocation zeroes the leaf, resets the tree history so stale roots stop verifying, and
          bumps the epoch, which voids proofs already in circulation.
        </Note>
      </Group>

      <Group label="authorize a verifier">
        <Labelled label="Verifier id (32-byte label)">
          <TextInput
            value={verifier}
            onChange={(e) => setVerifier(e.target.value)}
            list="trien-verifiers"
            disabled={disabled}
          />
        </Labelled>
        <datalist id="trien-verifiers">
          {VERIFIERS.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={authorizeVerifier} disabled={disabled}>
            {busy?.startsWith('authorize') ? 'Proving…' : 'Authorize'}
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={withdrawVerifier}
            disabled={disabled}
          >
            {busy?.startsWith('withdraw') ? 'Proving…' : 'Withdraw'}
          </Button>
        </div>
        <Note>
          A proof is refused for any verifier the operator has not authorized, so an identifier
          nobody blessed cannot collect proofs at all.
        </Note>
      </Group>

      <Group label="freeze access">
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="quiet" onClick={() => freeze(true)} disabled={disabled}>
            {busy === 'pause' ? 'Proving…' : 'Pause'}
          </Button>
          <Button type="button" variant="quiet" onClick={() => freeze(false)} disabled={disabled}>
            {busy === 'unpause' ? 'Proving…' : 'Unpause'}
          </Button>
        </div>
        <Note>
          Access stops; administration does not. Registration and verifier changes keep working
          while the gate is frozen.
        </Note>
      </Group>

      <Group label="hand over the registry">
        <Labelled label="Successor secret (64 hex chars)">
          <TextInput
            value={successorSecretHex}
            onChange={(e) => setSuccessorSecretHex(e.target.value)}
            placeholder="0000…"
            disabled={disabled}
          />
        </Labelled>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="quiet" onClick={propose} disabled={disabled}>
            {busy?.startsWith('propose') ? 'Proving…' : 'Propose successor'}
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={accept}
            disabled={disabled || hexToBytes(successorSecretHex) === undefined}
          >
            {busy === 'accept handover' ? 'Proving…' : 'Accept as successor'}
          </Button>
        </div>
        <Note>
          Two-sided: the outgoing operator proposes, the successor accepts by proving knowledge of
          the proposed secret. A typo cannot lock the registry out of its own administration, and no
          secret ever leaves its holder&apos;s machine.
        </Note>
      </Group>

      <Group label="session">
        <LogLine>{`network ${session.networkId}`}</LogLine>
        <LogLine>{`proving via ${session.proofServerUri ?? 'wallet default'}`}</LogLine>
      </Group>
    </div>
  );
};

const freshHex = (): string => hexOf(crypto.getRandomValues(new Uint8Array(32)));

const hexToBytes = (hex: string): Uint8Array | undefined => {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return undefined;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};
