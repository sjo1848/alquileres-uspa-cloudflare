import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));
assert.equal(process.argv.length, 2, 'local fixture runner rejects all forwarded flags and arguments');
const config = JSON.parse(await readFile(path.join(fixtureDir, 'wrangler.jsonc'), 'utf8'));
assert.equal(config.vars?.LOCAL_FIXTURE_ONLY, undefined, 'tracked Wrangler config must not enable local fixture inspection hooks');
await writeFile(path.join(fixtureDir, '.dev.vars'), [
  'JWT_SECRET=synthetic-fixture-secret-only',
  'COOKIE_SAME_SITE=lax',
  'NODE_ENV=development',
  ''
].join('\n'));
const wrangler = path.join(fixtureDir, 'node_modules/wrangler/bin/wrangler.js');
const child = spawn(process.execPath, [wrangler, 'dev', '--config', 'wrangler.jsonc', '--local', '--var', 'LOCAL_FIXTURE_ONLY:true', '--port', '8791'], {
  cwd: fixtureDir,
  stdio: 'inherit'
});
child.on('error', (error) => { console.error(error); process.exitCode = 1; });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
