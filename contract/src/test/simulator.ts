import {
  type CircuitContext,
  type CircuitResults,
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  type Ledger,
  ledger,
  pureCircuits,
} from '../managed/trien/contract/index.js';
import { createPrivateState, type TrienPrivateState } from '../types.ts';
import { witnesses } from '../witnesses.ts';

/** Deterministic 32-byte value, so failures are reproducible. */
export const bytes32 = (label: string): Uint8Array => {
  const out = new Uint8Array(32);
  const encoded = new TextEncoder().encode(label);
  out.set(encoded.subarray(0, 32));
  return out;
};

/**
 * A credential holder: the private state they keep locally, plus the
 * commitment the chain would see for it.
 *
 * The commitment is derived here the same way the circuit derives it, so a test
 * can register the value the holder actually holds rather than a value the test
 * assumed they hold.
 */
export const holder = (
  label: string,
  role: Uint8Array,
  expiry: bigint,
): { state: TrienPrivateState; commitment: Uint8Array } => {
  const state = createPrivateState(bytes32(label), role, expiry);
  return {
    state,
    commitment: pureCircuits.commitmentOf(state.secret, state.role, state.expiry),
  };
};

/** The commitment an operator state owns, i.e. the value `initialize` binds. */
export const operatorCommitment = (state: TrienPrivateState): Uint8Array =>
  pureCircuits.adminCommitmentOf(state.secret);

/**
 * Runs the contract locally against the real Compact runtime.
 *
 * This is the same interpreter the chain uses, minus proof generation, so
 * every `assert` in the Compact source fires here exactly as it would on
 * chain. That is what makes these tests meaningful rather than decorative.
 *
 * The simulator holds one shared ledger and lets each call supply its own
 * private state, which is how it can model an operator and several mutually
 * distrusting members against one registry. It also owns the clock: `setTime`
 * is the block time the circuits see, which is what lets a test show a
 * credential dying at its deadline rather than only asserting that the deadline
 * exists.
 */
export class TrienSimulator {
  private readonly contract: Contract<TrienPrivateState>;
  private circuitContext: CircuitContext<TrienPrivateState>;
  private readonly coinPublicKey: string;

  constructor(initial: TrienPrivateState, time = 0) {
    this.contract = new Contract<TrienPrivateState>(witnesses);
    this.coinPublicKey = '0'.repeat(64);
    const { currentContractState, currentPrivateState } = this.contract.initialState(
      createConstructorContext(initial, this.coinPublicKey),
    );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      this.coinPublicKey,
      currentContractState.data,
      currentPrivateState,
      undefined,
      undefined,
      time,
    );
  }

  /** Current public ledger state — exactly what any chain observer can read. */
  get ledger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  /**
   * Advance the chain clock, in seconds.
   *
   * Only the time changes: the ledger and every holder's private state are
   * untouched, which is the point — a credential stops working because time
   * passed, not because anything about the member changed.
   */
  setTime(time: number): void {
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      this.coinPublicKey,
      this.circuitContext.currentQueryContext.state,
      this.circuitContext.currentPrivateState,
      undefined,
      undefined,
      time,
    );
  }

  /**
   * Invoke a circuit as `who`, committing the resulting ledger state.
   *
   * Swapping `currentPrivateState` per call is what lets one simulator stand in
   * for several independent parties: each supplies only their own secret, and
   * none of them can see another's.
   */
  private as<T>(
    who: TrienPrivateState,
    call: (ctx: CircuitContext<TrienPrivateState>) => CircuitResults<TrienPrivateState, T>,
  ): T {
    const { result, context } = call({ ...this.circuitContext, currentPrivateState: who });
    this.circuitContext = context;
    return result;
  }

  // --- setup ---------------------------------------------------------------

  initialize(operator: TrienPrivateState): void {
    this.as(operator, (ctx) => this.contract.impureCircuits.initialize(ctx));
  }

  // --- membership ----------------------------------------------------------

  register(operator: TrienPrivateState, commitment: Uint8Array): void {
    this.as(operator, (ctx) => this.contract.impureCircuits.register(ctx, commitment));
  }

  registerMany(operator: TrienPrivateState, commitments: Uint8Array[]): void {
    this.as(operator, (ctx) => this.contract.impureCircuits.registerMany(ctx, commitments));
  }

  revoke(operator: TrienPrivateState, index: bigint): void {
    this.as(operator, (ctx) => this.contract.impureCircuits.revoke(ctx, index));
  }

  // --- verifiers -----------------------------------------------------------

  authorizeVerifier(operator: TrienPrivateState, verifierId: Uint8Array): void {
    this.as(operator, (ctx) => this.contract.impureCircuits.authorizeVerifier(ctx, verifierId));
  }

  revokeVerifier(operator: TrienPrivateState, verifierId: Uint8Array): void {
    this.as(operator, (ctx) => this.contract.impureCircuits.revokeVerifier(ctx, verifierId));
  }

  // --- administration ------------------------------------------------------

  pause(operator: TrienPrivateState): void {
    this.as(operator, (ctx) => this.contract.impureCircuits.pause(ctx));
  }

  unpause(operator: TrienPrivateState): void {
    this.as(operator, (ctx) => this.contract.impureCircuits.unpause(ctx));
  }

  proposeAdmin(operator: TrienPrivateState, commitment: Uint8Array): void {
    this.as(operator, (ctx) => this.contract.impureCircuits.proposeAdmin(ctx, commitment));
  }

  acceptAdmin(candidate: TrienPrivateState): void {
    this.as(candidate, (ctx) => this.contract.impureCircuits.acceptAdmin(ctx));
  }

  // --- access --------------------------------------------------------------

  proveAccess(member: TrienPrivateState, verifierId: Uint8Array, requiredRole: Uint8Array): void {
    this.as(member, (ctx) =>
      this.contract.impureCircuits.proveAccess(ctx, verifierId, requiredRole),
    );
  }
}
