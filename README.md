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
