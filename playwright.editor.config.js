import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.js';

export default defineConfig({
  ...baseConfig,
  // Production car previews run in their own four merge-gating shards.
  testIgnore: [/race-physics-feel\.spec\.js$/, /car-catalog-preview\.spec\.js$/]
});
