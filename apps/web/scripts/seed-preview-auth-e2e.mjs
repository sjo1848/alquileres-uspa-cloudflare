import { spawnSync } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';
import process from 'node:process';

const stateDirectory = process.env.PREVIEW_AUTH_E2E_STATE_DIR;
if (!stateDirectory || !isAbsolute(stateDirectory)) {
  console.error('PREVIEW_AUTH_E2E_STATE_DIR must be an absolute per-run temporary directory.');
  process.exit(2);
}

const webDirectory = process.cwd();
const workerConfig = resolve(webDirectory, '../worker/wrangler.preview-auth-e2e.jsonc');
const seedFiles = [
  resolve(webDirectory, '../worker/tests/seed-owner-e2e.sql'),
  resolve(webDirectory, '../worker/tests/seed-preview-auth-e2e.sql'),
];

function wrangler(args) {
  const result = spawnSync('npx', ['--no-install', 'wrangler', ...args], {
    cwd: webDirectory,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

wrangler(['d1', 'migrations', 'apply', 'DB', '--local', '--config', workerConfig, '--persist-to', stateDirectory]);
for (const file of seedFiles) {
  wrangler(['d1', 'execute', 'DB', '--local', '--config', workerConfig, '--persist-to', stateDirectory, '--file', file]);
}
