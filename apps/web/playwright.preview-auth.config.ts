import { defineConfig } from '@playwright/test';

const clientId=process.env.CF_ACCESS_CLIENT_ID;
const clientSecret=process.env.CF_ACCESS_CLIENT_SECRET;
if(process.env.PREVIEW_QA_ALLOW_REMOTE_D1_WRITES!=='true')throw new Error('This remote Preview E2E creates synthetic auth-session rows in D1. It is disabled until remote D1 test writes are separately authorized; no credential will be used.');
if(!clientId||!clientSecret)throw new Error('Remote Preview auth requires CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET in the local secret environment.');
if(!/^[A-Za-z0-9._-]{8,128}$/.test(clientId))throw new Error('CF_ACCESS_CLIENT_ID has an invalid format.');

export default defineConfig({
  testDir:'./e2e',
  testMatch:'preview-access-readonly.spec.ts',
  outputDir:'/tmp/alquileres-preview-access-playwright',
  fullyParallel:false,
  workers:1,
  retries:0,
  timeout:60_000,
  expect:{timeout:10_000},
  reporter:'list',
  use:{
    baseURL:'https://private-alquileres-uspa-lab.sjo1848.workers.dev',
    browserName:'chromium',
    launchOptions:{channel:'chrome'},
    screenshot:'off',
    trace:'off',
    video:'off',
  },
});
