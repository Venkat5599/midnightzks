# Demo video

Put the recording here as `demo.mp4`, or host it and drop the link in the
table below. Git is a poor place for large binaries — if the file runs to more
than a few megabytes, host it and commit only the link.

| | |
| --- | --- |
| Level 2 demo | _pending_ |
| Level 3 demo | _pending_ |
| Level 4 demo | _pending_ |

## What each level asks for

**Level 2** — wallet connect, and a successful circuit call.
**Level 3** — one minute showing full functionality.
**Level 4** — the MVP, end to end.

## Recording it

This needs the Lace extension installed and set to **Preview**, which is why
it cannot be captured from an automated browser: there is no wallet in one, so
"Connect Lace" only ever produces its not-installed error.

A run that covers Level 2, in order:

1. Open https://midnight-rust-psi.vercel.app — the instrument is already
   running. A proof lands every few seconds and publishes a nullifier.
2. Hold **reveal what happened**. The path traces from the leaf that produced
   the proof up to the root. Say the line out loud: the chain sees the root and
   the nullifier, never the leaf. That is the whole product.
3. Click **Connect Lace** and approve in the extension. The session panel shows
   the address, the network and the proof server the wallet reported.
4. Click **Forget this session**, and point out that it forgets rather than
   revokes — permission lives in Lace, and only the user can withdraw it.
5. Once the registry is deployed, call a circuit and show the nullifier landing
   on chain while the caller stays unidentified.

Step 5 needs a funded wallet. Until then the contract address is `Pending`,
which the challenge explicitly allows.

## Keeping the repo lean

`.gitignore` excludes video files in this directory by default. Commit a link,
or force-add a small file deliberately:

```bash
git add -f docs/video/demo.mp4
```
