import { useCallback, useState } from 'react';
import { Plate } from './Plate';
import { CONFIGURED_CONTRACT_ADDRESS, NETWORK_ID } from './config';
import { connectWallet, disconnectWallet, WalletError, type WalletSession } from './lib/lace';

/** Enough of an address to recognise, without a wall of base32. */
const abbreviate = (value: string): string =>
  value.length <= 28 ? value : `${value.slice(0, 16)}…${value.slice(-10)}`;

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
    <div className="page">
      <header className="masthead">
        <h1 className="wordmark">Gatekeeper</h1>
        <span className="network">midnight · {NETWORK_ID}</span>
      </header>

      <main className="main">
        <div>
          {/* Two deliberate lines. Left to wrap on its own the sentence breaks
              into a ragged stack and strands the second clause, which reads as
              an accident rather than a composition. */}
          <p className="claim">
            Prove you belong here.
            <br />
            <em>Without saying who.</em>
          </p>

          <p className="lede">
            Token gates read your whole wallet to decide whether to let you in. This one reads{' '}
            <strong>one bit</strong>. Membership lives on chain as a commitment in a Merkle tree,
            and access is a zero-knowledge proof that you hold a secret behind one of those
            leaves. The gate learns that someone on the list arrived. Never which someone.
          </p>

          {session === undefined ? (
            <div className="control">
              <button className="connect" type="button" onClick={connect} disabled={connecting}>
                {connecting ? 'Waiting for Lace…' : 'Connect Lace'}
              </button>
              <span className="note">Connecting reveals nothing on chain.</span>
            </div>
          ) : (
            <>
              <div className="control">
                <button className="disconnect" type="button" onClick={disconnect}>
                  Forget this session
                </button>
              </div>

              <dl className="session">
                <div className="row">
                  <dt>Wallet</dt>
                  <dd>{session.name}</dd>
                </div>
                <div className="row">
                  <dt>Address</dt>
                  <dd title={session.shieldedAddress}>{abbreviate(session.shieldedAddress)}</dd>
                </div>
                <div className="row">
                  <dt>Network</dt>
                  <dd>{session.networkId}</dd>
                </div>
                <div className="row">
                  <dt>Proof server</dt>
                  <dd>{session.proofServerUri ?? 'not reported'}</dd>
                </div>
              </dl>

              <p className="note" style={{ marginTop: '1rem' }}>
                Read from the wallet, held in this tab, sent nowhere. Disconnecting forgets the
                session; only you can withdraw the permission, from inside Lace.
              </p>
            </>
          )}

          {error !== undefined && (
            <p className="error" role="alert">
              {error}{' '}
              {error.includes('No Midnight wallet') && (
                <a href="https://www.lace.io/" target="_blank" rel="noreferrer noopener">
                  Get Lace
                </a>
              )}
            </p>
          )}
        </div>

        <Plate />
      </main>

      <footer className="colophon">
        <span>
          {CONFIGURED_CONTRACT_ADDRESS === undefined ? (
            'Registry not yet configured'
          ) : (
            <>
              Registry <code>{abbreviate(CONFIGURED_CONTRACT_ADDRESS)}</code>
            </>
          )}
        </span>
        <a href="https://github.com/Venkat5599/mn" target="_blank" rel="noreferrer noopener">
          Source
        </a>
      </footer>
    </div>
  );
};
