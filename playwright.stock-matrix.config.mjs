import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/playwright',
  testMatch:'stock-render-matrix.spec.js',
  workers:1, timeout:120_000,
  captureGitInfo:{commit:false,diff:false},
  use:{baseURL:'http://127.0.0.1:4173',launchOptions:{chromiumSandbox:true},trace:'off'},
  webServer:{command:'node tools/playwright/static-server.cjs', port:4173,reuseExistingServer:false,timeout:30_000}
});
