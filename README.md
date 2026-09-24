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

## Circuit reference

| Circuit | Who | What it asserts | What it changes |
| --- | --- | --- | --- |
| `initialize` | anyone, once | `admin` is still empty | Binds `H("gk:admin", secret)` as the operator |
| `register` | operator | caller holds the operator secret | Inserts one leaf, `issued += 1` |
| `registerMany` | operator | same | Inserts four leaves, `issued += 4` |
| `revoke` | operator | same | Zeroes a leaf, resets tree history, `epoch += 1`, `revocations += 1` |
| `authorizeVerifier` | operator | verifier is not already authorized | Adds a verifier, seeds its counter at 0 |
| `revokeVerifier` | operator | verifier is authorized | Removes it. Effective on the next proof |
| `pause` | operator | not already paused | `paused = true` |
| `unpause` | operator | currently paused | `paused = false` |
| `proposeAdmin` | operator | caller holds the operator secret | Records a proposed successor |
| `acceptAdmin` | the proposed successor | proposal exists and matches the caller's operator commitment | Transfers `admin`, clears the proposal |
| `proveAccess` | a member | not paused, verifier authorized, role matches, not expired, leaf in tree, current root, nullifier unspent | Spends a nullifier, `verifierAccesses[v] += 1`, `accessCount += 1` |

Pure helpers, callable without a wallet: `adminCommitmentOf(secret)`, `commitmentOf(secret, role, expiry)`, `nullifierOf(secret, verifierId, epoch)`.

---

## Architecture

```
Lace wallet ──▶ Triện dApp ──▶ proof server (local, :6300)
   │                │                │
   │                └──▶ Midnight indexer / node (Preprod)
   │                            │
   │                            └──▶ Triện registry contract
```

Proving happens locally on purpose: a proof server is handed the witness, and sending that to someone else's host would give away the secret this design exists to protect.

### Transaction flow

```bash
1. Operator deploys        → two txs: circuits + empty ledger, then initialize binds the admin commitment
2. Operator authorizes     → authorizeVerifier(newsroom), authorizeVerifier(clinic)
3. Operator registers      → register(commitment): proves operator identity, inserts a leaf
4. Member proves           → witness (secret + role + deadline + path) stays local; tx publishes root, deadline, nullifier
5. Observer reads          → ledger shows counts and opaque nullifiers, never identities
6. Operator revokes        → revoke(index): zeroes leaf, resets history, bumps epoch
7. Member re-proves        → stale path rejected, old nullifier void — revocation is retroactive
8. Operator withdraws gate → revokeVerifier(newsroom): that gate stops, everyone else keeps working
9. Operator freezes        → pause(): access stops, administration continues
10. Operator hands over    → proposeAdmin(commitment), then acceptAdmin() from the successor
```

### Component by component

| Component | Technology | Responsibility |
|---|---|---|
| Triện contract | Compact 0.23 | Members tree, nullifier set, verifier registry, epoch and counters, pause, handover — 11 circuits |
| Witness driver | TypeScript (`@trien/contract`) | `memberSecret()` / `memberRole()` / `memberExpiry()` / `memberPath()` — never leave the machine |
| Proof server | `midnightnetwork/proof-server` | Local proving; witness never sent to a host |
| dApp | React 18, Vite 6, Lace connector | Operator pane (all 10 administrative circuits), gate pane (role + deadline + named verifier), a wallet-free ledger panel, hold-to-reveal |
| Artifact sync | `frontend/scripts/sync-zk.mjs` | Copies the compiled circuits into `public/zk/` so the browser never proves against a circuit the contract no longer has |
| Deploy tooling | `@midnight-ntwrk/wallet` 5.0.0 · 1.2.0 (preprod run) | Seed → unshielded address → tDust → deploy; initializes, and authorizes the gates named in `TRIEN_VERIFIERS` |
| CI | GitHub Actions (Node 22) | Compile from source + typecheck + tests + frontend build |

---

## Engineering decisions — the hard problems

**1. `register` must store `leafHash(commitment)`, not the commitment.** The first version used `members.insertHash(commitment)`, which writes the commitment into the tree verbatim. But `proveAccess` validates a path with `merkleTreePathRoot()`, which applies `leafHash()` to the leaf before folding upward. The two disagreed, so `checkRoot()` rejected every honestly constructed proof: the contract compiled, would have deployed, and could never have admitted anybody. Switching to `members.insert()` fixed it. This class of mistake is invisible until something actually tries to prove membership — which is why the test suite exists.

**2. Revocation is a three-part transaction, not a leaf clear.** Zeroing a leaf leaves a revoked member holding a valid path to an older root. `revoke` also calls `resetHistory()` to invalidate every previously-valid root and bumps the epoch to change every member's nullifier. Stale paths stop verifying; proofs built before the revocation cannot be replayed after it.

**3. Withdrawing one verifier must not cost every member their credential.** The obvious implementation of "this gate is bad" is a registry-wide epoch bump, which voids every outstanding proof for every gate — a denial of service dressed as a security response. Verifier authorization is therefore checked on its own, so `revokeVerifier` is targeted and the epoch is reserved for what it is actually for: revoking a member.

**4. `+ 1` widens a `Uint<64>` past `Uint<64>`, and Compact is right to complain.** `verifierAccesses.lookup(v) + 1` has type `Uint<0..2^64+1>`, which the map's value type rejects; the literal `0` in a ternary had the same problem. The fix is an explicit narrowing cast — `(…) as Uint<64>` — and it is not decorative: the bound the compiler infers is genuinely wider than the type the ledger stores, and it will not quietly narrow it for you.

**5. A helper that reads the ledger is not `pure`.** `assertOperator()` began as `pure circuit`, which reads well and does not compile: it compares against `admin`, and reading a ledger field makes a circuit impure. Compact caught it at compile time rather than letting five call sites each repeat the same check.

**6. There is no mutable local, and no `let`.** Compact reserves `let` for future use, and reassigning a `const` local fails with `expected left-hand side of = to have an ADT type`. So every read-modify-write has to be expressed as a single expression. The per-verifier counter is seeded to zero when a verifier is authorized, precisely so that the read in `proveAccess` can never be a missing key and the update can stay one expression.

**7. This laptop cannot generate proving keys, and that is a hardware fact, not a project one.** `compactc` parses and type-checks a contract anywhere, but the key generator (`zkir`) is built for CPUs with ADX and dies with SIGILL (`exit status -4`) on an AMD A6-9225 — the core dump lands after the compiler has already wiped the output directory. Two consequences, both in this repo: compiling is done on a machine that has the instruction set (CI, or the box the artifacts were produced on), and the committed `src/managed/trien/` tree is the compiler's output rather than anybody's hand-edit. The tests run fine locally, because running a circuit needs the interpreter, not the key generator.

**8. The nullifier is the minimum public leak — and the deadline is a deliberate second one.** One credential, one access per verifier per epoch. Uniqueness necessarily means publishing something stable per (member, verifier, epoch). The deadline is public for a different reason: `blockTimeLt` discloses the bound it is given, and a check against the chain's clock cannot be done against a secret the chain cannot see. The README and the dApp both state both limits plainly.

**9. The proof server runs locally.** A proof server is handed the witness — the secret, the role, the deadline and the Merkle path. Pointing the dApp at a hosted server would defeat the design. The dApp defaults to localhost proving and only falls back to a configured server after a wallet reports one.

**10. Stale ZK artifacts fail in the wallet, with an error that never says "your artifacts are stale".** The compiler writes to `contract/src/managed/trien/`; the browser fetches from `frontend/public/zk/`. When those disagree, proving fails at the point of use with a message about a missing key. Copying them is therefore a script (`npm run sync:zk`) rather than a habit — and it skips the multi-megabyte proving keys by default, because the hosted dApp proves inside the connected wallet and only a local proof server needs them (`--with-prover`).

**11. Funding preprod is two steps, and only one is scriptable.** The faucet ([midnight-tmnight-preprod.nethermind.dev](https://midnight-tmnight-preprod.nethermind.dev)) dispenses tNight to the *unshielded* Night address and rejects the shielded form (`mn_shield-addr_test1…`). Deriving it needs `signingKeyFromBip340()` first — `signatureVerifyingKey()` refuses raw HD bytes. Then tNight must be *delegated* to generate the tDust that pays fees, and delegation has no headless API in `@midnight-ntwrk/wallet` 5.0.0. The deploy seed's 24-word mnemonic is handed to Lace for **Generate tDust**, after which the deploy completes. The endpoints that used to work compound the pain: `testnet-02` no longer resolves, the proof-server image dropped `--network preview` (`error: unexpected argument '--network' found`), and the preprod indexer's GraphQL lives at `/api/v4/graphql` — a wrong endpoint fails silently, because the wallet builds and prints a correct address that simply never syncs.

**12. Syncing preprod is a memory wall, not a speed problem.** The 5.0.0 facade's sync gate walks *shielded* state over ~1.45M+ preprod blocks; on an 8G VPS it dies a few minutes in at ~19K blocks, past a 5 GB Node heap. The preprod deploy therefore runs the SDK 1.2.0 stack, whose sync gate excludes shielded state — peak ~54 MB through the same chain tip, at the cost of a ~2h first sync. Same contract, same wallet derivation, same seed.

---

## Build checklist

- [x] Contract compiles — 11 circuits via `compact compile` (CI recompiles from source on every push)
- [x] Test suite green — 52/52, run against the real Compact runtime
- [x] CI green — contract job (compile + typecheck + test) and frontend job (typecheck + build)
- [x] Contract deployed on Midnight Preprod — `25b6851f398827f7d84729e63d1cb96ae271af2c63af51d725720a30a5aa6414` (the four-circuit build), deploy tx `905a0e9959473c47583279cc3544ea27e2f0b302dcbc06070747fdb9cb919713`, verified via the public indexer
- [x] Managed artifacts committed — circuits, verifier keys and ZKIR under `src/managed/trien/`
- [x] ZK artifacts served to the browser by script — `npm run sync:zk` in `frontend/`
- [x] Live dApp — [midnight-rust-psi.vercel.app](https://midnight-rust-psi.vercel.app), redeployed on every push
- [x] Demo video — [youtu.be/5gKaCGEMLYc](https://youtu.be/5gKaCGEMLYc)
- [x] X profile — [@trien_midnight](https://x.com/trien_midnight)

---

## What's real vs pending — the honesty table

| Feature | Status | Detail |
|---|---|---|
| Contract source — 11 circuits | ✅ Real | `contract/src/trien.compact`; compiles clean with `compactc` 0.31.1 (`Compiling 11 circuits:`) |
| Four circuits + keys + ZKIR (v1) | ✅ Real | Committed under `src/managed/trien/` for the deployed instance; CI-reproducible from the v1 source |
| Eleven circuits + verifier keys + ZKIR (v2) | ✅ Real | Regenerated from the v2 source with the same compiler, committed in this tree; CI recompiles from source on every push |
| Test suite | ✅ Real | 52 tests, run against the real Compact runtime, covering every circuit and every assertion (see [Tests](#tests)) |
| Roles bound into the commitment | ✅ Real | `commitmentOf(secret, role, expiry)`; a wrong role fails the proof, verified by test |
| Deadlines enforced on chain | ✅ Real | `blockTimeLt` against the chain clock; tests move the simulator's clock past a deadline and watch the same credential stop working |
| Verifier authorization + withdrawal | ✅ Real | `authorizeVerifier` / `revokeVerifier`; unauthorized verifiers are refused, verified by test |
| Pause and two-sided handover | ✅ Real | `pause` / `unpause` / `proposeAdmin` / `acceptAdmin`, all verified by test |
| Live dApp — operator pane | ✅ Real | Wires all ten administrative circuits through Lace; each call attaches with the private state it should run as |
| Live dApp — gate pane | ✅ Real | Named verifier, required role, credential fields, and a preflight that says *why* a mismatched pair will be refused before a proof is generated |
| Live dApp — ledger panel | ✅ Real | Reads the registry straight from the indexer with no wallet at all; shows counts and per-gate usage, never identities |
| dApp instrument → v2 registry | 🟡 Next | The configured preprod address is the v1 four-circuit registry, and this build ships v2 circuits. Deploying v2 and setting `VITE_CONTRACT_ADDRESS` to it is the one step that needs a funded wallet — the instrument then runs against it unchanged. Until then the ledger panel reads whatever address is configured, and the operator pane will fail honestly rather than pretending |
| Operator initialize on v2 | 🟡 Next | Needs the initialize proof, built in the wallet (Lace on preprod) — there is no headless path for the delegation step that funds it |
| Member register + proveAccess on v2 | 🟡 Next | Land one real register and one real proveAccess tx on the v2 registry once initialize is bound |
| Demo video | ✅ Real | [trien demo](https://youtu.be/5gKaCGEMLYc) — walkthrough of the live dApp: instrument firing, hold-to-reveal tracing proofs to the root (recorded against the v1 instrument) |
| Source verification | ✅ Real | CI recompiles the contract from `trien.compact` on every push — committed circuits, keys and ZKIR are reproducible from source |
| Contract verification | ✅ Real | 52-test suite against the real Compact runtime (the same interpreter the chain uses) + CI compile-from-source |

---

## Tests

The suite runs the circuits through the real Compact runtime — the same interpreter the chain uses, minus proof generation — so every `assert` in the contract fires exactly as it would on Preprod. Fifty-two tests across nine groups:

| Group | What it pins down |
|---|---|
| setup | The operator commitment is bound and is not the secret; re-initialization is refused; the admin hash uses its own domain |
| registration | Operator-only; the published leaf is a hash; `issued` counts correctly; a batch of four lands four leaves; role and expiry change the commitment |
| verifier authorization | Unauthorized verifiers are refused; authorization admits exactly one id; double-authorization is refused; withdrawal stops a gate without moving the epoch and leaves other gates working; per-verifier counters stay separate |
| proving access | A registered member is admitted and publishes only a nullifier; unregistered parties are rejected; double-use is rejected; two verifiers get unlinkable nullifiers; two members stay distinct |
| roles | The matching role is admitted; a member credential is refused at an editor gate and vice versa; one person with two roles gets one access per gate per epoch — and no way for the gate to tell; the role is not on the ledger |
| expiry | Admitted before the deadline; refused after it, with the leaf still in the tree; a long-lived credential keeps working at the same clock; moving the clock rewrites nothing |
| the emergency stop | Access is refused while paused; administration keeps working; unpause restores access; pausing twice or unpausing a running registry is refused; operator-only |
| operator handover | A proposal does not change the operator; only the operator proposes; acceptance requires an outstanding proposal and the proposed key; control moves and the proposal clears; the outgoing operator loses access; an empty commitment can never be accepted |
| what an observer can learn | Only counts and opaque hashes; the ledger's field set is exactly the documented eleven, and its serialization contains neither a secret nor a role |

```
 RUN  v2.1.9 /home/arch/midnightzks/contract

 ✓ src/test/trien.test.ts (52 tests) 10780ms

 Test Files  1 passed (1)
      Tests  52 passed (52)
```

---

## Run it locally

Requires **Node 22+**, **Docker** (for the proof server), and the **Compact toolchain**. On Windows, install the toolchain inside WSL — the compiler ships for Linux and macOS only, and Windows has its own unrelated `compact.exe` (the NTFS compression tool) that shadows it on `PATH`.

```bash
# 1. Compact toolchain
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
export PATH="$HOME/.local/bin:$PATH"
compact update 0.31.1
compact --version         # compact 0.5.1 at this commit, selecting compiler 0.31.1

# 2. Compile the circuits and run the tests
cd contract
npm install
npm run compact           # writes src/managed/trien/  — needs a CPU with ADX, see below
npm test

# 3. Proof server, for anything that touches a real network
docker run -d -p 6300:6300 -e PORT=6300 midnightnetwork/proof-server:latest

# 4. The dApp
cd ../frontend
npm install
npm run sync:zk           # copy the compiled circuits into public/zk/
npm run dev               # http://localhost:5173
```

On Windows, step 2's compile is `wsl -d Ubuntu -- bash contract/compile.sh`.

The compiler prints exactly this — it reports the count, not the names:

```
$ compact compile src/trien.compact src/managed/trien
Compiling 11 circuits:
```

The circuits it built are visible in the output tree. Prover keys are large (multiple MB each), so the committed tree keeps the verifier keys and the ZKIR, and `.gitignore` excludes `keys/*.prover` and `zkir/*.bzkir` — both are reproducible from `trien.compact`:

```
$ ls src/managed/trien/keys src/managed/trien/zkir
keys: acceptAdmin.verifier  authorizeVerifier.verifier  initialize.verifier  pause.verifier
      proposeAdmin.verifier proveAccess.verifier        register.verifier    registerMany.verifier
      revoke.verifier       revokeVerifier.verifier     unpause.verifier
zkir: acceptAdmin.zkir      authorizeVerifier.zkir      initialize.zkir      pause.zkir
      proposeAdmin.zkir     proveAccess.zkir            register.zkir        registerMany.zkir
      revoke.zkir           revokeVerifier.zkir         unpause.zkir
```

![compile output](docs/media/3.png)

The same output, as plain text, is in [`docs/media/compile-output.txt`](docs/media/compile-output.txt). `src/managed/trien/` holds `contract/` (generated TypeScript), `keys/` (prover and verifier keys per circuit) and `zkir/` (the ZK intermediate representation).

**If `npm run compact` dies with `Exception: zkir returned a non-zero exit status -4`,** the front end compiled and the *key generator* hit an illegal instruction: `zkir` is built for CPUs with ADX, and older AMD parts (the A6-9225, for one) do not have it. Run the compile on a machine that does — CI does exactly that on every push — and copy `src/managed/trien/` back. The tests do not need it; they run locally against the committed artifacts.

---

## Deploy

The proof server must be running first — proving happens locally, because a proof server is handed the witness:

```bash
docker run -d --rm -p 6300:6300 --name midnight-proof-server \
  midnightnetwork/proof-server -- 'midnight-proof-server --num-workers 4'
```

Note the flag: the published image no longer accepts the `--network preview` argument older instructions pass; it exits immediately with `error: unexpected argument '--network' found`.

```bash
cd deploy
npm install
npm run new-wallet        # writes a throwaway seed to deploy/.env (gitignored)
npm run address           # shielded address + tDUST fee balance
npm run unshielded        # unshielded Night address — this is what the faucet wants
npm run mnemonic          # the same seed as 24 words, for importing into Lace
TRIEN_VERIFIERS="verifier:newsroom,verifier:clinic" npm run deploy
```

Deployment is two transactions on purpose. The first puts the circuits and an empty ledger on chain; `initialize` then writes the operator commitment into `admin`. Keeping them apart means the registry is inert until somebody proves they hold the operator secret, rather than the contract trusting whoever happened to submit the deployment.

`TRIEN_VERIFIERS` is optional and matters: a freshly deployed registry admits nobody until at least one verifier is authorized, so naming the gates at deploy time is the difference between a registry that works and one that refuses everything for reasons that are correct but not obvious.

Funding is the only manual step: the [preprod faucet](https://midnight-tmnight-preprod.nethermind.dev) dispenses tNight to the unshielded address, and tNight must be delegated (Lace → **Generate tDust**) before the fee balance is non-zero and the deploy completes. The result lands in `deploy/deployment.json`:

```json
{
  "network": "preprod",
  "contractAddress": "…",
  "deployTxId": "…",
  "initializeTxId": "…bound from the dApp — the initialize proof is built in the wallet, not headless",
  "operatorCommitment": "…",
  "authorizedVerifiers": ["verifier:newsroom", "verifier:clinic"],
  "deployedAt": "…"
}
```

---

## Project layout

```
contract/
  src/trien.compact          the contract (11 circuits)
  src/index.ts               what consumers import, plus the circuit-id list
  src/types.ts               the credential: secret, role, expiry
  src/witnesses.ts           witness implementations (local, never sent)
  src/test/simulator.ts      runs circuits against the real Compact runtime, with a clock
  src/test/trien.test.ts     the test suite (52 tests)
  src/managed/trien/         compiler output: circuits, verifier keys, ZKIR
  compile.sh                 compiles via WSL on Windows
deploy/
  src/new-wallet.ts          generates a throwaway seed
  src/address.ts             prints the address and balance
  src/unshielded-address.ts  derives the unshielded Night address (faucet form)
  src/deploy.ts              deploys, initializes, and authorizes the named verifiers
  src/providers.ts           compiled-contract binding + providers
  src/zk-config.ts           serves ZK artifacts from disk
frontend/
  src/App.tsx                the page
  src/Plate.tsx              the allowlist, drawn
  src/components/OperatorPanel.tsx  every administrative circuit, wired
  src/components/GatePanel.tsx      a named gate, a required role, a credential
  src/components/LedgerPanel.tsx    the registry read with no wallet at all
  src/lib/registry-reader.ts        indexer → decoded ledger
  src/lib/credentials.ts     the three parts of a credential, as a form
  src/lib/contract.ts        registry binding, providers, hashing helpers
  src/lib/lace.ts            wallet connect / disconnect
  scripts/sync-zk.mjs        compiled circuits → public/zk/
docs/media/                  README screenshots (1.png, 2.png, 3.png, compile-output.txt)
.github/workflows/ci.yml     compile + typecheck + test on every push
vercel.json                  build config for the deployed dApp
```

---
