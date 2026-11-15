import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Saved artwork produces very large Git diffs; do not embed them in test reports.
  captureGitInfo: { commit: false, diff: false },
  testDir: './tests/playwright',
  fullyParallel: true,
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'node tools/playwright/static-server.cjs',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
