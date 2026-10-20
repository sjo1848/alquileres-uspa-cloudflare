import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'public-journey.spec.ts',
  outputDir: '/tmp/cf-au-i06.4-playwright-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    browserName: 'chromium',
    launchOptions: { channel: 'chrome' },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run seed:local && npm run dev -- --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
