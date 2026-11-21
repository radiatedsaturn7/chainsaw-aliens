import {defineConfig} from '@playwright/test';
import config from './playwright.config.js';

// Supplemental QA only. The base checkout/config remains byte-identical.
export default defineConfig({
  ...config,
  workers: 2,
  retries: 0,
  outputDir: 'artifacts/scenery-private-smoke',
  use: { ...config.use, launchOptions: { ...config.use?.launchOptions, chromiumSandbox: true }, trace: 'retain-on-failure' }
});
