# Gatekeeper

**Anonymous, revocable allowlist access on Midnight.**

An operator issues credentials to approved people. Those people prove they are
on the list — to a newsroom, a clinic, a support forum, a beta programme —
without revealing who they are, and without any two of those places being able
to work out they saw the same person. When the operator revokes someone, that
person is locked out immediately, and the proofs they already hold stop working.

Chosen problem (Level 3, from the provided list): **Private Allowlist Access —
prove membership without revealing identity.**

## The idea

Allowlists are how most gated things work: a press-only briefing, a patient
portal, an employee discount, a private beta. Today they are implemented by
handing over an identity — an email, an SSO account, a wallet address — and
letting the gate look you up. That makes the gate a surveillance point. It
learns who you are and when you showed up, and if two gates compare notes they
can reconstruct your movements across both.

Gatekeeper keeps the allowlist and drops the identity. The operator publishes a
Merkle tree of *commitments* — hashes of secrets only the holders know. To get
in, a holder proves in zero knowledge that their secret hashes to a leaf of that
tree. The gate learns one bit: "someone on the list is here." It never learns
which someone. Revocation still works, immediately, because the tree is public
even though its contents are meaningless to observers.

The design is not "hide everything." It is a specific, defensible choice about
which single fact becomes public and which stay private.

## Public state vs private witness

Everything in the `ledger` declarations of
[`contract/src/gatekeeper.compact`](contract/src/gatekeeper.compact) is on chain
and readable by anyone. Everything declared `witness` never leaves the holder's
machine.

### Public ledger state

| Field | Type | What it is | What it leaks |
| --- | --- | --- | --- |
| `members` | `HistoricMerkleTree<10, Bytes<32>>` | Commitments of approved members | How many members exist. Each leaf is `H("gk:commit", secret)`, so it identifies nobody. |
| `nullifiers` | `Set<Bytes<32>>` | Spent access tokens | How many accesses happened. Each is `H("gk:null", secret, verifier, epoch)` — an opaque hash. |
| `epoch` | `Counter` | Bumped on every revocation | How many revocations have occurred. |
| `accessCount` | `Counter` | Total successful accesses | Aggregate usage, and nothing per-person. |
| `admin` | `Bytes<32>` | Commitment of the operator | That an operator exists. Not who they are. |

### Private witnesses

| Witness | What it is | Why it is private |
| --- | --- | --- |
| `memberSecret()` | The holder's 32-byte root secret | It *is* the credential. Anyone holding it is the member. It is used inside the proof to recompute the commitment and derive the nullifier, and is never disclosed. |
| `memberPath()` | Merkle authentication path from the holder's commitment to a valid root | The path identifies *which leaf* the holder occupies. Publishing it would deanonymise them completely. |

### Where `disclose()` is used, and why

The compiler refuses to publish anything derived from a witness unless you say
so explicitly. There are exactly four `disclose()` calls, and each is a
deliberate decision:

- `initialize` — discloses the operator's commitment. A hash, not an identity.
- `register` — discloses the commitment being added. The operator already knows
  it; they issued it.
- `revoke` — discloses the leaf index being cleared. Which slot is being emptied
  is inherently public, since the tree is public.
- `proveAccess` — discloses the Merkle **root** (already public ledger state; a
  root does not say which leaf produced it) and the **nullifier**. Nothing else.

Notably, `proveAccess` does *not* disclose the secret, the commitment, or the
path — so an access cannot be traced back to a registration.

## Privacy model: what an observer can and cannot learn

Assume an observer who reads every block, plus the verifier being proven to, plus
the registry operator. All of them, cooperating.

**They can learn:**

- how many members are registered, and how many have been revoked;
- how many accesses have occurred in total, and at their own verifier;
- that a given access was made by *someone* who was on the list at the time.

**They cannot learn:**

- which member performed any given access;
- whether two accesses at *different* verifiers came from the same member — the
  nullifier is salted with `verifierId`, so colluding verifiers see two unrelated
  hashes;
- anything at all about a member who never proves access;
- a member's secret, from any amount of on-chain data.

**Deliberate, and worth stating plainly:** repeat visits by one member to *one*
verifier within one epoch are prevented, not hidden — that is the entire purpose
of the nullifier. One credential, one access per verifier per epoch. Enforcing
uniqueness necessarily means publishing something stable per (member, verifier,
epoch), and the nullifier is the minimum such thing.

### Revocation is immediate, not eventual

This is the part that is easy to get wrong. Clearing a leaf is not enough: a
revoked member already holds a Merkle path to an *older* root, and a naive
contract would happily accept a proof against it. `revoke` therefore does three
things:

1. zeroes the leaf, removing the member from the tree;
2. calls `resetHistory()`, invalidating every previously-valid root, so stale
   paths stop verifying;
3. bumps `epoch`, which changes every member's nullifier, so a proof built before
   the revocation cannot be replayed after it.

Non-revoked members are unaffected — they rebuild their path from the current
public tree, which needs no help from the operator.

## Repository layout

```
contract/
  src/gatekeeper.compact          the contract
  src/witnesses.ts                witness implementations (local, never sent)
  src/types.ts                    private state
  src/test/simulator.ts           runs circuits against the real Compact runtime
  src/test/gatekeeper.test.ts     the test suite
  src/managed/gatekeeper/         compiler output: circuits, keys, ZKIR
.github/workflows/ci.yml          compile + typecheck + test on every push
```

## Running it locally

Requires **Node 22+**, **Docker** (for the proof server), and the **Compact
toolchain**. On Windows, install the toolchain inside WSL — the compiler ships
for Linux and macOS only.

```bash
# 1. Compact toolchain
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
export PATH="$HOME/.local/bin:$PATH"
compact update            # installs the compiler (0.31.1 at time of writing)
compact --version

# 2. Compile the circuits and run the tests
cd contract
npm install
npm run compact           # writes src/managed/gatekeeper/
npm test

# 3. Proof server, for anything that touches a real network
docker run -p 6300:6300 midnightnetwork/proof-server:latest -- \
  'midnight-proof-server --network testnet'
```

`npm run compact` reports the circuits it built:

```
Compiling 4 circuits:
  initialize, register, revoke, proveAccess
```

and produces `src/managed/gatekeeper/` containing `contract/` (generated
TypeScript), `keys/` (prover and verifier keys per circuit) and `zkir/` (the ZK
intermediate representation).

## Tests

```
$ npm test

 ✓ src/test/gatekeeper.test.ts (14 tests) 571ms

 Test Files  1 passed (1)
      Tests  14 passed (14)
```

The suite runs the circuits through the real Compact runtime — the same
interpreter the chain uses, minus proof generation — so every `assert` in the
contract fires exactly as it would on Preprod. It covers the operator checks,
the membership proof, double-spend rejection, cross-verifier unlinkability, and
each of the three things revocation has to do.

## Status

- [x] Toolchain installed; contract compiles to 4 ZK circuits
- [x] Test suite passing (14 tests)
- [x] `managed/` generated (circuits + keys + ZKIR)
- [x] CI compiling from source and running tests on every push
- [ ] Deployed to Preprod (address pending)
- [ ] Frontend wired to Lace

## A note on a bug that mattered

The first version of `register` used `members.insertHash(commitment)`, which
writes the commitment into the tree verbatim. But `proveAccess` validates a path
with `merkleTreePathRoot()`, which applies `leafHash()` to the leaf before
folding upward. The two disagreed, so `checkRoot()` rejected every honestly
constructed proof: the contract compiled, would have deployed, and could never
have admitted anybody. Switching to `members.insert()` — which stores
`leafHash(commitment)` — fixed it. The test suite exists partly because this
class of mistake is invisible until something actually tries to prove
membership.
