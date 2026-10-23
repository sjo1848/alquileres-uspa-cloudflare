import { env } from 'cloudflare:workers';
import { beforeAll, expect, it } from 'vitest';
import { app } from '../src/index';
import { D1_IMAGE_MAX_BYTES, D1_MEDIA_QUOTA_BYTES, validateImageBytes } from '../src/d1-blob-media';

const secret='synthetic-d1-blob-media-test-secret-at-least-32-bytes';
const bindings={...env,DB:env.DB,JWT_SECRET:secret,MEDIA_STRATEGY:'D1_BLOB'};
const origin='http://localhost';
const png=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9AAAAAElFTkSuQmCC','base64'));
const jpeg=new Uint8Array(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDmKKKK/QT8+P/Z','base64'));
const webp=new Uint8Array(Buffer.from('UklGRjoAAABXRUJQVlA4IC4AAAAQAgCdASoCAAIAAUAmJaACdLoB+AH4AAPIAP7udn/+oLQ18vxov/U4MHPn4/wA','base64'));
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
  await env.DB.prepare('INSERT OR REPLACE INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at) VALUES(?,?,?,?,?,?,?)').bind(ownerId,'d1-media-owner@example.test',hash,'OWNER',t,t,t).run();
  await env.DB.prepare('INSERT OR REPLACE INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at) VALUES(?,?,?,?,?,?,?)').bind(otherOwnerId,'other-d1-media@example.test',hash,'OWNER',t,t,t).run();
  ownerCookie=await login('d1-media-owner@example.test');otherCookie=await login('other-d1-media@example.test');
});

it('decodes actual image data instead of trusting the declared MIME or header markers',async()=>{
  expect(await validateImageBytes(png,'image/png')).toBe(true);
  expect(await validateImageBytes(jpeg,'image/jpeg')).toBe(true);
  expect(await validateImageBytes(webp,'image/webp')).toBe(true);
  const overPixelLimit=png.slice();overPixelLimit.set([0,0,11,184],16);overPixelLimit.set([0,0,11,184],20);
  expect(await validateImageBytes(overPixelLimit,'image/png')).toBe(false);
  expect(await validateImageBytes(png,'image/jpeg')).toBe(false);
  expect(await validateImageBytes(png,'image/svg+xml')).toBe(false);
  const acceptedListing=await listing();
  for(const [bytes,type,name,key] of [[jpeg,'image/jpeg','valid.jpg','valid-jpeg'],[webp,'image/webp','valid.webp','valid-webp']] as const){
    const stored=await upload(acceptedListing,key,ownerCookie,bytes,type,name);expect(stored.status,await stored.clone().text()).toBe(201);
    const item=await stored.json() as any,read=await request(`/listings/${acceptedListing}/images/${item.id}`,'GET',undefined,{cookie:ownerCookie});
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(bytes);
  }
  const malformed=new Uint8Array(45);
  malformed.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0]);
  malformed.set([0,0,0,0,0,0,0,0,73,69,78,68,0,0,0,0],29);
  expect(await validateImageBytes(malformed,'image/png')).toBe(false);
  const lid=await listing(),usageBefore=await env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first('used_bytes');
  expect((await upload(lid,'malformed-png',ownerCookie,malformed)).status).toBe(400);
  expect(await env.DB.prepare('SELECT id FROM listing_images WHERE listing_id=?').bind(lid).first()).toBeNull();
  expect(await env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first('used_bytes')).toBe(usageBefore);
  const scan=jpeg.findIndex((value,index)=>value===0xff&&jpeg[index+1]===0xda),scanLength=(jpeg[scan+2]<<8)|jpeg[scan+3];
  const truncatedJpeg=new Uint8Array([...jpeg.slice(0,scan+2+scanLength),0xff,0xd9]);
  expect(await validateImageBytes(truncatedJpeg,'image/jpeg')).toBe(false);
  const truncatedWebp=webp.slice(0,30);truncatedWebp[4]=22;truncatedWebp[5]=0;truncatedWebp[6]=0;truncatedWebp[7]=0;truncatedWebp[16]=10;truncatedWebp[17]=0;truncatedWebp[18]=0;truncatedWebp[19]=0;
  expect(await validateImageBytes(truncatedWebp,'image/webp')).toBe(false);
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
  expect((await request(`/listings/${lid}/images`,'GET',undefined,{cookie:ownerCookie})).status).toBe(200);
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
  const ownerImages=await request(`/listings/${lid}/images`,'GET',undefined,{cookie:ownerCookie});
  expect(ownerImages.status).toBe(200);expect(await ownerImages.json()).toMatchObject([{id:a.id,position:0,originalName:'casa.png'}]);
  const privateApprovedImage=await request(`/listings/${lid}/images/${a.id}`,'GET',undefined,{cookie:ownerCookie});
  expect(privateApprovedImage.status).toBe(200);expect(privateApprovedImage.headers.get('cache-control')).toContain('private');expect(new Uint8Array(await privateApprovedImage.arrayBuffer())).toEqual(png);
  expect((await request(`/listings/${lid}/images`,'GET',undefined,{cookie:otherCookie})).status).toBe(404);
  expect((await request(`/listings/${lid}/images/${a.id}`,'GET',undefined,{cookie:otherCookie})).status).toBe(404);
  expect((await upload(lid,'approved-image-upload',ownerCookie)).status).toBe(404);
  expect((await request(`/listings/${lid}/images/${a.id}`,'PATCH',JSON.stringify({position:0}),{cookie:ownerCookie,key:'approved-image-reorder',type:'application/json'})).status).toBe(404);
  expect((await request(`/listings/${lid}/images/${a.id}`,'DELETE',undefined,{cookie:ownerCookie,key:'approved-image-delete'})).status).toBe(404);
  expect(await env.DB.prepare('SELECT id,position FROM listing_images WHERE listing_id=?').bind(lid).all()).toMatchObject({results:[{id:a.id,position:0}]});
  const listingResponse=await request(`/public/listings/${lid}`);expect(listingResponse.status).toBe(200);expect(((await listingResponse.json() as any).images as any[]).map(x=>x.id)).toEqual([a.id]);
  const publicRead=await request(`/public/listings/${lid}/images/${a.id}`);expect(publicRead.status).toBe(200);expect(new Uint8Array(await publicRead.arrayBuffer())).toEqual(png);
});

it('continues to expose repository-managed Static Assets when D1 BLOB is the Preview strategy',async()=>{
  const lid=await listing(ownerId,'APPROVED');
  await env.DB.prepare("UPDATE listings SET publication_status='PUBLISHED' WHERE id=?").bind(lid).run();
  await env.DB.prepare('INSERT INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES(?,?,?,?,?,?)').bind('static-kept-'+lid,lid,'/media/catalog/synthetic.svg','image/svg+xml',123,0).run();
  const page=await request(`/public/listings/${lid}`),body=await page.json() as any;
  expect(page.status).toBe(200);expect(body.images).toEqual([{id:'static-kept-'+lid,contentType:'image/svg+xml',sizeBytes:123,position:0,url:'/media/catalog/synthetic.svg'}]);
  const ownerImages=await request(`/listings/${lid}/images`,'GET',undefined,{cookie:ownerCookie}),ownerRows=await ownerImages.json() as any[];
  expect(ownerImages.status).toBe(200);expect(ownerRows).toEqual([{id:'static-kept-'+lid,originalName:'synthetic.svg',contentType:'image/svg+xml',sizeBytes:123,position:0,source:'STATIC_ASSET'}]);
  const privateOwnerAsset=await request(`/listings/${lid}/images/static-kept-${lid}`,'GET',undefined,{cookie:ownerCookie});
  expect(privateOwnerAsset.status).toBe(302);expect(privateOwnerAsset.headers.get('location')).toBe('/media/catalog/synthetic.svg');
  expect((await request(`/listings/${lid}/images`,'GET',undefined,{cookie:otherCookie})).status).toBe(404);
  expect((await request(`/listings/${lid}/images/static-kept-${lid}`,'GET',undefined,{cookie:otherCookie})).status).toBe(404);
  const image=await request(`/public/listings/${lid}/images/static-kept-${lid}`);
  expect(image.status).toBe(302);expect(image.headers.get('location')).toBe('/media/catalog/synthetic.svg');
});

it('merges repository and OWNER-uploaded photos in their stored position order',async()=>{
  const lid=await listing();
  const created=await upload(lid,`dynamic-before-static-${lid}`),dynamic=await created.json() as any;
  expect(created.status).toBe(201);expect(dynamic.position).toBe(0);
  await env.DB.prepare('INSERT INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES(?,?,?,?,?,?)').bind(`static-after-upload-${lid}`,lid,'/media/catalog/static-after-upload.svg','image/svg+xml',123,1).run();
  const ownerRows=await request(`/listings/${lid}/images`,'GET',undefined,{cookie:ownerCookie});
  expect(ownerRows.status).toBe(200);
  expect((await ownerRows.json() as any[]).map(row=>[row.id,row.position,row.source??'OWNER_UPLOAD'])).toEqual([
    [dynamic.id,0,'OWNER_UPLOAD'],[`static-after-upload-${lid}`,1,'STATIC_ASSET'],
  ]);
  const tiedStaticId=`aaa-static-tie-${lid}`;
  await env.DB.prepare('INSERT INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES(?,?,?,?,?,?)').bind(tiedStaticId,lid,'/media/catalog/static-tie.svg','image/svg+xml',123,0).run();
  const tieOrder=dynamic.id<tiedStaticId?[dynamic.id,tiedStaticId]:[tiedStaticId,dynamic.id];
  const expectedMixed:Array<[string,number]>=[[tieOrder[0],0],[tieOrder[1],0],[`static-after-upload-${lid}`,1]];
  const mixedOwner=await request(`/listings/${lid}/images`,'GET',undefined,{cookie:ownerCookie});
  expect((await mixedOwner.json() as any[]).map(row=>[row.id,row.position])).toEqual(expectedMixed);
  await env.DB.prepare("UPDATE listings SET status='APPROVED',publication_status='PUBLISHED' WHERE id=?").bind(lid).run();
  const publicListing=await request(`/public/listings/${lid}`),publicBody=await publicListing.json() as any;
  expect(publicListing.status).toBe(200);
  expect(publicBody.images.map((row:any)=>[row.id,row.position])).toEqual(expectedMixed);
});

it('fails closed with a migration conflict for legacy R2 rows in D1 BLOB mode',async()=>{
  const lid=await listing(),legacyId='legacy-r2-'+lid,created=new Date().toISOString();
  await env.DB.prepare("UPDATE listings SET location='Legacy Probe',location_search='legacy probe' WHERE id=?").bind(lid).run();
  await env.DB.prepare('INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(legacyId,lid,'legacy-r2-object-'+lid,'old.jpg','image/jpeg',64,0,created,created).run();
  const assertConflict=async(response:Response)=>{expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:'LEGACY_MEDIA_MIGRATION_REQUIRED'});};
  await assertConflict(await request(`/listings/${lid}/images`,'GET',undefined,{cookie:ownerCookie}));
  await assertConflict(await upload(lid,'legacy-conflict-upload'));
  await assertConflict(await request(`/listings/${lid}/images/${legacyId}`,'PATCH',JSON.stringify({position:0}),{cookie:ownerCookie,key:'legacy-conflict-reorder',type:'application/json'}));
  await assertConflict(await request(`/listings/${lid}/images/${legacyId}`,'DELETE',undefined,{cookie:ownerCookie,key:'legacy-conflict-delete'}));
  await assertConflict(await request(`/listings/${lid}/images/${legacyId}`,'GET',undefined,{cookie:ownerCookie}));
  expect(await env.DB.prepare('SELECT id,position,blob_data FROM listing_images WHERE listing_id=?').bind(lid).all()).toMatchObject({results:[{id:legacyId,position:0,blob_data:null}]});
  expect(await env.DB.prepare('SELECT request_key FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(ownerId,`IMAGE_ADD:${lid}`,'legacy-conflict-upload').first()).toBeNull();
  await env.DB.prepare("UPDATE listings SET status='APPROVED',publication_status='PUBLISHED' WHERE id=?").bind(lid).run();
  await assertConflict(await request(`/public/listings/${lid}`));
  await assertConflict(await request(`/public/listings?location=Legacy`));
  await assertConflict(await request(`/public/listings/${lid}/images/${legacyId}`));
});

it('checks for legacy rows before replaying committed D1 BLOB mutations',async()=>{
  const addListing=await listing(),added=await upload(addListing,'legacy-replay-add'),addedBody=await added.json() as any;
  expect(added.status).toBe(201);
  const addLegacyId='legacy-after-add-'+addListing,created=new Date().toISOString();
  const insertLegacy=async(lid:string,id:string,position:number)=>env.DB.prepare('INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,lid,`legacy-object-${id}`,'legacy.jpg','image/jpeg',64,position,created,created).run();
  await insertLegacy(addListing,addLegacyId,1);
  const assertConflict=async(response:Response)=>{expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:'LEGACY_MEDIA_MIGRATION_REQUIRED'});};
  await assertConflict(await upload(addListing,'legacy-replay-add'));
  expect(await env.DB.prepare('SELECT id,position FROM listing_images WHERE listing_id=? ORDER BY position').bind(addListing).all()).toMatchObject({results:[{id:addedBody.id,position:0},{id:addLegacyId,position:1}]});

  const reorderListing=await listing(),first=await upload(reorderListing,'legacy-replay-reorder-a'),second=await upload(reorderListing,'legacy-replay-reorder-b'),firstBody=await first.json() as any,secondBody=await second.json() as any;
  const reorderPath=`/listings/${reorderListing}/images/${secondBody.id}`,reorder=()=>request(reorderPath,'PATCH',JSON.stringify({position:0}),{cookie:ownerCookie,key:'legacy-replay-reorder-key',type:'application/json'});
  expect((await reorder()).status).toBe(200);await insertLegacy(reorderListing,'legacy-after-reorder-'+reorderListing,2);await assertConflict(await reorder());
  expect(await env.DB.prepare('SELECT id,position FROM listing_images WHERE listing_id=? ORDER BY position').bind(reorderListing).all()).toMatchObject({results:[{id:secondBody.id,position:0},{id:firstBody.id,position:1},{id:'legacy-after-reorder-'+reorderListing,position:2}]});

  const deleteListing=await listing(),deleteFirst=await upload(deleteListing,'legacy-replay-delete-a'),deleteSecond=await upload(deleteListing,'legacy-replay-delete-b'),deleteFirstBody=await deleteFirst.json() as any,deleteSecondBody=await deleteSecond.json() as any;
  const deletePath=`/listings/${deleteListing}/images/${deleteFirstBody.id}`,remove=()=>request(deletePath,'DELETE',undefined,{cookie:ownerCookie,key:'legacy-replay-delete-key'});
  expect((await remove()).status).toBe(200);await insertLegacy(deleteListing,'legacy-after-delete-'+deleteListing,1);await assertConflict(await remove());
  expect(await env.DB.prepare('SELECT id,position FROM listing_images WHERE listing_id=? ORDER BY position').bind(deleteListing).all()).toMatchObject({results:[{id:deleteSecondBody.id,position:0},{id:'legacy-after-delete-'+deleteListing,position:1}]});
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

it('serializes concurrent D1 BLOB add, reorder and delete on one listing without losing rows or density',async()=>{
  const lid=await listing(),first=await upload(lid,'same-listing-a',ownerCookie,png,'image/png','first.png'),second=await upload(lid,'same-listing-b',ownerCookie,jpeg,'image/jpeg','second.jpg'),a=await first.json() as any,b=await second.json() as any;
  const [added,reordered,deleted]=await Promise.all([
    upload(lid,'same-listing-c',ownerCookie,webp,'image/webp','third.webp'),
    request(`/listings/${lid}/images/${b.id}`,'PATCH',JSON.stringify({position:0}),{cookie:ownerCookie,key:'same-listing-reorder',type:'application/json'}),
    request(`/listings/${lid}/images/${a.id}`,'DELETE',undefined,{cookie:ownerCookie,key:'same-listing-delete'}),
  ]);
  expect([201,409]).toContain(added.status);expect([200,409]).toContain(reordered.status);expect([200,409]).toContain(deleted.status);
  expect(Number(added.status===201)+Number(reordered.status===200)+Number(deleted.status===200)).toBeGreaterThan(0);
  const addedImage=added.status===201?await added.clone().json() as any:null;
  const rows=await env.DB.prepare('SELECT id,position,byte_size,length(blob_data) AS blob_length,blob_data FROM listing_images WHERE listing_id=? AND blob_data IS NOT NULL ORDER BY position,id').bind(lid).all<any>();
  const expected=new Set([b.id,...(addedImage?[addedImage.id]:[]),...(deleted.status===409?[a.id]:[])]);
  expect(rows.results.map((row:any)=>row.id).sort()).toEqual([...expected].sort());
  expect(rows.results.map((row:any)=>row.position)).toEqual(rows.results.map((_:any,index:number)=>index));
  expect(rows.results.every((row:any)=>row.byte_size===row.blob_length)).toBe(true);
  const expectedBytes=new Map([[a.id,png],[b.id,jpeg],...(addedImage?[[addedImage.id,webp] as const]:[])]);
  for(const row of rows.results)expect(new Uint8Array(row.blob_data)).toEqual(expectedBytes.get(row.id));
  if(reordered.status===200)expect(rows.results[0].id).toBe(b.id);
  const usage=await env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first('used_bytes'),sum=await env.DB.prepare('SELECT COALESCE(SUM(byte_size),0) AS total FROM listing_images WHERE blob_data IS NOT NULL').first('total');
  expect(usage).toBe(sum);
});

it('caps uploads at twenty photos per listing',async()=>{
  const lid=await listing();
  for(let index=0;index<20;index++)expect((await upload(lid,`count-${index}`)).status).toBe(201);
  expect((await upload(lid,'count-overflow')).status).toBe(409);
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM listing_images WHERE listing_id=? AND blob_data IS NOT NULL').bind(lid).first('count')).toBe(20);
});
