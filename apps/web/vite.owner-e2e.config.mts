import process from 'node:process';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { cloudflare } from '@cloudflare/vite-plugin';
export default defineConfig({
  plugins: [vue(), cloudflare({ configPath: '../worker/wrangler.owner-e2e.runtime.jsonc', persistState: { path: process.env.CF_E2E_STATE! } })],
});
