import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../../tests/playwright',
  testMatch: 'race-environments.spec.js',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4226',
    launchOptions: process.env.RACE_QA_CHROMIUM ? {
      executablePath: process.env.RACE_QA_CHROMIUM,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    } : {},
  },
  webServer: {
    command: 'PORT=4226 node tools/playwright/static-server.cjs',
    cwd: new URL('../..', import.meta.url).pathname,
    port: 4226,
    timeout: 30000,
  },
  outputDir: '../../test-results/race-environments',
});
