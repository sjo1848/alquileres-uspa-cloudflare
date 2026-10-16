import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { previewAuthConfigured, requiresPreviewAuth, verifyPreviewOperator, PREVIEW_OWNER_ID, PREVIEW_OWNER_EMAIL, type PreviewAuthEnv } from './preview-auth';
import { cleanImageName, d1BlobBytes, D1_IMAGE_MAX_BYTES, D1_IMAGE_MAX_COUNT, D1_MEDIA_QUOTA_BYTES, readBoundedBody, validateImageBytes } from './d1-blob-media';

type Env = PreviewAuthEnv & { MEDIA_STRATEGY?:string; DB: D1Database; IMAGES: R2Bucket; JWT_SECRET: string; JWT_EXPIRES_IN?: string; MAX_IMAGE_BYTES?: string; COOKIE_SAME_SITE?: string; COOKIE_SECURE?: string; NODE_ENV?: string };
type User = { id: string; email: string; role: 'OWNER'|'ADMIN' };
type ImageRow = { id:string; listing_id:string; object_key:string; original_name:string; mime_type:string; byte_size:number; position:number; created_at:string; blob_data?:unknown };
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
function jwtSecretBytes(env:Env) { if(typeof env.JWT_SECRET!=='string')throw Error('jwt secret unavailable');const secret=te.encode(env.JWT_SECRET);if(secret.length<32)throw Error('jwt secret too short');return secret; }
function jwtSecretConfigured(env:Env) { try{jwtSecretBytes(env);return true;}catch{return false;} }
async function sign(u:User,env:Env,expiresAt=Infinity) { const n=Math.floor(Date.now()/1000), a=b64(te.encode(JSON.stringify({alg:'HS256',typ:'JWT'}))), p=b64(te.encode(JSON.stringify({id:u.id,email:u.email,role:u.role,iat:n,exp:Math.min(n+lifetime(env),expiresAt)}))), input=`${a}.${p}`, key=await crypto.subtle.importKey('raw',jwtSecretBytes(env),{name:'HMAC',hash:'SHA-256'},false,['sign']); return `${input}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,te.encode(input))))}`; }
async function verify(token:string,env:Env) { if(token.length>8192) throw Error(); const p=token.split('.'); if(p.length!==3) throw Error(); const h=JSON.parse(new TextDecoder().decode(unb64(p[0]))), c=JSON.parse(new TextDecoder().decode(unb64(p[1]))); if(h.alg!=='HS256'||!Number.isFinite(c.exp)||c.exp<=Date.now()/1000) throw Error(); const key=await crypto.subtle.importKey('raw',jwtSecretBytes(env),{name:'HMAC',hash:'SHA-256'},false,['verify']); if(!await crypto.subtle.verify('HMAC',key,unb64(p[2]),te.encode(`${p[0]}.${p[1]}`))) throw Error(); return c as {id:string;email:string}; }
function cookie(raw:string|null) { return raw?.split(';').map(x=>x.trim()).find(x=>x.startsWith('alquileres_session='))?.slice('alquileres_session='.length); }
function setCookie(token:string,env:Env,clear=false) { const same=['strict','none'].includes(env.COOKIE_SAME_SITE??'')?env.COOKIE_SAME_SITE:'lax'; const secure=env.COOKIE_SECURE==='true'||env.NODE_ENV==='production'||same==='none'; return `alquileres_session=${clear?'':encodeURIComponent(token)}; Path=/; ${clear?'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT':'Max-Age=900'}; HttpOnly; SameSite=${same![0].toUpperCase()+same!.slice(1)}${secure?'; Secure':''}`; }
app.use('*',async(c,next)=>{ c.header('Cache-Control','no-store'); c.header('X-Content-Type-Options','nosniff'); await next(); });
app.use('*',async(c,next)=>{
  const strategy=c.env.AUTH_STRATEGY;
  if((requiresPreviewAuth(new URL(c.req.url).origin)||(strategy&&strategy!=='PASSWORD')) && (/^\/auth(?:\/|$)/.test(c.req.path)||/^\/listings(?:\/|$)/.test(c.req.path))
    && !previewAuthConfigured(c.env,new URL(c.req.url).origin))return c.json({error:'Preview authentication unavailable'},503);
  await next();
});
app.get('/auth/config',c=>c.json({strategy:c.env.AUTH_STRATEGY??'PASSWORD'}));
app.post('/auth/preview-session',async c=>{
  if(!previewAuthConfigured(c.env,new URL(c.req.url).origin)||!jwtSecretConfigured(c.env))return c.json({error:'Preview authentication unavailable'},503);
  if(c.req.header('Origin')!==new URL(c.req.url).origin)return c.json({error:'same-origin request required'},403);
  let identity:{expiresAt:number};
  try{identity=await verifyPreviewOperator(c.req.header('Cf-Access-Jwt-Assertion')??'',c.env,new URL(c.req.url).origin);}
  catch{return c.json({error:'Authorized Access identity required'},401);}
  const user=await c.env.DB.prepare("SELECT id,email,role FROM users WHERE id=? AND email=? AND role='OWNER'").bind(PREVIEW_OWNER_ID,PREVIEW_OWNER_EMAIL).first<User>();
  if(!user)return c.json({error:'Synthetic owner unavailable'},503);
  return c.json({user},200,{'Set-Cookie':setCookie(await sign(user,c.env,identity.expiresAt),c.env)});
});
app.get('/health',c=>c.json({ok:true}));
app.all('/__fixture/*',c=>c.json({error:'not found'},404));
app.post('/auth/login',async c=>{if(c.env.AUTH_STRATEGY&&c.env.AUTH_STRATEGY!=='PASSWORD')return c.json({error:'Password login is unavailable in this Preview'},403);if(!jwtSecretConfigured(c.env))return c.json({error:'authentication unavailable'},503);if(c.req.header('Origin')!==new URL(c.req.url).origin)return c.json({error:'same-origin request required'},403);const x=await c.req.json().catch(()=>null) as any; if(!x||typeof x.email!=='string'||x.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email.trim())||typeof x.password!=='string'||x.password.length<8)return c.json({error:'validation failed'},400); const u=await c.env.DB.prepare('SELECT id,email,password_hash,role FROM users WHERE email=?').bind(x.email.trim().toLowerCase()).first<any>(); if(!u||!await bcrypt.compare(x.password,u.password_hash))return c.json({error:'Invalid credentials'},401); const user:User={id:u.id,email:u.email,role:u.role}; return c.json({user},200,{'Set-Cookie':setCookie(await sign(user,c.env),c.env)}); });
app.get('/auth/me',async c=>{
  if(!jwtSecretConfigured(c.env))return c.json({error:'authentication unavailable'},503);
  const auth=c.req.header('Authorization'),raw=auth?.startsWith('Bearer ')?auth.slice(7):cookie(c.req.header('Cookie')??null);
  if(!raw)return c.json({error:'Invalid or expired token'},401);
  let claims:{id:string;email:string};try{claims=await verify(decodeURIComponent(raw),c.env);}catch{return c.json({error:'Invalid or expired token'},401);}
  const user=await c.env.DB.prepare('SELECT id,email,role FROM users WHERE id=?').bind(claims.id).first<User>();
  if(!user||user.email!==claims.email)return c.json({error:'Invalid or expired token'},401);
  return c.json(user);
});
app.post('/auth/logout',c=>{if(c.req.header('Origin')!==new URL(c.req.url).origin)return c.json({error:'same-origin request required'},403);return c.json({ok:true},200,{'Set-Cookie':setCookie('',c.env,true)});});
app.use('/listings/*',async(c,next)=>{ if(!jwtSecretConfigured(c.env))return c.json({error:'authentication unavailable'},503);const auth=c.req.header('Authorization'); const raw=auth?.startsWith('Bearer ')?auth.slice(7):cookie(c.req.header('Cookie')??null); if(!raw)return c.json({error:'Invalid or expired token'},401); if(!auth?.startsWith('Bearer ')&&['POST','PATCH','DELETE','PUT'].includes(c.req.method)){const origin=c.req.header('Origin');if(!origin||origin!==new URL(c.req.url).origin)return c.json({error:'same-origin request required'},403);}let claims:{id:string;email:string};try { claims=await verify(decodeURIComponent(raw),c.env); } catch { return c.json({error:'Invalid or expired token'},401); }const u=await c.env.DB.prepare('SELECT id,email,role FROM users WHERE id=?').bind(claims.id).first<User>();if(!u||u.email!==claims.email)return c.json({error:'Invalid or expired token'},401);if(u.role!=='OWNER')return c.json({error:'Insufficient role'},401);c.set('user',u);await next(); });
app.use('/listings/*',async(c,next)=>{if(c.env.MEDIA_STRATEGY==='STATIC_ASSETS'&&/\/images(?:\/|$)/.test(c.req.path))return c.json({error:'Owner image upload is not available with repository-managed media'},503);await next();});
app.get('/listings',async c=>{const rows=await c.env.DB.prepare('SELECT id,owner_id AS ownerId,status,title,description,location,price_amount AS priceAmount,price_period AS pricePeriod,rental_duration AS rentalDuration,max_occupants AS maxOccupants,currency,publication_status AS publicationStatus,availability_status AS availabilityStatus,last_confirmed_at AS lastConfirmedAt,rejection_reason AS rejectionReason,created_at AS createdAt,updated_at AS updatedAt FROM listings WHERE owner_id=? ORDER BY updated_at DESC').bind(c.get('user').id).all();return c.json(rows.results);});
function validListingInput(x:any){return !(!x||typeof x.title!=='string'||x.title.length<1||x.title.length>120||typeof x.description!=='string'||x.description.length>5000||typeof x.location!=='string'||x.location.length<1||x.location.length>240||!Number.isInteger(x.priceAmount)||x.priceAmount<0||x.priceAmount>2147483647||!['WEEK','MONTH'].includes(x.pricePeriod)||!['WEEKS','MONTHS','PERMANENT','FLEXIBLE'].includes(x.rentalDuration)||!Number.isInteger(x.maxOccupants)||x.maxOccupants<1||x.maxOccupants>2147483647||!['ARS','USD'].includes(x.currency));}
app.post('/listings',async c=>{
  const x=await c.req.json().catch(()=>null) as any;
  if(!validListingInput(x))return c.json({error:'validation failed'},400);
  const user=c.get('user'), supplied=requestKey(c);if(supplied===false)return c.json({error:'invalid idempotency key'},400);
  const requestFingerprint=await fingerprint({title:x.title,description:x.description,location:x.location,priceAmount:x.priceAmount,pricePeriod:x.pricePeriod,rentalDuration:x.rentalDuration,maxOccupants:x.maxOccupants,currency:x.currency});
  let listingId=id(),t=now(),body=listingDto(listingId,user.id,x,t);
  if(supplied){
    let record:any;
    try{record=await c.env.DB.prepare('SELECT request_fingerprint,resource_id,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(user.id,'LISTING_CREATE',supplied).first<any>();}catch{return c.json({error:'request outcome unavailable; retry with the same idempotency key'},503);}
    if(record){if(record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reused with different request'},409);if(typeof record.result_json!=='string')return c.json({error:'listing replay requires recovery; retry with the same idempotency key'},503);listingId=record.resource_id;body=JSON.parse(record.result_json);t=body.createdAt;}
    else {
      try{await c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,result_json,created_at,updated_at) VALUES(?,? ,?,?,?,'PENDING',?,?,?)").bind(user.id,'LISTING_CREATE',supplied,requestFingerprint,listingId,JSON.stringify(body),t,t).run();}
      catch{try{record=await c.env.DB.prepare('SELECT request_fingerprint,resource_id,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(user.id,'LISTING_CREATE',supplied).first<any>();}catch{return c.json({error:'request reservation outcome unavailable; retry with the same idempotency key'},503);}if(!record||record.request_fingerprint!==requestFingerprint||typeof record.result_json!=='string')return c.json({error:'idempotency key reservation conflict'},409);listingId=record.resource_id;body=JSON.parse(record.result_json);t=body.createdAt;}
    }
    try{const existing=await c.env.DB.prepare('SELECT id FROM listings WHERE id=? AND owner_id=?').bind(listingId,user.id).first();if(existing){if(!await confirmIdempotencyCommit(c.env.DB,user.id,'LISTING_CREATE',supplied,requestFingerprint,JSON.stringify(body)))return c.json({error:'listing acknowledgment requires recovery; retry with the same idempotency key'},503);return c.json(body,201);}}catch{return c.json({error:'listing outcome unavailable; retry with the same idempotency key'},503);}
  }
  const insert=c.env.DB.prepare("INSERT INTO listings(id,owner_id,status,title,description,location,location_search,price_amount,price_period,rental_duration,max_occupants,currency,created_at,updated_at) VALUES(?,?,'DRAFT',?,?,?,?,?,?,?,?,?,?,?)").bind(listingId,user.id,x.title,x.description,x.location,x.location.normalize('NFC').toLowerCase(),x.priceAmount,x.pricePeriod,x.rentalDuration,x.maxOccupants,x.currency,t,t);
  try{
    if(supplied){const transition=c.env.DB.prepare("UPDATE idempotency_records SET state='COMMITTED',updated_at=? WHERE owner_id=? AND scope='LISTING_CREATE' AND request_key=? AND request_fingerprint=?").bind(now(),user.id,supplied,requestFingerprint);const result=await c.env.DB.batch([insert,transition]);if(result.some(x=>x.meta?.changes!==1)){const row=await c.env.DB.prepare('SELECT id FROM listings WHERE id=? AND owner_id=?').bind(listingId,user.id).first();if(!row||!await confirmIdempotencyCommit(c.env.DB,user.id,'LISTING_CREATE',supplied,requestFingerprint,JSON.stringify(body)))return c.json({error:'listing commit requires retry with the same idempotency key'},503);}}
    else await insert.run();
  }catch{
    try{const row=await c.env.DB.prepare('SELECT id FROM listings WHERE id=? AND owner_id=?').bind(listingId,user.id).first();if(!row)return c.json({error:'listing outcome requires retry with the same idempotency key'},503);if(supplied&&!await confirmIdempotencyCommit(c.env.DB,user.id,'LISTING_CREATE',supplied,requestFingerprint,JSON.stringify(body)))return c.json({error:'listing acknowledgment requires recovery; retry with the same idempotency key'},503);}
    catch{return c.json({error:'listing outcome unknown; retry with the same idempotency key'},503);}
  }
  return c.json(body,201);
});
async function owned(c:any,listingId:string) {return c.env.DB.prepare("SELECT id FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED')").bind(listingId,c.get('user').id).first();}
async function ownerListing(db:D1Database,listingId:string,owner:string){return db.prepare("SELECT id,owner_id AS ownerId,status,title,description,location,price_amount AS priceAmount,price_period AS pricePeriod,rental_duration AS rentalDuration,max_occupants AS maxOccupants,currency,publication_status AS publicationStatus,availability_status AS availabilityStatus,last_confirmed_at AS lastConfirmedAt,rejection_reason AS rejectionReason,created_at AS createdAt,updated_at AS updatedAt FROM listings WHERE id=? AND owner_id=?").bind(listingId,owner).first<any>();}
app.patch('/listings/:id',async c=>{
  const lid=c.req.param('id'),owner=ownerId(c),input=await c.req.json().catch(()=>null) as any;
  if(!input||['priceAmount','pricePeriod','rentalDuration','maxOccupants','currency'].some(key=>input[key]===undefined))return c.json({error:'Rental fields are required'},400);
  if(!await ownerListing(c.env.DB,lid,owner))return c.json({error:'not found'},404);
  const lease=await lock(c.env.DB,lid);if(!lease)return c.json({error:'Listing is busy; retry shortly'},503);
  try{
    const current=await ownerListing(c.env.DB,lid,owner);if(!current||!['DRAFT','REJECTED'].includes(current.status))return c.json({error:'not found'},404);
    const x={...current,...Object.fromEntries(['title','description','location','priceAmount','pricePeriod','rentalDuration','maxOccupants','currency'].filter(key=>input[key]!==undefined).map(key=>[key,input[key]]))};
    if(!validListingInput(x))return c.json({error:'validation failed'},400);
    const result=await c.env.DB.prepare("UPDATE listings SET title=?,description=?,location=?,location_search=?,price_amount=?,price_period=?,rental_duration=?,max_occupants=?,currency=?,updated_at=? WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED') AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())").bind(x.title,x.description,x.location,x.location.normalize('NFC').toLowerCase(),x.priceAmount,x.pricePeriod,x.rentalDuration,x.maxOccupants,x.currency,now(),lid,owner,lid,lease).run();
    if(result.meta.changes!==1)return c.json({error:'Listing changed; reload and retry'},409);
    return c.json(await ownerListing(c.env.DB,lid,owner));
  }finally{await unlock(c.env.DB,lid,lease);}
});
app.post('/listings/:id/submit',async c=>{
  const lid=c.req.param('id'),owner=ownerId(c);
  // Ownership is checked before reserving a lock, so unknown IDs do not create FK errors.
  const existing=await ownerListing(c.env.DB,lid,owner);if(!existing)return c.json({error:'not found'},404);
  const lease=await lock(c.env.DB,lid);if(!lease)return c.json({error:'Listing is busy; retry shortly'},503);
  try{
    const current=await ownerListing(c.env.DB,lid,owner);if(!current)return c.json({error:'not found'},404);
    if(current.status==='SUBMITTED')return c.json(current);
    if(!['DRAFT','REJECTED'].includes(current.status))return c.json({error:'Listing cannot be submitted in its current status'},409);
    if(!validListingInput(current))return c.json({error:'Complete all required listing fields before submission'},400);
    if(await hasPendingDeleteRecovery(c.env.DB,lid,owner)||await hasPendingReorder(c.env.DB,owner,lid)||await c.env.DB.prepare("SELECT 1 FROM image_operations WHERE listing_id=? AND kind='ADD' AND state IN ('PENDING','NEEDS_REPAIR') LIMIT 1").bind(lid).first())return c.json({error:'Image operation requires recovery before submission'},503);
    const result=await c.env.DB.prepare("UPDATE listings SET status='SUBMITTED',rejection_reason=NULL,updated_at=? WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED') AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())").bind(now(),lid,owner,lid,lease).run();
    if(result.meta.changes!==1)return c.json({error:'Listing changed during submission'},409);
    return c.json(await ownerListing(c.env.DB,lid,owner));
  }finally{await unlock(c.env.DB,lid,lease);}
});
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
async function orderedD1Images(db:D1Database,lid:string){return (await db.prepare('SELECT id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at FROM listing_images WHERE listing_id=? AND blob_data IS NOT NULL ORDER BY position,id').bind(lid).all<ImageRow>()).results;}
function imageResponse(bytes:Uint8Array,type:string,privateImage=true){return new Response(bytes.slice().buffer as ArrayBuffer,{headers:{'Content-Type':type,'Content-Length':String(bytes.byteLength),'Cache-Control':privateImage?'private, no-store':'no-store','X-Content-Type-Options':'nosniff'}});}
function d1ImageStatus(c:any){return c.env.MEDIA_STRATEGY==='D1_BLOB';}
async function uploadD1Image(c:any,lid:string){
  if(!await owned(c,lid))return c.json({error:'not found'},404);
  const key=requestKey(c);if(!key)return c.json({error:'Idempotency-Key required for image upload'},400);
  const rawLength=c.req.header('content-length');
  if(rawLength!==undefined&&(!/^\d+$/.test(rawLength)||Number(rawLength)>D1_IMAGE_MAX_BYTES))return c.json({error:'image exceeds the 1.8 MB limit'},413);
  const originalName=cleanImageName(c.req.header('x-image-name'));
  const type=c.req.header('content-type')??'';
  if(!originalName)return c.json({error:'invalid image name'},400);
  const bytes=await readBoundedBody(c.req.raw);
  if(!bytes)return c.json({error:'image exceeds the 1.8 MB limit or has no body'},413);
  if(rawLength!==undefined&&Number(rawLength)!==bytes.byteLength)return c.json({error:'content length does not match image bytes'},400);
  if(!validateImageBytes(bytes,type))return c.json({error:'unsupported or invalid JPEG, PNG, or WebP image'},400);
  const owner=ownerId(c),scope=`IMAGE_ADD:${lid}`,contentHash=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.slice().buffer as ArrayBuffer)));
  const requestFingerprint=await fingerprint({listingId:lid,name:originalName,type,size:bytes.byteLength,contentHash});
  const lease=await lock(c.env.DB,lid);if(!lease)return c.json({error:'listing is busy; retry with the same idempotency key'},409);
  try{
    if(!await owned(c,lid))return c.json({error:'not found'},404);
    let record:any;
    try{record=await c.env.DB.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,key).first();}catch{return c.json({error:'image request outcome unavailable; retry with the same idempotency key'},503);}
    if(record){
      if(record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reused with different image'},409);
      if(record.state!=='COMMITTED'||typeof record.result_json!=='string')return c.json({error:'image reservation requires recovery; retry with the same idempotency key'},503);
      try{return c.json(JSON.parse(record.result_json),201);}catch{return c.json({error:'image replay result is invalid'},503);}
    }
    const staticImage=await c.env.DB.prepare('SELECT 1 FROM static_listing_images WHERE listing_id=? LIMIT 1').bind(lid).first();
    if(staticImage)return c.json({error:'listing uses repository-managed images'},409);
    const images=await orderedD1Images(c.env.DB,lid);
    if(!images.every((row,index)=>row.position===index))return c.json({error:'image order requires recovery'},503);
    if(images.length>=D1_IMAGE_MAX_COUNT)return c.json({error:'listing image limit reached'},409);
    const usage=await c.env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first() as {used_bytes:number}|null;
    if(!usage)return c.json({error:'image storage unavailable'},503);
    if(usage.used_bytes+bytes.byteLength>D1_MEDIA_QUOTA_BYTES)return c.json({error:'Preview image storage quota reached'},507);
    const imageId=id(),created=now(),objectKey=`d1blob:${imageId}`;
    const body={id:imageId,originalName,contentType:type,sizeBytes:bytes.byteLength,position:images.length,createdAt:created};
    const binary=bytes.slice().buffer as ArrayBuffer;
    try{
      const results=await c.env.DB.batch([
        c.env.DB.prepare('INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at,blob_data) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(imageId,lid,objectKey,originalName,type,bytes.byteLength,images.length,created,created,binary),
        c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,result_json,created_at,updated_at) VALUES(?,?,?,?,?,'COMMITTED',?,?,?)").bind(owner,scope,key,requestFingerprint,imageId,JSON.stringify(body),created,created),
      ]);
      const batchResults=results as D1Result[];if(batchResults.length!==2||batchResults.some(result=>result.meta?.changes!==1))throw new Error('image batch not confirmed');
    }catch{
      try{record=await c.env.DB.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,key).first();}catch{return c.json({error:'image commit outcome unknown; retry with the same idempotency key'},503);}
      if(record?.request_fingerprint===requestFingerprint&&record.state==='COMMITTED'&&typeof record.result_json==='string')return c.json(JSON.parse(record.result_json),201);
      const after=await c.env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first().catch(()=>null) as {used_bytes:number}|null;
      if(after&&after.used_bytes+bytes.byteLength>D1_MEDIA_QUOTA_BYTES)return c.json({error:'Preview image storage quota reached'},507);
      return c.json({error:'image was not committed; retry with the same idempotency key'},503);
    }
    return c.json(body,201);
  }finally{await unlock(c.env.DB,lid,lease);}
}
function stagedD1Order(db:D1Database,lid:string,current:ImageRow[],ids:string[]){
  const base=Math.max(1000000,...current.map(row=>row.position))+current.length+1,statements:D1PreparedStatement[]=[];
  current.forEach((row,index)=>statements.push(db.prepare('UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND blob_data IS NOT NULL').bind(base+index,now(),row.id,lid)));
  ids.forEach((imageId,index)=>statements.push(db.prepare('UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND blob_data IS NOT NULL').bind(index,now(),imageId,lid)));
  return statements;
}
async function mutationReplay(db:D1Database,owner:string,scope:string,key:string,fingerprintValue:string){
  const row=await db.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,key).first<any>();
  if(!row)return null;
  if(row.request_fingerprint!==fingerprintValue)return {conflict:true as const};
  if(row.state!=='COMMITTED'||typeof row.result_json!=='string')return {pending:true as const};
  try{return {result:JSON.parse(row.result_json)};}catch{return {pending:true as const};}
}
async function reorderD1Image(c:any,lid:string,imageId:string){
  const owner=ownerId(c);if(!await owned(c,lid))return c.json({error:'not found'},404);
  const input=await c.req.json().catch(()=>null) as any,position=input?.position;if(!Number.isInteger(position)||position<0)return c.json({error:'invalid position'},400);
  const key=requestKey(c);if(!key)return c.json({error:'Idempotency-Key required for image reorder'},400);
  const scope=`IMAGE_D1_REORDER:${lid}:${imageId}`,requestFingerprint=await fingerprint({method:'PATCH',lid,imageId,position});
  const lease=await lock(c.env.DB,lid);if(!lease)return c.json({error:'retryable conflict'},409);
  try{
    if(!await owned(c,lid))return c.json({error:'not found'},404);
    let replay;try{replay=await mutationReplay(c.env.DB,owner,scope,key,requestFingerprint);}catch{return c.json({error:'image reorder outcome unavailable; retry with the same idempotency key'},503);}
    if(replay?.conflict)return c.json({error:'idempotency key reused with a different reorder'},409);
    if(replay?.pending)return c.json({error:'image reorder requires recovery; retry with the same idempotency key'},503);
    if(replay)return c.json(replay.result,200);
    const current=await orderedD1Images(c.env.DB,lid);if(!current.every((row,index)=>row.position===index))return c.json({error:'image order requires recovery'},503);
    const index=current.findIndex(row=>row.id===imageId);if(index<0)return c.json({error:'not found'},404);if(position>=current.length)return c.json({error:'invalid position'},400);
    const [moved]=current.splice(index,1);current.splice(position,0,moved);
    const result=current.map((row,index)=>imageDto({...row,position:index})),resultJson=JSON.stringify(result),created=now();
    const statements=stagedD1Order(c.env.DB,lid,await orderedD1Images(c.env.DB,lid),current.map(row=>row.id));
    statements.push(c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,result_json,created_at,updated_at) VALUES(?,?,?,?,?,'COMMITTED',?,?,?)").bind(owner,scope,key,requestFingerprint,imageId,resultJson,created,created));
    try{await c.env.DB.batch(statements);}catch{}
    const after=await orderedD1Images(c.env.DB,lid),record=await mutationReplay(c.env.DB,owner,scope,key,requestFingerprint).catch(()=>null);
    if(after.length===result.length&&after.every((row,i)=>row.id===result[i].id&&row.position===i)&&record&&!('pending'in record)&&!('conflict'in record))return c.json(record.result,200);
    return c.json({error:'image reorder was not confirmed; retry with the same idempotency key'},503);
  }finally{await unlock(c.env.DB,lid,lease);}
}
async function deleteD1Image(c:any,lid:string,imageId:string){
  const owner=ownerId(c);if(!await owned(c,lid))return c.json({error:'not found'},404);
  const key=requestKey(c);if(!key)return c.json({error:'Idempotency-Key required for image deletion'},400);
  const scope=`IMAGE_D1_DELETE:${lid}:${imageId}`,requestFingerprint=await fingerprint({method:'DELETE',lid,imageId});
  const lease=await lock(c.env.DB,lid);if(!lease)return c.json({error:'retryable conflict'},409);
  try{
    if(!await owned(c,lid))return c.json({error:'not found'},404);
    let replay;try{replay=await mutationReplay(c.env.DB,owner,scope,key,requestFingerprint);}catch{return c.json({error:'image delete outcome unavailable; retry with the same idempotency key'},503);}
    if(replay?.conflict)return c.json({error:'idempotency key reused with a different delete'},409);
    if(replay?.pending)return c.json({error:'image delete requires recovery; retry with the same idempotency key'},503);
    if(replay)return c.body(null,200);
    const current=await orderedD1Images(c.env.DB,lid);if(!current.every((row,index)=>row.position===index))return c.json({error:'image order requires recovery'},503);
    const target=current.find(row=>row.id===imageId);if(!target)return c.json({error:'not found'},404);
    const remaining=current.filter(row=>row.id!==imageId),statements:D1PreparedStatement[]=[c.env.DB.prepare('DELETE FROM listing_images WHERE id=? AND listing_id=? AND blob_data IS NOT NULL').bind(imageId,lid)];
    statements.push(...stagedD1Order(c.env.DB,lid,remaining,remaining.map(row=>row.id)));
    const created=now();statements.push(c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,result_json,created_at,updated_at) VALUES(?,?,?,?,?,'COMMITTED','null',?,?)").bind(owner,scope,key,requestFingerprint,imageId,created,created));
    try{await c.env.DB.batch(statements);}catch{}
    const after=await orderedD1Images(c.env.DB,lid),record=await mutationReplay(c.env.DB,owner,scope,key,requestFingerprint).catch(()=>null);
    if(!after.some(row=>row.id===imageId)&&after.every((row,index)=>row.position===index)&&record&&!('pending'in record)&&!('conflict'in record))return c.body(null,200);
    return c.json({error:'image deletion was not confirmed; retry with the same idempotency key'},503);
  }finally{await unlock(c.env.DB,lid,lease);}
}
async function bestEffortOperationState(db:D1Database,op:string,state:'COMMITTED'|'CLEANED'|'COMPENSATED'|'CLEANUP_PENDING'|'NEEDS_REPAIR') { try{const cleanupComplete=state==='CLEANED'||state==='COMPENSATED';await db.prepare('UPDATE image_operations SET state=?,cleanup_complete=?,updated_at=? WHERE id=?').bind(state,cleanupComplete?1:0,now(),op).run();return true;}catch{return false;} }
async function compensateAdd(db:D1Database,bucket:R2Bucket,op:string,key:string) { try{await bucket.delete(key);if(await bucket.head(key)){await bestEffortOperationState(db,op,'NEEDS_REPAIR');return false;}await bestEffortOperationState(db,op,'COMPENSATED');return true;}catch{await bestEffortOperationState(db,op,'NEEDS_REPAIR');return false;} }
async function cleanupDeleteBackup(db:D1Database,bucket:R2Bucket,op:string,backup:string,state:'CLEANED'|'COMPENSATED') { try{await bucket.delete(backup);const remaining=await bucket.head(backup);await bestEffortOperationState(db,op,remaining?'CLEANUP_PENDING':state);return !remaining;}catch{await bestEffortOperationState(db,op,'CLEANUP_PENDING');return false;} }
async function writeDenseOrder(db:D1Database,lid:string,owner:string,lease:string,items:ImageRow[]) { const maximum=await db.prepare('SELECT COALESCE(MAX(position),-1) AS position FROM listing_images WHERE listing_id=?').bind(lid).first<{position:number}>(),maxPosition=maximum?.position??-1;if(!Number.isSafeInteger(maxPosition)||maxPosition>Number.MAX_SAFE_INTEGER-items.length*2)return false;const stagingBase=Math.max(1000000,maxPosition+items.length+1),fence=Math.floor(Date.now()/1000),stmts:D1PreparedStatement[]=[];for(let i=0;i<items.length;i++)stmts.push(db.prepare("UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(stagingBase+i,now(),items[i].id,lid,lid,lease,fence,lid,owner));for(let i=0;i<items.length;i++)stmts.push(db.prepare("UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(i,now(),items[i].id,lid,lid,lease,fence,lid,owner));const result=await db.batch(stmts);return result.length===stmts.length&&result.every(x=>x.meta?.changes===1); }
async function orderIs(db:D1Database,lid:string,ids:string[]) { try{const rows=await db.prepare('SELECT id,position FROM listing_images WHERE listing_id=? ORDER BY position').bind(lid).all<{id:string;position:number}>();return rows.results.length===ids.length&&rows.results.every((row,i)=>row.id===ids[i]&&row.position===i);}catch{return false;} }
async function plannedAddOrder(db:D1Database,lid:string,imageId:string,resultJson:string) { try{const result=JSON.parse(resultJson),current=await ordered(db,lid);if(result?.id!==imageId||!Number.isInteger(result.position)||result.position<0)return null;const ids=current.filter(row=>row.id!==imageId).map(row=>row.id);if(current.length!==ids.length+1||result.position>ids.length)return null;ids.splice(result.position,0,imageId);return ids;}catch{return null;} }
async function ensureExactImageOrder(db:D1Database,lid:string,owner:string,lease:string,ids:string[]) { if(await orderIs(db,lid,ids))return true;const current=await ordered(db,lid);if(current.length!==ids.length||ids.some(id=>!current.some(row=>row.id===id)))return false;const plan=ids.map(id=>current.find(row=>row.id===id)!);return await writeDenseOrder(db,lid,owner,lease,plan)&&await orderIs(db,lid,ids); }
async function ensurePlannedAddOrder(db:D1Database,lid:string,owner:string,lease:string,imageId:string,resultJson:string) { const ids=await plannedAddOrder(db,lid,imageId,resultJson);return !!ids&&ensureExactImageOrder(db,lid,owner,lease,ids); }
async function confirmAddOperationCommit(db:D1Database,op:string,lid:string,lease:string,fence:number,imageId:string,objectKey:string,resultJson:string) { try{await db.prepare("UPDATE image_operations SET state='COMMITTED',result_json=?,updated_at=? WHERE id=? AND kind='ADD' AND listing_id=? AND image_id=? AND object_key=? AND state IN ('PENDING','NEEDS_REPAIR','COMMITTED') AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listing_images WHERE id=? AND listing_id=? AND object_key=?)").bind(resultJson,now(),op,lid,imageId,objectKey,lid,lease,fence,imageId,lid,objectKey).run();}catch{}try{const row=await db.prepare('SELECT state,result_json FROM image_operations WHERE id=? AND kind=\'ADD\' AND listing_id=? AND image_id=? AND object_key=?').bind(op,lid,imageId,objectKey).first<any>();return row?.state==='COMMITTED'&&row.result_json===resultJson;}catch{return false;} }
async function ensureDenseCurrentOrder(db:D1Database,lid:string,owner:string,lease:string) { const rows=await ordered(db,lid),ids=rows.map(row=>row.id);if(rows.every((row,index)=>row.position===index))return true;return await writeDenseOrder(db,lid,owner,lease,rows)&&await orderIs(db,lid,ids); }
function reorderCommitGuard(lid:string,lease:string,ids:string[]) { const exact=ids.map(()=>`AND EXISTS (SELECT 1 FROM listing_images WHERE listing_id=? AND id=? AND position=?)`).join(' ');const sql=`AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch()) AND (SELECT COUNT(*) FROM listing_images WHERE listing_id=?)=? AND NOT EXISTS (SELECT 1 FROM listing_images WHERE listing_id=? AND (position<0 OR position>=?)) ${exact}`;const values:any[]=[lid,lease,lid,ids.length,lid,ids.length];ids.forEach((id,index)=>values.push(lid,id,index));return {sql,values}; }
async function confirmReorderOperation(db:D1Database,owner:string,scope:string,key:string,requestFingerprint:string,resultJson:string,lid:string,lease:string,ids:string[]) { const guard=reorderCommitGuard(lid,lease,ids);try{await db.prepare(`UPDATE image_reorder_operations SET state='COMMITTED',result_json=?,updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? AND result_json=? AND state IN ('PENDING','NEEDS_REPAIR') AND retryable=1 ${guard.sql}`).bind(resultJson,now(),owner,scope,key,requestFingerprint,resultJson,...guard.values).run();}catch{}try{const row=await db.prepare('SELECT request_fingerprint,state,result_json,retryable FROM image_reorder_operations WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,key).first<any>();return row?.request_fingerprint===requestFingerprint&&row.state==='COMMITTED'&&row.retryable===1&&row.result_json===resultJson;}catch{return false;} }
async function confirmReorderIdempotency(db:D1Database,owner:string,scope:string,key:string,requestFingerprint:string,resultJson:string) { try{await db.prepare("UPDATE idempotency_records SET state='COMMITTED',result_json=?,updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? AND state IN ('PENDING','NEEDS_REPAIR') AND EXISTS (SELECT 1 FROM image_reorder_operations o WHERE o.owner_id=? AND o.scope=? AND o.request_key=? AND o.request_fingerprint=? AND o.state='COMMITTED' AND o.retryable=1 AND o.result_json=?)").bind(resultJson,now(),owner,scope,key,requestFingerprint,owner,scope,key,requestFingerprint,resultJson).run();}catch{}try{const row=await db.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,key).first<any>();return row?.request_fingerprint===requestFingerprint&&row.state==='COMMITTED'&&row.result_json===resultJson;}catch{return false;} }
async function repairReorderOperationFromCommittedRecord(db:D1Database,owner:string,scope:string,key:string,requestFingerprint:string,resultJson:string) { try{await db.prepare("UPDATE image_reorder_operations SET state='COMMITTED',updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? AND result_json=? AND state IN ('PENDING','NEEDS_REPAIR') AND retryable=1 AND EXISTS (SELECT 1 FROM idempotency_records r WHERE r.owner_id=? AND r.scope=? AND r.request_key=? AND r.request_fingerprint=? AND r.state='COMMITTED' AND r.result_json=?)").bind(now(),owner,scope,key,requestFingerprint,resultJson,owner,scope,key,requestFingerprint,resultJson).run();}catch{}try{const row=await db.prepare('SELECT request_fingerprint,state,result_json FROM image_reorder_operations WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,key).first<any>();return row?.request_fingerprint===requestFingerprint&&row.state==='COMMITTED'&&row.result_json===resultJson;}catch{return false;} }
async function repairRetiredReorderIdempotency(db:D1Database,op:any) { const imageId=String(op.scope).slice(`IMAGE_REORDER:${op.listing_id??String(op.scope).slice('IMAGE_REORDER:'.length).split(':')[0]}:`.length);try{const row=await db.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(op.owner_id,op.scope,op.request_key).first<any>();if(row&&(row.request_fingerprint!==op.request_fingerprint||(row.result_json!==null&&row.result_json!==op.result_json)||!['PENDING','NEEDS_REPAIR'].includes(row.state)))return false;if(row)await db.prepare("UPDATE idempotency_records SET state='NEEDS_REPAIR',result_json=?,updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? AND (result_json IS NULL OR result_json=?) AND state IN ('PENDING','NEEDS_REPAIR')").bind(op.result_json,now(),op.owner_id,op.scope,op.request_key,op.request_fingerprint,op.result_json).run();else await db.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,result_json,created_at,updated_at) VALUES(?,?,?,?,?,'NEEDS_REPAIR',?,?,?)").bind(op.owner_id,op.scope,op.request_key,op.request_fingerprint,imageId,op.result_json,now(),now()).run();const after=await db.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(op.owner_id,op.scope,op.request_key).first<any>();return after?.request_fingerprint===op.request_fingerprint&&after.state==='NEEDS_REPAIR'&&after.result_json===op.result_json;}catch{return false;} }
async function ensureReorderIdempotencyReservation(db:D1Database,op:any) { const lid=op.listing_id??String(op.scope).slice('IMAGE_REORDER:'.length).split(':')[0],imageId=String(op.scope).slice(`IMAGE_REORDER:${lid}:`.length);try{let row=await db.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(op.owner_id,op.scope,op.request_key).first<any>();if(!row)await db.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,result_json,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?,?)").bind(op.owner_id,op.scope,op.request_key,op.request_fingerprint,imageId,op.result_json,now(),now()).run();else if(row.request_fingerprint===op.request_fingerprint&&row.result_json==null&&['PENDING','NEEDS_REPAIR'].includes(row.state))await db.prepare("UPDATE idempotency_records SET result_json=?,updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? AND result_json IS NULL AND state IN ('PENDING','NEEDS_REPAIR')").bind(op.result_json,now(),op.owner_id,op.scope,op.request_key,op.request_fingerprint).run();row=await db.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(op.owner_id,op.scope,op.request_key).first<any>();return row?.request_fingerprint===op.request_fingerprint&&row.result_json===op.result_json&&['PENDING','NEEDS_REPAIR','COMMITTED'].includes(row.state);}catch{return false;} }
async function hasPendingReorder(db:D1Database,owner:string,lid:string,exceptScope?:string,exceptKey?:string,exceptFingerprint?:string) { const prefix=`IMAGE_REORDER:${lid}:`,recoverable="((o.state IN ('PENDING','NEEDS_REPAIR') AND o.retryable=1) OR (o.state='COMMITTED' AND o.retryable=1 AND EXISTS (SELECT 1 FROM idempotency_records r WHERE r.owner_id=o.owner_id AND r.scope=o.scope AND r.request_key=o.request_key AND r.request_fingerprint=o.request_fingerprint AND r.state IN ('PENDING','NEEDS_REPAIR'))))";try{const row=exceptScope&&exceptKey&&exceptFingerprint?await db.prepare(`SELECT 1 FROM image_reorder_operations o WHERE o.owner_id=? AND substr(o.scope,1,?)=? AND ${recoverable} AND NOT (o.scope=? AND o.request_key=? AND o.request_fingerprint=?) LIMIT 1`).bind(owner,prefix.length,prefix,exceptScope,exceptKey,exceptFingerprint).first():await db.prepare(`SELECT 1 FROM image_reorder_operations o WHERE o.owner_id=? AND substr(o.scope,1,?)=? AND ${recoverable} LIMIT 1`).bind(owner,prefix.length,prefix).first();return !!row;}catch{return true;} }
async function hasPendingDeleteRecovery(db:D1Database,lid:string,owner:string,exceptScope?:string,exceptKey?:string,exceptFingerprint?:string) { try{const row=exceptScope&&exceptKey&&exceptFingerprint?await db.prepare("SELECT 1 FROM image_operations o WHERE o.listing_id=? AND o.kind='DELETE' AND (o.state IN ('PENDING','NEEDS_REPAIR') OR (o.state='COMPENSATED' AND o.cleanup_complete=0)) AND NOT (EXISTS (SELECT 1 FROM idempotency_records r WHERE r.owner_id=? AND r.scope=? AND r.request_key=? AND r.request_fingerprint=? AND r.resource_id=o.image_id AND r.state IN ('PENDING','NEEDS_REPAIR','COMMITTED'))) LIMIT 1").bind(lid,owner,exceptScope,exceptKey,exceptFingerprint).first():await db.prepare("SELECT 1 FROM image_operations WHERE listing_id=? AND kind='DELETE' AND (state IN ('PENDING','NEEDS_REPAIR') OR (state='COMPENSATED' AND cleanup_complete=0)) LIMIT 1").bind(lid).first();return !!row;}catch{return true;} }
async function confirmIdempotencyCommit(db:D1Database,owner:string,scope:string,key:string,requestFingerprint:string,resultJson?:string) { try{const result=await db.prepare("UPDATE idempotency_records SET state='COMMITTED',result_json=COALESCE(?,result_json),updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? AND state IN ('PENDING','NEEDS_REPAIR')").bind(resultJson??null,now(),owner,scope,key,requestFingerprint).run();if(result?.meta?.changes===1)return true;}catch{}try{const row=await db.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,key).first<any>();return row?.request_fingerprint===requestFingerprint&&row.state==='COMMITTED'&&(resultJson===undefined||row.result_json===resultJson);}catch{return false;} }
async function resetCompensatedIdempotency(db:D1Database,owner:string,scope:string,key:string,requestFingerprint:string,lid:string,imageId:string,lease:string,targetPresent:boolean) { try{const target=await db.prepare('SELECT id FROM listing_images WHERE id=? AND listing_id=?').bind(imageId,lid).first();if(!!target!==targetPresent)return false;const targetGuard=targetPresent?'EXISTS':'NOT EXISTS';await db.prepare(`UPDATE idempotency_records SET state='PENDING',result_json=NULL,updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? AND state IN ('COMMITTED','NEEDS_REPAIR') AND ${targetGuard} (SELECT 1 FROM listing_images WHERE id=? AND listing_id=?) AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())`).bind(now(),owner,scope,key,requestFingerprint,imageId,lid,lid,lease).run();const row=await db.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,key).first<any>();return row?.request_fingerprint===requestFingerprint&&row.state==='PENDING'&&row.result_json===null;}catch{return false;} }
app.get('/listings/:id/images',async c=>{const lid=c.req.param('id');if(!await owned(c,lid))return c.json({error:'not found'},404);const rows=d1ImageStatus(c)?await orderedD1Images(c.env.DB,lid):await ordered(c.env.DB,lid);if(!rows.every((row,index)=>row.position===index))return c.json({error:'image ordering requires recovery; retry after recovery'},503);return c.json(rows.map(imageDto));});
app.post('/listings/:id/images', async c => {
  const lid=c.req.param('id');
  if(d1ImageStatus(c))return uploadD1Image(c,lid);
  if(!await owned(c,lid)) return c.json({error:'not found'},404);
  const maxImageBytes=Number(c.env.MAX_IMAGE_BYTES??5242880);if(!Number.isSafeInteger(maxImageBytes)||maxImageBytes<1)return c.json({error:'image upload configuration invalid'},503);
  const limit=maxImageBytes+128*1024;
  if(Number(c.req.header('content-length')??0)>limit) return c.json({error:'request too large'},413);
  const reader=c.req.raw.body?.getReader(), chunks:Uint8Array[]=[]; let total=0;
  if(reader) for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();return c.json({error:'request too large'},413);}chunks.push(value);}
  const request=new Request(c.req.raw.url,{method:'POST',headers:c.req.raw.headers,body:new Blob(chunks.map(x=>x.slice().buffer as ArrayBuffer))});
  const form=await request.formData().catch(()=>null),file=form?.get('image');
  if(!(file instanceof File)) return c.json({error:'image required'},400);
  if(file.size<16||file.size>maxImageBytes||!/^[^/\\\0]{1,120}$/.test(file.name)||file.name.startsWith('.')) return c.json({error:'invalid image'},400);
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
      if(record){if(record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reused with different request'},409);imageId=record.resource_id;const existing=await c.env.DB.prepare('SELECT * FROM listing_images WHERE id=? AND listing_id=?').bind(imageId,lid).first<ImageRow>();if(!existing){const prior=await c.env.DB.prepare("SELECT state,cleanup_complete,result_json FROM image_operations WHERE image_id=? AND kind='ADD' ORDER BY created_at DESC LIMIT 1").bind(imageId).first<{state:string;cleanup_complete:number;result_json:string|null}>();if(prior?.state==='COMPENSATED'&&prior.cleanup_complete===1&&record.state==='COMMITTED'){if(!await resetCompensatedIdempotency(c.env.DB,requestOwner,scope,supplied,requestFingerprint,lid,imageId,lease,false))return c.json({error:'compensated upload reservation requires recovery; retry with the same idempotency key'},503);record.state='PENDING';}else if(prior?.state==='COMMITTED'&&['PENDING','NEEDS_REPAIR','COMMITTED'].includes(record.state)){const resultJson=record.result_json??prior.result_json;if(typeof resultJson!=='string')return c.json({error:'committed image replay requires recovery'},503);let body:any;try{body=JSON.parse(resultJson);}catch{return c.json({error:'committed image replay requires recovery'},503);}if(body?.id!==imageId||!Number.isInteger(body.position)||body.position<0)return c.json({error:'committed image replay requires recovery'},503);if(!await confirmIdempotencyCommit(c.env.DB,requestOwner,scope,supplied,requestFingerprint,resultJson))return c.json({error:'image acknowledgment requires recovery; retry with the same idempotency key'},503);return c.json(body,201);}else if(record.state==='COMMITTED')return c.json({error:'committed image replay requires recovery'},503);}if(existing){let objectPresent=false;try{objectPresent=!!await c.env.IMAGES.head(existing.object_key);}catch{}if(!objectPresent){await c.env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE image_id=? AND kind='ADD'").bind(now(),imageId).run().catch(()=>{});return c.json({error:'committed image requires storage repair'},503);}const prior=await c.env.DB.prepare("SELECT id,result_json,state FROM image_operations WHERE image_id=? AND kind='ADD' ORDER BY created_at DESC LIMIT 1").bind(imageId).first<{id:string;result_json:string|null;state:string}>();if(prior?.state!=='COMMITTED')return c.json({error:'image operation requires recovery; retry with the same idempotency key'},503);const resultJson=record.result_json??prior.result_json;if(typeof resultJson!=='string')return c.json({error:'committed image replay requires recovery'},503);let body:any;try{body=JSON.parse(resultJson);}catch{return c.json({error:'committed image replay requires recovery'},503);}if(body?.id!==imageId||!Number.isInteger(body.position)||body.position<0)return c.json({error:'committed image replay requires recovery'},503);if(!await confirmIdempotencyCommit(c.env.DB,requestOwner,scope,supplied,requestFingerprint,resultJson))return c.json({error:'image acknowledgment requires recovery; retry with the same idempotency key'},503);return c.json(body,201);}if(record.state==='COMMITTED')return c.json({error:'committed image metadata requires repair'},503);const priorOp=await c.env.DB.prepare("SELECT id FROM image_operations WHERE image_id=? AND kind='ADD' ORDER BY created_at DESC LIMIT 1").bind(imageId).first<{id:string}>();if(priorOp)op=priorOp.id;}
      else{try{await c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?)").bind(requestOwner,scope,supplied,requestFingerprint,imageId,created,created).run();}catch{try{record=await c.env.DB.prepare('SELECT request_fingerprint,resource_id,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(requestOwner,scope,supplied).first<any>();}catch{return c.json({error:'image request reservation unavailable; retry with the same idempotency key'},503);}if(!record||record.request_fingerprint!==requestFingerprint)return c.json({error:'image request reservation conflict'},409);imageId=record.resource_id;const priorOp=await c.env.DB.prepare("SELECT id FROM image_operations WHERE image_id=? AND kind='ADD' ORDER BY created_at DESC LIMIT 1").bind(imageId).first<{id:string}>();if(priorOp)op=priorOp.id;}}
    }
    if(await hasPendingDeleteRecovery(c.env.DB,lid,requestOwner))return c.json({error:'another image delete requires recovery; retry after its original request'},503);
    if(await hasPendingReorder(c.env.DB,requestOwner,lid))return c.json({error:'another image reorder requires recovery; retry after its original request'},503);
    const objectKey=`listings/${lid}/${imageId}.${extension}`;
    let images=await ordered(c.env.DB,lid); if(images.length>=20) return c.json({error:'image limit reached'},409);
    if(!images.every((image,index)=>image.position===index)){if(!await writeDenseOrder(c.env.DB,lid,requestOwner,lease,images)||!await orderIs(c.env.DB,lid,images.map(x=>x.id)))return c.json({error:'image ordering requires recovery'},503);images=images.map((image,index)=>({...image,position:index}));}
    const responseBody=imageDto({id:imageId,listing_id:lid,object_key:objectKey,original_name:file.name,mime_type:type,byte_size:bytes.length,position:images.length,created_at:created}),resultJson=JSON.stringify(responseBody);
    const priorOp=await c.env.DB.prepare("SELECT id FROM image_operations WHERE image_id=? AND kind='ADD' ORDER BY created_at DESC LIMIT 1").bind(imageId).first<{id:string}>();if(priorOp){op=priorOp.id;await c.env.DB.prepare("UPDATE image_operations SET result_json=?,updated_at=? WHERE id=? AND state IN ('PENDING','NEEDS_REPAIR')").bind(resultJson,now(),op).run();}else await c.env.DB.prepare("INSERT INTO image_operations(id,listing_id,kind,state,object_key,image_id,result_json,created_at,updated_at) VALUES(?,?,'ADD','PENDING',?,?,?,?,?)").bind(op,lid,objectKey,imageId,resultJson,created,created).run();
    try{await c.env.IMAGES.put(objectKey,bytes,{httpMetadata:{contentType:type,cacheControl:'private, no-store'}});}catch{let present=false;try{present=!!await c.env.IMAGES.head(objectKey);}catch{await bestEffortOperationState(c.env.DB,op,'NEEDS_REPAIR');return c.json({error:'image storage outcome requires recovery'},503);}await bestEffortOperationState(c.env.DB,op,present?'NEEDS_REPAIR':'COMPENSATED');return c.json({error:'image storage failed'},503);}
    const fence=Math.floor(Date.now()/1000);
    const expectedOrder=[...images.map(x=>x.id),imageId],addCommitGuard=`AND (SELECT COUNT(*) FROM listing_images WHERE listing_id=?)=? ${expectedOrder.map(()=>"AND EXISTS (SELECT 1 FROM listing_images WHERE id=? AND listing_id=? AND position=?)").join(' ')}`,addCommitValues=[lid,expectedOrder.length,...expectedOrder.flatMap((id,position)=>[id,lid,position])];
    let results:D1Result[];
    try{
      const statements=[
        c.env.DB.prepare("INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(imageId,lid,objectKey,file.name,type,bytes.length,images.length,created,created,lid,lease,fence,lid,c.get('user').id),
        c.env.DB.prepare(`UPDATE image_operations SET state='COMMITTED',result_json=?,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listing_images WHERE id=? AND listing_id=? AND object_key=?) ${addCommitGuard}`).bind(resultJson,now(),op,lid,lease,fence,imageId,lid,objectKey,...addCommitValues)
      ];if(supplied)statements.push(c.env.DB.prepare(`UPDATE idempotency_records SET state='COMMITTED',result_json=?,updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? AND EXISTS (SELECT 1 FROM listing_images WHERE id=? AND listing_id=? AND object_key=?) ${addCommitGuard}`).bind(JSON.stringify(responseBody),now(),requestOwner,scope,supplied,requestFingerprint,imageId,lid,objectKey,...addCommitValues));
      results=await c.env.DB.batch(statements);
    }catch{
      let exists:unknown;
      try{exists=await c.env.DB.prepare('SELECT id FROM listing_images WHERE id=?').bind(imageId).first();}catch{await c.env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE id=?").bind(now(),op).run().catch(()=>{});return c.json({error:'metadata outcome requires recovery'},503);}
      if(exists){let objectPresent=false;try{objectPresent=!!await c.env.IMAGES.head(objectKey);}catch{}if(objectPresent){if(!await ensurePlannedAddOrder(c.env.DB,lid,requestOwner,lease,imageId,resultJson)){await bestEffortOperationState(c.env.DB,op,'NEEDS_REPAIR');return c.json({error:'image ordering requires recovery'},503);}if(!await confirmAddOperationCommit(c.env.DB,op,lid,lease,fence,imageId,objectKey,resultJson))return c.json({error:'image operation requires recovery; retry with the same idempotency key'},503);if(supplied&&!await confirmIdempotencyCommit(c.env.DB,requestOwner,scope,supplied,requestFingerprint,resultJson))return c.json({error:'image acknowledgment requires recovery; retry with the same idempotency key'},503);return c.json(responseBody,201);}await c.env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE id=?").bind(now(),op).run().catch(()=>{});return c.json({error:'image metadata committed but storage requires repair'},503);}
      if(await compensateAdd(c.env.DB,c.env.IMAGES,op,objectKey))return c.json({error:'metadata commit failed; retry with the same idempotency key'},503);return c.json({error:'metadata compensation requires recovery'},503);
    }
    if(results.some(result=>result?.meta?.changes!==1)){let exists:unknown;try{exists=await c.env.DB.prepare('SELECT id FROM listing_images WHERE id=?').bind(imageId).first();}catch{return c.json({error:'metadata outcome requires recovery'},503);}if(exists){let objectPresent=false;try{objectPresent=!!await c.env.IMAGES.head(objectKey);}catch{}if(objectPresent){if(await ensurePlannedAddOrder(c.env.DB,lid,requestOwner,lease,imageId,resultJson)){if(!await confirmAddOperationCommit(c.env.DB,op,lid,lease,fence,imageId,objectKey,resultJson))return c.json({error:'image operation requires recovery; retry with the same idempotency key'},503);if(supplied&&!await confirmIdempotencyCommit(c.env.DB,requestOwner,scope,supplied,requestFingerprint,resultJson))return c.json({error:'image acknowledgment requires recovery; retry with the same idempotency key'},503);return c.json(responseBody,201);}await bestEffortOperationState(c.env.DB,op,'NEEDS_REPAIR');return c.json({error:'image ordering requires recovery'},503);}return c.json({error:'image metadata committed but storage requires repair'},503);}await compensateAdd(c.env.DB,c.env.IMAGES,op,objectKey);return c.json({error:'retryable conflict'},409);}
    if(!await orderIs(c.env.DB,lid,expectedOrder)){const current=await ordered(c.env.DB,lid),repairable=current.length===expectedOrder.length&&await writeDenseOrder(c.env.DB,lid,requestOwner,lease,expectedOrder.map(id=>current.find(x=>x.id===id)!))&&await orderIs(c.env.DB,lid,expectedOrder);if(!repairable)return c.json({error:'image ordering requires recovery'},503);}
    if(!await confirmAddOperationCommit(c.env.DB,op,lid,lease,fence,imageId,objectKey,resultJson))return c.json({error:'image operation requires recovery; retry with the same idempotency key'},503);
    if(supplied&&!await confirmIdempotencyCommit(c.env.DB,requestOwner,scope,supplied,requestFingerprint,resultJson))return c.json({error:'image acknowledgment requires recovery; retry with the same idempotency key'},503);
    return c.json(responseBody,201);
  }finally{await unlock(c.env.DB,lid,lease);}
});
app.get('/listings/:id/images/:imageId',async c=>{const lid=c.req.param('id'),imageId=c.req.param('imageId');if(!await owned(c,lid))return c.json({error:'not found'},404);if(d1ImageStatus(c)){const row=await c.env.DB.prepare('SELECT blob_data,mime_type,byte_size FROM listing_images WHERE listing_id=? AND id=? AND blob_data IS NOT NULL').bind(lid,imageId).first<any>();if(!row)return c.json({error:'not found'},404);const bytes=d1BlobBytes(row.blob_data);if(!bytes||bytes.byteLength!==row.byte_size)return c.json({error:'image data unavailable'},503);return imageResponse(bytes,row.mime_type,true);}const row=await c.env.DB.prepare('SELECT * FROM listing_images WHERE listing_id=? AND id=?').bind(lid,imageId).first<ImageRow>();if(!row)return c.json({error:'not found'},404);const obj=await c.env.IMAGES.get(row.object_key);if(!obj)return c.json({error:'not found'},404);return new Response(obj.body,{headers:{'Content-Type':row.mime_type,'Content-Length':String(row.byte_size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});});
const PUBLIC_FRESHNESS_MS=30*24*60*60*1000;
const PUBLIC_ENUMS={currency:['ARS','USD'],pricePeriod:['WEEK','MONTH'],rentalDuration:['WEEKS','MONTHS','PERMANENT','FLEXIBLE']} as const;
function publicInteger(value:string|null,min:number,max:number,name:string,defaultValue?:number){if(value===null)return defaultValue; if(!/^(0|[1-9]\d*)$/.test(value))throw Error(`${name} must be an integer`);const parsed=Number(value);if(!Number.isSafeInteger(parsed)||parsed<min||parsed>max)throw Error(`${name} is outside the allowed range`);return parsed;}
function publicFreshness(lastConfirmedAt:string|null){if(!lastConfirmedAt)return 'UNCONFIRMED';const time=Date.parse(lastConfirmedAt);if(!Number.isFinite(time))return 'UNCONFIRMED';return time>Date.now()?'UNCONFIRMED':Date.now()-time<=PUBLIC_FRESHNESS_MS?'FRESH':'STALE';}
function publicDomainStatus(row:any){return row.priceAmount!==null&&row.pricePeriod!==null&&row.rentalDuration!==null&&row.maxOccupants!==null&&row.currency!==null?'COMPLETE':'MISSING';}
function publicListingDto(row:any,images:any[]){return {id:row.id,title:row.title,description:row.description,location:row.location,priceAmount:row.priceAmount,pricePeriod:row.pricePeriod,rentalDuration:row.rentalDuration,maxOccupants:row.maxOccupants,currency:row.currency,domainDataStatus:publicDomainStatus(row),availabilityStatus:row.availabilityStatus,lastConfirmedAt:row.lastConfirmedAt,freshnessStatus:publicFreshness(row.lastConfirmedAt),images:images.map(image=>({id:image.id,contentType:image.contentType,sizeBytes:image.sizeBytes,position:image.position,...(image.url?{url:image.url}:{})}))};}
async function publicImages(db:D1Database,listingIds:string[],staticMedia=false,d1Blob=false){if(!listingIds.length)return [];const placeholders=listingIds.map(()=>'?').join(',');if(staticMedia||d1Blob){const staticRows=(await db.prepare(`SELECT id,listing_id AS listingId,asset_path AS url,mime_type AS contentType,byte_size AS sizeBytes,position FROM static_listing_images WHERE listing_id IN (${placeholders}) ORDER BY position ASC,id ASC`).bind(...listingIds).all<any>()).results;if(staticMedia)return staticRows;const blobRows=(await db.prepare(`SELECT id,listing_id AS listingId,mime_type AS contentType,byte_size AS sizeBytes,position FROM listing_images WHERE listing_id IN (${placeholders}) AND blob_data IS NOT NULL ORDER BY position ASC,id ASC`).bind(...listingIds).all<any>()).results;return [...staticRows,...blobRows].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));}const rows=(await db.prepare(`SELECT id,listing_id AS listingId,mime_type AS contentType,byte_size AS sizeBytes,position FROM listing_images WHERE listing_id IN (${placeholders}) ORDER BY position ASC,id ASC`).bind(...listingIds).all<any>()).results;return rows;}
async function initializeLocationSearch(db:D1Database){
  const rows=(await db.prepare("SELECT id,location FROM listings WHERE location_search='' LIMIT 100").all<{id:string;location:string}>()).results;
  if(rows.length)await db.batch(rows.map(row=>db.prepare("UPDATE listings SET location_search=? WHERE id=? AND location=? AND location_search=''").bind(row.location.normalize('NFC').toLowerCase(),row.id,row.location)));
  return !await db.prepare("SELECT 1 FROM listings WHERE location_search='' LIMIT 1").first();
}

app.get('/public/listings',async c=>{
  const q=c.req.query(),location=q.location??'',pageRaw=q.page??'1',pageSizeRaw=q.pageSize??'20';
  if(location.length>240)return c.json({message:'location must not exceed 240 characters'},400);
  let page:number,pageSize:number,minPrice:number|undefined,maxPrice:number|undefined,maxOccupants:number|undefined;
  try{page=publicInteger(pageRaw,1,10_000,'page')!;pageSize=publicInteger(pageSizeRaw,1,50,'pageSize')!;minPrice=publicInteger(q.minPriceAmount??null,0,2_147_483_647,'minPriceAmount');maxPrice=publicInteger(q.maxPriceAmount??null,0,2_147_483_647,'maxPriceAmount');maxOccupants=publicInteger(q.maxOccupants??null,1,2_147_483_647,'maxOccupants');}catch(error){return c.json({message:error instanceof Error?error.message:'invalid query'},400);}
  if(minPrice!==undefined&&maxPrice!==undefined&&minPrice>maxPrice)return c.json({message:'minPriceAmount cannot exceed maxPriceAmount'},400);
  for(const key of ['currency','pricePeriod','rentalDuration'] as const){const value=q[key];if(value&&!(PUBLIC_ENUMS[key] as readonly string[]).includes(value))return c.json({message:`${key} is invalid`},400);}
  const availableOnly=q.availableOnly??'false';if(!['true','false'].includes(availableOnly))return c.json({message:'availableOnly must be true or false'},400);
  const clauses=["status='APPROVED'","publication_status='PUBLISHED'"],values:(string|number)[]=[];
  if(location&&!await initializeLocationSearch(c.env.DB))return c.json({message:'Location index initialization in progress; retry shortly'},503);
  if(location){clauses.push("COALESCE(NULLIF(location_search,''),LOWER(location)) LIKE ? ESCAPE '\\'");values.push('%'+location.normalize('NFC').toLowerCase().replace(/[\\%_]/g,'\\$&')+'%');}
  if(minPrice!==undefined){clauses.push('price_amount>=?');values.push(minPrice);}
  if(maxPrice!==undefined){clauses.push('price_amount<=?');values.push(maxPrice);}
  if(maxOccupants!==undefined){clauses.push('max_occupants>=?');values.push(maxOccupants);}
  if(q.currency){clauses.push('currency=?');values.push(q.currency);}
  if(q.pricePeriod){clauses.push('price_period=?');values.push(q.pricePeriod);}
  if(q.rentalDuration){clauses.push('rental_duration=?');values.push(q.rentalDuration);}
  if(availableOnly==='true')clauses.push("availability_status='AVAILABLE'");
  const where=clauses.join(' AND '),offset=(page-1)*pageSize;
  const [count,listed]=await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS totalItems FROM listings WHERE ${where}`).bind(...values).first<any>(),
    c.env.DB.prepare(`SELECT id,title,description,location,price_amount AS priceAmount,price_period AS pricePeriod,rental_duration AS rentalDuration,max_occupants AS maxOccupants,currency,availability_status AS availabilityStatus,last_confirmed_at AS lastConfirmedAt FROM listings WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).bind(...values,pageSize,offset).all<any>(),
  ]);
  const rows=listed.results,totalItems=Number(count?.totalItems??0),imageRows=await publicImages(c.env.DB,rows.map((row:any)=>row.id),c.env.MEDIA_STRATEGY==='STATIC_ASSETS',d1ImageStatus(c));
  const byListing=new Map<string,any[]>();for(const image of imageRows){const images=byListing.get(image.listingId)??[];images.push({id:image.id,contentType:image.contentType,sizeBytes:image.sizeBytes,position:image.position,...(image.url?{url:image.url}:{})});byListing.set(image.listingId,images);}
  return c.json({items:rows.map((row:any)=>publicListingDto(row,byListing.get(row.id)??[])),page,pageSize,totalItems,totalPages:Math.ceil(totalItems/pageSize)});
});
app.get('/public/listings/:id/images/:imageId',async c=>{
  if(c.env.MEDIA_STRATEGY==='STATIC_ASSETS'){const row=await c.env.DB.prepare("SELECT i.asset_path AS url FROM static_listing_images i JOIN listings l ON l.id=i.listing_id WHERE i.listing_id=? AND i.id=? AND l.status='APPROVED' AND l.publication_status='PUBLISHED'").bind(c.req.param('id'),c.req.param('imageId')).first<{url:string}>();return row?c.redirect(row.url,302):c.json({message:'Image not found'},404);}
  if(d1ImageStatus(c)){
    const lid=c.req.param('id'),imageId=c.req.param('imageId');
    const staticRow=await c.env.DB.prepare("SELECT i.asset_path AS url FROM static_listing_images i JOIN listings l ON l.id=i.listing_id WHERE i.listing_id=? AND i.id=? AND l.status='APPROVED' AND l.publication_status='PUBLISHED'").bind(lid,imageId).first<{url:string}>();
    if(staticRow)return c.redirect(staticRow.url,302);
    const row=await c.env.DB.prepare("SELECT i.blob_data AS blobData,i.mime_type AS contentType,i.byte_size AS sizeBytes FROM listing_images i JOIN listings l ON l.id=i.listing_id WHERE i.listing_id=? AND i.id=? AND i.blob_data IS NOT NULL AND l.status='APPROVED' AND l.publication_status='PUBLISHED'").bind(lid,imageId).first<any>();
    if(!row)return c.json({message:'Image not found'},404);const bytes=d1BlobBytes(row.blobData);if(!bytes||bytes.byteLength!==row.sizeBytes)return c.json({message:'Image data unavailable'},503);return imageResponse(bytes,row.contentType,false);
  }
  const row=await c.env.DB.prepare("SELECT i.object_key AS objectKey,i.mime_type AS contentType,i.byte_size AS sizeBytes FROM listing_images i JOIN listings l ON l.id=i.listing_id WHERE i.listing_id=? AND i.id=? AND l.status='APPROVED' AND l.publication_status='PUBLISHED'").bind(c.req.param('id'),c.req.param('imageId')).first<any>();
  if(!row)return c.json({message:'Image not found'},404);const object=await c.env.IMAGES.get(row.objectKey);if(!object)return c.json({message:'Image not found'},404);
  return new Response(object.body,{headers:{'Content-Type':row.contentType,'Content-Length':String(row.sizeBytes),'Cache-Control':'no-store, no-cache','X-Content-Type-Options':'nosniff'}});
});
app.get('/public/listings/:id',async c=>{
  const row=await c.env.DB.prepare("SELECT id,title,description,location,price_amount AS priceAmount,price_period AS pricePeriod,rental_duration AS rentalDuration,max_occupants AS maxOccupants,currency,availability_status AS availabilityStatus,last_confirmed_at AS lastConfirmedAt FROM listings WHERE id=? AND status='APPROVED' AND publication_status='PUBLISHED'").bind(c.req.param('id')).first<any>();
  if(!row)return c.json({message:'Listing not found'},404);const images=await publicImages(c.env.DB,[row.id],c.env.MEDIA_STRATEGY==='STATIC_ASSETS',d1ImageStatus(c));return c.json(publicListingDto(row,images));
});
app.patch('/listings/:id/images/:imageId',async c=>{
  const lid=c.req.param('id'),imageId=c.req.param('imageId');if(d1ImageStatus(c))return reorderD1Image(c,lid,imageId);const owner=ownerId(c),supplied=requestKey(c);
  if(supplied===false)return c.json({error:'invalid idempotency key'},400);
  if(!await owned(c,lid))return c.json({error:'not found'},404);
  const x=await c.req.json().catch(()=>null) as any,position=x?.position;
  if(!Number.isInteger(position)||position<0)return c.json({error:'invalid position'},400);
  const scope=`IMAGE_REORDER:${lid}:${imageId}`,requestFingerprint=await fingerprint({method:'PATCH',lid,imageId,position});
  const lk=await lock(c.env.DB,lid);if(!lk)return c.json({error:'retryable conflict'},409);
  try{
    if(!await owned(c,lid))return c.json({error:'not found'},404);
    let record:any=null,operation:any=null;
    if(supplied){
      try{
        record=await c.env.DB.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,supplied).first<any>();
        operation=await c.env.DB.prepare('SELECT listing_id,request_fingerprint,state,result_json,retryable FROM image_reorder_operations WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,supplied).first<any>();
      }catch{return c.json({error:'reorder outcome unavailable; retry with the same idempotency key'},503);}
      if(record&&record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reused with different request'},409);
      if(operation&&operation.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency operation fingerprint conflict'},409);
      if(operation?.retryable===0){if(operation.state==='NEEDS_REPAIR'&&!await repairRetiredReorderIdempotency(c.env.DB,{...operation,owner_id:owner,scope,request_key:supplied}))return c.json({error:'retired reorder acknowledgment requires recovery; retry with the same idempotency key'},503);return c.json({error:'prior reorder plan was abandoned; retry with a new idempotency key'},409);}
      if(record?.state==='COMMITTED'||operation?.state==='COMMITTED'){
        const resultJson=record?.result_json??operation?.result_json;
        let replay:any;try{if(typeof resultJson!=='string')throw new Error('missing stored result');replay=JSON.parse(resultJson);if(!Array.isArray(replay))throw new Error('invalid stored result');}catch{return c.json({error:'reorder replay requires recovery'},503);}
        if(record?.state==='COMMITTED'&&!await repairReorderOperationFromCommittedRecord(c.env.DB,owner,scope,supplied,requestFingerprint,resultJson))return c.json({error:'reorder operation ledger requires recovery; retry with the same idempotency key'},503);
        if(!await confirmReorderIdempotency(c.env.DB,owner,scope,supplied,requestFingerprint,resultJson))return c.json({error:'reorder acknowledgment requires recovery; retry with the same idempotency key'},503);
        return c.json(replay,200);
      }
    }
    if(await hasPendingDeleteRecovery(c.env.DB,lid,owner))return c.json({error:'another image delete requires recovery; retry after its original request'},503);
    if(await hasPendingReorder(c.env.DB,owner,lid,scope,supplied||undefined,requestFingerprint))return c.json({error:'another image reorder requires recovery; retry after its original request'},503);
    let items=await ordered(c.env.DB,lid);
    let expected:string[],body:any[],resultJson:string;
    if(supplied&&(operation?.state==='PENDING'||record?.state==='PENDING'||operation?.state==='NEEDS_REPAIR'||record?.state==='NEEDS_REPAIR')){
      const reservedJson=operation?.result_json??record?.result_json;
      try{body=JSON.parse(reservedJson);if(!Array.isArray(body)||body.some((row:any,i:number)=>typeof row?.id!=='string'||row.position!==i))throw Error('invalid reserved reorder plan');expected=body.map((row:any)=>row.id);if(new Set(expected).size!==body.length||body.length!==items.length||items.some(row=>!expected.includes(row.id))||!expected.includes(imageId)){const terminalAt=now(),terminalStatements:D1PreparedStatement[]=[];if(operation)terminalStatements.push(c.env.DB.prepare("UPDATE image_reorder_operations SET state='NEEDS_REPAIR',retryable=0,updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND state IN ('PENDING','NEEDS_REPAIR') AND retryable=1").bind(terminalAt,owner,scope,supplied));else terminalStatements.push(c.env.DB.prepare("INSERT INTO image_reorder_operations(owner_id,listing_id,scope,request_key,request_fingerprint,result_json,state,retryable,created_at,updated_at) VALUES(?,?,?,?,?,?,'NEEDS_REPAIR',0,?,?)").bind(owner,lid,scope,supplied,requestFingerprint,reservedJson,terminalAt,terminalAt));if(record)terminalStatements.push(c.env.DB.prepare("UPDATE idempotency_records SET state='NEEDS_REPAIR',updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND state IN ('PENDING','NEEDS_REPAIR')").bind(terminalAt,owner,scope,supplied));else terminalStatements.push(c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,result_json,created_at,updated_at) VALUES(?,?,?,?,?,'NEEDS_REPAIR',?,?,?)").bind(owner,scope,supplied,requestFingerprint,imageId,reservedJson,terminalAt,terminalAt));try{await c.env.DB.batch(terminalStatements);}catch{}const [terminalOperation,terminalRecord]=await Promise.all([c.env.DB.prepare('SELECT state,retryable,request_fingerprint,result_json FROM image_reorder_operations WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,supplied).first<any>(),c.env.DB.prepare('SELECT state,request_fingerprint,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,supplied).first<any>()]);if(terminalOperation?.state!=='NEEDS_REPAIR'||terminalOperation.retryable!==0||terminalOperation.request_fingerprint!==requestFingerprint||terminalOperation.result_json!==reservedJson||terminalRecord?.state!=='NEEDS_REPAIR'||terminalRecord.request_fingerprint!==requestFingerprint||terminalRecord.result_json!==reservedJson)return c.json({error:'reserved reorder plan could not be retired; retry with the same key'},503);return c.json({error:'reserved reorder plan cannot be recovered after the image set changed'},503);}}
      catch{return c.json({error:'pending reorder plan requires recovery; retry with the same idempotency key'},503);}
      resultJson=reservedJson;
      items=expected.map(id=>items.find(row=>row.id===id)!);
    }else{
      const idx=items.findIndex(i=>i.id===imageId);if(idx<0)return c.json({error:'not found'},404);if(position>=items.length)return c.json({error:'invalid position'},400);
      const [moved]=items.splice(idx,1);items.splice(position,0,moved);expected=items.map(item=>item.id);body=items.map((item,i)=>imageDto({...item,position:i}));resultJson=JSON.stringify(body);
    }
    if(supplied){
      if(['PENDING','NEEDS_REPAIR'].includes(operation?.state)&&operation.result_json!==resultJson)return c.json({error:'reorder reservation differs from the original plan'},503);
      if(['PENDING','NEEDS_REPAIR'].includes(record?.state)&&record.result_json!==resultJson)return c.json({error:'reorder reservation differs from the original plan'},503);
      const createdRecord=!record,createdOperation=!operation,reservations:D1PreparedStatement[]=[];if(createdRecord)reservations.push(c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,result_json,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?,?)").bind(owner,scope,supplied,requestFingerprint,imageId,resultJson,now(),now()));if(createdOperation)reservations.push(c.env.DB.prepare("INSERT INTO image_reorder_operations(owner_id,listing_id,scope,request_key,request_fingerprint,result_json,state,created_at,updated_at) VALUES(?,?,?,?,?,?,'PENDING',?,?)").bind(owner,lid,scope,supplied,requestFingerprint,resultJson,now(),now()));if(reservations.length){try{await c.env.DB.batch(reservations);}catch{}try{[record,operation]=await Promise.all([c.env.DB.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,supplied).first<any>(),c.env.DB.prepare('SELECT request_fingerprint,state,result_json,retryable FROM image_reorder_operations WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,supplied).first<any>()]);}catch{return c.json({error:'reorder reservation outcome unknown; retry with the same idempotency key'},503);}const recordOk=record?.request_fingerprint===requestFingerprint&&['PENDING','NEEDS_REPAIR'].includes(record.state)&&record.result_json===resultJson,operationOk=operation?.request_fingerprint===requestFingerprint&&['PENDING','NEEDS_REPAIR'].includes(operation.state)&&operation.retryable===1&&operation.result_json===resultJson;if(!recordOk||!operationOk){const cleanup:D1PreparedStatement[]=[];if(createdRecord)cleanup.push(c.env.DB.prepare("DELETE FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? AND result_json=? AND state='PENDING'").bind(owner,scope,supplied,requestFingerprint,resultJson));if(createdOperation)cleanup.push(c.env.DB.prepare("DELETE FROM image_reorder_operations WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? AND result_json=? AND state='PENDING' AND retryable=1").bind(owner,scope,supplied,requestFingerprint,resultJson));if(cleanup.length)await c.env.DB.batch(cleanup).catch(()=>{});return c.json({error:'both reorder reservations were not confirmed; retry with the same idempotency key'},503);}}
    }
    if(await orderIs(c.env.DB,lid,expected)){
      if(supplied&&!await confirmReorderOperation(c.env.DB,owner,scope,supplied,requestFingerprint,resultJson,lid,lk,expected))return c.json({error:'reorder outcome requires recovery; retry with the same idempotency key'},503);
      if(supplied&&!await confirmReorderIdempotency(c.env.DB,owner,scope,supplied,requestFingerprint,resultJson))return c.json({error:'reorder acknowledgment requires recovery; retry with the same idempotency key'},503);
      return c.json(body,200);
    }
    const stagingBase=Math.max(0,...items.map(item=>item.position))+items.length+1,stmts:D1PreparedStatement[]=[];for(let i=0;i<items.length;i++)stmts.push(c.env.DB.prepare("UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch()) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(stagingBase+i,now(),items[i].id,lid,lid,lk,lid,owner));for(let i=0;i<items.length;i++)stmts.push(c.env.DB.prepare("UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch()) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(i,now(),items[i].id,lid,lid,lk,lid,owner));if(supplied){const guard=reorderCommitGuard(lid,lk,expected);stmts.push(c.env.DB.prepare(`UPDATE image_reorder_operations SET state='COMMITTED',result_json=?,updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? AND result_json=? AND state IN ('PENDING','NEEDS_REPAIR') AND retryable=1 ${guard.sql}`).bind(resultJson,now(),owner,scope,supplied,requestFingerprint,resultJson,...guard.values));stmts.push(c.env.DB.prepare(`UPDATE idempotency_records SET state='COMMITTED',result_json=?,updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? AND result_json=? AND state IN ('PENDING','NEEDS_REPAIR') AND EXISTS (SELECT 1 FROM image_reorder_operations o WHERE o.owner_id=? AND o.scope=? AND o.request_key=? AND o.request_fingerprint=? AND o.result_json=? AND o.retryable=1) ${guard.sql}`).bind(resultJson,now(),owner,scope,supplied,requestFingerprint,resultJson,owner,scope,supplied,requestFingerprint,resultJson,...guard.values));}
    let result:D1Result[]|null=null;try{result=await c.env.DB.batch(stmts);}catch{}
    const orderConfirmed=await orderIs(c.env.DB,lid,expected);
    if(orderConfirmed){
      if(supplied&&!await confirmReorderOperation(c.env.DB,owner,scope,supplied,requestFingerprint,resultJson,lid,lk,expected))return c.json({error:'reorder outcome requires recovery; retry with the same idempotency key'},503);
      if(supplied&&!await confirmReorderIdempotency(c.env.DB,owner,scope,supplied,requestFingerprint,resultJson))return c.json({error:'reorder acknowledgment requires recovery; retry with the same idempotency key'},503);
      if(!supplied&&result&&result.length===stmts.length&&result.every(row=>row?.meta?.changes===1))return c.json(body,200);
      if(!supplied)return c.json(body,200);
      return c.json(body,200);
    }
    return c.json({error:'reorder outcome unknown; retry with the same idempotency key'},503);
  }finally{await unlock(c.env.DB,lid,lk);}
});
app.delete('/listings/:id/images/:imageId', async c => {
  const lid=c.req.param('id'),imageId=c.req.param('imageId');if(d1ImageStatus(c))return deleteD1Image(c,lid,imageId);const owner=ownerId(c),supplied=requestKey(c);
  if(supplied===false)return c.json({error:'invalid idempotency key'},400);
  const scope=`IMAGE_DELETE:${lid}:${imageId}`,requestFingerprint=await fingerprint({method:'DELETE',lid,imageId});
  if(!await owned(c,lid))return c.json({error:'not found'},404);
  const lease=await lock(c.env.DB,lid);if(!lease)return c.json({error:'retryable conflict'},409);
  try{
    if(!await owned(c,lid))return c.json({error:'not found'},404);
    let record:any=null;
    if(supplied){try{record=await c.env.DB.prepare('SELECT request_fingerprint,state FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,supplied).first<any>();}catch{return c.json({error:'delete outcome unavailable; retry with the same idempotency key'},503);}if(record&&record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reused with different request'},409);}
    if(await hasPendingDeleteRecovery(c.env.DB,lid,owner,record&&supplied?scope:undefined,record&&supplied?supplied:undefined,record&&supplied?requestFingerprint:undefined))return c.json({error:'another image delete requires recovery; retry after its original request'},503);
    let items=await ordered(c.env.DB,lid);const target=items.find(x=>x.id===imageId);
    if(!target){
      if(!record)return c.json({error:'not found'},404);
      let prior:any=null;try{prior=await c.env.DB.prepare("SELECT id,backup_key,state,object_key FROM image_operations WHERE listing_id=? AND image_id=? AND kind='DELETE' ORDER BY created_at DESC LIMIT 1").bind(lid,imageId).first<any>();}catch{return c.json({error:'delete operation outcome unavailable'},503);}
      if(!prior)return c.json({error:'delete intent is not durably recorded'},503);
      if(record.state==='COMMITTED'&&['COMMITTED','CLEANUP_PENDING','CLEANED'].includes(prior.state))return c.body(null,200);
      if(await hasPendingReorder(c.env.DB,owner,lid))return c.json({error:'another image reorder requires recovery; retry after its original request'},503);
      let dense=await orderIs(c.env.DB,lid,items.map(x=>x.id));
      if(!dense){try{dense=items.length===0||await writeDenseOrder(c.env.DB,lid,owner,lease,items)&&await orderIs(c.env.DB,lid,items.map(x=>x.id));}catch{dense=false;}}
      if(!dense){await bestEffortOperationState(c.env.DB,prior.id,'NEEDS_REPAIR');if(supplied)await c.env.DB.prepare("UPDATE idempotency_records SET state='NEEDS_REPAIR',updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=?").bind(now(),owner,scope,supplied,requestFingerprint).run().catch(()=>{});return c.json({error:'delete ordering requires recovery; retry with the same idempotency key'},503);}
      let originalPresent:boolean;
      try{originalPresent=!!await c.env.IMAGES.head(prior.object_key);if(originalPresent){await c.env.IMAGES.delete(prior.object_key);originalPresent=!!await c.env.IMAGES.head(prior.object_key);}}
      catch{await bestEffortOperationState(c.env.DB,prior.id,'NEEDS_REPAIR');await c.env.DB.prepare("UPDATE idempotency_records SET state='NEEDS_REPAIR',updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=?").bind(now(),owner,scope,supplied,requestFingerprint).run().catch(()=>{});return c.json({error:'delete storage outcome requires recovery; retry with the same idempotency key'},503);}
      if(originalPresent)await bestEffortOperationState(c.env.DB,prior.id,'NEEDS_REPAIR');
      else if(prior.state!=='CLEANED')await bestEffortOperationState(c.env.DB,prior.id,'COMMITTED');
      if(originalPresent){await c.env.DB.prepare("UPDATE idempotency_records SET state='NEEDS_REPAIR',updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=?").bind(now(),owner,scope,supplied,requestFingerprint).run().catch(()=>{});return c.json({error:'delete storage cleanup requires recovery; retry with the same idempotency key'},503);}
      if(prior&&prior.state!=='CLEANED'){
        await bestEffortOperationState(c.env.DB,prior.id,'COMMITTED');
        if(prior.backup_key)await cleanupDeleteBackup(c.env.DB,c.env.IMAGES,prior.id,prior.backup_key,'CLEANED');else await bestEffortOperationState(c.env.DB,prior.id,'CLEANED');
      }
      if(supplied&&!await confirmIdempotencyCommit(c.env.DB,owner,scope,supplied,requestFingerprint))return c.json({error:'delete acknowledgment requires recovery; retry with the same idempotency key'},503);
      return c.body(null,200);
    }
    if(await hasPendingReorder(c.env.DB,owner,lid))return c.json({error:'another image reorder requires recovery; retry after its original request'},503);
    let original=await c.env.IMAGES.get(target.object_key);
    if(!original){let repair:any=null;try{repair=await c.env.DB.prepare("SELECT id,backup_key,state FROM image_operations WHERE listing_id=? AND image_id=? AND kind='DELETE' ORDER BY created_at DESC LIMIT 1").bind(lid,imageId).first<any>();}catch{return c.json({error:'delete recovery outcome unavailable'},503);}if(repair?.backup_key){try{const saved=await c.env.IMAGES.get(repair.backup_key);if(saved){await c.env.IMAGES.put(target.object_key,await saved.arrayBuffer(),{httpMetadata:{contentType:target.mime_type}});original=await c.env.IMAGES.get(target.object_key);}}catch{return c.json({error:'image restore requires scheduled recovery'},503);}}if(!original){await bestEffortOperationState(c.env.DB,repair?.id??'', 'NEEDS_REPAIR');return c.json({error:'image object missing; recovery required'},503);}}
    if(supplied&&!record){try{await c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?)").bind(owner,scope,supplied,requestFingerprint,imageId,now(),now()).run();}catch{try{record=await c.env.DB.prepare('SELECT request_fingerprint,state FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(owner,scope,supplied).first<any>();}catch{return c.json({error:'delete reservation outcome unknown; retry with the same idempotency key'},503);}if(!record||record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reservation conflict'},409);}}
    let priorOp:any=null;try{priorOp=await c.env.DB.prepare("SELECT id,backup_key,state,cleanup_complete,result_json FROM image_operations WHERE listing_id=? AND image_id=? AND kind='DELETE' ORDER BY created_at DESC LIMIT 1").bind(lid,imageId).first<any>();}catch{return c.json({error:'delete operation outcome unavailable'},503);}
    if(record?.state==='COMMITTED'){if(priorOp?.state==='COMPENSATED'&&priorOp.cleanup_complete===1&&await resetCompensatedIdempotency(c.env.DB,owner,scope,supplied,requestFingerprint,lid,imageId,lease,true))record.state='PENDING';else return c.json({error:'delete ledger conflicts with existing image'},503);}
    if(priorOp&&['COMMITTED','CLEANUP_PENDING','CLEANED'].includes(priorOp.state))return c.json({error:'delete ledger conflicts with existing image'},503);
    if(priorOp&&['PENDING','NEEDS_REPAIR'].includes(priorOp.state)&&priorOp.result_json){let savedPlan:string[];try{savedPlan=JSON.parse(priorOp.result_json);if(!Array.isArray(savedPlan)||savedPlan.length!==items.length||!savedPlan.includes(imageId)||new Set(savedPlan).size!==savedPlan.length||!items.every(x=>savedPlan.includes(x.id)))throw Error('invalid DELETE plan');}catch{return c.json({error:'delete operation plan requires recovery'},503);}items=savedPlan.map(id=>items.find(x=>x.id===id)!);}
    const deletePlan=JSON.stringify(items.map(x=>x.id)),op=priorOp?.id??id(),backup=priorOp?.backup_key??`compensation/${op}`;
    try{if(priorOp)await c.env.DB.prepare("UPDATE image_operations SET state='PENDING',result_json=?,updated_at=? WHERE id=? AND state IN ('PENDING','NEEDS_REPAIR','COMPENSATED')").bind(deletePlan,now(),op).run();else await c.env.DB.prepare("INSERT INTO image_operations(id,listing_id,kind,state,object_key,backup_key,image_id,result_json,created_at,updated_at) VALUES(?,?,'DELETE','PENDING',?,?,?,?,?,?)").bind(op,lid,target.object_key,backup,imageId,deletePlan,now(),now()).run();const reserved=await c.env.DB.prepare('SELECT state,result_json FROM image_operations WHERE id=?').bind(op).first<any>();if(reserved?.state!=='PENDING'||reserved.result_json!==deletePlan)return c.json({error:'delete operation plan requires recovery'},503);}catch{return c.json({error:'delete operation reservation requires recovery'},503);}
    if(!await orderIs(c.env.DB,lid,items.map(x=>x.id))&&(!await writeDenseOrder(c.env.DB,lid,owner,lease,items)||!await orderIs(c.env.DB,lid,items.map(x=>x.id)))){await bestEffortOperationState(c.env.DB,op,'NEEDS_REPAIR');if(supplied)await c.env.DB.prepare("UPDATE idempotency_records SET state='NEEDS_REPAIR',updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=?").bind(now(),owner,scope,supplied,requestFingerprint).run().catch(()=>{});return c.json({error:'delete ordering requires recovery; retry with the same idempotency key'},503);}
    try{await c.env.IMAGES.put(backup,await original.arrayBuffer(),{httpMetadata:{contentType:target.mime_type}});}catch{let backupPresent=false,originalPresent=false;try{backupPresent=!!await c.env.IMAGES.head(backup);originalPresent=!!await c.env.IMAGES.head(target.object_key);}catch{}await bestEffortOperationState(c.env.DB,op,backupPresent?'NEEDS_REPAIR':originalPresent?'COMPENSATED':'NEEDS_REPAIR');return c.json({error:'image backup failed; retry with the same idempotency key'},503);}
    try{await c.env.IMAGES.delete(target.object_key);}catch{let originalPresent=false,backupPresent=false;try{originalPresent=!!await c.env.IMAGES.head(target.object_key);backupPresent=!!await c.env.IMAGES.head(backup);}catch{}if(!originalPresent&&backupPresent){try{const saved=await c.env.IMAGES.get(backup);if(!saved)throw Error('backup missing');await c.env.IMAGES.put(target.object_key,await saved.arrayBuffer(),{httpMetadata:{contentType:target.mime_type}});originalPresent=!!await c.env.IMAGES.head(target.object_key);}catch{originalPresent=false;}}if(originalPresent){await cleanupDeleteBackup(c.env.DB,c.env.IMAGES,op,backup,'COMPENSATED');if(supplied&&!await resetCompensatedIdempotency(c.env.DB,owner,scope,supplied,requestFingerprint,lid,imageId,lease,true))return c.json({error:'delete compensation requires recovery; retry with the same idempotency key'},503);return c.json({error:'image delete was compensated; retry with the same idempotency key'},503);}await bestEffortOperationState(c.env.DB,op,'NEEDS_REPAIR');return c.json({error:'image delete outcome requires recovery'},503);}
    let deleteConfirmed=false;try{deleteConfirmed=!(await c.env.IMAGES.head(target.object_key));}catch{await bestEffortOperationState(c.env.DB,op,'NEEDS_REPAIR');return c.json({error:'image delete outcome requires storage verification; retry with the same idempotency key'},503);}if(!deleteConfirmed){await cleanupDeleteBackup(c.env.DB,c.env.IMAGES,op,backup,'COMPENSATED');if(supplied&&!await resetCompensatedIdempotency(c.env.DB,owner,scope,supplied,requestFingerprint,lid,imageId,lease,true))return c.json({error:'delete compensation requires recovery; retry with the same idempotency key'},503);return c.json({error:'image storage did not confirm deletion; retry with the same idempotency key'},503);}
    const rest=items.filter(x=>x.id!==target.id),fence=Math.floor(Date.now()/1000),stmts:D1PreparedStatement[]=[c.env.DB.prepare("DELETE FROM listing_images WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(target.id,lid,lid,lease,fence,lid,owner)];
    for(let i=0;i<rest.length;i++)stmts.push(c.env.DB.prepare("UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(1000000+i,now(),rest[i].id,lid,lid,lease,fence,lid,owner));
    for(let i=0;i<rest.length;i++)stmts.push(c.env.DB.prepare("UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(i,now(),rest[i].id,lid,lid,lease,fence,lid,owner));
    const confirmedDeleteGuard="AND NOT EXISTS (SELECT 1 FROM listing_images WHERE id=? AND listing_id=?) AND NOT EXISTS (SELECT 1 FROM listing_images WHERE listing_id=? AND (position<0 OR position >= (SELECT COUNT(*) FROM listing_images WHERE listing_id=?)))";
    stmts.push(c.env.DB.prepare(`UPDATE image_operations SET state='COMMITTED',updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) ${confirmedDeleteGuard}`).bind(now(),op,lid,lease,fence,target.id,lid,lid,lid));
    if(supplied)stmts.push(c.env.DB.prepare(`UPDATE idempotency_records SET state='COMMITTED',updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? ${confirmedDeleteGuard}`).bind(now(),owner,scope,supplied,requestFingerprint,target.id,lid,lid,lid));
    try{await c.env.DB.batch(stmts);}catch{}
    const commitExpected=rest.map(x=>x.id);
    let committed=false;let targetRow:unknown;try{targetRow=await c.env.DB.prepare('SELECT id FROM listing_images WHERE id=? AND listing_id=?').bind(target.id,lid).first();}catch{return c.json({error:'delete outcome unknown; retry with the same idempotency key'},503);}if(!targetRow){if(!await orderIs(c.env.DB,lid,commitExpected)){try{const current=await ordered(c.env.DB,lid);if(current.length===rest.length&&current.every(x=>commitExpected.includes(x.id))){await writeDenseOrder(c.env.DB,lid,owner,lease,rest);}}catch{}}committed=await orderIs(c.env.DB,lid,commitExpected);}
    if(!committed){let targetStillExists=false;try{targetStillExists=!!await c.env.DB.prepare('SELECT id FROM listing_images WHERE id=? AND listing_id=?').bind(target.id,lid).first();}catch{return c.json({error:'delete outcome requires recovery'},503);}if(!targetStillExists){await bestEffortOperationState(c.env.DB,op,'NEEDS_REPAIR');if(supplied)await c.env.DB.prepare("UPDATE idempotency_records SET state='NEEDS_REPAIR',updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=?").bind(now(),owner,scope,supplied,requestFingerprint).run().catch(()=>{});return c.json({error:'delete ordering requires recovery; retry with the same idempotency key'},503);}let targetPresent=false;try{targetPresent=!!await c.env.IMAGES.head(target.object_key);}catch{}if(!targetPresent){try{const saved=await c.env.IMAGES.get(backup);if(!saved)throw Error('backup missing');await c.env.IMAGES.put(target.object_key,await saved.arrayBuffer(),{httpMetadata:{contentType:target.mime_type}});targetPresent=!!await c.env.IMAGES.head(target.object_key);}catch{targetPresent=false;}}if(targetPresent){let restoredOrder=await orderIs(c.env.DB,lid,items.map(x=>x.id));if(!restoredOrder){try{restoredOrder=await writeDenseOrder(c.env.DB,lid,owner,lease,items)&&await orderIs(c.env.DB,lid,items.map(x=>x.id));}catch{restoredOrder=false;}}if(!restoredOrder){await bestEffortOperationState(c.env.DB,op,'NEEDS_REPAIR');if(supplied)await c.env.DB.prepare("UPDATE idempotency_records SET state='NEEDS_REPAIR',updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=?").bind(now(),owner,scope,supplied,requestFingerprint).run().catch(()=>{});return c.json({error:'delete compensation ordering requires recovery; retry with the same idempotency key'},503);}await cleanupDeleteBackup(c.env.DB,c.env.IMAGES,op,backup,'COMPENSATED');if(supplied&&!await resetCompensatedIdempotency(c.env.DB,owner,scope,supplied,requestFingerprint,lid,imageId,lease,true))return c.json({error:'delete compensation requires recovery; retry with the same idempotency key'},503);return c.json({error:'metadata delete did not commit; retry with the same idempotency key'},503);}await bestEffortOperationState(c.env.DB,op,'NEEDS_REPAIR');return c.json({error:'delete consistency requires recovery'},503);}
    // D1 row absence plus exact dense order confirms the logical delete. Backup cleanup is recoverable and cannot overturn HTTP success.
    await bestEffortOperationState(c.env.DB,op,'COMMITTED');
    if(supplied&&!await confirmIdempotencyCommit(c.env.DB,owner,scope,supplied,requestFingerprint))return c.json({error:'delete acknowledgment requires recovery; retry with the same idempotency key'},503);
    await cleanupDeleteBackup(c.env.DB,c.env.IMAGES,op,backup,'CLEANED');
    return c.body(null,200);
  }finally{await unlock(c.env.DB,lid,lease);}
});
app.notFound(c=>c.json({error:'not found'},404));
app.onError((e,c)=>{const correlationId=crypto.randomUUID();console.error(JSON.stringify({event:'request_error',correlationId}));return c.json({error:'internal error',correlationId},500);});
async function reconcile(env:Env) {
  const pending=(await env.DB.prepare("SELECT * FROM image_operations o WHERE (state IN ('PENDING','NEEDS_REPAIR','CLEANUP_PENDING') OR (kind='DELETE' AND state='COMMITTED') OR (kind='DELETE' AND state='COMPENSATED' AND cleanup_complete=0)) AND NOT EXISTS (SELECT 1 FROM listing_locks l WHERE l.listing_id=o.listing_id AND l.expires_at>unixepoch()) ORDER BY updated_at LIMIT 100").all<any>()).results;
  for(const op of pending){
    const lease=await lock(env.DB,op.listing_id); if(!lease) continue;
    try {
      await env.DB.prepare('UPDATE image_operations SET updated_at=? WHERE id=?').bind(now(),op.id).run();
      const row=await env.DB.prepare('SELECT id,listing_id FROM listing_images WHERE object_key=?').bind(op.object_key).first<{id:string;listing_id:string}>();
      if(op.kind==='ADD'){
        if(row){let expectedImageId=op.image_id;if(!expectedImageId&&typeof op.result_json==='string'){try{const saved=JSON.parse(op.result_json);if(typeof saved?.id==='string')expectedImageId=saved.id;}catch{}}if(row.listing_id!==op.listing_id||!expectedImageId||row.id!==expectedImageId){await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}let present=false;try{present=!!await env.IMAGES.head(op.object_key);}catch{}if(present){const listing=await env.DB.prepare('SELECT owner_id FROM listings WHERE id=?').bind(op.listing_id).first<{owner_id:string}>(),orderOk=listing&&await ensureDenseCurrentOrder(env.DB,op.listing_id,listing.owner_id,lease);await bestEffortOperationState(env.DB,op.id,orderOk?'COMMITTED':'NEEDS_REPAIR');}else await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}
        await compensateAdd(env.DB,env.IMAGES,op.id,op.object_key);
      }else if(op.kind==='DELETE'){
        const listing=await env.DB.prepare('SELECT owner_id FROM listings WHERE id=?').bind(op.listing_id).first<{owner_id:string}>();if(!listing){await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}
        const backup=op.backup_key?await env.IMAGES.get(op.backup_key):null,current=await ordered(env.DB,op.listing_id),currentIds=current.map((x:ImageRow)=>x.id),positions=current.map((x:ImageRow)=>x.position),currentDense=positions.every((position:number,i:number)=>position===i);
        if(!row&&['COMMITTED','CLEANUP_PENDING'].includes(op.state)){
          if(!currentDense){await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}
          await env.IMAGES.delete(op.object_key);if(await env.IMAGES.head(op.object_key)){await bestEffortOperationState(env.DB,op.id,'CLEANUP_PENDING');continue;}
          if(op.backup_key){await env.IMAGES.delete(op.backup_key);if(await env.IMAGES.head(op.backup_key)){await bestEffortOperationState(env.DB,op.id,'CLEANUP_PENDING');continue;}}
          await bestEffortOperationState(env.DB,op.id,'CLEANED');continue;
        }
        if(row&&op.state==='CLEANUP_PENDING'){
          let originalPresent=false;try{originalPresent=!!await env.IMAGES.head(op.object_key);}catch{}
          if(!originalPresent&&backup){try{await env.IMAGES.put(op.object_key,await backup.arrayBuffer(),{httpMetadata:{contentType:backup.httpMetadata?.contentType}});originalPresent=!!await env.IMAGES.head(op.object_key);}catch{}}
          if(!originalPresent){await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}
          if(op.backup_key){await env.IMAGES.delete(op.backup_key);if(await env.IMAGES.head(op.backup_key)){await bestEffortOperationState(env.DB,op.id,'CLEANUP_PENDING');continue;}}
          await bestEffortOperationState(env.DB,op.id,'COMPENSATED');continue;
        }
        let planIds:string[]|null=null;
        if(typeof op.result_json==='string'){try{const parsed=JSON.parse(op.result_json);if(Array.isArray(parsed)&&parsed.every((value:any)=>typeof value==='string')&&new Set(parsed).size===parsed.length&&parsed.includes(op.image_id))planIds=parsed;}catch{}}
        if(row){
          if(!planIds&&currentDense&&currentIds.includes(op.image_id))planIds=currentIds;
          if(!planIds||planIds.length!==currentIds.length||!currentIds.every((imageId:string)=>planIds!.includes(imageId))){await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}
          const planned=planIds.map((imageId:string)=>current.find((item:ImageRow)=>item.id===imageId)!);
          if(!await orderIs(env.DB,op.listing_id,planIds)&&(!await writeDenseOrder(env.DB,op.listing_id,listing.owner_id,lease,planned)||!await orderIs(env.DB,op.listing_id,planIds))){await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}
          let originalPresent=false;try{originalPresent=!!await env.IMAGES.head(op.object_key);}catch{}
          if(!originalPresent){if(!backup){await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}await env.IMAGES.put(op.object_key,await backup.arrayBuffer(),{httpMetadata:{contentType:backup.httpMetadata?.contentType}});originalPresent=!!await env.IMAGES.head(op.object_key);}
          if(!originalPresent){await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}
          if(op.backup_key)await cleanupDeleteBackup(env.DB,env.IMAGES,op.id,op.backup_key,'COMPENSATED');else await bestEffortOperationState(env.DB,op.id,'COMPENSATED');
        }else{
          const survivorIds=planIds?planIds.filter((imageId:string)=>imageId!==op.image_id):currentIds;
          if(survivorIds.length!==currentIds.length||!currentIds.every((imageId:string)=>survivorIds.includes(imageId))){await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}
          const planned=survivorIds.map((imageId:string)=>current.find((item:ImageRow)=>item.id===imageId)!);
          if(!await orderIs(env.DB,op.listing_id,survivorIds)&&(!await writeDenseOrder(env.DB,op.listing_id,listing.owner_id,lease,planned)||!await orderIs(env.DB,op.listing_id,survivorIds))){await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}
          await env.IMAGES.delete(op.object_key);if(await env.IMAGES.head(op.object_key)){await bestEffortOperationState(env.DB,op.id,'NEEDS_REPAIR');continue;}if(op.backup_key){await env.IMAGES.delete(op.backup_key);if(await env.IMAGES.head(op.backup_key)){await bestEffortOperationState(env.DB,op.id,'CLEANUP_PENDING');continue;}}await bestEffortOperationState(env.DB,op.id,'CLEANED');
        }
      }
    } catch(error) {
      console.error(JSON.stringify({event:'image_operation_recovery_deferred',operationId:op.id,kind:op.kind}));
    } finally { await unlock(env.DB,op.listing_id,lease); }
  }
}
async function reconcilePendingReorders(env:Env) {
  const pending=(await env.DB.prepare("SELECT o.* FROM image_reorder_operations o WHERE (o.state IN ('PENDING','NEEDS_REPAIR') AND o.retryable=1 AND unixepoch(o.updated_at)<=unixepoch()-300) OR (o.state='COMMITTED' AND o.retryable=1 AND EXISTS (SELECT 1 FROM idempotency_records r WHERE r.owner_id=o.owner_id AND r.scope=o.scope AND r.request_key=o.request_key AND r.request_fingerprint=o.request_fingerprint AND r.state IN ('PENDING','NEEDS_REPAIR'))) OR (o.state='NEEDS_REPAIR' AND o.retryable=0 AND NOT EXISTS (SELECT 1 FROM idempotency_records r WHERE r.owner_id=o.owner_id AND r.scope=o.scope AND r.request_key=o.request_key AND r.request_fingerprint=o.request_fingerprint AND r.state='NEEDS_REPAIR')) ORDER BY o.updated_at LIMIT 100").all<any>()).results;
  for(const candidate of pending){
    const lid=candidate.listing_id??candidate.scope.slice('IMAGE_REORDER:'.length).split(':')[0];
    if(!lid)continue;
    const lease=await lock(env.DB,lid);if(!lease)continue;
    try{
      const op=await env.DB.prepare('SELECT * FROM image_reorder_operations WHERE owner_id=? AND scope=? AND request_key=?').bind(candidate.owner_id,candidate.scope,candidate.request_key).first<any>();
      if(!op)continue;
      if(op.state==='NEEDS_REPAIR'&&op.retryable===0){if(!await repairRetiredReorderIdempotency(env.DB,op))console.error(JSON.stringify({event:'reorder_retirement_record_deferred'}));continue;}
      if(op.retryable!==1||!['PENDING','NEEDS_REPAIR','COMMITTED'].includes(op.state))continue;
      if(op.state!=='COMMITTED'&&!await ensureReorderIdempotencyReservation(env.DB,op)){console.error(JSON.stringify({event:'reorder_reservation_pair_deferred'}));continue;}
      if(op.state==='COMMITTED'){await confirmReorderIdempotency(env.DB,op.owner_id,op.scope,op.request_key,op.request_fingerprint,op.result_json);continue;}
      const prefix=`IMAGE_REORDER:${lid}:`,imageId=op.scope.startsWith(prefix)?op.scope.slice(prefix.length):'';
      let plan:any[];try{plan=JSON.parse(op.result_json);if(!Array.isArray(plan)||plan.some((row:any,index:number)=>typeof row?.id!=='string'||row.position!==index)||new Set(plan.map(row=>row.id)).size!==plan.length)throw Error('invalid reserved plan');}catch{plan=[];}
      const current=await ordered(env.DB,lid),ids=plan.map(row=>row.id),sameSet=!!imageId&&plan.length===current.length&&ids.includes(imageId)&&current.every(row=>ids.includes(row.id));
      if(!sameSet){const retirementAt=now();try{await env.DB.batch([env.DB.prepare("UPDATE image_reorder_operations SET state='NEEDS_REPAIR',retryable=0,updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND state IN ('PENDING','NEEDS_REPAIR') AND retryable=1").bind(retirementAt,op.owner_id,op.scope,op.request_key),env.DB.prepare("UPDATE idempotency_records SET state='NEEDS_REPAIR',updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? AND state IN ('PENDING','NEEDS_REPAIR')").bind(retirementAt,op.owner_id,op.scope,op.request_key,op.request_fingerprint)]);}catch{}const retired=await env.DB.prepare('SELECT * FROM image_reorder_operations WHERE owner_id=? AND scope=? AND request_key=?').bind(op.owner_id,op.scope,op.request_key).first<any>();if(retired?.state!=='NEEDS_REPAIR'||retired.retryable!==0){console.error(JSON.stringify({event:'reorder_retirement_deferred'}));continue;}if(!await repairRetiredReorderIdempotency(env.DB,retired))console.error(JSON.stringify({event:'reorder_retirement_record_deferred'}));continue;}
      const plannedOrder=ids.map(id=>current.find((row:ImageRow)=>row.id===id)!);
      if(!await orderIs(env.DB,lid,ids)&&!await writeDenseOrder(env.DB,lid,op.owner_id,lease,plannedOrder)){await env.DB.prepare("UPDATE image_reorder_operations SET state='NEEDS_REPAIR',updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND state IN ('PENDING','NEEDS_REPAIR') AND retryable=1").bind(now(),op.owner_id,op.scope,op.request_key).run().catch(()=>{});continue;}
      if(!await orderIs(env.DB,lid,ids))continue;
      if(!await confirmReorderOperation(env.DB,op.owner_id,op.scope,op.request_key,op.request_fingerprint,op.result_json,lid,lease,ids))continue;
      await confirmReorderIdempotency(env.DB,op.owner_id,op.scope,op.request_key,op.request_fingerprint,op.result_json);
    }catch{console.error(JSON.stringify({event:'reorder_recovery_deferred'}));}
    finally{await unlock(env.DB,lid,lease);}
  }
}
const worker = { fetch: (request:Request,env:Env,ctx:ExecutionContext) => { const url=new URL(request.url);if(url.pathname.startsWith('/api/')){url.pathname=url.pathname.slice(4);request=new Request(url,request);}return app.fetch(request,env,ctx); }, scheduled: async (_controller: ScheduledController, env: Env) => { if(env.MEDIA_STRATEGY==='STATIC_ASSETS'||env.MEDIA_STRATEGY==='D1_BLOB')return;await reconcile(env);await reconcilePendingReorders(env); } };
export { app };
export default worker;
