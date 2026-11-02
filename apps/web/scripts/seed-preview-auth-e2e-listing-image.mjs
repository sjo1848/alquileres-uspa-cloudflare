import { spawnSync } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';
import process from 'node:process';

const listingId = process.argv[2];
const stateDirectory = process.env.PREVIEW_AUTH_E2E_STATE_DIR;
if (!stateDirectory || !isAbsolute(stateDirectory)) {
  console.error('PREVIEW_AUTH_E2E_STATE_DIR must be an absolute per-run temporary directory.');
  process.exit(2);
}
if (!listingId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)) {
  console.error('A generated listing UUID is required.');
  process.exit(2);
}

// This local-only fixture associates an existing repository-managed image with
// the listing created by Playwright. It does not enable owner uploads or modify assets.
const sql = `INSERT INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) SELECT 'e2e-static-${listingId}','${listingId}','/media/catalog/cabana-cerro.svg','image/svg+xml',123,0 FROM listings WHERE id='${listingId}' AND NOT EXISTS (SELECT 1 FROM static_listing_images WHERE listing_id='${listingId}');`;
const workerConfig = resolve(process.cwd(), '../worker/wrangler.preview-auth-e2e.jsonc');
const result = spawnSync('npx', [
  '--no-install', 'wrangler', 'd1', 'execute', 'DB', '--local',
  '--config', workerConfig, '--persist-to', stateDirectory, '--command', sql,
], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
