<div align="center">

<img src="docs/media/1.png" alt="Triện — anonymous, revocable allowlist access on Midnight" width="100%" />

&nbsp;

[![Live demo](https://img.shields.io/badge/●_live-midnight--rust--psi.vercel.app-34d399)](https://midnight-rust-psi.vercel.app)
![Preview: contract](https://img.shields.io/badge/📜_Preview-a234fcd8…-14151a)
[![CI](https://github.com/Venkat5599/midnightzks/actions/workflows/ci.yml/badge.svg)](https://github.com/Venkat5599/midnightzks/actions/workflows/ci.yml)
![Tests](https://img.shields.io/badge/tests-14%20passing-3fb950)
![Stack](https://img.shields.io/badge/React%2018%20·%20Vite%206%20·%20TypeScript-1f1f23)
![Compact](https://img.shields.io/badge/Compact%200.23-4f46e5)
![Midnight](https://img.shields.io/badge/Midnight-Preview-34d399)
[![License: MIT](https://img.shields.io/badge/license-MIT-34d399.svg)](LICENSE)

### Prove you're on the list. Nobody learns who you are.

Triện is an on-chain allowlist where membership is a zero-knowledge claim. An operator issues commitments; members prove they are on the list without revealing which member they are; revocation locks a member out immediately — and kills the proofs they already hold. Built in Compact on Midnight Preview, the one chain where the allowlist can sit on chain while membership stays private.

### ▶ Live now — the instrument runs at **[midnight-rust-psi.vercel.app](https://midnight-rust-psi.vercel.app)**

**[ Live dApp ↗ ](https://midnight-rust-psi.vercel.app)** · **[ Demo video ↗ ](https://youtu.be/5gKaCGEMLYc)** · **[ How it works ↓ ](#how-it-works)** · **[ Run it locally ↓ ](#run-it-locally)**

Built for the Midnight challenge — Private Allowlist Access (Level 3). MIT licensed.

</div>

---

## Table of contents

- [See it in one command](#-see-it-in-one-command)
- [The problem](#the-problem)
- [How it works](#how-it-works)
  - [1 · Register — the operator issues a commitment](#1--register--the-operator-issues-a-commitment)
  - [2 · Prove — membership without identity](#2--prove--membership-without-identity)
  - [3 · Revoke — immediate, not eventual](#3--revoke--immediate-not-eventual)
  - [4 · Stay unlinkable — the nullifier](#4--stay-unlinkable--the-nullifier)
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

The registry is live on Midnight Preview. The public indexer returns its state right now:

```bash
$ curl -s -X POST https://indexer.preview.midnight.network/api/v3/graphql \
    -H 'content-type: application/json' \
    -d '{"query":"{ contract(address: \"a234fcd8498a793f498185cc35a2e29c4145d3cc61bdd0341eefbab887bfbca3\") { state } }"}'
{"data":{"contract":{"state":"6d69646e696768743a636f6e74726163742d73746174655b76365d3a70…"}}}
```

The state blob carries the ledger: a Merkle tree of member commitments, a set of spent nullifiers, an epoch counter and an access counter. Zero identities.

The four circuits compile from source, and the suite that exercises them passes:

```bash
$ npm test

 RUN  v2.1.9 /home/arch/midnightzks/contract

 ✓ src/test/trien.test.ts (14 tests) 1427ms

 Test Files  1 passed (1)
      Tests  14 passed (14)
```

---

## The problem

Token-gated apps today work by asking you to connect a wallet, then reading everything in it. The app learns your whole balance history and every other app you have touched. For a gate, it needs exactly one bit — **are you allowed in, or not** — and it takes a biography instead.

- **Every wallet leaks more than the gate asks for** — balance, history, other memberships, all readable
- **Allowlists are identity lists** — membership itself is the sensitive fact, and it is published to prove it
- **Correlation across sites** — the same person at two gated sites is trivially linkable
- **Revocation is weak** — a member who was removed still holds credentials that keep working

Existing approaches hide the *transaction* but not the *membership*. Triện hides the membership: the list lives on chain as opaque commitments, and access is granted by a zero-knowledge proof, not by showing a wallet.

---

## How it works

Everything in the `ledger` declarations of
[`contract/src/trien.compact`](contract/src/trien.compact) is on chain and readable by anyone. Everything declared `witness` never leaves the holder's machine.

### Public ledger state

| Field | Type | What it is | What it leaks |
| --- | --- | --- | --- |
| `members` | `HistoricMerkleTree<10, Bytes<32>>` | Commitments of approved members | How many members exist. Each leaf is `H("gk:commit", secret)` — identifies nobody |
| `nullifiers` | `Set<Bytes<32>>` | Spent access tokens | How many accesses happened. Each is `H("gk:null", secret, verifier, epoch)` — an opaque hash |
| `epoch` | `Counter` | Bumped on every revocation | How many revocations have occurred |
| `accessCount` | `Counter` | Total successful accesses | Aggregate usage, nothing per person |
| `admin` | `Bytes<32>` | Commitment of the operator | That an operator exists, not who they are |

### 1 · Register — the operator issues a commitment

The operator adds a member by inserting their commitment into the tree. The chain learns only that the approved set grew by one:

```compact
export circuit register(commitment: Bytes<32>): [] {
  assert(commitmentOf(memberSecret()) == admin, "caller is not the operator");
  members.insert(disclose(commitment));
}
```

`insert`, not `insertHash` — the leaf stored is `leafHash(commitment)`, which is what `merkleTreePathRoot` recomputes when `proveAccess` validates a path. Storing the commitment directly would make every membership proof fail against the root (see [Engineering decisions](#engineering-decisions--the-hard-problems)).

### 2 · Prove — membership without identity

To get in, a holder proves in zero knowledge that they know a secret whose hash sits in the tree, and publishes a nullifier instead of an identity:

```compact
export circuit proveAccess(verifierId: Bytes<32>): [] {
  const secret = memberSecret();
  const path = memberPath();

  assert(path.leaf == commitmentOf(secret), "path does not match caller's commitment");
  assert(members.checkRoot(disclose(merkleTreePathRoot<10, Bytes<32>>(path))),
         "stale or unknown Merkle root - membership revoked or never granted");

  const nul = disclose(nullifierOf(secret, verifierId, epoch.read()));
  assert(!nullifiers.member(nul), "credential already used at this verifier");

  nullifiers.insert(nul);
  accessCount.increment(1);
}
```

The circuit discloses the Merkle **root** — already public ledger state, and a root does not say which leaf produced it — plus the **nullifier**. It never discloses the secret, the commitment, or the path, so an access cannot be traced back to a registration.

Holding **reveal what happened** in the dApp traces the proof back to the leaf it came from — the view the chain never gets:

<img src="docs/media/2.png" alt="the dApp — revealed: the proof traced back to its leaf" width="100%" />

### 3 · Revoke — immediate, not eventual

Clearing a leaf is not enough: a revoked member already holds a Merkle path to an *older* root, and a naive contract would accept a proof against it. `revoke` therefore does three things:

1. zeroes the leaf, removing the member from the tree;
2. calls `resetHistory()`, invalidating every previously-valid root, so stale paths stop verifying;
3. bumps `epoch`, which changes every member's nullifier, so a proof built before the revocation cannot be replayed after it.

Non-revoked members are unaffected — they rebuild their path from the current public tree, with no help from the operator.

### 4 · Stay unlinkable — the nullifier

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

The one deliberate, stated limit: repeat visits by one member to *one* verifier within *one* epoch are prevented, not hidden. Enforcing uniqueness necessarily means publishing something stable per (member, verifier, epoch), and the nullifier is the minimum such thing.

---

## Architecture

```
Lace wallet ──▶ Triện dApp ──▶ proof server (local, :6300)
   │                │                │
   │                └──▶ Midnight indexer / node (Preview)
   │                            │
   │                            └──▶ Triện registry contract
```

Proving happens locally on purpose: a proof server is handed the witness, and sending that to someone else's host would give away the secret this design exists to protect.

### Transaction flow

```bash
1. Operator deploys        → two txs: circuits + empty ledger, then initialize binds the admin commitment
2. Operator registers      → register(commitment): proves operator identity, inserts a leaf
3. Member proves           → witness (secret + path) stays local; tx publishes root + nullifier
4. Observer reads          → ledger shows counts and opaque nullifiers, never identities
5. Operator revokes        → revoke(index): zeroes leaf, resets history, bumps epoch
6. Member re-proves        → stale path rejected, old nullifier void — revocation is retroactive
```

### Component by component

| Component | Technology | Responsibility |
|---|---|---|
| Triện contract | Compact 0.23 | Members tree, nullifier set, epoch, access count — the on-chain allowlist |
| Witness driver | TypeScript (`@trien/contract`) | `memberSecret()` / `memberPath()` — never leave the machine |
| Proof server | `midnightnetwork/proof-server` | Local proving; witness never sent to a host |
| dApp | React 18, Vite 6, Lace connector | Connect Lace, run the instrument, hold-to-reveal |
| Deploy tooling | `@midnight-ntwrk/wallet` 5.0.0 | Seed → unshielded address → tDust → deploy + initialize |
| CI | GitHub Actions (Node 22) | Compile from source + typecheck + tests + frontend build |

---

## Engineering decisions — the hard problems

**1. `register` must store `leafHash(commitment)`, not the commitment.** The first version used `members.insertHash(commitment)`, which writes the commitment into the tree verbatim. But `proveAccess` validates a path with `merkleTreePathRoot()`, which applies `leafHash()` to the leaf before folding upward. The two disagreed, so `checkRoot()` rejected every honestly constructed proof: the contract compiled, would have deployed, and could never have admitted anybody. Switching to `members.insert()` fixed it. This class of mistake is invisible until something actually tries to prove membership — which is why the test suite exists.

**2. Revocation is a three-part transaction, not a leaf clear.** Zeroing a leaf leaves a revoked member holding a valid path to an older root. `revoke` also calls `resetHistory()` to invalidate every previously-valid root and bumps the epoch to change every member's nullifier. Stale paths stop verifying; proofs built before the revocation cannot be replayed after it.

**3. The nullifier is the minimum public leak.** One credential, one access per verifier per epoch. Uniqueness necessarily means publishing something stable per (member, verifier, epoch) — the nullifier is that minimum. Scoping by verifier makes colluding verifiers see unrelated hashes; scoping by epoch makes revocation retroactive. The README and the dApp both state the limit plainly: repeat visits are *prevented*, not hidden.

**4. The proof server runs locally.** A proof server is handed the witness — the secret plus the Merkle path. Pointing the dApp at a hosted server would defeat the design. The dApp defaults to localhost proving and only falls back to a configured server after a wallet reports one.

**5. Funding Preview is two steps, and only one is scriptable.** The faucet dispenses tNight to the *unshielded* Night address, and rejects the shielded form (`mn_shield-addr_test1…`). Deriving it needs `signingKeyFromBip340()` first — `signatureVerifyingKey()` refuses raw HD bytes. Then tNight must be *delegated* to generate the tDust that pays fees, and delegation has no headless API in `@midnight-ntwrk/wallet` 5.0.0. The deploy seed's 24-word mnemonic is handed to Lace for **Generate tDust**, after which `npm run deploy` completes. The endpoints that used to work compound the pain: `testnet-02` no longer resolves and the indexer's GraphQL moved to `/api/v3/graphql` — a wrong endpoint fails silently, because the wallet builds and prints a correct address that simply never syncs.

---

## Build checklist

- [x] Contract compiles — 4 circuits via `compact compile` (CI recompiles from source on every push)
- [x] Test suite green — 14/14, run against the real Compact runtime
- [x] CI green — contract job (compile + typecheck + test) and frontend job (typecheck + build)
- [x] Contract deployed on Midnight Preview — `a234fcd8498a793f498185cc35a2e29c4145d3cc61bdd0341eefbab887bfbca3`, verified via the public indexer
- [x] Managed artifacts committed — circuits + prover/verifier keys + ZKIR under `src/managed/trien/`
- [x] Live dApp — [midnight-rust-psi.vercel.app](https://midnight-rust-psi.vercel.app), redeployed on every push
- [x] Demo video — [youtu.be/5gKaCGEMLYc](https://youtu.be/5gKaCGEMLYc)

---

## What's real vs pending — the honesty table

| Feature | Status | Detail |
|---|---|---|
| Contract deployed | ✅ Real | `a234fcd8…bca3` on Midnight Preview; indexer returns live ledger state |
| Four circuits + keys + ZKIR | ✅ Real | Committed under `src/managed/trien/`, CI-reproducible from `trien.compact` |
| Live dApp | ✅ Real | Vercel, editorial page + Lace connect + hold-to-reveal instrument |
| Lace connect / network guard | ✅ Real | Connect + forget-session; refuses a wallet on the wrong network |
| dApp instrument | ✅ Real | Runs live in the page — a simulated proof lands every few seconds and traces to the root (display only; no wallet needed) |
| Demo video | ✅ Real | [trien demo](https://youtu.be/5gKaCGEMLYc) — walkthrough of the live dApp: instrument firing, hold-to-reveal tracing proofs to the root |
| Source verification | ✅ Real | CI recompiles the contract from `trien.compact` on every push — committed circuits, keys and ZKIR are reproducible from source |
| Contract verification | ✅ Real | 14-test suite against the real Compact runtime (the same interpreter the chain uses) + CI compile-from-source |

---

## Tests

The suite runs the circuits through the real Compact runtime — the same interpreter the chain uses, minus proof generation — so every `assert` in the contract fires exactly as it would on Preview. It covers the operator checks, the membership proof, double-spend rejection, cross-verifier unlinkability, and each of the three things revocation has to do.

```
 RUN  v2.1.9 /home/arch/midnightzks/contract

 ✓ src/test/trien.test.ts (14 tests) 1427ms

 Test Files  1 passed (1)
      Tests  14 passed (14)
```

---

## Run it locally

Requires **Node 22+**, **Docker** (for the proof server), and the **Compact toolchain**. On Windows, install the toolchain inside WSL — the compiler ships for Linux and macOS only, and Windows has its own unrelated `compact.exe` (the NTFS compression tool) that shadows it on `PATH`.

```bash
# 1. Compact toolchain
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
export PATH="$HOME/.local/bin:$PATH"
compact update
compact --version         # compact 0.5.1 at time of writing

# 2. Compile the circuits and run the tests
cd contract
npm install
npm run compact           # writes src/managed/trien/
npm test

# 3. Proof server, for anything that touches a real network
docker run -d -p 6300:6300 -e PORT=6300 midnightnetwork/proof-server:latest

# 4. The dApp
cd ../frontend
npm install
npm run dev               # http://localhost:5173
```

On Windows, step 2's compile is `wsl -d Ubuntu -- bash contract/compile.sh`.

The compiler prints exactly this — it reports the count, not the names:

```
$ compact compile src/trien.compact src/managed/trien
Compiling 4 circuits:
```

The four circuits it built are visible in the output tree:

```
$ ls src/managed/trien/keys src/managed/trien/zkir
keys: initialize.prover  initialize.verifier   proveAccess.prover  proveAccess.verifier
      register.prover    register.verifier     revoke.prover       revoke.verifier
zkir: initialize.zkir    proveAccess.zkir      register.zkir       revoke.zkir
```

![compile output](docs/media/3.png)

The same output, as plain text, is in [`docs/media/compile-output.txt`](docs/media/compile-output.txt). `src/managed/trien/` holds `contract/` (generated TypeScript), `keys/` (prover and verifier keys per circuit) and `zkir/` (the ZK intermediate representation).

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
npm run deploy            # deploys, then calls initialize
```

Deployment is two transactions on purpose. The first puts the circuits and an empty ledger on chain; `initialize` then writes the operator commitment into `admin`. Keeping them apart means the registry is inert until somebody proves they hold the operator secret, rather than the contract trusting whoever happened to submit the deployment.

Funding is the only manual step: the faucet dispenses tNight to the unshielded address, and tNight must be delegated (Lace → **Generate tDust**) before the fee balance is non-zero and `npm run deploy` completes. The result lands in `deploy/deployment.json`:

```json
{
  "network": "preview",
  "contractAddress": "a234fcd8498a793f498185cc35a2e29c4145d3cc61bdd0341eefbab887bfbca3",
  "deployTxId": "…",
  "initializeTxId": "…",
  "operatorCommitment": "…",
  "deployedAt": "…"
}
```

---

## Project layout

```
contract/
  src/trien.compact          the contract (4 circuits)
  src/index.ts               what consumers import
  src/witnesses.ts           witness implementations (local, never sent)
  src/types.ts               private state
  src/test/simulator.ts      runs circuits against the real Compact runtime
  src/test/trien.test.ts     the test suite (14 tests)
  src/managed/trien/         compiler output: circuits, keys, ZKIR
  compile.sh                 compiles via WSL on Windows
deploy/
  src/new-wallet.ts          generates a throwaway seed
  src/address.ts             prints the address and balance
  src/unshielded-address.ts  derives the unshielded Night address (faucet form)
  src/deploy.ts              deploys, then binds the operator
  src/providers.ts           compiled-contract binding + providers
  src/zk-config.ts           serves ZK artifacts from disk
frontend/
  src/App.tsx                the page
  src/Plate.tsx              the allowlist, drawn
  src/lib/lace.ts            wallet connect / disconnect
docs/media/                  README screenshots (1.png, 2.png, 3.png, compile-output.txt)
.github/workflows/ci.yml     compile + typecheck + test on every push
vercel.json                  build config for the deployed dApp
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Contract | Compact 0.23 (`pragma language_version 0.23`), compiler 0.5.1, `@midnight-ntwrk/compact-runtime` 0.16.0 |
| Chain | Midnight Preview |
| Frontend | React 18, Vite 6, TypeScript, Tailwind 4, motion, Lenis |
| Wallet | Lace via `@midnight-ntwrk/dapp-connector-api` 4.0.1 |
| Integration | `@midnight-ntwrk/midnight-js-*` 4.1.1 (contracts, proof provider, indexer data, private state) |
| Deploy | `@midnight-ntwrk/wallet` 5.0.0 |
| Tests | Vitest 2.1, simulator against the real Compact runtime |
| CI | GitHub Actions, Node 22 |

---

## Roadmap

- **Multiple issuers** — an issuer registry lets a DAO, a university and an employer each hold their own subtree and their own revocation epoch; a verifier declares which issuers it trusts, and the proof carries an issuer index without leaking which specific credential was used beyond that set.
- **Time- and role-bound credentials** — expiry and role fields in the leaf preimage, so the circuit asserts the claimed role matches what the verifier asked for and that the current block time is under expiry. The user still never reveals which leaf they are.
- **Reusable across dApps** — because the nullifier already takes a verifier id as input, one credential can be presented to many apps without any of them linking the presentations. Wrapping the verify call in a small TypeScript SDK would let any Midnight dApp drop it in.

---

## License

MIT — built for the Midnight challenge, 2026.
