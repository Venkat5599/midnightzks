import { ArrowUpRight, Eye, EyeSlash, Fingerprint, Key, Wallet } from '@phosphor-icons/react';
import { useCallback, useState } from 'react';
import { Plate } from './Plate';
import { Reveal } from './components/Reveal';
import { Button } from './components/ui/button';
import { CONFIGURED_CONTRACT_ADDRESS, NETWORK_ID } from './config';
import { connectWallet, disconnectWallet, WalletError, type WalletSession } from './lib/lace';

/** Enough of an address to recognise, without a wall of base32. */
const abbreviate = (value: string): string =>
  value.length <= 28 ? value : `${value.slice(0, 16)}…${value.slice(-10)}`;

const Row = ({ label, value, title }: { label: string; value: string; title?: string }) => (
  <div className="grid items-baseline gap-1 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4">
    <dt className="text-[0.8125rem] text-bone-3">{label}</dt>
    <dd className="m-0 font-mono text-[0.8125rem] break-all text-bone" title={title}>
      {value}
    </dd>
  </div>
);

/** The ledger fields, taken from the contract. Real declarations, not filler. */
const LEDGER = [
  ['members', 'Commitments of approved members. Each leaf is a hash. It identifies nobody.'],
  ['nullifiers', 'Spent access tokens. Opaque, and salted per verifier.'],
  ['epoch', 'Bumped on every revocation, which voids outstanding proofs.'],
  ['accessCount', 'Aggregate usage. Nothing per person.'],
  ['admin', 'The operator commitment. That an operator exists, not who.'],
] as const;

const CAN_LEARN = [
  'How many members are registered, and how many were revoked',
  'How many accesses happened in total, and at their own gate',
  'That some approved, non-revoked party proved access',
] as const;

const CANNOT_LEARN = [
  'Which member performed any given access',
  'Whether two accesses at different gates came from one person',
  'Anything at all about a member who never proves access',
  "A member's secret, from any amount of on-chain data",
] as const;

const STEPS = [
  {
    icon: Key,
    title: 'The operator issues',
    body: 'A member generates a secret locally. The operator inserts only its hash into a Merkle tree on chain. The secret never moves.',
  },
  {
    icon: Fingerprint,
    title: 'The member proves',
    body: 'To get in, the member proves in zero knowledge that they know a secret behind one of those leaves, and publishes a nullifier instead of a name.',
  },
  {
    icon: EyeSlash,
    title: 'The gate learns one bit',
    body: 'Allowed in, or not. The nullifier is salted with the verifier id, so two gates comparing notes still cannot tell they saw the same person.',
  },
] as const;

export const App = () => {
  const [session, setSession] = useState<WalletSession | undefined>(undefined);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(undefined);
    try {
      setSession(await connectWallet());
    } catch (cause) {
      // A refused connection is an ordinary outcome, not a crash: the user
      // said no, or Lace is not installed. Say which, and keep the page usable.
      setError(
        cause instanceof WalletError
          ? cause.message
          : `Could not connect: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    disconnectWallet();
    setSession(undefined);
    setError(undefined);
  }, []);

  return (
    <div className="relative z-2">
      <div className="mx-auto max-w-[84rem] px-5 sm:px-10 lg:px-16">
        {/* Nav: one line, well under the 80px cap. */}
        <header className="flex h-[68px] items-center justify-between gap-4">
          <span className="text-base font-semibold tracking-[-0.012em]">Triện</span>
          <nav className="flex items-center gap-6 font-mono text-xs text-bone-3">
            <span>midnight {NETWORK_ID}</span>
            <a
              className="inline-flex items-center gap-1 transition-colors duration-300 ease-(--ease-spring) hover:text-bone"
              href="https://github.com/Venkat5599/mn"
              target="_blank"
              rel="noreferrer noopener"
            >
              Source <ArrowUpRight size={12} weight="bold" />
            </a>
          </nav>
        </header>

        {/* Hero. Asymmetric split, headline two lines, one primary action. */}
        <main className="grid items-center gap-14 pt-10 pb-24 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-20 lg:pt-16 lg:pb-32">
          <div>
            <h1 className="m-0 mb-7 text-[clamp(2rem,0.95rem+2.7vw,3.1rem)] leading-[1.06] font-[620] tracking-[-0.032em] text-balance">
              Prove you belong here.
              <br />
              <em className="text-bone-3 not-italic">Without saying who.</em>
            </h1>

            <p className="m-0 mb-10 max-w-[30rem] text-bone-2">
              Most gates read your whole wallet to decide. This one reads{' '}
              <strong className="font-medium text-bone">one bit</strong>.
            </p>

            {session === undefined ? (
              <div className="flex flex-wrap items-center gap-5">
                <Button type="button" onClick={connect} disabled={connecting}>
                  {connecting ? 'Waiting for Lace…' : 'Connect Lace'}
                </Button>
                <span className="text-[0.9375rem] text-bone-3">
                  Connecting reveals nothing on chain.
                </span>
              </div>
            ) : (
              <>
                <Button variant="quiet" size="bare" type="button" onClick={disconnect}>
                  Forget this session
                </Button>
                <dl className="mt-8 grid max-w-[31rem] gap-[0.8rem] border-t border-hair-soft pt-6">
                  <Row label="Wallet" value={session.name} />
                  <Row
                    label="Address"
                    value={abbreviate(session.shieldedAddress)}
                    title={session.shieldedAddress}
                  />
                  <Row label="Network" value={session.networkId} />
                  <Row label="Proof server" value={session.proofServerUri ?? 'not reported'} />
                </dl>
                <p className="mt-4 max-w-[31rem] text-[0.9375rem] text-bone-3">
                  Read from the wallet, held in this tab, sent nowhere. Disconnecting forgets the
                  session; only you can withdraw the permission, from inside Lace.
                </p>
              </>
            )}

            {error !== undefined && (
              <p
                role="alert"
                className="mt-6 max-w-[31rem] rounded-[4px] bg-ink-3 px-[1.1rem] py-[0.9rem] text-[0.9375rem] shadow-[inset_0_0_0_1px_var(--color-hair),inset_2px_0_0_0_var(--color-clay-dim)]"
              >
                {error}{' '}
                {error.includes('No Midnight wallet') && (
                  <a
                    className="text-clay"
                    href="https://www.lace.io/"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Get Lace
                  </a>
                )}
              </p>
            )}
          </div>

          <Plate />
        </main>
      </div>

      {/* The contrast. Two columns split by a rule, no cards. */}
      <section className="border-t border-hair-soft">
        <div className="mx-auto max-w-[84rem] px-5 py-20 sm:px-10 lg:px-16 lg:py-28">
          <Reveal>
            <div className="grid gap-10 md:grid-cols-2 md:gap-0">
              <div className="md:pr-12">
                <div className="mb-4 flex items-center gap-2 text-bone-3">
                  <Wallet size={18} weight="light" />
                  <span className="text-[0.9375rem]">A token gate today</span>
                </div>
                <p className="m-0 text-[1.35rem] leading-[1.35] tracking-[-0.02em] text-bone-2">
                  Connect a wallet and it reads everything in it. Your balances, your history, every
                  other app you have touched. Then it decides.
                </p>
              </div>
              <div className="border-hair-soft md:border-l md:pl-12">
                <div className="mb-4 flex items-center gap-2 text-clay">
                  <Eye size={18} weight="light" />
                  <span className="text-[0.9375rem]">Triện</span>
                </div>
                <p className="m-0 text-[1.35rem] leading-[1.35] tracking-[-0.02em] text-bone">
                  Prove membership with a zero-knowledge proof. The gate learns that someone on the
                  list arrived, and nothing else. Not which someone.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works. A hairline rail of three, not three floating cards. */}
      <section className="border-t border-hair-soft">
        <div className="mx-auto max-w-[84rem] px-5 py-20 sm:px-10 lg:px-16 lg:py-28">
          <Reveal>
            <h2 className="m-0 mb-12 max-w-[24ch] text-[clamp(1.6rem,1rem+1.6vw,2.2rem)] leading-[1.15] font-[620] tracking-[-0.028em]">
              Three moves, and only one of them is public.
            </h2>
          </Reveal>

          <ol className="m-0 grid list-none gap-px bg-hair-soft p-0 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.08} className="bg-ink">
                <li className="h-full py-8 md:px-8 md:py-10">
                  <step.icon size={22} weight="light" className="mb-5 text-clay" />
                  <h3 className="m-0 mb-3 text-[1.05rem] font-semibold tracking-[-0.012em]">
                    {step.title}
                  </h3>
                  <p className="m-0 max-w-[38ch] text-[0.9375rem] text-bone-2">{step.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* What an observer gets. Both halves, honestly. */}
      <section className="border-t border-hair-soft">
        <div className="mx-auto max-w-[84rem] px-5 py-20 sm:px-10 lg:px-16 lg:py-28">
          <Reveal>
            <h2 className="m-0 mb-3 text-[clamp(1.6rem,1rem+1.6vw,2.2rem)] leading-[1.15] font-[620] tracking-[-0.028em]">
              What an observer actually gets.
            </h2>
            <p className="m-0 mb-12 max-w-[52ch] text-bone-3">
              Assume someone reads every block, runs the gate, and operates the registry. All three,
              cooperating.
            </p>
          </Reveal>

          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
            <Reveal>
              <h3 className="m-0 mb-5 text-[0.9375rem] text-bone-3">They can learn</h3>
              <ul className="m-0 grid list-none gap-3 p-0">
                {CAN_LEARN.map((item) => (
                  <li key={item} className="text-[0.9375rem] text-bone-2">
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.08}>
              <h3 className="m-0 mb-5 text-[0.9375rem] text-clay">They cannot learn</h3>
              <ul className="m-0 grid list-none gap-3 p-0">
                {CANNOT_LEARN.map((item) => (
                  <li key={item} className="text-[0.9375rem] text-bone">
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.16}>
              <h3 className="m-0 mb-5 text-[0.9375rem] text-bone-3">The public ledger, in full</h3>
              <dl className="m-0 grid gap-3">
                {LEDGER.map(([field, note]) => (
                  <div key={field} className="grid gap-1">
                    <dt className="font-mono text-[0.8125rem] text-bone">{field}</dt>
                    <dd className="m-0 text-[0.875rem] text-bone-3">{note}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Closing statement. The part that is easy to get wrong. */}
      <section className="border-t border-hair-soft">
        <div className="mx-auto max-w-[84rem] px-5 py-20 sm:px-10 lg:px-16 lg:py-28">
          <Reveal>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end lg:gap-20">
              <div>
                <h2 className="m-0 mb-5 max-w-[20ch] text-[clamp(1.7rem,1rem+2vw,2.6rem)] leading-[1.1] font-[620] tracking-[-0.03em]">
                  Revocation lands immediately, not eventually.
                </h2>
                <p className="m-0 max-w-[54ch] text-bone-2">
                  Clearing a leaf is not enough on its own. A revoked member still holds a path to
                  an older root. So revoking also resets the tree history and bumps the epoch, which
                  changes every nullifier and voids the proofs already in someone's hands.
                </p>
              </div>
              <div className="lg:justify-self-end">
                {session === undefined && (
                  <Button type="button" onClick={connect} disabled={connecting}>
                    {connecting ? 'Waiting for Lace…' : 'Connect Lace'}
                  </Button>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-hair-soft">
        <div className="mx-auto flex max-w-[84rem] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-8 text-[0.8125rem] text-bone-3 sm:px-10 lg:px-16">
          <span>
            {CONFIGURED_CONTRACT_ADDRESS === undefined ? (
              'Registry not yet deployed'
            ) : (
              <>
                Registry{' '}
                <code className="font-mono text-xs break-all">
                  {abbreviate(CONFIGURED_CONTRACT_ADDRESS)}
                </code>
              </>
            )}
          </span>
          <span>Triện · a seal proves the claim, not the bearer</span>
        </div>
      </footer>
    </div>
  );
};
