import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

const webDirectory = process.cwd();
const temporaryRoot = mkdtempSync(join(tmpdir(), 'alquileres-preview-auth-e2e-'));
const stateDirectory = join(temporaryRoot, 'd1');
const outputDirectory = join(temporaryRoot, 'playwright-results');
const playwright = resolve(webDirectory, 'node_modules/.bin/playwright');

try {
  const result = spawnSync(playwright, ['test', '--config=playwright.preview-auth.local.config.ts'], {
    cwd: webDirectory,
    env: {
      ...process.env,
      PREVIEW_AUTH_E2E_STATE_DIR: stateDirectory,
      PREVIEW_AUTH_E2E_OUTPUT_DIR: outputDirectory,
    },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
