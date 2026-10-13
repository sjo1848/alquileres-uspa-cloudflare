import { Hono } from 'hono';
import bcrypt from 'bcryptjs';

type Env = { DB: D1Database; IMAGES: R2Bucket; JWT_SECRET: string; JWT_EXPIRES_IN?: string; MAX_IMAGE_BYTES?: string; COOKIE_SAME_SITE?: string; COOKIE_SECURE?: string; NODE_ENV?: string };
type User = { id: string; email: string; role: 'OWNER'|'ADMIN' };
type ImageRow = { id:string; listing_id:string; object_key:string; original_name:string; mime_type:string; byte_size:number; position:number; created_at:string };
const app = new Hono<{ Bindings: Env; Variables: { user: User } }>();
const te = new TextEncoder();
const json = (body: unknown, status=200, headers?: HeadersInit) => Response.json(body,{status,headers});
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const ownerId = (c:any) => c.get('user').id as string;
const requestKey = (c:any) => {
  const key=c.req.header('Idempotency-Key');
  return key===undefined?null:(/^[A-Za-z0-9._~-]{1,128}$/.test(key)?key:false);
};
async function fingerprint(value:unknown) { return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(JSON.stringify(value))))); }
function listingDto(id:string,owner:string,x:any,t:string){return {id,ownerId:owner,status:'DRAFT',title:x.title,description:x.description,location:x.location,priceAmount:x.priceAmount,pricePeriod:x.pricePeriod,rentalDuration:x.rentalDuration,maxOccupants:x.maxOccupants,currency:x.currency,publicationStatus:'UNPUBLISHED',availabilityStatus:'AVAILABLE',lastConfirmedAt:null,rejectionReason:null,createdAt:t,updatedAt:t};}
function b64(bytes: Uint8Array) { let s=''; for (const b of bytes) s+=String.fromCharCode(b); return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function unb64(s:string) { if(!/^[A-Za-z0-9_-]+$/.test(s)) throw Error('bad token'); const x=s.replace(/-/g,'+').replace(/_/g,'/'); return Uint8Array.from(atob(x+'='.repeat((4-x.length%4)%4)),c=>c.charCodeAt(0)); }
function lifetime(env:Env) { const m=/^(\d+)(s|m|h|d)$/.exec(env.JWT_EXPIRES_IN??'15m'); if(!m) throw Error('bad jwt expiry'); return Number(m[1])*({s:1,m:60,h:3600,d:86400}[m[2]]!); }
async function sign(u:User,env:Env) { const n=Math.floor(Date.now()/1000), a=b64(te.encode(JSON.stringify({alg:'HS256',typ:'JWT'}))), p=b64(te.encode(JSON.stringify({id:u.id,email:u.email,role:u.role,iat:n,exp:n+lifetime(env)}))), input=`${a}.${p}`, key=await crypto.subtle.importKey('raw',te.encode(env.JWT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']); return `${input}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,te.encode(input))))}`; }
async function verify(token:string,env:Env) { if(token.length>8192) throw Error(); const p=token.split('.'); if(p.length!==3) throw Error(); const h=JSON.parse(new TextDecoder().decode(unb64(p[0]))), c=JSON.parse(new TextDecoder().decode(unb64(p[1]))); if(h.alg!=='HS256'||!Number.isFinite(c.exp)||c.exp<=Date.now()/1000) throw Error(); const key=await crypto.subtle.importKey('raw',te.encode(env.JWT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']); if(!await crypto.subtle.verify('HMAC',key,unb64(p[2]),te.encode(`${p[0]}.${p[1]}`))) throw Error(); return c as {id:string;email:string}; }
function cookie(raw:string|null) { return raw?.split(';').map(x=>x.trim()).find(x=>x.startsWith('alquileres_session='))?.slice('alquileres_session='.length); }
function setCookie(token:string,env:Env,clear=false) { const same=['strict','none'].includes(env.COOKIE_SAME_SITE??'')?env.COOKIE_SAME_SITE:'lax'; const secure=env.COOKIE_SECURE==='true'||env.NODE_ENV==='production'||same==='none'; return `alquileres_session=${clear?'':encodeURIComponent(token)}; Path=/; ${clear?'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT':'Max-Age=900'}; HttpOnly; SameSite=${same![0].toUpperCase()+same!.slice(1)}${secure?'; Secure':''}`; }
app.use('*',async(c,next)=>{ c.header('Cache-Control','no-store'); c.header('X-Content-Type-Options','nosniff'); await next(); });
app.get('/health',c=>c.json({ok:true}));
app.all('/__fixture/*',c=>c.json({error:'not found'},404));
app.post('/auth/login',async c=>{if(c.req.header('Origin')!==new URL(c.req.url).origin)return c.json({error:'same-origin request required'},403);const x=await c.req.json().catch(()=>null) as any; if(!x||typeof x.email!=='string'||x.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email.trim())||typeof x.password!=='string'||x.password.length<8)return c.json({error:'validation failed'},400); const u=await c.env.DB.prepare('SELECT id,email,password_hash,role FROM users WHERE email=?').bind(x.email.trim().toLowerCase()).first<any>(); if(!u||!await bcrypt.compare(x.password,u.password_hash))return c.json({error:'Invalid credentials'},401); const user:User={id:u.id,email:u.email,role:u.role}; return c.json({user},200,{'Set-Cookie':setCookie(await sign(user,c.env),c.env)}); });
app.post('/auth/logout',c=>{if(c.req.header('Origin')!==new URL(c.req.url).origin)return c.json({error:'same-origin request required'},403);return c.json({ok:true},200,{'Set-Cookie':setCookie('',c.env,true)});});
app.use('/listings/*',async(c,next)=>{ const auth=c.req.header('Authorization'); const raw=auth?.startsWith('Bearer ')?auth.slice(7):cookie(c.req.header('Cookie')??null); if(!raw)return c.json({error:'Invalid or expired token'},401); if(!auth?.startsWith('Bearer ')&&['POST','PATCH','DELETE','PUT'].includes(c.req.method)){const origin=c.req.header('Origin');if(!origin||origin!==new URL(c.req.url).origin)return c.json({error:'same-origin request required'},403);} try { const claims=await verify(decodeURIComponent(raw),c.env), u=await c.env.DB.prepare('SELECT id,email,role FROM users WHERE id=?').bind(claims.id).first<User>(); if(!u||u.email!==claims.email)return c.json({error:'Invalid or expired token'},401); if(u.role!=='OWNER')return c.json({error:'Insufficient role'},401); c.set('user',u); await next(); } catch { return c.json({error:'Invalid or expired token'},401); } });
app.get('/listings',async c=>{const rows=await c.env.DB.prepare('SELECT id,owner_id AS ownerId,status,title,description,location,price_amount AS priceAmount,price_period AS pricePeriod,rental_duration AS rentalDuration,max_occupants AS maxOccupants,currency,publication_status AS publicationStatus,availability_status AS availabilityStatus,last_confirmed_at AS lastConfirmedAt,rejection_reason AS rejectionReason,created_at AS createdAt,updated_at AS updatedAt FROM listings WHERE owner_id=? ORDER BY updated_at DESC').bind(c.get('user').id).all();return c.json(rows.results);});
app.post('/listings',async c=>{
  const x=await c.req.json().catch(()=>null) as any;
  if(!x||typeof x.title!=='string'||x.title.length<1||x.title.length>120||typeof x.description!=='string'||x.description.length>5000||typeof x.location!=='string'||x.location.length<1||x.location.length>240||!Number.isInteger(x.priceAmount)||x.priceAmount<0||x.priceAmount>2147483647||!['WEEK','MONTH'].includes(x.pricePeriod)||!['WEEKS','MONTHS','PERMANENT','FLEXIBLE'].includes(x.rentalDuration)||!Number.isInteger(x.maxOccupants)||x.maxOccupants<1||x.maxOccupants>2147483647||!['ARS','USD'].includes(x.currency))return c.json({error:'validation failed'},400);
  const user=c.get('user'), supplied=requestKey(c);if(supplied===false)return c.json({error:'invalid idempotency key'},400);
  const requestFingerprint=await fingerprint({title:x.title,description:x.description,location:x.location,priceAmount:x.priceAmount,pricePeriod:x.pricePeriod,rentalDuration:x.rentalDuration,maxOccupants:x.maxOccupants,currency:x.currency});
  let listingId=id(),t=now(),body=listingDto(listingId,user.id,x,t);
  if(supplied){
    let record:any;
    try{record=await c.env.DB.prepare('SELECT request_fingerprint,resource_id,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(user.id,'LISTING_CREATE',supplied).first<any>();}catch{return c.json({error:'request outcome unavailable; retry with the same idempotency key'},503);}
    if(record){if(record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reused with different request'},409);listingId=record.resource_id;body=record.result_json?JSON.parse(record.result_json):body;}
    else {
      try{await c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,result_json,created_at,updated_at) VALUES(?,? ,?,?,?,'PENDING',?,?,?)").bind(user.id,'LISTING_CREATE',supplied,requestFingerprint,listingId,JSON.stringify(body),t,t).run();}
      catch{try{record=await c.env.DB.prepare('SELECT request_fingerprint,resource_id,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(user.id,'LISTING_CREATE',supplied).first<any>();}catch{return c.json({error:'request reservation outcome unavailable; retry with the same idempotency key'},503);}if(!record||record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reservation conflict'},409);listingId=record.resource_id;body=record.result_json?JSON.parse(record.result_json):body;}
    }
    try{const existing=await c.env.DB.prepare('SELECT id FROM listings WHERE id=? AND owner_id=?').bind(listingId,user.id).first();if(existing){await c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',updated_at=? WHERE owner_id=? AND scope='LISTING_CREATE' AND request_key=?").bind(now(),user.id,supplied).run().catch(()=>{});return c.json(body,201);}}catch{return c.json({error:'listing outcome unavailable; retry with the same idempotency key'},503);}
  }
  const insert=c.env.DB.prepare("INSERT INTO listings(id,owner_id,status,title,description,location,price_amount,price_period,rental_duration,max_occupants,currency,created_at,updated_at) VALUES(?,?,'DRAFT',?,?,?,?,?,?,?,?,?,?)").bind(listingId,user.id,x.title,x.description,x.location,x.priceAmount,x.pricePeriod,x.rentalDuration,x.maxOccupants,x.currency,t,t);
  try{
    if(supplied){const transition=c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',updated_at=? WHERE owner_id=? AND scope='LISTING_CREATE' AND request_key=? AND request_fingerprint=?").bind(now(),user.id,supplied,requestFingerprint);const result=await c.env.DB.batch([insert,transition]);if(result.some(x=>x.meta?.changes!==1)){const row=await c.env.DB.prepare('SELECT id FROM listings WHERE id=? AND owner_id=?').bind(listingId,user.id).first();if(!row)return c.json({error:'listing commit requires retry with the same idempotency key'},503);}}
    else await insert.run();
  }catch{
    try{const row=await c.env.DB.prepare('SELECT id FROM listings WHERE id=? AND owner_id=?').bind(listingId,user.id).first();if(!row)return c.json({error:'listing outcome requires retry with the same idempotency key'},503);if(supplied)await c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',updated_at=? WHERE owner_id=? AND scope='LISTING_CREATE' AND request_key=?").bind(now(),user.id,supplied).run().catch(()=>{});}
    catch{return c.json({error:'listing outcome unknown; retry with the same idempotency key'},503);}
  }
  return c.json(body,201);
});
async function owned(c:any,listingId:string) {return c.env.DB.prepare("SELECT id FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED')").bind(listingId,c.get('user').id).first();}
async function lock(db:D1Database,lid:string) { const token=id(),n=Math.floor(Date.now()/1000);const r=await db.prepare('INSERT INTO listing_locks(listing_id,token,expires_at) VALUES(?,?,?) ON CONFLICT(listing_id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE listing_locks.expires_at < ? RETURNING token').bind(lid,token,n+3600,n).first();return r?token:null; }
async function unlock(db:D1Database,lid:string,t:string) {
  const correlationId=crypto.randomUUID(),attempts=3;
  for(let attempt=0;attempt<attempts;attempt++){
    try{await db.prepare('DELETE FROM listing_locks WHERE listing_id=? AND token=?').bind(lid,t).run();}catch{}
    try{
      const current=await db.prepare('SELECT token,expires_at FROM listing_locks WHERE listing_id=?').bind(lid).first<{token:string;expires_at:number}>();
      if(!current||current.token!==t)return;
    }catch{}
  }
  const nowSeconds=Math.floor(Date.now()/1000),expiredAt=nowSeconds-1;
  try{await db.prepare('UPDATE listing_locks SET expires_at=? WHERE listing_id=? AND token=?').bind(expiredAt,lid,t).run();}catch{}
  try{const current=await db.prepare('SELECT token,expires_at FROM listing_locks WHERE listing_id=?').bind(lid).first<{token:string;expires_at:number}>();if(!current||current.token!==t||current.expires_at<=nowSeconds){console.warn(JSON.stringify({event:'listing_lease_release_deferred_to_expiry',correlationId}));return;}}catch{}
  console.error(JSON.stringify({event:'listing_lease_release_unconfirmed',correlationId,attempts}));
}
async function ownsLock(db:D1Database,lid:string,t:string) { return !!await db.prepare('SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?').bind(lid,t,Math.floor(Date.now()/1000)).first(); }
function imageDto(x:ImageRow){return {id:x.id,originalName:x.original_name,contentType:x.mime_type,sizeBytes:x.byte_size,position:x.position,createdAt:x.created_at};}
async function ordered(db:D1Database,lid:string){return (await db.prepare('SELECT * FROM listing_images WHERE listing_id=? ORDER BY position').bind(lid).all<ImageRow>()).results;}
async function bestEffortOperationState(db:D1Database,op:string,state:'COMMITTED'|'CLEANED'|'COMPENSATED'|'CLEANUP_PENDING'|'NEEDS_REPAIR') { try{await db.prepare('UPDATE image_operations SET state=?,updated_at=? WHERE id=?').bind(state,now(),op).run();return true;}catch{return false;} }
async function writeDenseOrder(db:D1Database,lid:string,owner:string,lease:string,items:ImageRow[]) { const fence=Math.floor(Date.now()/1000),stmts:D1PreparedStatement[]=[];for(let i=0;i<items.length;i++)stmts.push(db.prepare("UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(1000000+i,now(),items[i].id,lid,lid,lease,fence,lid,owner));for(let i=0;i<items.length;i++)stmts.push(db.prepare("UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(i,now(),items[i].id,lid,lid,lease,fence,lid,owner));const result=await db.batch(stmts);return result.length===stmts.length&&result.every(x=>x.meta?.changes===1); }
async function orderIs(db:D1Database,lid:string,ids:string[]) { try{const rows=await db.prepare('SELECT id,position FROM listing_images WHERE listing_id=? ORDER BY position').bind(lid).all<{id:string;position:number}>();return rows.results.length===ids.length&&rows.results.every((row,i)=>row.id===ids[i]&&row.position===i);}catch{return false;} }
app.get('/listings/:id/images',async c=>{if(!await owned(c,c.req.param('id')))return c.json({error:'not found'},404);const rows=await ordered(c.env.DB,c.req.param('id'));if(!rows.every((row,index)=>row.position===index))return c.json({error:'image ordering requires recovery; retry after recovery'},503);return c.json(rows.map(imageDto));});
app.post('/listings/:id/images', async c => {
  const lid=c.req.param('id');
  if(!await owned(c,lid)) return c.json({error:'not found'},404);
  const maxImageBytes=Number(c.env.MAX_IMAGE_BYTES??5242880);if(!Number.isSafeInteger(maxImageBytes)||maxImageBytes<1)return c.json({error:'image upload configuration invalid'},503);
  const limit=maxImageBytes+128*1024;
  if(Number(c.req.header('content-length')??0)>limit) return c.json({error:'request too large'},413);
  const reader=c.req.raw.body?.getReader(), chunks:Uint8Array[]=[]; let total=0;
  if(reader) for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();return c.json({error:'request too large'},413);}chunks.push(value);}
  const request=new Request(c.req.raw.url,{method:'POST',headers:c.req.raw.headers,body:new Blob(chunks.map(x=>x.slice().buffer as ArrayBuffer))});
  const form=await request.formData().catch(()=>null),file=form?.get('image');
  if(!(file instanceof File)) return c.json({error:'image required'},400);
  if(file.size<16||file.size>maxImageBytes||!/^[^/\\\0-]{1,120}$/.test(file.name)||file.name.startsWith('.')) return c.json({error:'invalid image'},400);
  const bytes=new Uint8Array(await file.arrayBuffer()),type=file.type;
  const valid=(type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217)||(type==='image/png'&&bytes.length>=24&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)&&String.fromCharCode(...bytes.slice(12,16))==='IHDR')||(type==='image/webp'&&bytes.length>=16&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP');
  if(!valid) return c.json({error:'invalid image'},400);
  const supplied=requestKey(c);if(supplied===false)return c.json({error:'invalid idempotency key'},400);
  const requestOwner=ownerId(c),scope=`IMAGE_ADD:${lid}`,requestFingerprint=await fingerprint({name:file.name,type,size:bytes.length,content:b64(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))});
  const lease=await lock(c.env.DB,lid); if(!lease) return c.json({error:'retryable conflict'},409);
  let imageId:string=id(),op:string=id(),record:any=null;
  const extension=type==='image/jpeg'?'jpg':type==='image/png'?'png':'webp',created=now();
  try{
    if(!await owned(c,lid))return c.json({error:'not found'},404);
    if(supplied){
      try{record=await c.env.DB.prepare('SELECT request_fingerprint,resource_id,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(requestOwner,scope,supplied).first<any>();}catch{return c.json({error:'image request outcome unavailable; retry with the same idempotency key'},503);}
      if(record){if(record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reused with different request'},409);imageId=record.resource_id;const existing=await c.env.DB.prepare('SELECT * FROM listing_images WHERE id=? AND listing_id=?').bind(imageId,lid).first<ImageRow>();if(existing){let objectPresent=false;try{objectPresent=!!await c.env.IMAGES.head(existing.object_key);}catch{}if(!objectPresent){await c.env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE image_id=? AND kind='ADD'").bind(now(),imageId).run().catch(()=>{});return c.json({error:'committed image requires storage repair'},503);}const body=record.result_json?JSON.parse(record.result_json):imageDto(existing);await c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',updated_at=? WHERE owner_id=? AND scope=? AND request_key=?").bind(now(),requestOwner,scope,supplied).run().catch(()=>{});return c.json(body,201);}if(record.state==='COMMITTED')return c.json({error:'committed image metadata requires repair'},503);const priorOp=await c.env.DB.prepare("SELECT id FROM image_operations WHERE image_id=? AND kind='ADD' ORDER BY created_at DESC LIMIT 1").bind(imageId).first<{id:string}>();if(priorOp)op=priorOp.id;}
      else{try{await c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?)").bind(requestOwner,scope,supplied,requestFingerprint,imageId,created,created).run();}catch{try{record=await c.env.DB.prepare('SELECT request_fingerprint,resource_id,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(requestOwner,scope,supplied).first<any>();}catch{return c.json({error:'image request reservation unavailable; retry with the same idempotency key'},503);}if(!record||record.request_fingerprint!==requestFingerprint)return c.json({error:'image request reservation conflict'},409);imageId=record.resource_id;const priorOp=await c.env.DB.prepare("SELECT id FROM image_operations WHERE image_id=? AND kind='ADD' ORDER BY created_at DESC LIMIT 1").bind(imageId).first<{id:string}>();if(priorOp)op=priorOp.id;}}
    }
    const objectKey=`listings/${lid}/${imageId}.${extension}`;
    let images=await ordered(c.env.DB,lid); if(images.length>=20) return c.json({error:'image limit reached'},409);
    if(!images.every((image,index)=>image.position===index)){if(!await writeDenseOrder(c.env.DB,lid,requestOwner,lease,images)||!await orderIs(c.env.DB,lid,images.map(x=>x.id)))return c.json({error:'image ordering requires recovery'},503);images=images.map((image,index)=>({...image,position:index}));}
    const priorOp=await c.env.DB.prepare("SELECT id FROM image_operations WHERE image_id=? AND kind='ADD' ORDER BY created_at DESC LIMIT 1").bind(imageId).first<{id:string}>();if(priorOp)op=priorOp.id;else await c.env.DB.prepare("INSERT INTO image_operations(id,listing_id,kind,state,object_key,image_id,created_at,updated_at) VALUES(?,?,'ADD','PENDING',?,?,?,?)").bind(op,lid,objectKey,imageId,created,created).run();
    try{await c.env.IMAGES.put(objectKey,bytes,{httpMetadata:{contentType:type,cacheControl:'private, no-store'}});}catch{let present=false;try{present=!!await c.env.IMAGES.head(objectKey);}catch{await bestEffortOperationState(c.env.DB,op,'NEEDS_REPAIR');return c.json({error:'image storage outcome requires recovery'},503);}await bestEffortOperationState(c.env.DB,op,present?'NEEDS_REPAIR':'COMPENSATED');return c.json({error:'image storage failed'},503);}
    const fence=Math.floor(Date.now()/1000);
    const responseBody=imageDto({id:imageId,listing_id:lid,object_key:objectKey,original_name:file.name,mime_type:type,byte_size:bytes.length,position:images.length,created_at:created});
    let results:D1Result[];
    try{
      const statements=[
        c.env.DB.prepare("INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(imageId,lid,objectKey,file.name,type,bytes.length,images.length,created,created,lid,lease,fence,lid,c.get('user').id),
        c.env.DB.prepare("UPDATE image_operations SET state='COMMITTED',updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?)").bind(now(),op,lid,lease,fence)
      ];if(supplied)statements.push(c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',result_json=?,updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=?").bind(JSON.stringify(responseBody),now(),requestOwner,scope,supplied,requestFingerprint));
      results=await c.env.DB.batch(statements);
    }catch{
      let exists:unknown;
      try{exists=await c.env.DB.prepare('SELECT id FROM listing_images WHERE id=?').bind(imageId).first();}catch{await c.env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE id=?").bind(now(),op).run().catch(()=>{});return c.json({error:'metadata outcome requires recovery'},503);}
      if(exists){let objectPresent=false;try{objectPresent=!!await c.env.IMAGES.head(objectKey);}catch{}if(objectPresent){await c.env.DB.prepare("UPDATE image_operations SET state='COMMITTED',updated_at=? WHERE id=?").bind(now(),op).run().catch(()=>{});if(supplied)await c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',result_json=?,updated_at=? WHERE owner_id=? AND scope=? AND request_key=?").bind(JSON.stringify(responseBody),now(),requestOwner,scope,supplied).run().catch(()=>{});return c.json(responseBody,201);}await c.env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE id=?").bind(now(),op).run().catch(()=>{});return c.json({error:'image metadata committed but storage requires repair'},503);}
      try{await c.env.IMAGES.delete(objectKey);await c.env.DB.prepare("UPDATE image_operations SET state='COMPENSATED',updated_at=? WHERE id=?").bind(now(),op).run().catch(()=>{});return c.json({error:'metadata commit failed; retry with the same idempotency key'},503);}catch{await c.env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE id=?").bind(now(),op).run().catch(()=>{});return c.json({error:'metadata compensation requires recovery'},503);}
    }
    if(results.some(result=>result?.meta?.changes!==1)){let exists:unknown;try{exists=await c.env.DB.prepare('SELECT id FROM listing_images WHERE id=?').bind(imageId).first();}catch{return c.json({error:'metadata outcome requires recovery'},503);}if(exists){let objectPresent=false;try{objectPresent=!!await c.env.IMAGES.head(objectKey);}catch{}if(objectPresent){const current=await ordered(c.env.DB,lid),expected=[...images.map(x=>x.id),imageId],orderedOk=await orderIs(c.env.DB,lid,expected)||((current.length===expected.length)&&await writeDenseOrder(c.env.DB,lid,requestOwner,lease,expected.map((id,index)=>({...current.find(x=>x.id===id)!,position:index})))&&await orderIs(c.env.DB,lid,expected));if(orderedOk){await bestEffortOperationState(c.env.DB,op,'COMMITTED');if(supplied)await c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',result_json=?,updated_at=? WHERE owner_id=? AND scope=? AND request_key=?").bind(JSON.stringify(responseBody),now(),requestOwner,scope,supplied).run().catch(()=>{});return c.json(responseBody,201);}return c.json({error:'image ordering requires recovery'},503);}return c.json({error:'image metadata committed but storage requires repair'},503);}try{await c.env.IMAGES.delete(objectKey);await bestEffortOperationState(c.env.DB,op,'COMPENSATED');}catch{await bestEffortOperationState(c.env.DB,op,'NEEDS_REPAIR');}return c.json({error:'retryable conflict'},409);}
    const expectedOrder=[...images.map(x=>x.id),imageId];if(!await orderIs(c.env.DB,lid,expectedOrder)){const current=await ordered(c.env.DB,lid),repairable=current.length===expectedOrder.length&&await writeDenseOrder(c.env.DB,lid,requestOwner,lease,expectedOrder.map((id,index)=>({...current.find(x=>x.id===id)!,position:index})))&&await orderIs(c.env.DB,lid,expectedOrder);if(!repairable)return c.json({error:'image ordering requires recovery'},503);}
    return c.json(responseBody,201);
  }finally{await unlock(c.env.DB,lid,lease);}
});
app.get('/listings/:id/images/:imageId',async c=>{const lid=c.req.param('id');if(!await owned(c,lid))return c.json({error:'not found'},404);const row=await c.env.DB.prepare('SELECT * FROM listing_images WHERE listing_id=? AND id=?').bind(lid,c.req.param('imageId')).first<ImageRow>();if(!row)return c.json({error:'not found'},404);const obj=await c.env.IMAGES.get(row.object_key);if(!obj)return c.json({error:'not found'},404);return new Response(obj.body,{headers:{'Content-Type':row.mime_type,'Content-Length':String(row.byte_size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});});
app.get('/public/listings/:id/images/:imageId',async c=>c.json({error:'not found'},404));
app.patch('/listings/:id/images/:imageId',async c=>{
  const lid=c.req.param('id'),imageId=c.req.param('imageId'),owner=ownerId(c),supplied=requestKey(c);
  if(supplied===false)return c.json({error:'invalid idempotency key'},400);
  if(!await owned(c,lid))return c.json({error:'not found'},404);
  const x=await c.req.json().catch(()=>null) as any,position=x?.position;
  if(!Number.isInteger(position)||position<0)return c.json({error:'invalid position'},400);
  const scope=`IMAGE_REORDER:${lid}:${imageId}`,requestFingerprint=await fingerprint({method:'PATCH',lid,imageId,position});
  const lk=await lock(c.env.DB,lid);if(!lk)return c.json({error:'retryable conflict'},409);
  try{
    if(!await owned(c,lid))return c.json({error:'not found'},404);
    const items=await ordered(c.env.DB,lid),idx=items.findIndex(i=>i.id===imageId);if(idx<0)return c.json({error:'not found'},404);if(position>=items.length)return c.json({error:'invalid position'},400);
    const [moved]=items.splice(idx,1);items.splice(position,0,moved);const expected=items.map(item=>item.id),body=items.map((item,i)=>imageDto({...item,position:i}));
    if(supplied){let record:any;try{record=await c.env.DB.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,supplied).first<any>();}catch{return c.json({error:'reorder outcome unavailable; retry with the same idempotency key'},503);}if(record&&record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reused with different request'},409);if(record?.state==='COMMITTED'){try{const current=await c.env.DB.prepare('SELECT id FROM listing_images WHERE id=? AND listing_id=?').bind(imageId,lid).first();if(current)return c.json(record.result_json?JSON.parse(record.result_json):body,200);}catch{return c.json({error:'reorder replay requires recovery'},503);}}if(!record){try{await c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?)").bind(owner,scope,supplied,requestFingerprint,imageId,now(),now()).run();}catch{try{record=await c.env.DB.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,supplied).first<any>();}catch{return c.json({error:'reorder reservation outcome unknown'},503);}if(!record||record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reservation conflict'},409);if(record.state==='COMMITTED')return c.json(record.result_json?JSON.parse(record.result_json):body,200);}}}
    if(await orderIs(c.env.DB,lid,expected)){if(supplied)await c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',result_json=?,updated_at=? WHERE owner_id=? AND scope=? AND request_key=?").bind(JSON.stringify(body),now(),owner,scope,supplied).run().catch(()=>{});return c.json(body,200);}
    const fence=Math.floor(Date.now()/1000),stmts:D1PreparedStatement[]=[];for(let i=0;i<items.length;i++)stmts.push(c.env.DB.prepare("UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(1000000+i,now(),items[i].id,lid,lid,lk,fence,lid,owner));for(let i=0;i<items.length;i++)stmts.push(c.env.DB.prepare("UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(i,now(),items[i].id,lid,lid,lk,fence,lid,owner));if(supplied)stmts.push(c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',result_json=?,updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=?").bind(JSON.stringify(body),now(),owner,scope,supplied,requestFingerprint));
    let result:D1Result[]|null=null;try{result=await c.env.DB.batch(stmts);}catch{}
    if(result&&result.length===stmts.length&&result.every(row=>row?.meta?.changes===1))return c.json(body,200);
    if(await orderIs(c.env.DB,lid,expected)){if(supplied)await c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',result_json=?,updated_at=? WHERE owner_id=? AND scope=? AND request_key=?").bind(JSON.stringify(body),now(),owner,scope,supplied).run().catch(()=>{});return c.json(body,200);}
    return c.json({error:'reorder outcome unknown; retry with the same idempotency key'},503);
  }finally{await unlock(c.env.DB,lid,lk);}
});
app.delete('/listings/:id/images/:imageId', async c => {
  const lid=c.req.param('id'),imageId=c.req.param('imageId'),owner=ownerId(c),supplied=requestKey(c);
  if(supplied===false)return c.json({error:'invalid idempotency key'},400);
  const scope=`IMAGE_DELETE:${lid}:${imageId}`,requestFingerprint=await fingerprint({method:'DELETE',lid,imageId});
  const lease=await lock(c.env.DB,lid);if(!lease)return c.json({error:'retryable conflict'},409);
  try{
    if(!await owned(c,lid))return c.json({error:'not found'},404);
    let record:any=null;
    if(supplied){try{record=await c.env.DB.prepare('SELECT request_fingerprint,state FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,supplied).first<any>();}catch{return c.json({error:'delete outcome unavailable; retry with the same idempotency key'},503);}if(record&&record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reused with different request'},409);}
    const items=await ordered(c.env.DB,lid),target=items.find(x=>x.id===imageId);
    if(!target){
      if(!record)return c.json({error:'not found'},404);
      let prior:any=null;try{prior=await c.env.DB.prepare("SELECT id,backup_key,state,object_key FROM image_operations WHERE listing_id=? AND image_id=? AND kind='DELETE' ORDER BY created_at DESC LIMIT 1").bind(lid,imageId).first<any>();}catch{return c.json({error:'delete operation outcome unavailable'},503);}
      if(!prior)return c.json({error:'delete intent is not durably recorded'},503);
      let dense=await orderIs(c.env.DB,lid,items.map(x=>x.id));
      if(!dense){try{dense=items.length===0||await writeDenseOrder(c.env.DB,lid,owner,lease,items)&&await orderIs(c.env.DB,lid,items.map(x=>x.id));}catch{dense=false;}}
      let originalPresent:boolean;
      try{originalPresent=!!await c.env.IMAGES.head(prior.object_key);if(originalPresent){await c.env.IMAGES.delete(prior.object_key);originalPresent=!!await c.env.IMAGES.head(prior.object_key);}}
      catch{await bestEffortOperationState(c.env.DB,prior.id,'NEEDS_REPAIR');await c.env.DB.prepare("UPDATE idempotency_records SET state='NEEDS_REPAIR',updated_at=? WHERE owner_id=? AND scope=? AND request_key=?").bind(now(),owner,scope,supplied).run().catch(()=>{});return c.json({error:'delete storage outcome requires recovery; retry with the same idempotency key'},503);}
      if(!dense||originalPresent)await bestEffortOperationState(c.env.DB,prior.id,'NEEDS_REPAIR');
      else if(prior.state!=='CLEANED')await bestEffortOperationState(c.env.DB,prior.id,'COMMITTED');
      if(originalPresent){await c.env.DB.prepare("UPDATE idempotency_records SET state='NEEDS_REPAIR',updated_at=? WHERE owner_id=? AND scope=? AND request_key=?").bind(now(),owner,scope,supplied).run().catch(()=>{});return c.json({error:'delete storage cleanup requires recovery; retry with the same idempotency key'},503);}
      await c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',updated_at=? WHERE owner_id=? AND scope=? AND request_key=?").bind(now(),owner,scope,supplied).run().catch(()=>{});
      if(!dense)return c.body(null,200);
      if(prior&&prior.state!=='CLEANED'){
        await bestEffortOperationState(c.env.DB,prior.id,'COMMITTED');
        try{if(prior.backup_key)await c.env.IMAGES.delete(prior.backup_key);await bestEffortOperationState(c.env.DB,prior.id,'CLEANED');}catch{await bestEffortOperationState(c.env.DB,prior.id,'CLEANUP_PENDING');}
      }
      return c.body(null,200);
    }
    if(record?.state==='COMMITTED')return c.json({error:'delete ledger conflicts with existing image'},503);
    let original=await c.env.IMAGES.get(target.object_key);
    if(!original){let repair:any=null;try{repair=await c.env.DB.prepare("SELECT id,backup_key,state FROM image_operations WHERE listing_id=? AND image_id=? AND kind='DELETE' ORDER BY created_at DESC LIMIT 1").bind(lid,imageId).first<any>();}catch{return c.json({error:'delete recovery outcome unavailable'},503);}if(repair?.backup_key){try{const saved=await c.env.IMAGES.get(repair.backup_key);if(saved){await c.env.IMAGES.put(target.object_key,await saved.arrayBuffer(),{httpMetadata:{contentType:target.mime_type}});original=await c.env.IMAGES.get(target.object_key);}}catch{return c.json({error:'image restore requires scheduled recovery'},503);}}if(!original){await bestEffortOperationState(c.env.DB,repair?.id??'', 'NEEDS_REPAIR');return c.json({error:'image object missing; recovery required'},503);}}
    if(supplied&&!record){try{await c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?)").bind(owner,scope,supplied,requestFingerprint,imageId,now(),now()).run();}catch{try{record=await c.env.DB.prepare('SELECT request_fingerprint,state FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,supplied).first<any>();}catch{return c.json({error:'delete reservation outcome unknown; retry with the same idempotency key'},503);}if(!record||record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reservation conflict'},409);if(record.state==='COMMITTED')return c.body(null,200);}}
    let priorOp:any=null;try{priorOp=await c.env.DB.prepare("SELECT id,backup_key,state FROM image_operations WHERE listing_id=? AND image_id=? AND kind='DELETE' ORDER BY created_at DESC LIMIT 1").bind(lid,imageId).first<any>();}catch{return c.json({error:'delete operation outcome unavailable'},503);}
    if(priorOp&&['COMMITTED','CLEANUP_PENDING','CLEANED'].includes(priorOp.state))return c.json({error:'delete ledger conflicts with existing image'},503);
    const op=priorOp?.id??id(),backup=priorOp?.backup_key??`compensation/${op}`;
    try{if(priorOp)await c.env.DB.prepare("UPDATE image_operations SET state='PENDING',updated_at=? WHERE id=?").bind(now(),op).run();else await c.env.DB.prepare("INSERT INTO image_operations(id,listing_id,kind,state,object_key,backup_key,image_id,created_at,updated_at) VALUES(?,?,'DELETE','PENDING',?,?,?,?,?)").bind(op,lid,target.object_key,backup,imageId,now(),now()).run();}catch{return c.json({error:'delete operation reservation requires recovery'},503);}
    try{await c.env.IMAGES.put(backup,await original.arrayBuffer(),{httpMetadata:{contentType:target.mime_type}});}catch{let backupPresent=false,originalPresent=false;try{backupPresent=!!await c.env.IMAGES.head(backup);originalPresent=!!await c.env.IMAGES.head(target.object_key);}catch{}await bestEffortOperationState(c.env.DB,op,backupPresent?'NEEDS_REPAIR':originalPresent?'COMPENSATED':'NEEDS_REPAIR');return c.json({error:'image backup failed; retry with the same idempotency key'},503);}
    try{await c.env.IMAGES.delete(target.object_key);}catch{let originalPresent=false,backupPresent=false;try{originalPresent=!!await c.env.IMAGES.head(target.object_key);backupPresent=!!await c.env.IMAGES.head(backup);}catch{}if(!originalPresent&&backupPresent){try{const saved=await c.env.IMAGES.get(backup);if(!saved)throw Error('backup missing');await c.env.IMAGES.put(target.object_key,await saved.arrayBuffer(),{httpMetadata:{contentType:target.mime_type}});originalPresent=!!await c.env.IMAGES.head(target.object_key);}catch{originalPresent=false;}}if(originalPresent){try{await c.env.IMAGES.delete(backup);}catch{}await bestEffortOperationState(c.env.DB,op,'COMPENSATED');return c.json({error:'image delete was compensated; retry with the same idempotency key'},503);}await bestEffortOperationState(c.env.DB,op,'NEEDS_REPAIR');return c.json({error:'image delete outcome requires recovery'},503);}
    const rest=items.filter(x=>x.id!==target.id),fence=Math.floor(Date.now()/1000),stmts:D1PreparedStatement[]=[c.env.DB.prepare("DELETE FROM listing_images WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(target.id,lid,lid,lease,fence,lid,owner)];
    for(let i=0;i<rest.length;i++)stmts.push(c.env.DB.prepare("UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(1000000+i,now(),rest[i].id,lid,lid,lease,fence,lid,owner));
    for(let i=0;i<rest.length;i++)stmts.push(c.env.DB.prepare("UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(i,now(),rest[i].id,lid,lid,lease,fence,lid,owner));
    stmts.push(c.env.DB.prepare("UPDATE image_operations SET state='COMMITTED',updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?)").bind(now(),op,lid,lease,fence));
    if(supplied)stmts.push(c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=?").bind(now(),owner,scope,supplied,requestFingerprint));
    let batchResults:D1Result[]|null=null;try{batchResults=await c.env.DB.batch(stmts);}catch{}
    const commitExpected=rest.map(x=>x.id);
    let committed=false;
    if(batchResults&&batchResults.length===stmts.length&&batchResults.every(x=>x?.meta?.changes===1))committed=true;
    else {let targetRow:unknown;try{targetRow=await c.env.DB.prepare('SELECT id FROM listing_images WHERE id=? AND listing_id=?').bind(target.id,lid).first();}catch{return c.json({error:'delete outcome unknown; retry with the same idempotency key'},503);}if(!targetRow){if(!await orderIs(c.env.DB,lid,commitExpected)){try{const current=await ordered(c.env.DB,lid);if(current.length===rest.length&&current.every(x=>commitExpected.includes(x.id))){await writeDenseOrder(c.env.DB,lid,owner,lease,rest);}}catch{}}committed=await orderIs(c.env.DB,lid,commitExpected);}}
    if(!committed){let targetStillExists=false;try{targetStillExists=!!await c.env.DB.prepare('SELECT id FROM listing_images WHERE id=? AND listing_id=?').bind(target.id,lid).first();}catch{return c.json({error:'delete outcome requires recovery'},503);}if(!targetStillExists){await bestEffortOperationState(c.env.DB,op,'NEEDS_REPAIR');if(supplied)await c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',updated_at=? WHERE owner_id=? AND scope=? AND request_key=?").bind(now(),owner,scope,supplied).run().catch(()=>{});return c.body(null,200);}let targetPresent=false;try{targetPresent=!!await c.env.IMAGES.head(target.object_key);}catch{}if(!targetPresent){try{const saved=await c.env.IMAGES.get(backup);if(!saved)throw Error('backup missing');await c.env.IMAGES.put(target.object_key,await saved.arrayBuffer(),{httpMetadata:{contentType:target.mime_type}});targetPresent=!!await c.env.IMAGES.head(target.object_key);}catch{targetPresent=false;}}if(targetPresent){try{await c.env.IMAGES.delete(backup);}catch{}await bestEffortOperationState(c.env.DB,op,'COMPENSATED');return c.json({error:'metadata delete did not commit; retry with the same idempotency key'},503);}await bestEffortOperationState(c.env.DB,op,'NEEDS_REPAIR');return c.json({error:'delete consistency requires recovery'},503);}
    // D1 row absence plus exact dense order confirms the logical delete. Backup cleanup is recoverable and cannot overturn HTTP success.
    await bestEffortOperationState(c.env.DB,op,'COMMITTED');
    if(supplied)await c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',updated_at=? WHERE owner_id=? AND scope=? AND request_key=?").bind(now(),owner,scope,supplied).run().catch(()=>{});
    try{await c.env.IMAGES.delete(backup);await bestEffortOperationState(c.env.DB,op,'CLEANED');}catch{await bestEffortOperationState(c.env.DB,op,'CLEANUP_PENDING');}
    return c.body(null,200);
  }finally{await unlock(c.env.DB,lid,lease);}
});
app.notFound(c=>c.json({error:'not found'},404));
app.onError((e,c)=>{const correlationId=crypto.randomUUID();console.error(JSON.stringify({event:'request_error',correlationId}));return c.json({error:'internal error',correlationId},500);});
async function reconcile(env:Env) {
  const pending=(await env.DB.prepare("SELECT * FROM image_operations o WHERE (state IN ('PENDING','NEEDS_REPAIR','CLEANUP_PENDING') OR (kind='DELETE' AND state IN ('COMMITTED','COMPENSATED'))) AND NOT EXISTS (SELECT 1 FROM listing_locks l WHERE l.listing_id=o.listing_id AND l.expires_at>unixepoch()) ORDER BY updated_at LIMIT 100").all<any>()).results;
  for(const op of pending){
    const lease=await lock(env.DB,op.listing_id); if(!lease) continue;
    try {
      await env.DB.prepare('UPDATE image_operations SET updated_at=? WHERE id=?').bind(now(),op.id).run();
      const row=await env.DB.prepare('SELECT id FROM listing_images WHERE object_key=?').bind(op.object_key).first();
      if(op.kind==='ADD'){
        if(row){let present=false;try{present=!!await env.IMAGES.head(op.object_key);}catch{}if(present)await bestEffortOperationState(env.DB,op.id,'COMMITTED');else await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}
        await env.IMAGES.delete(op.object_key);
        await bestEffortOperationState(env.DB,op.id,'COMPENSATED');
      }else if(op.kind==='DELETE'){
        const backup=op.backup_key?await env.IMAGES.get(op.backup_key):null;
        if(!row){
          const current=await ordered(env.DB,op.listing_id),positions=current.map(x=>x.position),dense=positions.every((position,i)=>position===i);
          if(!dense){const listing=await env.DB.prepare('SELECT owner_id FROM listings WHERE id=?').bind(op.listing_id).first<{owner_id:string}>();if(!listing||!await writeDenseOrder(env.DB,op.listing_id,listing.owner_id,lease,current)||!(await ordered(env.DB,op.listing_id)).every((x,i)=>x.position===i)){await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}}
          await env.IMAGES.delete(op.object_key);if(op.backup_key)await env.IMAGES.delete(op.backup_key);await bestEffortOperationState(env.DB,op.id,'CLEANED');continue;
        }
        if(row){if(!await env.IMAGES.head(op.object_key)){if(!backup){await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}await env.IMAGES.put(op.object_key,await backup.arrayBuffer(),{httpMetadata:{contentType:backup.httpMetadata?.contentType}});}if(!await env.IMAGES.head(op.object_key)){await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}if(op.backup_key)await env.IMAGES.delete(op.backup_key);await bestEffortOperationState(env.DB,op.id,'COMPENSATED');}
        else{await env.IMAGES.delete(op.object_key);if(op.backup_key)await env.IMAGES.delete(op.backup_key);await bestEffortOperationState(env.DB,op.id,'CLEANED');}
      }
    } catch(error) {
      console.error(JSON.stringify({event:'image_operation_recovery_deferred',operationId:op.id,kind:op.kind}));
    } finally { await unlock(env.DB,op.listing_id,lease); }
  }
}
const worker = { fetch: app.fetch, scheduled: async (_controller: ScheduledController, env: Env) => { await reconcile(env); } };
export { app };
export default worker;
