/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // BridgeQueue's regression test waits through ImporterProgress's real onDone delay
    // (1.5s per queued item), so the default 5s timeout isn't enough for a 2-item queue.
    testTimeout: 15000,
  },
})
