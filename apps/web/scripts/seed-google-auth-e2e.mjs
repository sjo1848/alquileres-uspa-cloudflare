import { spawnSync } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';
import process from 'node:process';

const stateDirectory = process.env.GOOGLE_AUTH_E2E_STATE_DIR;
if (!stateDirectory || !isAbsolute(stateDirectory)) {
  console.error('GOOGLE_AUTH_E2E_STATE_DIR must be an absolute per-run temporary directory.');
  process.exit(2);
}

const webDirectory = process.cwd();
const workerDirectory = resolve(webDirectory, '../worker');
const workerConfig = process.env.GOOGLE_AUTH_E2E_CONFIG;
if (!workerConfig || !isAbsolute(workerConfig) || !workerConfig.startsWith(`${workerDirectory}/.wrangler.google-auth-e2e-`)) {
  console.error('GOOGLE_AUTH_E2E_CONFIG must point to the private per-run local Worker config.');
  process.exit(2);
}
for (const args of [
  ['d1', 'migrations', 'apply', 'DB', '--local', '--config', workerConfig, '--persist-to', stateDirectory],
  ['d1', 'execute', 'DB', '--local', '--config', workerConfig, '--persist-to', stateDirectory, '--file', '../worker/tests/seed-google-auth-e2e.sql'],
]) {
  const result = spawnSync('npx', ['--no-install', 'wrangler', ...args], {
    cwd: webDirectory,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
