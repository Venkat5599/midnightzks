import {
  ZKConfigProvider,
  createProverKey,
  createVerifierKey,
  createZKIR,
  type ProverKey,
  type VerifierKey,
  type ZKIR,
} from '@midnight-ntwrk/midnight-js-types';
import { ZK_ASSETS_BASE } from '../config';

/**
 * Serves the compiled ZK artifacts over HTTP.
 *
 * The SDK ships `ZKConfigProvider` as an abstract class and no implementation,
 * because where artifacts live is an environment question: Node reads files,
 * the browser fetches URLs. This is the browser half — the Node half lives in
 * `deploy/src/zk-config.ts`. The files themselves are committed under
 * `contract/src/managed/trien/` and copied to `frontend/public/zk/` at build
 * time so the same artifacts prove in the browser as on the backend.
 *
 * The proof server wants the *binary* ZKIR (`.bzkir`); the readable `.zkir`
 * next to it is for reviewers and is not fetched here.
 */
export class HttpZKConfigProvider<K extends string> extends ZKConfigProvider<K> {
  private readonly base: string;

  constructor(base: string = ZK_ASSETS_BASE) {
    super();
    this.base = base.endsWith('/') ? base.slice(0, -1) : base;
  }

  private async fetchBytes(...segments: string[]): Promise<Uint8Array> {
    const url = `${this.base}/${segments.join('/')}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`ZK artifact not found: ${url} (HTTP ${res.status})`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  async getZKIR(circuitId: K): Promise<ZKIR> {
    return createZKIR(await this.fetchBytes('zkir', `${circuitId}.bzkir`));
  }

  async getProverKey(circuitId: K): Promise<ProverKey> {
    return createProverKey(await this.fetchBytes('keys', `${circuitId}.prover`));
  }

  async getVerifierKey(circuitId: K): Promise<VerifierKey> {
    return createVerifierKey(await this.fetchBytes('keys', `${circuitId}.verifier`));
  }
}