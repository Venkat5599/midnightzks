import { useCallback, useState } from 'react';
import { Plate } from './Plate';
import { Button } from './components/ui/button';
import { CONFIGURED_CONTRACT_ADDRESS, NETWORK_ID } from './config';
import { connectWallet, disconnectWallet, WalletError, type WalletSession } from './lib/lace';

/** Enough of an address to recognise, without a wall of base32. */
const abbreviate = (value: string): string =>
  value.length <= 28 ? value : `${value.slice(0, 16)}…${value.slice(-10)}`;

const Row = ({ label, value, title }: { label: string; value: string; title?: string }) => (
  <div className="grid items-baseline gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
    <dt className="text-[0.8125rem] text-bone-3">{label}</dt>
    <dd className="m-0 font-mono text-[0.8125rem] break-all text-bone" title={title}>
      {value}
    </dd>
  </div>
);

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
      // said no, or Lace is not installed. Say which, and leave the page
      // working.
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
    <div className="relative z-2 mx-auto grid min-h-dvh max-w-[84rem] grid-rows-[auto_1fr_auto] gap-12 px-5 py-6 sm:px-10 lg:gap-28 lg:px-16 lg:py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="m-0 text-base font-semibold tracking-[-0.012em]">Gatekeeper</h1>
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.02em] text-bone-3">
          <span className="size-[5px] rounded-full bg-clay-dim" aria-hidden />
          midnight {NETWORK_ID}
        </span>
      </header>

      <main className="grid items-start gap-14 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:items-center lg:gap-20">
        <div>
          {/* Two deliberate lines. Left to wrap freely the sentence breaks into
              a ragged stack and strands the second clause. */}
          <p className="m-0 mb-7 text-[clamp(1.95rem,0.9rem+2.6vw,3rem)] leading-[1.06] font-[620] tracking-[-0.032em] text-balance">
            Prove you belong here.
            <br />
            <em className="text-bone-3 not-italic">Without saying who.</em>
          </p>

          <p className="m-0 mb-11 max-w-[33rem] text-bone-2">
            Token gates read your whole wallet to decide whether to let you in. This one reads{' '}
            <strong className="font-medium text-bone">one bit</strong>. Membership lives on chain as
            a commitment in a Merkle tree, and access is a zero-knowledge proof that you hold a
            secret behind one of those leaves. The gate learns that someone on the list arrived.
            Never which someone.
          </p>

          {session === undefined ? (
            <div className="flex flex-wrap items-center gap-5">
              <Button type="button" onClick={connect} disabled={connecting}>
                {connecting ? 'Waiting for Lace…' : 'Connect Lace'}
              </Button>
              <span className="text-[0.9375rem] text-bone-3">Connecting reveals nothing on chain.</span>
            </div>
          ) : (
            <>
              <Button variant="quiet" size="bare" type="button" onClick={disconnect}>
                Forget this session
              </Button>

              <dl className="mt-9 grid max-w-[33rem] gap-[0.85rem] border-t border-hair-soft pt-6">
                <Row label="Wallet" value={session.name} />
                <Row
                  label="Address"
                  value={abbreviate(session.shieldedAddress)}
                  title={session.shieldedAddress}
                />
                <Row label="Network" value={session.networkId} />
                <Row label="Proof server" value={session.proofServerUri ?? 'not reported'} />
              </dl>

              <p className="mt-4 max-w-[33rem] text-[0.9375rem] text-bone-3">
                Read from the wallet, held in this tab, sent nowhere. Disconnecting forgets the
                session; only you can withdraw the permission, from inside Lace.
              </p>
            </>
          )}

          {error !== undefined && (
            <p
              role="alert"
              className="mt-6 max-w-[33rem] rounded-[4px] bg-ink-3 px-[1.1rem] py-[0.9rem] text-[0.9375rem] shadow-[inset_0_0_0_1px_var(--color-hair),inset_2px_0_0_0_var(--color-clay-dim)]"
            >
              {error}{' '}
              {error.includes('No Midnight wallet') && (
                <a className="text-clay" href="https://www.lace.io/" target="_blank" rel="noreferrer noopener">
                  Get Lace
                </a>
              )}
            </p>
          )}
        </div>

        <Plate />
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-hair-soft pt-[1.4rem] text-[0.8125rem] text-bone-3">
        <span>
          {CONFIGURED_CONTRACT_ADDRESS === undefined ? (
            'Registry not yet configured'
          ) : (
            <>
              Registry{' '}
              <code className="font-mono text-xs break-all">
                {abbreviate(CONFIGURED_CONTRACT_ADDRESS)}
              </code>
            </>
          )}
        </span>
        <a
          className="text-bone-2 no-underline shadow-[inset_0_-1px_0_0_var(--color-hair)] transition-colors duration-300 ease-(--ease-spring) hover:text-bone"
          href="https://github.com/Venkat5599/mn"
          target="_blank"
          rel="noreferrer noopener"
        >
          Source
        </a>
      </footer>
    </div>
  );
};
