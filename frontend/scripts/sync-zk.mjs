#!/usr/bin/env node
/**
 * Copy the compiled ZK artifacts into the dApp's public directory.
 *
 * The compiler writes to `contract/src/managed/trien/`. The browser fetches
 * from `frontend/public/zk/`. If those two ever disagree, the dApp proves
 * against circuits the contract no longer has — which fails at proving time,
 * in the wallet, with an error that does not say "your artifacts are stale".
 * So the copy is a script rather than a habit.
 *
 * What is copied:
 *   contract/   the generated binding the dApp imports
 *   keys/*.verifier + zkir/*.bzkir + zkir/*.zkir   what the proof provider fetches
 *
 * What is not, by default: the proving keys (`keys/*.prover`, several MB each,
 * reproducible from `trien.compact` by running the compiler). Pass
 * `--with-prover` to copy them too, which is what a local proof server needs —
 * the hosted dApp proves inside the connected wallet and does not need them.
 */
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '..', '..', 'contract', 'src', 'managed', 'trien');
const target = join(here, '..', 'public', 'zk');
const withProver = process.argv.includes('--with-prover');

if (!existsSync(source)) {
  console.error(`no compiled artifacts at ${source} — run "npm run compact" in contract/ first`);
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

/** Copy every file in a subdirectory, optionally filtered by extension. */
const copyDir = async (subdir, keep) => {
  const from = join(source, subdir);
  if (!existsSync(from)) return 0;
  const to = join(target, subdir);
  await mkdir(to, { recursive: true });
  let copied = 0;
  for (const name of await readdir(from)) {
    if (!keep(name)) continue;
    await cp(join(from, name), join(to, name));
    copied += 1;
  }
  return copied;
};

const isVerifier = (name) => name.endsWith('.verifier');
const isIr = (name) => name.endsWith('.zkir') || name.endsWith('.bzkir');
const isProver = (name) => name.endsWith('.prover');
const isBinding = (name) => !name.endsWith('.prover');

const counts = {
  contract: await copyDir('contract', isBinding),
  'keys (verifier)': await copyDir('keys', isVerifier),
  'keys (prover)': withProver ? await copyDir('keys', isProver) : 0,
  zkir: await copyDir('zkir', isIr),
};

for (const [what, count] of Object.entries(counts)) {
  console.log(`${count.toString().padStart(3, ' ')}  ${what}`);
}
if (!withProver) {
  console.log('proving keys skipped (proof server path: rerun with --with-prover)');
}
