import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:8791';
const sql = async (statement) => { const response = await post('/fixture/sql', { sql: statement }); if (!response.ok) throw new Error(await response.text()); return response.json(); };
const cookie = (response) => response.headers.get('set-cookie');
const request = (path, init) => fetch(`${base}${path}`, init);
const post = (path, body, headers = {}) => request(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
await sql(await readFile(path.join(fixtureDir, 'rework1-schema.sql'), 'utf8'));
await sql(await readFile(path.join(fixtureDir, 'rework1-seed.sql'), 'utf8'));
const results = [];
const measurements = {};
async function check(name, fn) {
  try { await fn(); results.push({ name, result: 'PASS' }); }
  catch (error) { results.push({ name, result: 'FAIL', error: String(error) }); }
}

await check('health on local Worker', async () => assert.deepEqual(await (await request('/health')).json(), { ok: true }));
await check('schema enum checks reject invalid role', async () => {
  try {
    await sql("INSERT INTO users(id,email,role) VALUES('bad','bad@example.test','SUPERUSER')");
    assert.fail('invalid role unexpectedly inserted');
  } catch (error) { assert.notEqual(error.status, 0); }
});
await check('JWT cookie semantics and revalidated OWNER', async () => {
  const session = await post('/auth/session', { userId: 'owner-1' });
  const token = (await session.json()).token;
  const set = cookie(session);
  assert.match(set, /alquileres_session=/);
  assert.match(set, /HttpOnly/);
  assert.match(set, /Path=\//);
  assert.match(set, /Max-Age=900/);
  assert.match(set, /SameSite=Lax/);
  assert.doesNotMatch(set, /Secure/);
  const res = await request('/auth/me', { headers: { cookie: `alquileres_session=${encodeURIComponent(token)}` } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).role, 'OWNER');
});
await check('JWT rejects tampering, expiry and malformed input', async () => {
  const token = (await (await post('/auth/session', { userId: 'owner-1' })).json()).token;
  const jwtParts = token.split('.');
  const badSignature = `${jwtParts[0]}.${jwtParts[1]}.${jwtParts[2][0] === 'A' ? 'B' : 'A'}${jwtParts[2].slice(1)}`;
  assert.equal((await request('/auth/me', { headers: { authorization: `Bearer ${badSignature}` } })).status, 401);
  assert.equal((await request('/auth/me', { headers: { authorization: 'Bearer invalid' } })).status, 401);
  const parts = token.split('.');
  const expiredPayload = Buffer.from(JSON.stringify({ id: 'owner-1', email: 'owner@example.test', iat: 1, exp: 2 })).toString('base64url');
  const expiredUnsigned = `${parts[0]}.${expiredPayload}`;
  const { createHmac } = await import('node:crypto');
  const expired = `${expiredUnsigned}.${createHmac('sha256', 'synthetic-fixture-secret-only').update(expiredUnsigned).digest('base64url')}`;
  assert.equal((await request('/auth/me', { headers: { authorization: `Bearer ${expired}` } })).status, 401);
  assert.equal((await request('/auth/me')).status, 401);
});
await check('ADMIN role guard and OWNER denial', async () => {
  const owner = (await (await post('/auth/session', { userId: 'owner-1' })).json()).token;
  const admin = (await (await post('/auth/session', { userId: 'admin-1' })).json()).token;
  assert.equal((await request('/admin', { headers: { authorization: `Bearer ${owner}` } })).status, 401);
  assert.equal((await request('/admin', { headers: { authorization: `Bearer ${admin}` } })).status, 200);
});
await check('OWNER isolation hides foreign listing', async () => {
  const token = (await (await post('/auth/session', { userId: 'owner-1' })).json()).token;
  assert.equal((await request('/owner/listings/listing-2', { headers: { authorization: `Bearer ${token}` } })).status, 404);
});
await check('bcryptjs source cost-12 hash verify reveals Free CPU incompatibility', async () => {
  const hash = await bcrypt.hash('synthetic-password-123', 12);
  const valid = await post('/auth/verify-password', { password: 'synthetic-password-123', hash });
  const validBody = await valid.text();
  assert.equal(valid.status, 200, `Worker returned ${valid.status}: ${validBody}`);
  const validResult = JSON.parse(validBody);
  assert.equal(validResult.valid, true);
  const invalid = await post('/auth/verify-password', { password: 'wrong-password', hash });
  const invalidBody = await invalid.text();
  assert.equal(invalid.status, 200, `Worker returned ${invalid.status}: ${invalidBody}`);
  const invalidResult = JSON.parse(invalidBody);
  assert.equal(invalidResult.valid, false);
  const syncResponse = await post('/auth/verify-password-sync', { password: 'synthetic-password-123', hash });
  assert.equal(syncResponse.status, 200);
  const syncResult = await syncResponse.json();
  assert.equal(syncResult.valid, true);
  measurements.bcryptCost12Compare = { asyncCorrectPasswordElapsedMs: validResult.elapsedMs, asyncWrongPasswordElapsedMs: invalidResult.elapsedMs, syncCompareElapsedMs: syncResult.elapsedMs, workerCpuBudgetConfiguredMs: 10 };
  // The synchronous measurement has no I/O or scheduler yield; it is a direct local CPU proxy, not Cloudflare's production meter.
  assert.ok(syncResult.elapsedMs > 10, 'cost-12 bcrypt unexpectedly appeared to fit the Free CPU budget');
});
await check('source-compatible JWT from jsonwebtoken verifies in Worker', async () => {
  const { default: jwt } = await import('jsonwebtoken');
  const token = jwt.sign({ id: 'owner-1', email: 'owner@example.test', role: 'OWNER' }, 'synthetic-fixture-secret-only', { expiresIn: '15m' });
  assert.equal((await request('/auth/me', { headers: { authorization: `Bearer ${token}` } })).status, 200);
  const workerIssued = (await (await post('/auth/session', { userId: 'owner-1' })).json()).token;
  assert.equal(jwt.verify(workerIssued, 'synthetic-fixture-secret-only').id, 'owner-1');
});
await check('Bearer takes precedence over cookie', async () => {
  const owner = (await (await post('/auth/session', { userId: 'owner-1' })).json()).token;
  const admin = (await (await post('/auth/session', { userId: 'admin-1' })).json()).token;
  assert.equal((await request('/admin', { headers: { authorization: `Bearer ${owner}`, cookie: `alquileres_session=${admin}` } })).status, 401);
});

const ownerToken = (await (await post('/auth/session', { userId: 'owner-1' })).json()).token;
const auth = { authorization: `Bearer ${ownerToken}` };
const bytes = Buffer.from('synthetic-image-bytes').toString('base64');
let imageIds = [];
await check('R2 put plus D1 metadata retains ordered public-safe fields', async () => {
  const one = await post('/images', { listingId: 'listing-1', bytes, contentType: 'image/jpeg', position: 0 }, auth);
  const two = await post('/images', { listingId: 'listing-1', bytes, contentType: 'image/jpeg', position: 1 }, auth);
  assert.equal(one.status, 200); assert.equal(two.status, 200);
  const a = await one.json(); const b = await two.json();
  assert.equal(a.position, 0); assert.equal(b.position, 1);
  assert.equal(a.byteSize, Buffer.from('synthetic-image-bytes').length);
  assert.equal('objectKey' in a, false);
  imageIds = [a.id, b.id];
});
await check('R2 write is compensated after injected D1 insert failure', async () => {
  const failed = await post('/images', { listingId: 'listing-1', bytes, contentType: 'image/jpeg', position: 4, failDb: true }, auth);
  assert.equal(failed.status, 500);
  assert.match(await failed.text(), /injected D1 insert failure/);
});
await check('image ownership is enforced before R2 mutation', async () => {
  const outsider = (await (await post('/auth/session', { userId: 'owner-2' })).json()).token;
  const denied = await post('/images', { listingId: 'listing-1', bytes, contentType: 'image/jpeg', position: 2 }, { authorization: `Bearer ${outsider}` });
  assert.equal(denied.status, 404);
});
await check('R2 public delivery requires approved and published listing', async () => {
  const hidden = await request(`/images/public/${imageIds[0]}`);
  assert.equal(hidden.status, 404);
  await sql("UPDATE listings SET status='APPROVED',published=1 WHERE id='listing-1'");
  const publicResponse = await request(`/images/public/${imageIds[0]}`);
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers.get('content-type'), 'image/jpeg');
  assert.equal(await publicResponse.text(), 'synthetic-image-bytes');
});
await check('D1 reorder keeps unique contiguous image positions', async () => {
  await sql("UPDATE listings SET status='DRAFT',published=0 WHERE id='listing-1'");
  const res = await post('/images/reorder', { listingId: 'listing-1', ids: [...imageIds].reverse() }, auth);
  assert.equal(res.status, 200);
  const output = JSON.stringify(await sql("SELECT position FROM listing_images WHERE listing_id='listing-1' ORDER BY position"));
  assert.match(output, /\"position\":0[\s\S]*\"position\":1/);
  await sql("UPDATE listings SET status='APPROVED',published=1 WHERE id='listing-1'");
});
await check('R2 delete is denied for published listing before object mutation', async () => {
  const denied = await request(`/images/delete/${imageIds[0]}`, { method: 'DELETE', headers: auth });
  assert.equal(denied.status, 404);
  assert.equal((await request(`/images/public/${imageIds[0]}`)).status, 200);
});
await check('R2 delete is compensated after injected D1 delete failure', async () => {
  await sql("UPDATE listings SET status='DRAFT',published=0 WHERE id='listing-1'");
  const failed = await request(`/images/delete/${imageIds[0]}?failDb=1`, { method: 'DELETE', headers: auth });
  assert.equal(failed.status, 500);
  const readable = await request(`/images/manage/${imageIds[0]}`, { headers: auth });
  assert.equal(readable.status, 200);
  const restored = await readable.json();
  assert.equal(restored.contentType, 'image/jpeg');
  assert.equal(restored.byteSize, Buffer.from('synthetic-image-bytes').length);
  assert.equal(Buffer.from(restored.bytes, 'base64').toString(), 'synthetic-image-bytes');
  assert.equal('objectKey' in restored, false);
});
await check('successful R2 delete compacts image positions', async () => {
  const deleted = await request(`/images/delete/${imageIds[0]}`, { method: 'DELETE', headers: auth });
  assert.equal(deleted.status, 200);
  const output = JSON.stringify(await sql("SELECT position FROM listing_images WHERE listing_id='listing-1' ORDER BY position"));
  assert.match(output, /\"position\":0/);
  assert.doesNotMatch(output, /\"position\":1/);
});

console.log(JSON.stringify({ total: results.length, passed: results.filter((r) => r.result === 'PASS').length, failed: results.filter((r) => r.result === 'FAIL').length, measurements, results }, null, 2));
if (results.some((r) => r.result === 'FAIL')) process.exitCode = 1;
