import {
  ZKConfigProvider,
  createProverKey,
  createVerifierKey,
  createZKIR,
  type ProverKey,
  type VerifierKey,
  type ZKIR,
} from '@midnight-ntwrk/midnight-js-types';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Where `compact compile` wrote its output. */
export const MANAGED_DIR = resolve(here, '..', '..', 'contract', 'src', 'managed', 'trien');

/**
 * Serves the compiled ZK artifacts off the local filesystem.
 *
 * The SDK ships `ZKConfigProvider` as an abstract class and no implementation,
 * because where artifacts live is an environment question: Node reads files,
 * the browser fetches URLs. This is the Node half. The browser half lives in
 * `frontend/src/lib/zk-config.ts` and fetches the same files over HTTP.
 *
 * The proof server wants the *binary* ZKIR (`.bzkir`). The human-readable
 * `.zkir` next to it is committed for reviewers and is not used here.
 */
export class NodeZKConfigProvider<K extends string> extends ZKConfigProvider<K> {
  constructor(private readonly baseDir: string = MANAGED_DIR) {
    super();
  }

  private read(...segments: string[]): Promise<Uint8Array> {
    return readFile(resolve(this.baseDir, ...segments));
  }

  async getZKIR(circuitId: K): Promise<ZKIR> {
    return createZKIR(await this.read('zkir', `${circuitId}.bzkir`));
  }

  async getProverKey(circuitId: K): Promise<ProverKey> {
    return createProverKey(await this.read('keys', `${circuitId}.prover`));
  }

  async getVerifierKey(circuitId: K): Promise<VerifierKey> {
    return createVerifierKey(await this.read('keys', `${circuitId}.verifier`));
  }
}
