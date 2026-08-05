# Demo video

Put the recording here as `demo.mp4`, or host it and drop the link in the
table below. Git is a poor place for large binaries — if the file runs to more
than a few megabytes, host it and commit only the link.

| | |
| --- | --- |
| Level 2 demo | https://youtu.be/5gKaCGEMLYc |
| Level 3 demo | https://youtu.be/5gKaCGEMLYc |
| Level 4 demo | https://youtu.be/5gKaCGEMLYc |

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
5. Call a circuit and show the nullifier landing on chain while the caller
   stays unidentified.

Step 5 needs a funded wallet. The registry is live on Preview at
`a234fcd8498a793f498185cc35a2e29c4145d3cc61bdd0341eefbab887bfbca3` — the
address is no longer pending. What the recording still lacks is the
wallet-connected circuit call, which is the only part that needs money.

## The recording

`trien-demo.mp4` is a one-minute capture of the live site: the masthead, the
instrument running, and the hold-to-reveal firing three times, each tracing a
different leaf up to the root while the caption flips between the public view
and the one the chain never gets.

It does **not** show wallet connect or a circuit call, because it was captured
from an automated browser with no Lace extension and no funded wallet. Those
two shots are what the Level 2 recording still needs — the registry itself is
live and proving against it only needs tDust.

Recordings are committed here rather than ignored, so the demo travels with the
repository.
