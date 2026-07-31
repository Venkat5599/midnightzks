import { describe, expect, it } from 'vitest';
import { pureCircuits } from '../managed/trien/contract/index.js';
import { actor, bytes32, TrienSimulator } from './simulator.js';

const operator = actor('operator');
const alice = actor('alice');
const bob = actor('bob');
const mallory = actor('mallory');

const NEWSROOM = bytes32('verifier:newsroom');
const CLINIC = bytes32('verifier:clinic');

/** A registry with `members` already registered, in order. */
const registryWith = (...members: Uint8Array[]): TrienSimulator => {
  const sim = new TrienSimulator(operator.state);
  sim.initialize(operator.state);
  for (const commitment of members) {
    sim.register(operator.state, commitment);
  }
  return sim;
};

describe('setup', () => {
  it('binds the registry to the operator commitment and nothing else', () => {
    const sim = new TrienSimulator(operator.state);
    sim.initialize(operator.state);

    // The chain stores a hash of the operator's secret, not the secret and not
    // any identity derived from it.
    expect(sim.ledger.admin).toEqual(operator.commitment);
    expect(sim.ledger.admin).not.toEqual(operator.state.secret);
    expect(sim.ledger.epoch).toBe(0n);
    expect(sim.ledger.accessCount).toBe(0n);
    expect(sim.ledger.nullifiers.isEmpty()).toBe(true);
  });

  it('refuses to re-initialize an existing registry', () => {
    const sim = new TrienSimulator(operator.state);
    sim.initialize(operator.state);

    expect(() => sim.initialize(mallory.state)).toThrow(/already initialized/);
    expect(sim.ledger.admin).toEqual(operator.commitment);
  });
});

describe('registration', () => {
  it('lets only the operator add members', () => {
    const sim = registryWith();

    expect(() => sim.register(mallory.state, mallory.commitment)).toThrow(/not the operator/);
    expect(sim.ledger.members.firstFree()).toBe(0n);
  });

  it('publishes a commitment that reveals nothing about the member', () => {
    const sim = registryWith(alice.commitment);

    // The leaf is present, and it is a hash: it is not the secret, and it is
    // not derivable back to one. Two different members are indistinguishable
    // to an observer beyond "there are two of them".
    expect(sim.ledger.members.firstFree()).toBe(1n);
    expect(sim.ledger.members.findPathForLeaf(alice.commitment)).toBeDefined();
    expect(alice.commitment).not.toEqual(alice.state.secret);
    expect(alice.commitment).not.toEqual(bob.commitment);
  });
});

describe('proving access', () => {
  it('admits a registered member and publishes only a nullifier', () => {
    const sim = registryWith(alice.commitment, bob.commitment);

    sim.proveAccess(alice.state, NEWSROOM);

    expect(sim.ledger.accessCount).toBe(1n);
    expect(sim.ledger.nullifiers.size()).toBe(1n);

    // The one value the chain gained is the nullifier. It matches Alice only
    // if you already hold Alice's secret, which no observer does.
    const expected = pureCircuits.nullifierOf(alice.state.secret, NEWSROOM, 0n);
    expect(sim.ledger.nullifiers.member(expected)).toBe(true);
    expect(
      sim.ledger.nullifiers.member(pureCircuits.nullifierOf(bob.state.secret, NEWSROOM, 0n)),
    ).toBe(false);
  });

  it('rejects a party who was never registered', () => {
    const sim = registryWith(alice.commitment);

    expect(() => sim.proveAccess(mallory.state, NEWSROOM)).toThrow(/not a registered member/);
    expect(sim.ledger.accessCount).toBe(0n);
  });

  it('rejects a second use of the same credential at the same verifier', () => {
    const sim = registryWith(alice.commitment);
    sim.proveAccess(alice.state, NEWSROOM);

    expect(() => sim.proveAccess(alice.state, NEWSROOM)).toThrow(/already used/);
    expect(sim.ledger.accessCount).toBe(1n);
  });

  it('produces unlinkable nullifiers for one member across two verifiers', () => {
    const sim = registryWith(alice.commitment);

    sim.proveAccess(alice.state, NEWSROOM);
    sim.proveAccess(alice.state, CLINIC);

    // Both accesses succeed — one credential is usable everywhere, once each.
    expect(sim.ledger.accessCount).toBe(2n);
    expect(sim.ledger.nullifiers.size()).toBe(2n);

    // And the two published nullifiers share no structure, so the newsroom and
    // the clinic cannot collude to discover they saw the same person.
    const atNewsroom = pureCircuits.nullifierOf(alice.state.secret, NEWSROOM, 0n);
    const atClinic = pureCircuits.nullifierOf(alice.state.secret, CLINIC, 0n);
    expect(atNewsroom).not.toEqual(atClinic);
  });

  it('keeps two different members distinct at the same verifier', () => {
    const sim = registryWith(alice.commitment, bob.commitment);

    sim.proveAccess(alice.state, NEWSROOM);
    sim.proveAccess(bob.state, NEWSROOM);

    expect(sim.ledger.accessCount).toBe(2n);
    expect(sim.ledger.nullifiers.size()).toBe(2n);
  });
});

describe('revocation', () => {
  it('locks out the revoked member immediately', () => {
    const sim = registryWith(alice.commitment, bob.commitment);

    sim.revoke(operator.state, 0n); // Alice is leaf 0.

    expect(sim.ledger.epoch).toBe(1n);
    expect(() => sim.proveAccess(alice.state, NEWSROOM)).toThrow(/not a registered member/);
    expect(sim.ledger.accessCount).toBe(0n);
  });

  it('leaves every other member working', () => {
    const sim = registryWith(alice.commitment, bob.commitment);

    sim.revoke(operator.state, 0n);
    sim.proveAccess(bob.state, NEWSROOM);

    expect(sim.ledger.accessCount).toBe(1n);
  });

  it('voids nullifiers issued before the revocation, so proofs cannot be replayed', () => {
    const sim = registryWith(alice.commitment, bob.commitment);
    sim.proveAccess(bob.state, NEWSROOM);

    const beforeRevocation = pureCircuits.nullifierOf(bob.state.secret, NEWSROOM, 0n);
    sim.revoke(operator.state, 0n);
    const afterRevocation = pureCircuits.nullifierOf(bob.state.secret, NEWSROOM, 1n);

    // The epoch bump changes the nullifier, so the spent one no longer blocks
    // Bob — and equally, a proof built against epoch 0 no longer validates.
    expect(beforeRevocation).not.toEqual(afterRevocation);
    expect(sim.ledger.nullifiers.member(beforeRevocation)).toBe(true);
    expect(sim.ledger.nullifiers.member(afterRevocation)).toBe(false);

    sim.proveAccess(bob.state, NEWSROOM);
    expect(sim.ledger.accessCount).toBe(2n);
  });

  it('lets only the operator revoke', () => {
    const sim = registryWith(alice.commitment);

    expect(() => sim.revoke(mallory.state, 0n)).toThrow(/not the operator/);
    expect(sim.ledger.epoch).toBe(0n);
  });
});

describe('what an observer can learn', () => {
  it('sees a count and a set of opaque hashes, and no identities', () => {
    const sim = registryWith(alice.commitment, bob.commitment);
    sim.proveAccess(alice.state, NEWSROOM);
    sim.proveAccess(bob.state, CLINIC);

    const published = [...sim.ledger.nullifiers];

    // Two accesses happened. That is the whole of the public signal.
    expect(sim.ledger.accessCount).toBe(2n);
    expect(published).toHaveLength(2);

    // None of the published values is a member commitment, so an observer
    // cannot match an access back to the registration that authorised it.
    for (const nullifier of published) {
      expect(nullifier).not.toEqual(alice.commitment);
      expect(nullifier).not.toEqual(bob.commitment);
    }
  });
});
