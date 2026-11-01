import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'preview-auth-local.spec.ts',
  outputDir: '/tmp/cf-au-i64-preview-auth-playwright-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 12_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5177',
    browserName: 'chromium',
    launchOptions: { channel: 'chrome' },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run seed:preview-auth-e2e && npm run dev -- --port 5177 --strictPort',
    url: 'http://127.0.0.1:5177/api/health',
    reuseExistingServer: false,
    timeout: 180_000,
    env: { CF_PREVIEW_CONFIG: '../worker/wrangler.preview-auth-e2e.jsonc' },
  },
});
