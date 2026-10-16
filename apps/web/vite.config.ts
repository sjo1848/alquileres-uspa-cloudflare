import process from 'node:process';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [vue(), cloudflare({ configPath: process.env.CF_PREVIEW_CONFIG ?? '../worker/wrangler.jsonc' })],
});
