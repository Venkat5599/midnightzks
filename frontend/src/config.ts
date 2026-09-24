/**
 * Network and service configuration.
 *
 * The wallet is the authority on which services to use — a user may run their
 * own indexer or proof server, and overriding their choice would quietly harm
 * the privacy they configured it for. So these values are only fallbacks, used
 * before a wallet is connected and if the wallet reports nothing.
 */

/**
 * The network this dApp expects to be on.
 *
 * Must match what `deploy/` targeted, and must match what the connected wallet
 * reports: `lib/lace.ts` refuses a session whose `networkId` differs, rather
 * than letting anyone sign against the wrong chain by accident.
 */
export const NETWORK_ID: string = import.meta.env.VITE_NETWORK_ID ?? 'preview';

export const FALLBACK_INDEXER_URI: string =
  import.meta.env.VITE_INDEXER_URI ?? 'https://indexer.preview.midnight.network/api/v3/graphql';

export const FALLBACK_INDEXER_WS_URI: string =
  import.meta.env.VITE_INDEXER_WS_URI ??
  'wss://indexer.preview.midnight.network/api/v3/graphql/ws';

/**
 * Proving runs locally by default. Sending a witness to someone else's proof
 * server would hand them the secret this whole design exists to protect.
 */
export const FALLBACK_PROOF_SERVER_URI: string =
  import.meta.env.VITE_PROOF_SERVER_URI ?? 'http://localhost:6300';

/** A deployed registry to join on load, if one is configured. */
export const CONFIGURED_CONTRACT_ADDRESS: string | undefined =
  import.meta.env.VITE_CONTRACT_ADDRESS || undefined;

/** Where the compiled ZK artifacts are served from. See `public/zk/`. */
export const ZK_ASSETS_BASE = '/zk';

/** Key under which this dApp's private state is stored locally. */
export const PRIVATE_STATE_ID = 'trien';

/** Name of the local (browser) private state database. */
export const PRIVATE_STATE_STORE = 'trien-private-state';

/**
 * The roles this registry knows how to name.
 *
 * A role is a 32-byte label bound into a credential's commitment, so these are
 * only the labels the instrument offers in a picker — the contract itself
 * accepts any 32-byte value an operator chooses to issue.
 */
export const ROLES = ['role:member', 'role:editor', 'role:auditor'] as const;

/** The role the instrument starts on. */
export const DEFAULT_ROLE: string = ROLES[0];

/**
 * Verifier identifiers the operator is expected to authorize.
 *
 * A verifier is any 32-byte identifier a site chooses for itself; two are
 * named here so the instrument's gates have something concrete to address,
 * and any other value can be typed in.
 */
export const VERIFIERS = ['verifier:newsroom', 'verifier:clinic'] as const;

/** The verifier the instrument starts on. */
export const DEFAULT_VERIFIER: string = VERIFIERS[0];

/** How long a freshly generated credential stays valid, in days. */
export const DEFAULT_EXPIRY_DAYS = 365;

/**
 * Indexer used by the ledger panel when no wallet is connected.
 *
 * The panel reads public ledger state, which needs no session — so it has to
 * work before anyone connects, and it says so on screen.
 */
export const READ_ONLY_INDEXER_URI: string = import.meta.env.VITE_INDEXER_URI ?? FALLBACK_INDEXER_URI;

export const READ_ONLY_INDEXER_WS_URI: string =
  import.meta.env.VITE_INDEXER_WS_URI ?? FALLBACK_INDEXER_WS_URI;
