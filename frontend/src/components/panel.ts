import type { WalletSession } from '../lib/lace';
import type { TrienPrivateState } from '@trien/contract';
import type { OpenContract } from '../lib/contract';

/**
 * What every instrument pane is handed.
 *
 * `attach` is the only way a pane reaches the registry, and it always takes the
 * private state to run with: the same wallet can act as an operator in one pane
 * and as a member in another, and neither can read the other's credential.
 */
export type PanelProps = {
  readonly session: WalletSession;
  readonly contract: OpenContract | undefined;
  readonly attach: (privateState?: TrienPrivateState) => Promise<OpenContract | undefined>;
  readonly push: (line: string) => void;
  readonly busy: string | undefined;
  readonly setBusy: (busy: string | undefined) => void;
};
