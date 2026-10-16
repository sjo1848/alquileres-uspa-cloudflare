import { env } from 'cloudflare:workers';
import { beforeAll, expect, it } from 'vitest';
import { app } from '../src/index';
import { D1_IMAGE_MAX_BYTES, D1_MEDIA_QUOTA_BYTES, validateImageBytes } from '../src/d1-blob-media';

const secret='synthetic-d1-blob-media-test-secret-at-least-32-bytes';
const bindings={...env,DB:env.DB,JWT_SECRET:secret,MEDIA_STRATEGY:'D1_BLOB'};
const origin='http://localhost';
const png=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9AAAAAElFTkSuQmCC','base64'));
let ownerCookie='',otherCookie='';
const ownerId='owner-d1-blob',otherOwnerId='other-d1-blob';

function request(path:string,method='GET',body?:BodyInit,options:{cookie?:string;key?:string;type?:string;name?:string;origin?:string}={}){
  return app.request(origin+path,{method,headers:{...(options.origin===undefined?{Origin:origin}:{Origin:options.origin}),...(options.cookie?{Cookie:options.cookie}:{}),...(options.key?{'Idempotency-Key':options.key}:{}),...(options.type?{'Content-Type':options.type}:{}),...(options.name?{'X-Image-Name':encodeURIComponent(options.name)}:{})},body},bindings);
}
async function login(email:string){
  const response=await request('/auth/login','POST',JSON.stringify({email,password:'synthetic-owner-password-1'}),{type:'application/json'});
  expect(response.status).toBe(200);return response.headers.get('set-cookie')!.split(';')[0];
}
async function listing(owner=ownerId,status='DRAFT'){
  const id=`d1-image-${crypto.randomUUID()}`,t=new Date().toISOString();
  await env.DB.prepare("INSERT INTO listings(id,owner_id,status,title,description,location,location_search,price_amount,price_period,rental_duration,max_occupants,currency,created_at,updated_at) VALUES(?,?,?,'Imagen de prueba','Fixture sintética','Uspallata','uspallata',100,'MONTH','FLEXIBLE',2,'ARS',?,?)").bind(id,owner,status,t,t).run();return id;
}
async function upload(lid:string,key:string,cookie=ownerCookie,bytes=png,type='image/png',name='casa.png'){
  return request(`/listings/${lid}/images`,'POST',bytes,{cookie,key,type,name});
}
beforeAll(async()=>{
  const hash='$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS',t=new Date().toISOString();
  await env.DB.prepare('INSERT OR REPLACE INTO users(id,email,password_hash,role,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(ownerId,'d1-media-owner@example.test',hash,'OWNER',t,t).run();
  await env.DB.prepare('INSERT OR REPLACE INTO users(id,email,password_hash,role,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(otherOwnerId,'other-d1-media@example.test',hash,'OWNER',t,t).run();
  ownerCookie=await login('d1-media-owner@example.test');otherCookie=await login('other-d1-media@example.test');
});

it('validates actual signatures instead of trusting the declared MIME',()=>{
  expect(validateImageBytes(png,'image/png')).toBe(true);
  expect(validateImageBytes(png,'image/jpeg')).toBe(false);
  expect(validateImageBytes(png,'image/svg+xml')).toBe(false);
});

it('atomically stores BLOB, metadata and idempotency result; replays after later deletion without recreating bytes',async()=>{
  const lid=await listing(),key='upload-replay-1',before=Number(await env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first('used_bytes')),created=await upload(lid,key);
  expect(created.status).toBe(201);const original=await created.json() as any;expect(original).toMatchObject({originalName:'casa.png',contentType:'image/png',sizeBytes:png.length,position:0});
  const privateRead=await request(`/listings/${lid}/images/${original.id}`,'GET',undefined,{cookie:ownerCookie});
  expect(privateRead.status).toBe(200);expect(privateRead.headers.get('content-type')).toContain('image/png');expect(new Uint8Array(await privateRead.arrayBuffer())).toEqual(png);
  expect((await request(`/public/listings/${lid}/images/${original.id}`)).status).toBe(404);
  const removed=await request(`/listings/${lid}/images/${original.id}`,'DELETE',undefined,{cookie:ownerCookie,key:'delete-image-1'});expect(removed.status).toBe(200);
  const replay=await upload(lid,key);expect(replay.status).toBe(201);expect(await replay.json()).toEqual(original);
  expect(await env.DB.prepare('SELECT id FROM listing_images WHERE listing_id=? AND id=?').bind(lid,original.id).first()).toBeNull();
  expect(await env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first('used_bytes')).toBe(before);
});

it('rolls back the BLOB row and quota counter when the idempotency write fails, then recovers on same-key retry',async()=>{
  const lid=await listing(),before=Number(await env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first('used_bytes'));
  await env.DB.exec(`CREATE TRIGGER fail_d1_upload_receipt BEFORE INSERT ON idempotency_records WHEN NEW.scope='IMAGE_ADD:${lid}' BEGIN SELECT RAISE(ABORT,'injected receipt failure'); END;`);
  const failed=await upload(lid,'atomic-upload');expect(failed.status).toBe(503);
  expect(await env.DB.prepare('SELECT id FROM listing_images WHERE listing_id=?').bind(lid).first()).toBeNull();
  expect(await env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first('used_bytes')).toBe(before);
  await env.DB.exec('DROP TRIGGER fail_d1_upload_receipt');
  expect((await upload(lid,'atomic-upload')).status).toBe(201);
});

it('keeps private ownership, CSRF, editable status and request limits enforced',async()=>{
  const lid=await listing(),other=await listing(otherOwnerId);
  expect((await request(`/listings/${lid}/images`,'POST',png,{cookie:ownerCookie,type:'image/jpeg',name:'spoof.jpg',key:'spoof-1'})).status).toBe(400);
  expect((await request(`/listings/${lid}/images`,'POST',png,{cookie:ownerCookie,type:'image/png',name:'../bad.png',key:'bad-name'})).status).toBe(400);
  expect((await request(`/listings/${lid}/images`,'POST',png,{cookie:ownerCookie,type:'image/png',name:'no-origin.png',key:'origin-1',origin:'https://evil.example'})).status).toBe(403);
  expect((await upload(lid,'',ownerCookie)).status).toBe(400);
  const oversized=new Uint8Array(D1_IMAGE_MAX_BYTES+1);oversized.set(png.subarray(0,8));
  expect((await upload(lid,'oversized-1',ownerCookie,oversized,'image/png')).status).toBe(413);
  expect((await request(`/listings/${other}/images`,'GET',undefined,{cookie:ownerCookie})).status).toBe(404);
  expect((await upload(other,'cross-owner-1',ownerCookie)).status).toBe(404);
  await env.DB.prepare("UPDATE listings SET status='SUBMITTED' WHERE id=?").bind(lid).run();
  expect((await request(`/listings/${lid}/images`,'GET',undefined,{cookie:ownerCookie})).status).toBe(404);
  expect((await upload(lid,'submitted-1',ownerCookie)).status).toBe(404);
});

it('reorders densely and deletes with stable idempotent results while returning approved images publicly',async()=>{
  const lid=await listing(),first=await upload(lid,'order-upload-a'),second=await upload(lid,'order-upload-b');
  const a=await first.json() as any,b=await second.json() as any;expect(first.status).toBe(201);expect(second.status).toBe(201);
  const moved=await request(`/listings/${lid}/images/${b.id}`,'PATCH',JSON.stringify({position:0}),{cookie:ownerCookie,key:'reorder-to-front',type:'application/json'});
  expect(moved.status,await moved.clone().text()).toBe(200);expect((await moved.json() as any[]).map(x=>x.id)).toEqual([b.id,a.id]);
  const removed=await request(`/listings/${lid}/images/${b.id}`,'DELETE',undefined,{cookie:ownerCookie,key:'delete-reordered-image'});expect(removed.status).toBe(200);
  expect((await request(`/listings/${lid}/images/${b.id}`,'DELETE',undefined,{cookie:ownerCookie,key:'delete-reordered-image'})).status).toBe(200);
  const images=await (await request(`/listings/${lid}/images`,'GET',undefined,{cookie:ownerCookie})).json() as any[];expect(images).toHaveLength(1);expect(images[0]).toMatchObject({id:a.id,position:0});
  await env.DB.prepare("UPDATE listings SET status='APPROVED',publication_status='PUBLISHED' WHERE id=?").bind(lid).run();
  const listingResponse=await request(`/public/listings/${lid}`);expect(listingResponse.status).toBe(200);expect(((await listingResponse.json() as any).images as any[]).map(x=>x.id)).toEqual([a.id]);
  const publicRead=await request(`/public/listings/${lid}/images/${a.id}`);expect(publicRead.status).toBe(200);expect(new Uint8Array(await publicRead.arrayBuffer())).toEqual(png);
});

it('rolls back a failed reorder batch without leaving staged positions or a false committed result',async()=>{
  const lid=await listing(),one=await upload(lid,'rollback-order-a'),two=await upload(lid,'rollback-order-b'),a=await one.json() as any,b=await two.json() as any;
  await env.DB.exec(`CREATE TRIGGER fail_d1_reorder BEFORE UPDATE OF position ON listing_images WHEN NEW.listing_id='${lid}' AND NEW.position=0 BEGIN SELECT RAISE(ABORT,'injected reorder failure'); END;`);
  const failed=await request(`/listings/${lid}/images/${b.id}`,'PATCH',JSON.stringify({position:0}),{cookie:ownerCookie,key:'rollback-order-key',type:'application/json'});expect(failed.status).toBe(503);
  const unchanged=await env.DB.prepare('SELECT id,position FROM listing_images WHERE listing_id=? ORDER BY position').bind(lid).all();expect(unchanged.results).toEqual([{id:a.id,position:0},{id:b.id,position:1}]);
  expect(await env.DB.prepare("SELECT request_key FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key='rollback-order-key'").bind(ownerId,`IMAGE_D1_REORDER:${lid}:${b.id}`).first()).toBeNull();
  await env.DB.exec('DROP TRIGGER fail_d1_reorder');
  const retry=await request(`/listings/${lid}/images/${b.id}`,'PATCH',JSON.stringify({position:0}),{cookie:ownerCookie,key:'rollback-order-key',type:'application/json'});expect(retry.status).toBe(200);expect(((await retry.json() as any[]).map(x=>x.id))).toEqual([b.id,a.id]);
});

it('enforces the aggregate D1 BLOB cap under concurrent uploads',async()=>{
  const first=await listing(),second=await listing();
  const before=Number(await env.DB.prepare('SELECT COALESCE(SUM(byte_size),0) AS total FROM listing_images WHERE blob_data IS NOT NULL').first('total'));
  await env.DB.prepare('UPDATE media_storage_usage SET used_bytes=? WHERE id=1').bind(D1_MEDIA_QUOTA_BYTES-png.length).run();
  const responses=await Promise.all([upload(first,'quota-race-a'),upload(second,'quota-race-b')]);
  const after=Number(await env.DB.prepare('SELECT COALESCE(SUM(byte_size),0) AS total FROM listing_images WHERE blob_data IS NOT NULL').first('total'));
  await env.DB.prepare('UPDATE media_storage_usage SET used_bytes=? WHERE id=1').bind(after).run();
  expect(responses.map(x=>x.status).sort()).toEqual([201,507]);
  expect(after).toBe(before+png.length);
});

it('caps uploads at twenty photos per listing',async()=>{
  const lid=await listing();
  for(let index=0;index<20;index++)expect((await upload(lid,`count-${index}`)).status).toBe(201);
  expect((await upload(lid,'count-overflow')).status).toBe(409);
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM listing_images WHERE listing_id=? AND blob_data IS NOT NULL').bind(lid).first('count')).toBe(20);
});
