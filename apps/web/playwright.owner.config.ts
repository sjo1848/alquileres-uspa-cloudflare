import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'owner-journey.spec.ts',
  outputDir: '/tmp/cf-au-i06.5-owner-playwright-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5175',
    browserName: 'chromium',
    launchOptions: { channel: 'chrome' },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run seed:owner-e2e && npm run dev -- --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175/api/health',
    reuseExistingServer: false,
    timeout: 180_000,
    env: { CF_PREVIEW_CONFIG: '../worker/wrangler.owner-e2e.runtime.jsonc' },
  },
});
