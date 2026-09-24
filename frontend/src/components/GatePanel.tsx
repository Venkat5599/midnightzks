import { useCallback, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Group, Labelled, LogLine, Note, SelectInput, TextInput } from './ui/field';
import { CredentialFields, newDraft } from './CredentialFields';
import { DEFAULT_ROLE, DEFAULT_VERIFIER, ROLES, VERIFIERS } from '../config';
import { abbreviate, hexOf, expiryLabel } from '../lib/codec';
import { draftCommitment, draftExpiry, draftState, type CredentialDraft } from '../lib/credentials';
import { labelOf } from '../lib/contract';
import type { PanelProps } from './panel';

/**
 * The gate pane — what a member does, and what a verifier sees.
 *
 * The verifier asks for a role; the holder presents a credential. When the two
 * do not match, the circuit refuses it — and this pane says so before the proof
 * is generated, because a person who has just been told "access denied" deserves
 * to know which half of the pair was wrong.
 */
export const GatePanel = ({ attach, push, busy, setBusy }: PanelProps) => {
  const [verifier, setVerifier] = useState<string>(DEFAULT_VERIFIER);
  const [askedRole, setAskedRole] = useState<string>(DEFAULT_ROLE);
  const [credential, setCredential] = useState<CredentialDraft>(newDraft());

  const commitment = useMemo(() => draftCommitment(credential), [credential]);
  const roleMismatch = credential.role !== askedRole;

  const prove = useCallback(() => {
    const state = draftState(credential);
    if (state === undefined) return;
    setBusy('proving access');
    void (async () => {
      try {
        const reg = await attach(state);
        if (reg === undefined) return;
        const tx = await reg.callTx.proveAccess!(labelOf(verifier), labelOf(askedRole));
        push(
          `proveAccess as ${credential.role} at ${verifier} → tx ${abbreviate(
            tx.public?.txId ?? 'unknown',
          )}`,
        );
        push('published: the nullifier, the Merkle root — both already public — and the deadline');
      } catch (err) {
        push(
          `proof refused: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setBusy(undefined);
      }
    })();
  }, [askedRole, attach, credential, push, setBusy, verifier]);

  return (
    <div className="bg-ink p-7 sm:p-9">
      <span className="font-mono text-[0.6875rem] text-clay">member</span>

      <Group label="the gate">
        <Labelled label="Verifier id (must be authorized by the operator)">
          <TextInput
            value={verifier}
            onChange={(e) => setVerifier(e.target.value)}
            list="trien-gate-verifiers"
            disabled={busy !== undefined}
          />
        </Labelled>
        <datalist id="trien-gate-verifiers">
          {VERIFIERS.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>

        <Labelled label="Role this gate requires">
          <SelectInput
            value={askedRole}
            onChange={(e) => setAskedRole(e.target.value)}
            disabled={busy !== undefined}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </SelectInput>
        </Labelled>
      </Group>

      <Group label="your credential">
        <CredentialFields
          draft={credential}
          onChange={setCredential}
          disabled={busy !== undefined}
        />
      </Group>

      {roleMismatch && (
        <p
          role="alert"
          className="m-0 mt-6 rounded-[4px] bg-ink-3 px-[1.1rem] py-[0.9rem] text-[0.9375rem] shadow-[inset_0_0_0_1px_var(--color-hair),inset_2px_0_0_0_var(--color-clay-dim)]"
        >
          This credential is bound to <span className="font-mono">{credential.role}</span> and the
          gate asks for <span className="font-mono">{askedRole}</span>. The circuit checks that the
          role inside the proof equals the role the verifier required, so this proof will be
          refused — which is the point of binding a role at all.
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3 border-t border-hair-soft pt-8">
        <Button
          type="button"
          onClick={prove}
          disabled={busy !== undefined || draftState(credential) === undefined}
        >
          {busy === 'proving access' ? 'Proving…' : 'Prove access'}
        </Button>
        <Button
          type="button"
          variant="quiet"
          onClick={() => setCredential({ ...credential, secretHex: hexOf(crypto.getRandomValues(new Uint8Array(32))) })}
          disabled={busy !== undefined}
        >
          Generate secret
        </Button>
      </div>

      <div className="mt-8 grid gap-2 border-t border-hair-soft pt-6">
        <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-bone-3 uppercase">
          what you would publish
        </span>
        <LogLine>{`commitment ${commitment === undefined ? '…' : abbreviate(hexOf(commitment))}`}</LogLine>
        <LogLine>{`role ${credential.role} (inside the proof, never published)`}</LogLine>
        <LogLine>{`deadline ${expiryLabel(draftExpiry(credential))} (published, because the chain checks it)`}</LogLine>
        <LogLine>{`verifier ${verifier}`}</LogLine>
      </div>

      <Note>
        Proof generation happens in the connected wallet. The witness — the secret, the role, the
        deadline and the Merkle path — is consumed inside the circuit and never leaves this machine;
        a proof server handed those values would be handed the whole credential, which is why
        proving is local by default.
      </Note>
    </div>
  );
};
