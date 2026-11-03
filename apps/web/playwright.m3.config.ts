import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'm3-selection.spec.ts',
  outputDir: '/tmp/cf-au-m3-playwright-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5178',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run seed:local && npm run dev -- --port 5178 --strictPort',
    url: 'http://127.0.0.1:5178/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
