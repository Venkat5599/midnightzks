import { describe, expect, it } from 'vitest';
import { pureCircuits } from '../managed/trien/contract/index.js';
import { createOperatorState } from '../types.ts';
import { bytes32, holder, operatorCommitment, TrienSimulator } from './simulator.js';

const FAR_FUTURE = 4_000_000_000n; // never reached in a test
const YEAR_2033 = 2_000_000_000n;

const operator = createOperatorState(bytes32('operator'));
const OPERATOR_COMMITMENT = operatorCommitment(operator);

const MEMBER = bytes32('role:member');
const EDITOR = bytes32('role:editor');

const alice = holder('alice', MEMBER, FAR_FUTURE);
const bob = holder('bob', MEMBER, FAR_FUTURE);
const editor = holder('editor', EDITOR, FAR_FUTURE);
const intern = holder('intern', MEMBER, YEAR_2033);
const mallory = holder('mallory', MEMBER, FAR_FUTURE);

const NEWSROOM = bytes32('verifier:newsroom');
const CLINIC = bytes32('verifier:clinic');

/**
 * A registry that has been initialized, with both verifiers authorized.
 *
 * Verifier authorization is part of the fixture because `proveAccess` now
 * refuses an unknown verifier: without it, every access test would fail for a
 * reason unrelated to what it is testing.
 */
const registry = (): TrienSimulator => {
  const sim = new TrienSimulator(operator);
  sim.initialize(operator);
  sim.authorizeVerifier(operator, NEWSROOM);
  sim.authorizeVerifier(operator, CLINIC);
  return sim;
};

/** A registry with the given credentials registered, in order. */
const registryWith = (...credentials: Uint8Array[]): TrienSimulator => {
  const sim = registry();
  for (const commitment of credentials) {
    sim.register(operator, commitment);
  }
  return sim;
};

describe('setup', () => {
  it('binds the registry to the operator commitment and nothing else', () => {
    const sim = new TrienSimulator(operator);
    sim.initialize(operator);

    // The chain stores a hash of the operator's secret, not the secret and not
    // any identity derived from it.
    expect(sim.ledger.admin).toEqual(OPERATOR_COMMITMENT);
    expect(sim.ledger.admin).not.toEqual(operator.secret);
    expect(sim.ledger.epoch).toBe(0n);
    expect(sim.ledger.accessCount).toBe(0n);
    expect(sim.ledger.issued).toBe(0n);
    expect(sim.ledger.revocations).toBe(0n);
    expect(sim.ledger.paused).toBe(false);
    expect(sim.ledger.nullifiers.isEmpty()).toBe(true);
    expect(sim.ledger.verifiers.isEmpty()).toBe(true);
  });

  it('derives the operator identity in its own hash domain', () => {
    const sim = new TrienSimulator(operator);
    sim.initialize(operator);

    // A member credential commitment and the operator commitment over the same
    // secret are different values, so holding one can never be read as holding
    // the other.
    const asCredential = pureCircuits.commitmentOf(operator.secret, MEMBER, FAR_FUTURE);
    expect(sim.ledger.admin).not.toEqual(asCredential);
    expect(sim.ledger.admin).toEqual(pureCircuits.adminCommitmentOf(operator.secret));
  });

  it('refuses to re-initialize an existing registry', () => {
    const sim = new TrienSimulator(operator);
    sim.initialize(operator);

    expect(() => sim.initialize(mallory.state)).toThrow(/already initialized/);
    expect(sim.ledger.admin).toEqual(OPERATOR_COMMITMENT);
  });

  it('refuses to initialize a registry with any other key', () => {
    const sim = new TrienSimulator(operator);
    sim.initialize(mallory.state);

    // `initialize` binds whoever runs it — that is why deployment is two
    // transactions and the operator proof is the second one.
    expect(sim.ledger.admin).toEqual(pureCircuits.adminCommitmentOf(mallory.state.secret));
    expect(sim.ledger.admin).not.toEqual(OPERATOR_COMMITMENT);
  });
});

describe('registration', () => {
  it('lets only the operator add members', () => {
    const sim = registry();

    expect(() => sim.register(mallory.state, mallory.commitment)).toThrow(/not the operator/);
    expect(sim.ledger.members.firstFree()).toBe(0n);
    expect(sim.ledger.issued).toBe(0n);
  });

  it('publishes a commitment that reveals nothing about the member', () => {
    const sim = registryWith(alice.commitment);

    // The leaf is present, and it is a hash: it is not the secret, and it is
    // not derivable back to one. Two different members are indistinguishable to
    // an observer beyond "there are two of them".
    expect(sim.ledger.members.firstFree()).toBe(1n);
    expect(sim.ledger.members.findPathForLeaf(alice.commitment)).toBeDefined();
    expect(alice.commitment).not.toEqual(alice.state.secret);
    expect(alice.commitment).not.toEqual(bob.commitment);
  });

  it('counts each issued credential', () => {
    const sim = registryWith(alice.commitment, bob.commitment, editor.commitment);

    expect(sim.ledger.issued).toBe(3n);
    expect(sim.ledger.members.firstFree()).toBe(3n);
  });

  it('registers a batch of four in one transaction', () => {
    const sim = registry();

    sim.registerMany(operator, [
      alice.commitment,
      bob.commitment,
      editor.commitment,
      intern.commitment,
    ]);

    expect(sim.ledger.issued).toBe(4n);
    expect(sim.ledger.members.firstFree()).toBe(4n);
    for (const credential of [alice, bob, editor, intern]) {
      expect(sim.ledger.members.findPathForLeaf(credential.commitment)).toBeDefined();
    }
  });

  it('lets only the operator register a batch', () => {
    const sim = registry();

    expect(() =>
      sim.registerMany(mallory.state, [
        alice.commitment,
        bob.commitment,
        editor.commitment,
        intern.commitment,
      ]),
    ).toThrow(/not the operator/);
    expect(sim.ledger.issued).toBe(0n);
  });

  it('binds the role and expiry into the commitment, not just the secret', () => {
    const sim = registryWith(alice.commitment);

    // The same secret under another role, or with another deadline, is a
    // different leaf. A commitment tells an observer neither.
    const otherRole = pureCircuits.commitmentOf(alice.state.secret, EDITOR, FAR_FUTURE);
    const otherExpiry = pureCircuits.commitmentOf(alice.state.secret, MEMBER, YEAR_2033);
    expect(alice.commitment).not.toEqual(otherRole);
    expect(alice.commitment).not.toEqual(otherExpiry);
    expect(sim.ledger.members.findPathForLeaf(otherRole)).toBeUndefined();
    expect(sim.ledger.members.findPathForLeaf(otherExpiry)).toBeUndefined();
  });
});

describe('verifier authorization', () => {
  it('refuses a verifier the operator never authorized', () => {
    const sim = registryWith(alice.commitment);

    expect(() => sim.proveAccess(alice.state, bytes32('verifier:stranger'), MEMBER)).toThrow(
      /not authorized/,
    );
    expect(sim.ledger.accessCount).toBe(0n);
  });

  it('admits a verifier once the operator authorizes it', () => {
    const sim = registryWith(alice.commitment);
    const stranger = bytes32('verifier:stranger');

    sim.authorizeVerifier(operator, stranger);
    sim.proveAccess(alice.state, stranger, MEMBER);

    expect(sim.ledger.accessCount).toBe(1n);
    expect(sim.ledger.verifiers.member(stranger)).toBe(true);
  });

  it('refuses to authorize the same verifier twice', () => {
    const sim = registryWith(alice.commitment);

    expect(() => sim.authorizeVerifier(operator, NEWSROOM)).toThrow(/already authorized/);
    expect(sim.ledger.verifiers.size()).toBe(2n);
  });

  it('lets only the operator authorize a verifier', () => {
    const sim = registryWith(alice.commitment);

    expect(() => sim.authorizeVerifier(mallory.state, bytes32('verifier:stranger'))).toThrow(
      /not the operator/,
    );
    expect(sim.ledger.verifiers.size()).toBe(2n);
  });

  it('stops a withdrawn verifier on the next proof, without an epoch bump', () => {
    const sim = registryWith(alice.commitment, bob.commitment);
    sim.proveAccess(alice.state, NEWSROOM, MEMBER);

    sim.revokeVerifier(operator, NEWSROOM);

    // The credential is still valid — the epoch did not move — but the gate is
    // closed. Members keep whatever else they hold.
    expect(sim.ledger.epoch).toBe(0n);
    expect(() => sim.proveAccess(bob.state, NEWSROOM, MEMBER)).toThrow(/not authorized/);
    expect(sim.ledger.verifiers.member(NEWSROOM)).toBe(false);

    // The other gate is untouched, so withdrawing one verifier does not cost
    // anybody their access elsewhere.
    sim.proveAccess(bob.state, CLINIC, MEMBER);
    expect(sim.ledger.accessCount).toBe(2n);
  });

  it('refuses to withdraw a verifier that was never authorized', () => {
    const sim = registryWith(alice.commitment);

    expect(() => sim.revokeVerifier(operator, bytes32('verifier:stranger'))).toThrow(
      /not authorized/,
    );
  });

  it('lets only the operator withdraw a verifier', () => {
    const sim = registryWith(alice.commitment);

    expect(() => sim.revokeVerifier(mallory.state, NEWSROOM)).toThrow(/not the operator/);
    expect(sim.ledger.verifiers.member(NEWSROOM)).toBe(true);
  });

  it('counts accesses per verifier and keeps the two counts apart', () => {
    const sim = registryWith(alice.commitment, bob.commitment);

    sim.proveAccess(alice.state, NEWSROOM, MEMBER);
    sim.proveAccess(bob.state, NEWSROOM, MEMBER);
    sim.proveAccess(alice.state, CLINIC, MEMBER);

    expect(sim.ledger.verifierAccesses.lookup(NEWSROOM)).toBe(2n);
    expect(sim.ledger.verifierAccesses.lookup(CLINIC)).toBe(1n);
    expect(sim.ledger.accessCount).toBe(3n);
  });

  it('seeds an authorized verifier at zero accesses', () => {
    const sim = registry();

    expect(sim.ledger.verifierAccesses.size()).toBe(2n);
    expect(sim.ledger.verifierAccesses.lookup(NEWSROOM)).toBe(0n);
  });
});

describe('proving access', () => {
  it('admits a registered member and publishes only a nullifier', () => {
    const sim = registryWith(alice.commitment, bob.commitment);

    sim.proveAccess(alice.state, NEWSROOM, MEMBER);

    expect(sim.ledger.accessCount).toBe(1n);
    expect(sim.ledger.nullifiers.size()).toBe(1n);

    // The one value the chain gained is the nullifier. It matches Alice only if
    // you already hold Alice's secret, which no observer does.
    const expected = pureCircuits.nullifierOf(alice.state.secret, NEWSROOM, 0n);
    expect(sim.ledger.nullifiers.member(expected)).toBe(true);
    expect(
      sim.ledger.nullifiers.member(pureCircuits.nullifierOf(bob.state.secret, NEWSROOM, 0n)),
    ).toBe(false);
  });

  it('rejects a party who was never registered', () => {
    const sim = registryWith(alice.commitment);

    expect(() => sim.proveAccess(mallory.state, NEWSROOM, MEMBER)).toThrow(
      /not registered, was revoked/,
    );
    expect(sim.ledger.accessCount).toBe(0n);
  });

  it('rejects a second use of the same credential at the same verifier', () => {
    const sim = registryWith(alice.commitment);
    sim.proveAccess(alice.state, NEWSROOM, MEMBER);

    expect(() => sim.proveAccess(alice.state, NEWSROOM, MEMBER)).toThrow(/already used/);
    expect(sim.ledger.accessCount).toBe(1n);
  });

  it('produces unlinkable nullifiers for one member across two verifiers', () => {
    const sim = registryWith(alice.commitment);

    sim.proveAccess(alice.state, NEWSROOM, MEMBER);
    sim.proveAccess(alice.state, CLINIC, MEMBER);

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

    sim.proveAccess(alice.state, NEWSROOM, MEMBER);
    sim.proveAccess(bob.state, NEWSROOM, MEMBER);

    expect(sim.ledger.accessCount).toBe(2n);
    expect(sim.ledger.nullifiers.size()).toBe(2n);
  });
});

describe('roles', () => {
  it('admits a credential at the gate that asks for its role', () => {
    const sim = registryWith(editor.commitment);

    sim.proveAccess(editor.state, NEWSROOM, EDITOR);

    expect(sim.ledger.accessCount).toBe(1n);
  });

  it('refuses a member credential at a gate that asks for another role', () => {
    const sim = registryWith(alice.commitment);

    expect(() => sim.proveAccess(alice.state, NEWSROOM, EDITOR)).toThrow(
      /role does not match the role required/,
    );
    expect(sim.ledger.accessCount).toBe(0n);
  });

  it('refuses an editor credential at a gate that asks for member', () => {
    const sim = registryWith(editor.commitment);

    expect(() => sim.proveAccess(editor.state, NEWSROOM, MEMBER)).toThrow(
      /role does not match the role required/,
    );
  });

  it('issues one access per verifier per epoch even when one person holds two roles', () => {
    const sim = registry();

    // The same secret, issued twice under two different roles: two leaves, two
    // commitments, no way for an observer to connect them.
    const asMember = holder('alice', MEMBER, FAR_FUTURE);
    const asEditor = holder('alice', EDITOR, FAR_FUTURE);
    sim.register(operator, asMember.commitment);
    sim.register(operator, asEditor.commitment);

    expect(asMember.commitment).not.toEqual(asEditor.commitment);

    sim.proveAccess(asMember.state, NEWSROOM, MEMBER);

    // The second presentation is refused, and that refusal is the privacy
    // property: uniqueness is scoped to (member, verifier, epoch) and
    // deliberately not to role, so a verifier cannot learn that its visitor
    // holds two credentials — it only ever sees one person, once.
    expect(() => sim.proveAccess(asEditor.state, NEWSROOM, EDITOR)).toThrow(
      /already used at this verifier/,
    );
    expect(sim.ledger.accessCount).toBe(1n);
    expect(sim.ledger.nullifiers.size()).toBe(1n);

    // At a different verifier the second role works, still with no way to link
    // the two presentations.
    sim.proveAccess(asEditor.state, CLINIC, EDITOR);
    expect(sim.ledger.accessCount).toBe(2n);
    expect(sim.ledger.nullifiers.size()).toBe(2n);
  });

  it('does not put the role on the ledger', () => {
    const sim = registryWith(alice.commitment, editor.commitment);
    sim.proveAccess(editor.state, NEWSROOM, EDITOR);

    const published = [...sim.ledger.nullifiers];
    for (const value of published) {
      expect(value).not.toEqual(MEMBER);
      expect(value).not.toEqual(EDITOR);
    }
    expect(Object.keys(sim.ledger)).not.toContain('roles');
  });
});

describe('expiry', () => {
  it('admits a credential before its deadline', () => {
    const sim = registryWith(intern.commitment);
    sim.setTime(Number(YEAR_2033) - 86_400);

    sim.proveAccess(intern.state, NEWSROOM, MEMBER);

    expect(sim.ledger.accessCount).toBe(1n);
  });

  it('refuses the same credential after its deadline', () => {
    const sim = registryWith(intern.commitment, alice.commitment);

    sim.setTime(Number(YEAR_2033) + 1);

    // The member is untouched and their leaf is still in the tree — there is
    // still a Merkle path to build. What failed is the block-time check, against
    // the chain's clock rather than anything the caller supplied.
    expect(sim.ledger.members.findPathForLeaf(intern.commitment)).toBeDefined();
    expect(() => sim.proveAccess(intern.state, NEWSROOM, MEMBER)).toThrow(
      /credential has expired/,
    );

    // And the refusal costs the registry nothing: no nullifier, no access.
    expect(sim.ledger.accessCount).toBe(0n);
    expect(sim.ledger.nullifiers.size()).toBe(0n);
  });

  it('leaves a long-lived credential working at the same clock', () => {
    const sim = registryWith(alice.commitment, intern.commitment);
    sim.setTime(Number(YEAR_2033) + 1);

    sim.proveAccess(alice.state, NEWSROOM, MEMBER);

    expect(sim.ledger.accessCount).toBe(1n);
  });

  it('does not rewrite the ledger when the clock moves', () => {
    const sim = registryWith(alice.commitment);
    const before = sim.ledger.epoch;

    sim.setTime(Number(YEAR_2033) + 1);

    expect(sim.ledger.epoch).toBe(before);
    expect(sim.ledger.issued).toBe(1n);
  });
});

describe('revocation', () => {
  it('locks out the revoked member immediately', () => {
    const sim = registryWith(alice.commitment, bob.commitment);

    sim.revoke(operator, 0n); // Alice is leaf 0.

    expect(sim.ledger.epoch).toBe(1n);
    expect(() => sim.proveAccess(alice.state, NEWSROOM, MEMBER)).toThrow(
      /not registered, was revoked/,
    );
    expect(sim.ledger.accessCount).toBe(0n);
  });

  it('leaves every other member working', () => {
    const sim = registryWith(alice.commitment, bob.commitment);

    sim.revoke(operator, 0n);
    sim.proveAccess(bob.state, NEWSROOM, MEMBER);

    expect(sim.ledger.accessCount).toBe(1n);
  });

  it('voids nullifiers issued before the revocation, so proofs cannot be replayed', () => {
    const sim = registryWith(alice.commitment, bob.commitment);
    sim.proveAccess(bob.state, NEWSROOM, MEMBER);

    const beforeRevocation = pureCircuits.nullifierOf(bob.state.secret, NEWSROOM, 0n);
    sim.revoke(operator, 0n);
    const afterRevocation = pureCircuits.nullifierOf(bob.state.secret, NEWSROOM, 1n);

    // The epoch bump changes the nullifier, so the spent one no longer blocks
    // Bob — and equally, a proof built against epoch 0 no longer validates.
    expect(beforeRevocation).not.toEqual(afterRevocation);
    expect(sim.ledger.nullifiers.member(beforeRevocation)).toBe(true);
    expect(sim.ledger.nullifiers.member(afterRevocation)).toBe(false);

    sim.proveAccess(bob.state, NEWSROOM, MEMBER);
    expect(sim.ledger.accessCount).toBe(2n);
  });

  it('lets only the operator revoke', () => {
    const sim = registryWith(alice.commitment);

    expect(() => sim.revoke(mallory.state, 0n)).toThrow(/not the operator/);
    expect(sim.ledger.epoch).toBe(0n);
  });

  it('counts revocations alongside issued credentials', () => {
    const sim = registryWith(alice.commitment, bob.commitment, editor.commitment);

    sim.revoke(operator, 0n);
    sim.revoke(operator, 1n);

    expect(sim.ledger.revocations).toBe(2n);
    expect(sim.ledger.issued).toBe(3n);
    // One credential left standing, and the counters say so without naming it.
    expect(sim.ledger.issued - sim.ledger.revocations).toBe(1n);
  });
});

describe('what an observer can learn', () => {
  it('sees a count and a set of opaque hashes, and no identities', () => {
    const sim = registryWith(alice.commitment, bob.commitment);
    sim.proveAccess(alice.state, NEWSROOM, MEMBER);
    sim.proveAccess(bob.state, CLINIC, MEMBER);

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

  it('exposes exactly the fields the README lists, no more', () => {
    const sim = registryWith(alice.commitment);
    sim.proveAccess(alice.state, NEWSROOM, MEMBER);

    expect(Object.keys(sim.ledger).sort()).toEqual([
      'accessCount',
      'admin',
      'epoch',
      'issued',
      'members',
      'nullifiers',
      'paused',
      'pendingAdmin',
      'revocations',
      'verifierAccesses',
      'verifiers',
    ]);

    // Nothing in the ledger is a secret, a role, an expiry, or a Merkle path.
    const serialised = JSON.stringify(sim.ledger, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    expect(serialised).not.toContain(Buffer.from(alice.state.secret).toString('hex'));
    expect(serialised).not.toContain(Buffer.from(MEMBER).toString('hex'));
  });
});
