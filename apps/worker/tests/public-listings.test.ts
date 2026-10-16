import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import worker, { app } from '../src/index';

const png = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII='),
  (character) => character.charCodeAt(0),
);
const created = new Date(Date.now() - 60_000).toISOString();

async function get(path: string) {
  return app.request(`http://localhost${path}`, {}, env);
}

beforeAll(async () => {
  const db = env.DB;
  await db
    .prepare(
      'INSERT INTO users(id,email,password_hash,role,created_at,updated_at) VALUES(?,?,?,?,?,?)',
    )
    .bind('synthetic-owner', 'owner@example.test', 'not-used', 'OWNER', created, created)
    .run();
  const insertListing = db.prepare(
    'INSERT INTO listings(id,owner_id,status,title,description,location,price_amount,price_period,rental_duration,max_occupants,currency,publication_status,availability_status,last_confirmed_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
  );
  await db.batch([
    insertListing.bind('public-new', 'synthetic-owner', 'APPROVED', 'Casa del arroyo', 'Casa luminosa cerca del arroyo.', 'Uspallata', 45000, 'WEEK', 'WEEKS', 4, 'ARS', 'PUBLISHED', 'AVAILABLE', created, created, created),
    insertListing.bind('public-old', 'synthetic-owner', 'APPROVED', 'Cabaña del cerro', 'Cabaña para descansar.', 'Área %_ centro', 80000, 'MONTH', 'MONTHS', 2, 'ARS', 'PUBLISHED', 'UNAVAILABLE', new Date(Date.now() - 60 * 86400000).toISOString(), '2026-10-09T12:00:00.000Z', created),
    insertListing.bind('draft-hidden', 'synthetic-owner', 'DRAFT', 'Borrador privado', 'No debe aparecer.', 'Uspallata', 12000, 'WEEK', 'WEEKS', 1, 'ARS', 'PUBLISHED', 'AVAILABLE', created, '2026-10-11T12:00:00.000Z', created),
    insertListing.bind('unpublished-hidden', 'synthetic-owner', 'APPROVED', 'No publicada', 'No debe aparecer.', 'Uspallata', 12000, 'WEEK', 'WEEKS', 1, 'ARS', 'UNPUBLISHED', 'AVAILABLE', created, '2026-10-12T12:00:00.000Z', created),
  ]);
  await db.prepare('UPDATE listings SET location_search=? WHERE id=?').bind('área %_ centro','public-old').run();
  await env.IMAGES.put('public/test.png', png, { httpMetadata: { contentType: 'image/png' } });
  await env.IMAGES.put('private/draft.png', png, { httpMetadata: { contentType: 'image/png' } });
  await db.batch([
    db.prepare('INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('public-image', 'public-new', 'public/test.png', 'test.png', 'image/png', png.byteLength, 0, created, created),
    db.prepare('INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('draft-image', 'draft-hidden', 'private/draft.png', 'draft.png', 'image/png', png.byteLength, 0, created, created),
  ]);
});

describe('public catalog and property details', () => {
  it('returns source-shaped public listings and filters without leaking drafts', async () => {
    const response = await get('/public/listings?location=uspallata&minPriceAmount=40000&availableOnly=true');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const page = (await response.json()) as any;
    expect(page).toMatchObject({ page: 1, pageSize: 20, totalItems: 1, totalPages: 1 });
    expect(page.items[0]).toMatchObject({
      id: 'public-new', title: 'Casa del arroyo', domainDataStatus: 'COMPLETE',
      availabilityStatus: 'AVAILABLE', freshnessStatus: 'FRESH',
      images: [{ id: 'public-image', contentType: 'image/png', sizeBytes: png.byteLength, position: 0 }],
    });
    expect(JSON.stringify(page)).not.toContain('object_key');
    expect(JSON.stringify(page)).not.toContain('owner@example.test');
  });

  it('paginates and follows the approved/published visibility rule on detail and images', async () => {
    const page = (await (await get('/public/listings?pageSize=1')).json()) as any;
    expect(page.items).toHaveLength(1);
    expect(page.totalItems).toBe(2);
    expect(page.totalPages).toBe(2);
    expect((await get('/public/listings/draft-hidden')).status).toBe(404);
    expect((await get('/public/listings/unpublished-hidden')).status).toBe(404);
    expect((await get('/public/listings/draft-hidden/images/draft-image')).status).toBe(404);
    const image = await get('/public/listings/public-new/images/public-image');
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/png');
    expect(image.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(png);
  });

  it('routes the API prefix independently from the property SPA route', async () => {
    const health = await worker.fetch(new Request('http://localhost/api/health'), env, {} as ExecutionContext);
    expect(await health.json()).toEqual({ok:true});
    const denied = await worker.fetch(new Request('http://localhost/api/listings'), env, {} as ExecutionContext);
    expect(denied.status).toBe(503);
    expect(denied.headers.get('content-type')).toContain('application/json');
  });

  it('uses literal Unicode-normalized location search', async () => {
    for (const location of ['ÁREA', '%_', 'ÁREA %_']) {
      const page = await (await get('/public/listings?location=' + encodeURIComponent(location))).json() as any;
      expect(page.items.map((x:any)=>x.id)).toEqual(['public-old']);
    }
    const page = await (await get('/public/listings?location=' + encodeURIComponent('_missing%'))).json() as any;
    expect(page.totalItems).toBe(0);
  });

  it('rejects invalid pagination, enum, availability and price-range queries', async () => {
    for (const query of [
      '?page=1.5', '?pageSize=51', '?currency=EUR', '?availableOnly=yes',
      '?minPriceAmount=100&maxPriceAmount=10',
    ]) expect((await get(`/public/listings${query}`)).status).toBe(400);
  });
});
