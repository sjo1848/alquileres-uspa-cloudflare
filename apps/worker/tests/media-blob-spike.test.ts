import { env } from 'cloudflare:workers';
import { beforeAll, expect, it } from 'vitest';

// Bounded capability experiment, not an OWNER upload implementation.
// Falsification: bytes differ, batch leaks partial state, or quota admits both writers.
beforeAll(async () => {
  await env.DB.exec('CREATE TABLE blob_spike(id TEXT PRIMARY KEY, bytes BLOB NOT NULL, size INTEGER NOT NULL CHECK(size=length(bytes)));');
  await env.DB.exec('CREATE TABLE blob_spike_results(request_key TEXT PRIMARY KEY, response_json TEXT NOT NULL);');
  await env.DB.exec("CREATE TRIGGER blob_spike_quota BEFORE INSERT ON blob_spike WHEN (SELECT COALESCE(SUM(size),0) FROM blob_spike)+NEW.size>262144 BEGIN SELECT RAISE(ABORT,'quota exceeded'); END;");
});

it('round-trips a 256 KiB BLOB exactly and retains a committed result after deletion', async () => {
  const bytes = Uint8Array.from({length:262144}, (_,i) => i%251);
  const result = JSON.stringify({id:'roundtrip',size:bytes.length});
  await env.DB.batch([
    env.DB.prepare('INSERT INTO blob_spike VALUES(?,?,?)').bind('roundtrip',bytes.buffer,bytes.length),
    env.DB.prepare('INSERT INTO blob_spike_results VALUES(?,?)').bind('request-one',result),
  ]);
  const row = await env.DB.prepare('SELECT bytes FROM blob_spike WHERE id=?').bind('roundtrip').first<{bytes:number[]}>();
  expect(new Uint8Array(row!.bytes)).toEqual(bytes);
  await env.DB.prepare('DELETE FROM blob_spike WHERE id=?').bind('roundtrip').run();
  expect(await env.DB.prepare('SELECT response_json FROM blob_spike_results WHERE request_key=?').bind('request-one').first('response_json')).toBe(result);
  expect(await env.DB.prepare('SELECT id FROM blob_spike WHERE id=?').bind('roundtrip').first()).toBeNull();
});

it('rolls back bytes and result if a later batch statement fails', async () => {
  await expect(env.DB.batch([
    env.DB.prepare('INSERT INTO blob_spike VALUES(?,?,?)').bind('rollback',new Uint8Array([1,2,3]).buffer,3),
    env.DB.prepare('INSERT INTO blob_spike_results VALUES(?,?)').bind('rollback','{}'),
    env.DB.prepare('INSERT INTO blob_spike VALUES(?,?,?)').bind('bad',new Uint8Array([1]).buffer,2),
  ])).rejects.toThrow();
  expect(await env.DB.prepare("SELECT id FROM blob_spike WHERE id='rollback'").first()).toBeNull();
  expect(await env.DB.prepare("SELECT request_key FROM blob_spike_results WHERE request_key='rollback'").first()).toBeNull();
});

it('enforces the final available byte quota under concurrent writes', async () => {
  const bytes = new Uint8Array(180000);
  const results = await Promise.allSettled(['race-a','race-b'].map(id => env.DB.prepare('INSERT INTO blob_spike VALUES(?,?,?)').bind(id,bytes.buffer,bytes.length).run()));
  expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM blob_spike').first('count')).toBe(1);
});
