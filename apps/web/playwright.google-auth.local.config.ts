import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'google-auth-local.spec.ts',
  outputDir: process.env.GOOGLE_AUTH_E2E_OUTPUT_DIR ?? '/tmp/cf-au-m3-5-google-auth-playwright-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 12_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5178',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run seed:google-auth-e2e && npm run dev -- --port 5178 --strictPort',
    url: 'http://127.0.0.1:5178/api/health',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      CF_PREVIEW_CONFIG: process.env.GOOGLE_AUTH_E2E_CONFIG ?? '../worker/wrangler.google-auth-e2e.jsonc',
      GOOGLE_AUTH_E2E_STATE_DIR: process.env.GOOGLE_AUTH_E2E_STATE_DIR ?? '',
      GOOGLE_AUTH_E2E_SIGNING_KEY: process.env.GOOGLE_AUTH_E2E_SIGNING_KEY ?? '',
    },
  },
});
