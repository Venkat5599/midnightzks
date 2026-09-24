import { ROLES, DEFAULT_EXPIRY_DAYS, DEFAULT_ROLE } from '../config';
import { Labelled, Note, SelectInput, TextInput } from './ui/field';
import type { CredentialDraft } from '../lib/credentials';

/**
 * The three parts of a credential, as inputs.
 *
 * The deadline is edited in days and converted to block time at the moment a
 * circuit is called: nobody should have to think in Unix seconds to say "this
 * pass lapses next year".
 */
export const CredentialFields = ({
  draft,
  onChange,
  disabled = false,
  roleLocked = false,
}: {
  draft: CredentialDraft;
  onChange: (next: CredentialDraft) => void;
  disabled?: boolean;
  roleLocked?: boolean;
}) => (
  <div className="grid gap-4">
    <Labelled label="Secret (64 hex chars — stays on this machine)">
      <TextInput
        value={draft.secretHex}
        onChange={(e) => onChange({ ...draft, secretHex: e.target.value })}
        placeholder="0000…"
        disabled={disabled}
      />
    </Labelled>

    <div className="grid gap-4 sm:grid-cols-2">
      <Labelled label="Role bound into the commitment">
        <SelectInput
          value={draft.role}
          onChange={(e) => onChange({ ...draft, role: e.target.value })}
          disabled={disabled || roleLocked}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </SelectInput>
      </Labelled>

      <Labelled label="Valid for (days from now)">
        <TextInput
          type="number"
          min={1}
          value={draft.expiryDays === 0 ? DEFAULT_EXPIRY_DAYS : draft.expiryDays}
          onChange={(e) => onChange({ ...draft, expiryDays: Number(e.target.value) })}
          disabled={disabled}
        />
      </Labelled>
    </div>

    <Note>
      Role and deadline are hashed into the commitment, so the tree never learns
      either. The proof is only accepted at a gate asking for exactly this role,
      and only before this deadline — both checked on chain, against the chain's
      own clock.
    </Note>
  </div>
);

/** A draft of a brand-new credential. */
export const newDraft = (): CredentialDraft => ({
  secretHex: '',
  role: DEFAULT_ROLE,
  expiryDays: DEFAULT_EXPIRY_DAYS,
});
