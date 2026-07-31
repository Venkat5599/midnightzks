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

/** A participant: a secret plus the commitment the chain would see for it. */
export const actor = (label: string): { state: TrienPrivateState; commitment: Uint8Array } => {
  const state = createPrivateState(bytes32(label));
  return { state, commitment: pureCircuits.commitmentOf(state.secret) };
};

/**
 * Runs the contract locally against the real Compact runtime.
 *
 * This is the same interpreter the chain uses, minus proof generation, so
 * every `assert` in the Compact source fires here exactly as it would on
 * chain. That is what makes these tests meaningful rather than decorative.
 *
 * The simulator holds one shared ledger and lets each call supply its own
 * private state, which is how it can model an operator and several mutually
 * distrusting members against one registry.
 */
export class TrienSimulator {
  private readonly contract: Contract<TrienPrivateState>;
  private circuitContext: CircuitContext<TrienPrivateState>;

  constructor(initial: TrienPrivateState) {
    this.contract = new Contract<TrienPrivateState>(witnesses);
    const coinPublicKey = '0'.repeat(64);
    const { currentContractState, currentPrivateState } = this.contract.initialState(
      createConstructorContext(initial, coinPublicKey),
    );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      coinPublicKey,
      currentContractState.data,
      currentPrivateState,
    );
  }

  /** Current public ledger state — exactly what any chain observer can read. */
  get ledger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
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

  initialize(operator: TrienPrivateState): void {
    this.as(operator, (ctx) => this.contract.impureCircuits.initialize(ctx));
  }

  register(operator: TrienPrivateState, commitment: Uint8Array): void {
    this.as(operator, (ctx) => this.contract.impureCircuits.register(ctx, commitment));
  }

  revoke(operator: TrienPrivateState, index: bigint): void {
    this.as(operator, (ctx) => this.contract.impureCircuits.revoke(ctx, index));
  }

  proveAccess(member: TrienPrivateState, verifierId: Uint8Array): void {
    this.as(member, (ctx) => this.contract.impureCircuits.proveAccess(ctx, verifierId));
  }
}
