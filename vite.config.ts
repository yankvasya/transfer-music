/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Loads the app's own CSS asynchronously (media="print" + onload swap) so it never
// blocks first paint. The critical above-the-fold styles are inlined directly in
// index.html, so the hero paints immediately; this full stylesheet applies the rest
// (and re-applies the same hero rules) as soon as it's ready.
function asyncCssPlugin(): Plugin {
  return {
    name: 'async-css',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="stylesheet" crossorigin href="([^"]+\.css)">/,
        `<link rel="stylesheet" href="$1" media="print" onload="this.media='all'">`
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), asyncCssPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // BridgeQueue's regression test waits through ImporterProgress's real onDone delay
    // (1.5s per queued item), so the default 5s timeout isn't enough for a 2-item queue.
    testTimeout: 15000,
  },
})
