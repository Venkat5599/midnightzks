import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  memberSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  memberPath(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { leaf: Uint8Array,
                                                                           path: { sibling: { field: bigint
                                                                                            },
                                                                                   goes_left: boolean
                                                                                 }[]
                                                                         }];
  memberRole(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  memberExpiry(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
}

export type ImpureCircuits<PS> = {
  initialize(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  register(context: __compactRuntime.CircuitContext<PS>,
           commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerMany(context: __compactRuntime.CircuitContext<PS>,
               commitments_0: Uint8Array[]): __compactRuntime.CircuitResults<PS, []>;
  revoke(context: __compactRuntime.CircuitContext<PS>, index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  authorizeVerifier(context: __compactRuntime.CircuitContext<PS>,
                    verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeVerifier(context: __compactRuntime.CircuitContext<PS>,
                 verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  proposeAdmin(context: __compactRuntime.CircuitContext<PS>,
               commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  acceptAdmin(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  proveAccess(context: __compactRuntime.CircuitContext<PS>,
              verifierId_0: Uint8Array,
              requiredRole_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  initialize(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  register(context: __compactRuntime.CircuitContext<PS>,
           commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerMany(context: __compactRuntime.CircuitContext<PS>,
               commitments_0: Uint8Array[]): __compactRuntime.CircuitResults<PS, []>;
  revoke(context: __compactRuntime.CircuitContext<PS>, index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  authorizeVerifier(context: __compactRuntime.CircuitContext<PS>,
                    verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeVerifier(context: __compactRuntime.CircuitContext<PS>,
                 verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  proposeAdmin(context: __compactRuntime.CircuitContext<PS>,
               commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  acceptAdmin(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  proveAccess(context: __compactRuntime.CircuitContext<PS>,
              verifierId_0: Uint8Array,
              requiredRole_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  adminCommitmentOf(secret_0: Uint8Array): Uint8Array;
  commitmentOf(secret_0: Uint8Array, role_0: Uint8Array, expiry_0: bigint): Uint8Array;
  nullifierOf(secret_0: Uint8Array,
              verifierId_0: Uint8Array,
              currentEpoch_0: bigint): Uint8Array;
}

export type Circuits<PS> = {
  adminCommitmentOf(context: __compactRuntime.CircuitContext<PS>,
                    secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  commitmentOf(context: __compactRuntime.CircuitContext<PS>,
               secret_0: Uint8Array,
               role_0: Uint8Array,
               expiry_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  nullifierOf(context: __compactRuntime.CircuitContext<PS>,
              secret_0: Uint8Array,
              verifierId_0: Uint8Array,
              currentEpoch_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  initialize(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  register(context: __compactRuntime.CircuitContext<PS>,
           commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerMany(context: __compactRuntime.CircuitContext<PS>,
               commitments_0: Uint8Array[]): __compactRuntime.CircuitResults<PS, []>;
  revoke(context: __compactRuntime.CircuitContext<PS>, index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  authorizeVerifier(context: __compactRuntime.CircuitContext<PS>,
                    verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeVerifier(context: __compactRuntime.CircuitContext<PS>,
                 verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  proposeAdmin(context: __compactRuntime.CircuitContext<PS>,
               commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  acceptAdmin(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  proveAccess(context: __compactRuntime.CircuitContext<PS>,
              verifierId_0: Uint8Array,
              requiredRole_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  members: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  nullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  verifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  verifierAccesses: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  readonly admin: Uint8Array;
  readonly pendingAdmin: Uint8Array;
  readonly epoch: bigint;
  readonly accessCount: bigint;
  readonly issued: bigint;
  readonly revocations: bigint;
  readonly paused: boolean;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
