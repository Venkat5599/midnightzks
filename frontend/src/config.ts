/**
 * Network and service configuration.
 *
 * The wallet is the authority on which services to use — a user may run their
 * own indexer or proof server, and overriding their choice would quietly harm
 * the privacy they configured it for. So these values are only fallbacks, used
 * before a wallet is connected and if the wallet reports nothing.
 */

/** Preprod ("testnet") is the network these defaults point at. */
export const NETWORK_ID: string = import.meta.env.VITE_NETWORK_ID ?? 'testnet';

export const FALLBACK_INDEXER_URI: string =
  import.meta.env.VITE_INDEXER_URI ?? 'https://indexer.preprod.midnight.network/api/v3/graphql';

export const FALLBACK_INDEXER_WS_URI: string =
  import.meta.env.VITE_INDEXER_WS_URI ??
  'wss://indexer.preprod.midnight.network/api/v3/graphql/ws';

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
export const PRIVATE_STATE_ID = 'gatekeeper';

/** Name of the local (browser) private state database. */
export const PRIVATE_STATE_STORE = 'gatekeeper-private-state';
