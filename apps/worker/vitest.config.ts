import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: path.join(root, 'wrangler.jsonc') },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(root, 'migrations')),
        },
      },
    })),
  ],
  test: {
    include: ['tests/public-listings.test.ts', 'tests/contact-workflow.test.ts', 'tests/media-blob-spike.test.ts', 'tests/owner-d1-blob-media.test.ts', 'tests/owner-lifecycle.test.ts', 'tests/admin-moderation.test.ts', 'tests/preview-auth.test.ts'],
    setupFiles: ['./tests/apply-migrations.ts'],
  },
});
