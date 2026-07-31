/**
 * Public entry point for the Gatekeeper contract package.
 *
 * Consumers (the deploy script, the dApp) need three things: the generated
 * contract binding, the witness implementations that feed it private data, and
 * the private-state type those witnesses read. Re-exporting them from one place
 * means a consumer never has to reach into `src/managed/`, which is compiler
 * output and free to change shape between Compact releases.
 */

export {
  Contract,
  ledger,
  pureCircuits,
  type Circuits,
  type ImpureCircuits,
  type Ledger,
  type PureCircuits,
  type Witnesses,
} from './managed/gatekeeper/contract/index.js';

export { witnesses, type GatekeeperWitnesses } from './witnesses.js';

export { createPrivateState, randomPrivateState, type GatekeeperPrivateState } from './types.js';

/**
 * The circuits this contract exposes, as the identifiers midnight-js uses to
 * look up ZK artifacts. Kept here so a typo in a circuit name is a compile
 * error in every consumer rather than a runtime "key not found" during proving.
 */
export const CIRCUIT_IDS = ['initialize', 'register', 'revoke', 'proveAccess'] as const;

export type GatekeeperCircuitId = (typeof CIRCUIT_IDS)[number];
