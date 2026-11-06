import process from 'node:process';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [vue(), cloudflare({
    configPath: process.env.CF_PREVIEW_CONFIG ?? '../worker/wrangler.jsonc',
    ...((process.env.PREVIEW_AUTH_E2E_STATE_DIR||process.env.GOOGLE_AUTH_E2E_STATE_DIR)
      ? { persistState: { path: process.env.PREVIEW_AUTH_E2E_STATE_DIR||process.env.GOOGLE_AUTH_E2E_STATE_DIR! } }
      : {}),
  })],
});
