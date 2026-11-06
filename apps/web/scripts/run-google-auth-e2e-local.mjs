import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

const webDirectory = process.cwd();
const temporaryRoot = mkdtempSync(join(tmpdir(), 'alquileres-google-auth-e2e-'));
const stateDirectory = join(temporaryRoot, 'd1');
const outputDirectory = join(temporaryRoot, 'playwright-results');
const playwright = resolve(webDirectory, 'node_modules/.bin/playwright');
const workerDirectory = resolve(webDirectory, '../worker');
const templateConfigPath = resolve(workerDirectory, 'wrangler.google-auth-e2e.jsonc');
const generatedConfigPath = resolve(workerDirectory, `.wrangler.google-auth-e2e-${process.pid}.jsonc`);
const signingKeyPath = join(temporaryRoot, 'google-test-signing-key.pem');

try {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  Object.assign(jwk, { kid: 'google-owner-local-test', alg: 'RS256', use: 'sig' });
  const config = JSON.parse(readFileSync(templateConfigPath, 'utf8'));
  config.vars.GOOGLE_AUTH_TEST_JWKS = JSON.stringify({ keys: [jwk] });
  writeFileSync(generatedConfigPath, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  writeFileSync(signingKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });

  const result = spawnSync(playwright, ['test', '--config=playwright.google-auth.local.config.ts'], {
    cwd: webDirectory,
    env: {
      ...process.env,
      GOOGLE_AUTH_E2E_STATE_DIR: stateDirectory,
      GOOGLE_AUTH_E2E_OUTPUT_DIR: outputDirectory,
      GOOGLE_AUTH_E2E_CONFIG: generatedConfigPath,
      GOOGLE_AUTH_E2E_SIGNING_KEY: signingKeyPath,
    },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(generatedConfigPath, { force: true });
  rmSync(temporaryRoot, { recursive: true, force: true });
}
