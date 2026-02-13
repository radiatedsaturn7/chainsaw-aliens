import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
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
