import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';

/**
 * The instrument's form primitives.
 *
 * One place for the input chrome, so a new circuit's form looks like every
 * other form on the page without anybody re-deriving the border colour.
 */

const inputClass =
  'mt-2 w-full rounded-[4px] border border-hair-soft bg-ink-2 px-3 py-2 font-mono text-[0.8125rem] text-bone disabled:opacity-50';

export const Labelled = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <label className="block text-[0.8125rem] text-bone-3">
    {label}
    {children}
    {hint !== undefined && <span className="mt-1 block text-[0.75rem] text-bone-3">{hint}</span>}
  </label>
);

export const TextInput = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input spellCheck={false} autoComplete="off" {...props} className={inputClass} />
);

export const SelectInput = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={inputClass} />
);

/** A labelled run of controls, with a rule above it. */
export const Group = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="mt-8 grid gap-4 border-t border-hair-soft pt-8">
    <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-bone-3 uppercase">
      {label}
    </span>
    {children}
  </div>
);

/** A single line of instrument output. */
export const LogLine = ({ children }: { children: React.ReactNode }) => (
  <li className="font-mono text-[0.75rem] break-all text-bone-2">{children}</li>
);

/** A short explanatory note, set apart from the controls it explains. */
export const Note = ({ children }: { children: React.ReactNode }) => (
  <p className="m-0 mt-3 max-w-[52ch] text-[0.8125rem] text-bone-3">{children}</p>
);
