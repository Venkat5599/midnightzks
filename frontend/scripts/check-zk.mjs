#!/usr/bin/env node
/**
 * Fail when the artifacts the browser serves have drifted from the ones the
 * contract compiles to.
 *
 * `sync:zk` copies them, but a copy is only as good as the last time somebody
 * ran it: edit trien.compact, commit the regenerated artifacts under
 * contract/src/managed/trien/, forget the frontend copy, and the dApp proves
 * against circuits the deployed contract does not have. The failure mode is a
 * missing-key error inside the wallet, which names nothing useful.
 *
 * This compares the two trees byte-for-byte, for the file sets that are
 * committed. Proving keys are excluded (they are gitignored and only a local
 * proof server needs them).
 *
 * Exit code 1 with a list of the offending files; 0 when they agree.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const compiled = join(here, '..', '..', 'contract', 'src', 'managed', 'trien');
const served = join(here, '..', 'public', 'zk');

if (!existsSync(compiled) || !existsSync(served)) {
  console.error(`cannot compare: ${existsSync(compiled) ? served : compiled} is missing`);
  process.exit(1);
}

const digest = async (path) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');

/** Every committed artifact, as relative paths. */
const collect = async (subdir, keep) => {
  const dir = join(compiled, subdir);
  if (!existsSync(dir)) return [];
  const names = (await readdir(dir)).filter(keep).sort();
  return names.map((name) => `${subdir}/${name}`);
};

const paths = [
  ...(await collect('contract', (n) => !n.endsWith('.prover'))),
  ...(await collect('keys', (n) => n.endsWith('.verifier'))),
  ...(await collect('zkir', (n) => n.endsWith('.zkir') || n.endsWith('.bzkir'))),
];

const problems = [];
for (const rel of paths) {
  const from = join(compiled, rel);
  const to = join(served, rel);
  if (!existsSync(to)) {
    problems.push(`${rel}: missing from public/zk`);
    continue;
  }
  if ((await digest(from)) !== (await digest(to))) {
    problems.push(`${rel}: differs from the compiled artifact`);
  }
}

if (problems.length > 0) {
  console.error(`served ZK artifacts are out of date (${problems.length}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('run "npm run sync:zk" and commit the result');
  process.exit(1);
}

console.log(`served ZK artifacts match the compiled ones (${paths.length} files)`);
