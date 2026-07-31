import { ArrowDown, ArrowUpRight } from '@phosphor-icons/react';
import { useCallback, useState } from 'react';
import { Plate } from './Plate';
import { Reveal } from './components/Reveal';
import { Button } from './components/ui/button';
import { CONFIGURED_CONTRACT_ADDRESS, NETWORK_ID } from './config';
import { connectWallet, disconnectWallet, WalletError, type WalletSession } from './lib/lace';
import { useLenis } from './lib/useLenis';

const abbreviate = (value: string): string =>
  value.length <= 28 ? value : `${value.slice(0, 16)}…${value.slice(-10)}`;

/** The bracket label the report format uses for its micro-headings. */
const Tag = ({ children }: { children: string }) => (
  <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-bone-3 uppercase">
    [ {children} ]
  </span>
);

/**
 * Chapters. Each leads with a fact about this contract, not a survey figure:
 * the numbers below are structural properties of the deployed system.
 */
const CHAPTERS = [
  {
    n: '01',
    title: ['the gate', 'learns one bit'],
    lead: 'One bit is the entire disclosure',
    body: 'A token gate reads your wallet to decide. It sees balances, history, every other app you have touched, and it keeps that view. This registry answers a single question instead: are you on the list. The answer is yes or no, and nothing travels with it.',
    quote: 'Allowlists are plumbing. They should not also be surveillance.',
  },
  {
    n: '02',
    title: ['membership is', 'a hash, not a name'],
    lead: '1,024 leaves, zero identities',
    body: 'The operator publishes a Merkle tree of commitments. A commitment is a hash of a secret only the holder knows, so the published tree is a list of opaque values. Depth ten gives room for 1,024 members. An observer counting them learns how many people are approved, and not one thing about who.',
    quote: 'The list is public. The membership is not.',
  },
  {
    n: '03',
    title: ['the proof', 'replaces the identity'],
    lead: '4 circuits, 1 of them public-facing',
    body: 'To get in, a holder proves in zero knowledge that they know a secret behind one of those leaves. The circuit discloses the Merkle root, which was already public, and a nullifier. It never discloses the secret, the commitment, or the path, so an access cannot be traced back to a registration.',
    quote: 'The gate verifies the claim without ever meeting the claimant.',
  },
  {
    n: '04',
    title: ['two gates', 'cannot compare notes'],
    lead: 'The nullifier is salted per verifier',
    body: 'The nullifier is hashed from the secret plus the verifier id plus the current epoch. Present the same credential at two different sites and they receive two unrelated hashes. Colluding gets them nothing, which is the point: unlinkability has to survive cooperation between verifiers or it is not unlinkability.',
    quote: 'Correlation is the attack. Salting the nullifier is the answer.',
  },
  {
    n: '05',
    title: ['revocation lands', 'immediately'],
    lead: 'Not eventually. Immediately.',
    body: 'Clearing a leaf is not enough on its own, because a revoked member still holds a path to an older root and a naive contract would accept it. So revoking does three things: it zeroes the leaf, it resets the tree history so stale roots stop verifying, and it bumps the epoch, which changes every nullifier and voids proofs already in circulation.',
    quote: 'The bug this avoids is invisible until somebody exploits it.',
  },
  {
    n: '06',
    title: ['what is hidden', 'and what is not'],
    lead: 'Stated in both directions',
    body: 'Repeat visits by one member to one gate within an epoch are prevented, not hidden. That is the whole purpose of the nullifier, and enforcing uniqueness necessarily means publishing something stable per member, per verifier, per epoch. The nullifier is the minimum such thing. A privacy claim that will not name its own limits is not a claim worth trusting.',
    quote: 'A design that hides its tradeoffs is hiding the wrong thing.',
  },
] as const;

const LEDGER = [
  ['members', 'Commitments of approved members. Each leaf is a hash.'],
  ['nullifiers', 'Spent access tokens. Opaque, salted per verifier.'],
  ['epoch', 'Bumped on revocation, voiding outstanding proofs.'],
  ['accessCount', 'Aggregate usage. Nothing per person.'],
  ['admin', 'That an operator exists. Not who they are.'],
] as const;

export const App = () => {
  useLenis();

  const [session, setSession] = useState<WalletSession | undefined>(undefined);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(undefined);
    try {
      setSession(await connectWallet());
    } catch (cause) {
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
      <div className="mx-auto max-w-[88rem] px-5 sm:px-10 lg:px-14">
        <header className="flex h-[68px] items-center justify-between gap-4">
          <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-bone-3 uppercase">
            Triện / midnight {NETWORK_ID}
          </span>
          <a
            className="inline-flex items-center gap-1 font-mono text-[0.6875rem] tracking-[0.14em] text-bone-3 uppercase transition-colors duration-300 ease-(--ease-spring) hover:text-bone"
            href="https://github.com/Venkat5599/mn"
            target="_blank"
            rel="noreferrer noopener"
          >
            Source <ArrowUpRight size={11} weight="bold" />
          </a>
        </header>

        {/* Masthead. The word stacked at scale, the way the format wants it. */}
        <section className="pt-10 pb-16 lg:pt-16 lg:pb-24">
          <h1 className="m-0 text-[clamp(3.2rem,1rem+11vw,10.5rem)] leading-[0.86] font-[660] tracking-[-0.045em]">
            <span className="block">ANONYMOUS</span>
            <span className="block text-bone-3">REVOCABLE</span>
            <span className="block">ACCESS</span>
          </h1>

          <div className="mt-10 grid gap-10 border-t border-hair-soft pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20">
            <div>
              <Tag>the premise</Tag>
              <p className="mt-4 mb-8 max-w-[42ch] text-[1.05rem] text-bone-2">
                A registry on Midnight where membership lives as a commitment in a Merkle tree, and
                access is granted by a zero-knowledge proof instead of by showing a wallet.
              </p>
              {session === undefined ? (
                <div className="flex flex-wrap items-center gap-5">
                  <Button type="button" onClick={connect} disabled={connecting}>
                    {connecting ? 'Waiting for Lace…' : 'Connect Lace'}
                  </Button>
                  <span className="text-[0.9375rem] text-bone-3">Reveals nothing on chain.</span>
                </div>
              ) : (
                <>
                  <Button variant="quiet" size="bare" type="button" onClick={disconnect}>
                    Forget this session
                  </Button>
                  <dl className="mt-7 grid max-w-[30rem] gap-3 border-t border-hair-soft pt-5">
                    {(
                      [
                        ['Wallet', session.name],
                        ['Address', abbreviate(session.shieldedAddress)],
                        ['Network', session.networkId],
                        ['Proof server', session.proofServerUri ?? 'not reported'],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4">
                        <dt className="text-[0.8125rem] text-bone-3">{k}</dt>
                        <dd className="m-0 font-mono text-[0.8125rem] break-all text-bone">{v}</dd>
                      </div>
                    ))}
                  </dl>
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
          </div>
        </section>

        {/* Chapter index. */}
        <section className="border-t border-hair-soft py-14">
          <Tag>the argument</Tag>
          <ol className="m-0 mt-8 grid list-none gap-px bg-hair-soft p-0 sm:grid-cols-2 lg:grid-cols-3">
            {CHAPTERS.map((c) => (
              <li key={c.n} className="bg-ink">
                <a
                  href={`#ch-${c.n}`}
                  className="group flex h-full items-start justify-between gap-6 py-6 transition-colors duration-300 ease-(--ease-spring) sm:px-6"
                >
                  <span>
                    <span className="block font-mono text-[0.6875rem] text-bone-3">{c.n}</span>
                    <span className="mt-2 block max-w-[22ch] text-[1.05rem] leading-[1.25] font-medium text-bone-2 transition-colors duration-300 group-hover:text-bone">
                      {c.title[0]} {c.title[1]}
                    </span>
                  </span>
                  <ArrowDown
                    size={14}
                    weight="light"
                    className="mt-1 shrink-0 text-bone-3 transition-colors duration-300 group-hover:text-clay"
                  />
                </a>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Chapters. */}
      {CHAPTERS.map((c) => (
        <section key={c.n} id={`ch-${c.n}`} className="border-t border-hair-soft scroll-mt-8">
          <div className="mx-auto max-w-[88rem] px-5 py-20 sm:px-10 lg:px-14 lg:py-28">
            <Reveal>
              <span className="font-mono text-[0.6875rem] text-bone-3">{c.n}</span>
              <h2 className="m-0 mt-4 text-[clamp(1.9rem,0.9rem+3vw,3.6rem)] leading-[1.02] font-[640] tracking-[-0.038em]">
                <span className="block">{c.title[0]}</span>
                <span className="block text-bone-3">{c.title[1]}</span>
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20">
              <Reveal>
                <h3 className="m-0 max-w-[20ch] text-[1.35rem] leading-[1.3] font-medium tracking-[-0.02em] text-bone">
                  {c.lead}
                </h3>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="m-0 max-w-[62ch] text-bone-2">{c.body}</p>
                <p className="mt-8 max-w-[46ch] border-t border-hair-soft pt-6 text-[1.05rem] text-bone-3 italic">
                  {c.quote}
                </p>
              </Reveal>
            </div>
          </div>
        </section>
      ))}

      {/* The ledger, in full. The report's data block. */}
      <section className="border-t border-hair-soft">
        <div className="mx-auto max-w-[88rem] px-5 py-20 sm:px-10 lg:px-14 lg:py-28">
          <Reveal>
            <Tag>everything the chain stores</Tag>
            <h2 className="m-0 mt-4 mb-12 max-w-[18ch] text-[clamp(1.7rem,1rem+2vw,2.6rem)] leading-[1.08] font-[640] tracking-[-0.032em]">
              Five fields. No identities.
            </h2>
          </Reveal>
          <dl className="m-0 grid gap-px bg-hair-soft sm:grid-cols-2 lg:grid-cols-5">
            {LEDGER.map(([field, note], i) => (
              <Reveal key={field} delay={i * 0.05} className="bg-ink">
                <div className="h-full py-7 sm:px-6">
                  <dt className="font-mono text-[0.8125rem] text-clay">{field}</dt>
                  <dd className="m-0 mt-3 text-[0.9375rem] text-bone-2">{note}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* Methodology, as the format does it. */}
      <section className="border-t border-hair-soft">
        <div className="mx-auto max-w-[88rem] px-5 py-20 sm:px-10 lg:px-14 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-20">
            <Reveal>
              <Tag>method</Tag>
            </Reveal>
            <Reveal delay={0.06}>
              <p className="m-0 max-w-[68ch] text-bone-2">
                Written in Compact and compiled to four zero-knowledge circuits: initialize,
                register, revoke and proveAccess. The test suite runs those circuits against the
                real Compact runtime, the same interpreter the chain uses, so every assertion in the
                contract fires exactly as it would on the network.
              </p>
              <p className="m-0 mt-5 max-w-[68ch] text-bone-2">
                Proving happens locally. A proof server is handed the witness, so pointing it at
                someone else's host would give that host the secret this design exists to protect.
                The witness never leaves the machine that holds it.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <footer className="border-t border-hair-soft">
        <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-14 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-20 lg:px-14">
          <Tag>colophon</Tag>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="m-0 text-[0.8125rem] text-bone-3">Registry</p>
              <p className="m-0 mt-2 font-mono text-[0.8125rem] break-all text-bone-2">
                {CONFIGURED_CONTRACT_ADDRESS === undefined
                  ? 'not yet deployed'
                  : abbreviate(CONFIGURED_CONTRACT_ADDRESS)}
              </p>
            </div>
            <div>
              <p className="m-0 text-[0.8125rem] text-bone-3">Network</p>
              <p className="m-0 mt-2 font-mono text-[0.8125rem] text-bone-2">
                midnight {NETWORK_ID}
              </p>
            </div>
            <div>
              <p className="m-0 text-[0.8125rem] text-bone-3">Name</p>
              <p className="m-0 mt-2 text-[0.8125rem] text-bone-2">
                Triện, the carved seal. It proves the claim, not the bearer.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
