<div align="center">

<img src="docs/media/1.png" alt="Triện — anonymous, revocable allowlist access on Midnight" width="100%" />

&nbsp;

[![Live demo](https://img.shields.io/badge/●_live-midnight--rust--psi.vercel.app-34d399)](https://midnight-rust-psi.vercel.app)
![Preprod: contract](https://img.shields.io/badge/📜_Preprod-25b6851f…-34d399)
[![CI](https://github.com/Venkat5599/midnightzks/actions/workflows/ci.yml/badge.svg)](https://github.com/Venkat5599/midnightzks/actions/workflows/ci.yml)
![Tests](https://img.shields.io/badge/tests-52%20passing-3fb950)
![Circuits](https://img.shields.io/badge/circuits-11-4f46e5)
![Stack](https://img.shields.io/badge/React%2018%20·%20Vite%206%20·%20TypeScript-1f1f23)
![Compact](https://img.shields.io/badge/Compact%200.23-4f46e5)
![Midnight](https://img.shields.io/badge/Midnight-Preprod-34d399)
[![X (Twitter)](https://img.shields.io/badge/X-@trien__midnight-1DA1F2)](https://x.com/trien_midnight)
[![License: MIT](https://img.shields.io/badge/license-MIT-34d399.svg)](LICENSE)

### Prove you're on the list. Nobody learns who you are.

Triện is an on-chain allowlist where membership is a zero-knowledge claim. An operator issues commitments; members prove they are on the list without revealing which member they are; a credential carries a role and a deadline that the circuit enforces without ever publishing them; revocation locks a member out immediately — and kills the proofs they already hold. Built in Compact on Midnight Preprod, the one chain where the allowlist can sit on chain while membership stays private.

### ▶ Live now — the instrument runs at **[midnight-rust-psi.vercel.app](https://midnight-rust-psi.vercel.app)**

**[ Live dApp ↗ ](https://midnight-rust-psi.vercel.app)** · **[ Demo video ↗ ](https://youtu.be/5gKaCGEMLYc)** · **[ X ↗ ](https://x.com/trien_midnight)** · **[ How it works ↓ ](#how-it-works)** · **[ Run it locally ↓ ](#run-it-locally)**

Built for the Midnight challenge — Private Allowlist Access (Level 3). MIT licensed.

</div>

---

## Table of contents

- [See it in one command](#-see-it-in-one-command)
- [The problem](#the-problem)
- [How it works](#how-it-works)
  - [Public ledger state](#public-ledger-state)
  - [1 · Register — the operator issues a commitment](#1--register--the-operator-issues-a-commitment)
  - [2 · Roles and deadlines live inside the commitment](#2--roles-and-deadlines-live-inside-the-commitment)
  - [3 · Prove — membership, role and deadline, at one named gate](#3--prove--membership-role-and-deadline-at-one-named-gate)
  - [4 · Verifiers are named, and can be withdrawn](#4--verifiers-are-named-and-can-be-withdrawn)
  - [5 · Revoke — immediate, not eventual](#5--revoke--immediate-not-eventual)
  - [6 · Stay unlinkable — the nullifier](#6--stay-unlinkable--the-nullifier)
  - [7 · Freeze, and hand over — administration](#7--freeze-and-hand-over--administration)
- [Circuit reference](#circuit-reference)
- [Architecture](#architecture)
  - [Transaction flow](#transaction-flow)
  - [Component by component](#component-by-component)
- [Engineering decisions — the hard problems](#engineering-decisions--the-hard-problems)
- [Build checklist](#build-checklist)
- [What's real vs pending — the honesty table](#whats-real-vs-pending--the-honesty-table)
- [Tests](#tests)
- [Run it locally](#run-it-locally)
- [Deploy](#deploy)
- [Project layout](#project-layout)
- [Tech stack](#tech-stack)
- [Roadmap](#roadmap)
- [License](#license)

---

## ▶ See it in one command

The v1 registry is live on Midnight Preprod. The public indexer returns its state right now:

```bash
$ curl -s -X POST https://indexer.preprod.midnight.network/api/v4/graphql \
    -H 'content-type: application/json' \
    -d '{"query":"{ contractAction(address: \"25b6851f398827f7d84729e63d1cb96ae271af2c63af51d725720a30a5aa6414\") { address transaction { hash } state } }"}'
{"data":{"contractAction":{"address":"25b6851f398827f7d84729e63d1cb96ae271af2c63af51d725720a30a5aa6414","transaction":{"hash":"905a0e9959473c47583279cc3544ea27e2f0b302dcbc06070747fdb9cb919713"},"state":"6d69646e696768743a636f6e74726163742d73746174655b76365d3ac4000c04020a00084008040404010408080104…"}}}
```

The state blob carries the ledger: a Merkle tree of member commitments, a set of spent nullifiers, an epoch counter and an access counter. Zero identities.

The eleven circuits compile from source, and the suite that exercises them passes:

```bash
$ npm test

 RUN  v2.1.9 /home/arch/midnightzks/contract

 ✓ src/test/trien.test.ts (52 tests) 10780ms

 Test Files  1 passed (1)
      Tests  52 passed (52)
```

---

## The problem

Token-gated apps today work by asking you to connect a wallet, then reading everything in it. The app learns your whole balance history and every other app you have touched. For a gate, it needs exactly one bit — **are you allowed in, or not** — and it takes a biography instead.

- **Every wallet leaks more than the gate asks for** — balance, history, other memberships, all readable
- **Allowlists are identity lists** — membership itself is the sensitive fact, and it is published to prove it
- **Correlation across sites** — the same person at two gated sites is trivially linkable
- **A gate cannot ask a question** — it can check "on the list", not "on the list *as an editor*, until June"
- **Revocation is weak** — a member who was removed still holds credentials that keep working
- **The gate itself is unaccountable** — anyone can stand up a verifier id and quietly collect proofs

Existing approaches hide the *transaction* but not the *membership*. Triện hides the membership: the list lives on chain as opaque commitments, an access is granted by a zero-knowledge proof rather than by showing a wallet, a credential's role and deadline are enforced by the circuit without being revealed, and the operator decides which gates are allowed to ask at all.

---

## How it works

Everything in the `ledger` declarations of
[`contract/src/trien.compact`](contract/src/trien.compact) is on chain and readable by anyone. Everything declared `witness` never leaves the holder's machine.

### Public ledger state

| Field | Type | What it is | What it leaks |
| --- | --- | --- | --- |
| `members` | `HistoricMerkleTree<10, Bytes<32>>` | Commitments of approved members | How many members exist. Each leaf is `H("gk:commit", secret, role, expiry)` — identifies nobody, and reveals neither role nor deadline |
| `nullifiers` | `Set<Bytes<32>>` | Spent access tokens | How many accesses happened. Each is `H("gk:null", secret, verifier, epoch)` — an opaque hash |
| `verifiers` | `Set<Bytes<32>>` | Gates the operator has authorized | Which verifier ids are admitted. Not their traffic, not their users |
| `verifierAccesses` | `Map<Bytes<32>, Uint<64>>` | Successful accesses per verifier | Per-gate usage counts. The verifier already knows its own traffic; publishing it hides nothing and lets everyone else audit the same number |
| `epoch` | `Counter` | Bumped on every revocation | How many revocations have occurred |
| `accessCount` | `Counter` | Total successful accesses | Aggregate usage, nothing per person |
| `issued` | `Counter` | Credentials issued | How many approvals were made. A batch of four counts as four |
| `revocations` | `Counter` | Revocations performed | How many were taken away. `issued − revocations` is an upper bound on the live set |
| `paused` | `Boolean` | Whether access is frozen | That an operator has stopped admissions |
| `pendingAdmin` | `Bytes<32>` | A proposed successor, if any | That a handover is in progress. Not who it goes to |
| `admin` | `Bytes<32>` | Commitment of the operator | That an operator exists, not who they are |

### 1 · Register — the operator issues a commitment

The operator adds a member by inserting their commitment into the tree. The chain learns only that the approved set grew by one:

```compact
export circuit register(commitment: Bytes<32>): [] {
  assertOperator();
  members.insert(disclose(commitment));
  issued.increment(1);
}
```

`insert`, not `insertHash` — the leaf stored is `leafHash(commitment)`, which is what `merkleTreePathRoot` recomputes when `proveAccess` validates a path. Storing the commitment directly would make every membership proof fail against the root (see [Engineering decisions](#engineering-decisions--the-hard-problems)).

`registerMany` does the same for four commitments in one transaction, which is the shape an allowlist actually grows in — a cohort, not a trickle:

```compact
export circuit registerMany(commitments: Vector<4, Bytes<32>>): [] {
  assertOperator();
  for (const i of 0..4) {
    members.insert(disclose(commitments[i]));
  }
  issued.increment(4);
}
```

### 2 · Roles and deadlines live inside the commitment

A commitment is no longer `H(secret)`:

```compact
export pure circuit commitmentOf(
  secret: Bytes<32>,
  role: Bytes<32>,
  expiry: Uint<64>
): Bytes<32> {
  return persistentHash<Credential>(Credential {
    domain: pad(32, "gk:commit"),
    secret: secret,
    role: role,
    expiry: expiry,
  });
}
```

Binding all three is what lets the circuit enforce a role and a deadline while the tree learns neither. A holder can only ever prove the exact `(secret, role, expiry)` triple the operator was handed at issuance: present a member credential at an editor gate and the proof fails; present an expired one and the proof fails. The same secret can be issued under several roles — those are separate leaves, and nothing on chain connects them.

The operator's own identity is hashed in a separate domain, `H("gk:admin", secret)`, so holding a member credential for any role can never be mistaken for holding the operator key.

### 3 · Prove — membership, role and deadline, at one named gate

```compact
export circuit proveAccess(verifierId: Bytes<32>, requiredRole: Bytes<32>): [] {
  assert(!paused, "registry is paused");

  const secret = memberSecret();
  const role = memberRole();
  const expiry = memberExpiry();
  const path = memberPath();

  assert(verifiers.member(disclose(verifierId)), "verifier is not authorized");
  assert(role == requiredRole, "credential role does not match the role required here");
  assert(blockTimeLt(disclose(expiry)), "credential has expired");
  assert(path.leaf == commitmentOf(secret, role, expiry), "path does not match caller's credential");
  assert(members.checkRoot(disclose(merkleTreePathRoot<10, Bytes<32>>(path))),
         "stale or unknown Merkle root - membership revoked or never granted");

  const nul = disclose(nullifierOf(secret, verifierId, epoch.read()));
  assert(!nullifiers.member(nul), "credential already used at this verifier");

  nullifiers.insert(nul);
  verifierAccesses.insert(disclose(verifierId),
    (verifierAccesses.lookup(disclose(verifierId)) + 1) as Uint<64>);
  accessCount.increment(1);
}
```

The circuit discloses the Merkle **root** — already public ledger state, and a root does not say which leaf produced it — the **deadline** it checked, and the **nullifier**. It never discloses the secret, the commitment, the role, or the path, so an access cannot be traced back to a registration.

Holding **reveal what happened** in the dApp traces the proof back to the leaf it came from — the view the chain never gets:

<img src="docs/media/2.png" alt="the dApp — revealed: the proof traced back to its leaf" width="100%" />

### 4 · Verifiers are named, and can be withdrawn

A verifier id is any 32-byte label a site chooses for itself. Until the operator authorizes it, `proveAccess` refuses it outright — an identifier nobody blessed cannot collect proofs at all, which closes the hole where any site can stand up a gate and harvest whatever members hand it.

```compact
export circuit authorizeVerifier(verifierId: Bytes<32>): [] {
  assertOperator();
  assert(!verifiers.member(disclose(verifierId)), "verifier already authorized");
  verifiers.insert(disclose(verifierId));
  verifierAccesses.insert(disclose(verifierId), default<Uint<64>>);
}

export circuit revokeVerifier(verifierId: Bytes<32>): [] {
  assertOperator();
  assert(verifiers.member(disclose(verifierId)), "verifier is not authorized");
  verifiers.remove(disclose(verifierId));
}
```

Withdrawing a verifier is deliberately *targeted*: it stops that gate on its next proof without bumping the epoch, so revoking one bad gate does not cost every honest member their outstanding credential.

### 5 · Revoke — immediate, not eventual

Clearing a leaf is not enough: a revoked member already holds a Merkle path to an *older* root, and a naive contract would accept a proof against it. `revoke` therefore does four things:

1. zeroes the leaf, removing the member from the tree;
2. calls `resetHistory()`, invalidating every previously-valid root, so stale paths stop verifying;
3. bumps `epoch`, which changes every member's nullifier, so a proof built before the revocation cannot be replayed after it;
4. counts the revocation.

Non-revoked members are unaffected — they rebuild their path from the current public tree, with no help from the operator.

### 6 · Stay unlinkable — the nullifier

The nullifier is hashed from the secret plus the verifier id plus the current epoch:

```compact
export pure circuit nullifierOf(
  secret: Bytes<32>,
  verifierId: Bytes<32>,
  currentEpoch: Uint<64>
): Bytes<32> {
  return persistentHash<NullifierInput>(NullifierInput {
    domain: pad(32, "gk:null"),
    secret: secret,
    verifierId: verifierId,
    epoch: currentEpoch
  });
}
```

Scoping it to the **verifier** means two different sites cannot correlate the same person across both — colluding verifiers receive two unrelated hashes. Scoping it to the **epoch** means revocation kills proofs that were already outstanding, not only future ones.

It is deliberately **not** scoped to the role: a person holding two roles gets one access per verifier per epoch, so a verifier cannot even learn that its visitor holds more than one credential.

### 7 · Freeze, and hand over — administration

Two operations that a registry living on chain for years will need, and that a contract nobody can stop does not have:

```compact
export circuit pause(): [] {          // access stops …
  assertOperator();
  assert(!paused, "registry is already paused");
  paused = true;
}

export circuit proposeAdmin(commitment: Bytes<32>): [] {   // … two-sided handover
  assertOperator();
  pendingAdmin = disclose(commitment);
}

export circuit acceptAdmin(): [] {
  assert(pendingAdmin != default<Bytes<32>>, "no operator handover proposed");
  assert(adminCommitmentOf(memberSecret()) == pendingAdmin, "caller is not the proposed operator");
  admin = disclose(pendingAdmin);
  pendingAdmin = default<Bytes<32>>;
}
```

`pause` stops admissions and nothing else — registration, verifier changes and handover keep working while access is frozen, so a freeze does not also freeze the response to whatever caused it. Handover is two-sided and public: the outgoing operator proposes a commitment, and the successor takes over by proving knowledge of the secret behind it. No secret is ever transmitted, a typo cannot lock the registry out of its own administration, and the registry cannot be handed to an address nobody controls (an empty commitment can be proposed but never accepted).

---
