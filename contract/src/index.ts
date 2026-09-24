/**
 * Public entry point for the Triện contract package.
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
} from './managed/trien/contract/index.js';

export { witnesses, type TrienWitnesses } from './witnesses.ts';

export {
  createOperatorState,
  createPrivateState,
  OPERATOR_ROLE,
  randomPrivateState,
  roleFromString,
  type TrienPrivateState,
} from './types.ts';

/**
 * The circuits this contract exposes, as the identifiers midnight-js uses to
 * look up ZK artifacts. Kept here so a typo in a circuit name is a compile
 * error in every consumer rather than a runtime "key not found" during proving.
 *
 * Order is the order they appear in the source, not the order they are used:
 * setup, membership, verifiers, administration, then the access proof itself.
 */
export const CIRCUIT_IDS = [
  'initialize',
  'register',
  'registerMany',
  'revoke',
  'authorizeVerifier',
  'revokeVerifier',
  'pause',
  'unpause',
  'proposeAdmin',
  'acceptAdmin',
  'proveAccess',
] as const;

export type TrienCircuitId = (typeof CIRCUIT_IDS)[number];

/** The circuits that only the operator key can run. */
export const OPERATOR_CIRCUIT_IDS = [
  'initialize',
  'register',
  'registerMany',
  'revoke',
  'authorizeVerifier',
  'revokeVerifier',
  'pause',
  'unpause',
  'proposeAdmin',
] as const satisfies readonly TrienCircuitId[];

export type TrienOperatorCircuitId = (typeof OPERATOR_CIRCUIT_IDS)[number];
