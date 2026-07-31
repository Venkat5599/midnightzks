import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

/**
 * The Midnight SDK is WebAssembly wearing a JavaScript coat, and the three
 * plugins below are what let it run in a browser at all:
 *
 * - `wasm` + `topLevelAwait`: the ledger and zswap packages instantiate their
 *   WASM modules with a top-level `await`, which esbuild cannot lower alone.
 * - `nodePolyfills`: those same packages reach for `Buffer` and `process`,
 *   having been written for Node first.
 *
 * Dropping any one of them produces a build that succeeds and a page that dies
 * on first import, so they are not optional conveniences.
 */
export default defineConfig({
  /*
   * GitHub Pages serves this project from /mn/, not from the domain root.
   * Left at the default, Vite emits root-absolute asset URLs that 404 there
   * and the page renders blank -- with a green build, which is the annoying
   * part. Local dev and preview keep the root base.
   */
  base: process.env.VITE_BASE ?? '/',

  plugins: [react(), wasm(), topLevelAwait(), nodePolyfills({ include: ['buffer', 'process'] })],

  optimizeDeps: {
    // Pre-bundling rewrites these packages in ways that break their WASM
    // initialisation, so they are handed to the browser as published.
    exclude: [
      '@midnight-ntwrk/compact-runtime',
      '@midnight-ntwrk/ledger',
      '@midnight-ntwrk/onchain-runtime-v3',
      '@midnight-ntwrk/zswap',
    ],
    esbuildOptions: { target: 'esnext' },
  },

  build: {
    // WASM instantiation needs top-level await, which is ES2022+.
    target: 'esnext',
  },

  server: { port: 5173 },
});
