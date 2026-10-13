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
  const user=c.get('user'),key=id(),t=now();
  await c.env.DB.prepare("INSERT INTO listings(id,owner_id,status,title,description,location,price_amount,price_period,rental_duration,max_occupants,currency,created_at,updated_at) VALUES(?,?,'DRAFT',?,?,?,?,?,?,?,?,?,?)").bind(key,user.id,x.title,x.description,x.location,x.priceAmount,x.pricePeriod,x.rentalDuration,x.maxOccupants,x.currency,t,t).run();
  const row=await c.env.DB.prepare('SELECT id,owner_id,status,title,description,location,price_amount,price_period,rental_duration,max_occupants,currency,publication_status,availability_status,last_confirmed_at,rejection_reason,created_at,updated_at FROM listings WHERE id=?').bind(key).first<any>();return c.json({id:row.id,ownerId:row.owner_id,status:row.status,title:row.title,description:row.description,location:row.location,priceAmount:row.price_amount,pricePeriod:row.price_period,rentalDuration:row.rental_duration,maxOccupants:row.max_occupants,currency:row.currency,publicationStatus:row.publication_status,availabilityStatus:row.availability_status,lastConfirmedAt:row.last_confirmed_at,rejectionReason:row.rejection_reason,createdAt:row.created_at,updatedAt:row.updated_at},201);
});
async function owned(c:any,listingId:string) {return c.env.DB.prepare("SELECT id FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED')").bind(listingId,c.get('user').id).first();}
async function lock(db:D1Database,lid:string) { const token=id(),n=Math.floor(Date.now()/1000);const r=await db.prepare('INSERT INTO listing_locks(listing_id,token,expires_at) VALUES(?,?,?) ON CONFLICT(listing_id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE listing_locks.expires_at < ? RETURNING token').bind(lid,token,n+3600,n).first();return r?token:null; }
async function unlock(db:D1Database,lid:string,t:string) {await db.prepare('DELETE FROM listing_locks WHERE listing_id=? AND token=?').bind(lid,t).run();}
async function ownsLock(db:D1Database,lid:string,t:string) { return !!await db.prepare('SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?').bind(lid,t,Math.floor(Date.now()/1000)).first(); }
function imageDto(x:ImageRow){return {id:x.id,originalName:x.original_name,contentType:x.mime_type,sizeBytes:x.byte_size,position:x.position,createdAt:x.created_at};}
async function ordered(db:D1Database,lid:string){return (await db.prepare('SELECT * FROM listing_images WHERE listing_id=? ORDER BY position').bind(lid).all<ImageRow>()).results;}
app.get('/listings/:id/images',async c=>{if(!await owned(c,c.req.param('id')))return c.json({error:'not found'},404);return c.json((await ordered(c.env.DB,c.req.param('id'))).map(imageDto));});
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
  const lease=await lock(c.env.DB,lid); if(!lease) return c.json({error:'retryable conflict'},409);
  const imageId=id(),op=id(),extension=type==='image/jpeg'?'jpg':type==='image/png'?'png':'webp',objectKey=`listings/${lid}/${imageId}.${extension}`,created=now();
  try{
    if(!await owned(c,lid))return c.json({error:'not found'},404);
    const images=await ordered(c.env.DB,lid); if(images.length>=20) return c.json({error:'image limit reached'},409);
    await c.env.DB.prepare("INSERT INTO image_operations(id,listing_id,kind,state,object_key,created_at,updated_at) VALUES(?,?,'ADD','PENDING',?,?,?)").bind(op,lid,objectKey,created,created).run();
    try{await c.env.IMAGES.put(objectKey,bytes,{httpMetadata:{contentType:type,cacheControl:'private, no-store'}});}catch{let present=false;try{present=!!await c.env.IMAGES.head(objectKey);}catch{await c.env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE id=?").bind(now(),op).run();return c.json({error:'image storage outcome requires recovery'},503);}await c.env.DB.prepare("UPDATE image_operations SET state=?,updated_at=? WHERE id=?").bind(present?'NEEDS_REPAIR':'COMPENSATED',now(),op).run();return c.json({error:'image storage failed'},503);}
    const fence=Math.floor(Date.now()/1000);
    let results:D1Result[];
    try{
      results=await c.env.DB.batch([
        c.env.DB.prepare("INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(imageId,lid,objectKey,file.name,type,bytes.length,images.length,created,created,lid,lease,fence,lid,c.get('user').id),
        c.env.DB.prepare("UPDATE image_operations SET state='COMMITTED',updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?)").bind(now(),op,lid,lease,fence)
      ]);
    }catch{
      let exists:unknown;
      try{exists=await c.env.DB.prepare('SELECT id FROM listing_images WHERE id=?').bind(imageId).first();}catch{await c.env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE id=?").bind(now(),op).run();return c.json({error:'metadata outcome requires recovery'},503);}
      if(exists){await c.env.DB.prepare("UPDATE image_operations SET state='COMMITTED',updated_at=? WHERE id=?").bind(now(),op).run();return c.json(imageDto({id:imageId,listing_id:lid,object_key:objectKey,original_name:file.name,mime_type:type,byte_size:bytes.length,position:images.length,created_at:created}),201);}
      await c.env.IMAGES.delete(objectKey);await c.env.DB.prepare("UPDATE image_operations SET state='COMPENSATED',updated_at=? WHERE id=?").bind(now(),op).run();return c.json({error:'metadata commit failed'},503);
    }
    if(results[0]?.meta?.changes!==1){await c.env.IMAGES.delete(objectKey);await c.env.DB.prepare("UPDATE image_operations SET state='COMPENSATED',updated_at=? WHERE id=?").bind(now(),op).run();return c.json({error:'retryable conflict'},409);}
    return c.json(imageDto({id:imageId,listing_id:lid,object_key:objectKey,original_name:file.name,mime_type:type,byte_size:bytes.length,position:images.length,created_at:created}),201);
  }finally{await unlock(c.env.DB,lid,lease);}
});
app.get('/listings/:id/images/:imageId',async c=>{const lid=c.req.param('id');if(!await owned(c,lid))return c.json({error:'not found'},404);const row=await c.env.DB.prepare('SELECT * FROM listing_images WHERE listing_id=? AND id=?').bind(lid,c.req.param('imageId')).first<ImageRow>();if(!row)return c.json({error:'not found'},404);const obj=await c.env.IMAGES.get(row.object_key);if(!obj)return c.json({error:'not found'},404);return new Response(obj.body,{headers:{'Content-Type':row.mime_type,'Content-Length':String(row.byte_size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});});
app.get('/public/listings/:id/images/:imageId',async c=>c.json({error:'not found'},404));
app.patch('/listings/:id/images/:imageId',async c=>{const lid=c.req.param('id');if(!await owned(c,lid))return c.json({error:'not found'},404);const lk=await lock(c.env.DB,lid);if(!lk)return c.json({error:'retryable conflict'},409);try{if(!await owned(c,lid))return c.json({error:'not found'},404);const items=await ordered(c.env.DB,lid),x=await c.req.json().catch(()=>null) as any,idx=items.findIndex(i=>i.id===c.req.param('imageId'));if(idx<0)return c.json({error:'not found'},404);const position=x?.position;if(!Number.isInteger(position)||position<0||position>=items.length)return c.json({error:'invalid position'},400);const [moved]=items.splice(idx,1);items.splice(position,0,moved);const stmts: D1PreparedStatement[]=[];const fence=Math.floor(Date.now()/1000);for(let i=0;i<items.length;i++)stmts.push(c.env.DB.prepare('UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN (\'DRAFT\',\'REJECTED\'))').bind(1000000+i,now(),items[i].id,lid,lid,lk,fence,lid,c.get('user').id));for(let i=0;i<items.length;i++)stmts.push(c.env.DB.prepare('UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN (\'DRAFT\',\'REJECTED\'))').bind(i,now(),items[i].id,lid,lid,lk,fence,lid,c.get('user').id));const results=await c.env.DB.batch(stmts);if(results.some(r=>r.meta?.changes!==1)||!await ownsLock(c.env.DB,lid,lk))return c.json({error:'retryable conflict'},409);return c.json((await ordered(c.env.DB,lid)).map(imageDto));}finally{await unlock(c.env.DB,lid,lk);}});
app.delete('/listings/:id/images/:imageId', async c => {
  const lid=c.req.param('id'),imageId=c.req.param('imageId');
  if(!await owned(c,lid)) return c.json({error:'not found'},404);
  const lease=await lock(c.env.DB,lid);if(!lease)return c.json({error:'retryable conflict'},409);
  try{
    if(!await owned(c,lid))return c.json({error:'not found'},404);
    const items=await ordered(c.env.DB,lid),target=items.find(x=>x.id===imageId);if(!target)return c.json({error:'not found'},404);
    const original=await c.env.IMAGES.get(target.object_key);if(!original)return c.json({error:'image object missing'},409);
    const op=id(),backup=`compensation/${op}`;
    await c.env.DB.prepare("INSERT INTO image_operations(id,listing_id,kind,state,object_key,backup_key,created_at,updated_at) VALUES(?,?,'DELETE','PENDING',?,?,?,?)").bind(op,lid,target.object_key,backup,now(),now()).run();
    try{await c.env.IMAGES.put(backup,await original.arrayBuffer(),{httpMetadata:{contentType:target.mime_type}});}catch{let backupExists=false,originalExists=false;try{backupExists=!!await c.env.IMAGES.head(backup);originalExists=!!await c.env.IMAGES.head(target.object_key);}catch{}await c.env.DB.prepare("UPDATE image_operations SET state=?,updated_at=? WHERE id=?").bind(backupExists?'NEEDS_REPAIR':originalExists?'COMPENSATED':'NEEDS_REPAIR',now(),op).run();return c.json({error:'image backup failed'},503);}
    try{await c.env.IMAGES.delete(target.object_key);}catch{try{if(!await c.env.IMAGES.head(target.object_key)){const saved=await c.env.IMAGES.get(backup);if(!saved)throw Error('backup missing');await c.env.IMAGES.put(target.object_key,await saved.arrayBuffer(),{httpMetadata:{contentType:target.mime_type}});if(!await c.env.IMAGES.head(target.object_key))throw Error('restore not visible');}await c.env.IMAGES.delete(backup);await c.env.DB.prepare("UPDATE image_operations SET state='COMPENSATED',updated_at=? WHERE id=?").bind(now(),op).run();}catch{await c.env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE id=?").bind(now(),op).run();}return c.json({error:'image delete failed'},503);}
    const rest=items.filter(x=>x.id!==target.id),fence=Math.floor(Date.now()/1000),stmts=[c.env.DB.prepare("DELETE FROM listing_images WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(target.id,lid,lid,lease,fence,lid,c.get('user').id)];
    for(let i=0;i<rest.length;i++)stmts.push(c.env.DB.prepare("UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(1000000+i,now(),rest[i].id,lid,lid,lease,fence,lid,c.get('user').id));
    for(let i=0;i<rest.length;i++)stmts.push(c.env.DB.prepare("UPDATE listing_images SET position=?,updated_at=? WHERE id=? AND listing_id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?) AND EXISTS (SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED'))").bind(i,now(),rest[i].id,lid,lid,lease,fence,lid,c.get('user').id));
    stmts.push(c.env.DB.prepare("UPDATE image_operations SET state='COMMITTED',updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>?)").bind(now(),op,lid,lease,fence));
    let results:D1Result[];
    try{results=await c.env.DB.batch(stmts);}catch{
      let stillPresent:unknown;
      try{stillPresent=await c.env.DB.prepare('SELECT id FROM listing_images WHERE id=?').bind(target.id).first();}catch{return c.json({error:'delete outcome requires recovery'},503);}
      if(!stillPresent){
        await c.env.DB.prepare("UPDATE image_operations SET state='COMMITTED',updated_at=? WHERE id=?").bind(now(),op).run();
        try{await c.env.IMAGES.delete(backup);await c.env.DB.prepare("UPDATE image_operations SET state='CLEANED',updated_at=? WHERE id=?").bind(now(),op).run();}catch{await c.env.DB.prepare("UPDATE image_operations SET state='CLEANUP_PENDING',updated_at=? WHERE id=?").bind(now(),op).run();return c.json({error:'image cleanup pending'},503);}
        return c.body(null,200);
      }
      const backupObject=await c.env.IMAGES.get(backup);if(!backupObject){await c.env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE id=?").bind(now(),op).run();return c.json({error:'image restoration requires recovery'},503);}
      try{await c.env.IMAGES.put(target.object_key,await backupObject.arrayBuffer(),{httpMetadata:{contentType:target.mime_type}});if(!await c.env.IMAGES.head(target.object_key))throw Error('restore not visible');await c.env.IMAGES.delete(backup);await c.env.DB.prepare("UPDATE image_operations SET state='COMPENSATED',updated_at=? WHERE id=?").bind(now(),op).run();}catch{await c.env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE id=?").bind(now(),op).run();}
      return c.json({error:'metadata commit failed'},503);
    }
    if(results[0]?.meta?.changes!==1){
      const backupObject=await c.env.IMAGES.get(backup);
      let restored=!!await c.env.IMAGES.head(target.object_key);if(!restored&&backupObject){await c.env.IMAGES.put(target.object_key,await backupObject.arrayBuffer(),{httpMetadata:{contentType:target.mime_type}});restored=!!await c.env.IMAGES.head(target.object_key);}if(!restored){await c.env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE id=?").bind(now(),op).run();return c.json({error:'image restoration requires recovery'},503);}
      try{await c.env.IMAGES.delete(backup);await c.env.DB.prepare("UPDATE image_operations SET state='COMPENSATED',updated_at=? WHERE id=?").bind(now(),op).run();}catch{await c.env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE id=?").bind(now(),op).run();}
      return c.json({error:'retryable conflict'},409);
    }
    try{await c.env.IMAGES.delete(backup);await c.env.DB.prepare("UPDATE image_operations SET state='CLEANED',updated_at=? WHERE id=?").bind(now(),op).run();}catch{await c.env.DB.prepare("UPDATE image_operations SET state='CLEANUP_PENDING',updated_at=? WHERE id=?").bind(now(),op).run();return c.json({error:'image cleanup pending'},503);}
    return c.body(null,200);
  }finally{await unlock(c.env.DB,lid,lease);}
});
app.notFound(c=>c.json({error:'not found'},404));
app.onError((e,c)=>{const correlationId=crypto.randomUUID();console.error(JSON.stringify({event:'request_error',correlationId}));return c.json({error:'internal error',correlationId},500);});
async function reconcile(env:Env) {
  const pending=(await env.DB.prepare("SELECT * FROM image_operations o WHERE (state IN ('PENDING','NEEDS_REPAIR','CLEANUP_PENDING') OR (kind='DELETE' AND state='COMMITTED')) AND NOT EXISTS (SELECT 1 FROM listing_locks l WHERE l.listing_id=o.listing_id AND l.expires_at>unixepoch()) ORDER BY updated_at LIMIT 100").all<any>()).results;
  for(const op of pending){
    const lease=await lock(env.DB,op.listing_id); if(!lease) continue;
    try {
    await env.DB.prepare('UPDATE image_operations SET updated_at=? WHERE id=?').bind(now(),op.id).run();
    const row=await env.DB.prepare('SELECT id FROM listing_images WHERE object_key=?').bind(op.object_key).first();
    if(op.kind==='ADD'){
      if(row){await env.DB.prepare("UPDATE image_operations SET state='COMMITTED',updated_at=? WHERE id=?").bind(now(),op.id).run();continue;}
      await env.IMAGES.delete(op.object_key);
      await env.DB.prepare("UPDATE image_operations SET state='COMPENSATED',updated_at=? WHERE id=?").bind(now(),op.id).run();
    }else if(op.kind==='DELETE'){
      const backup=op.backup_key?await env.IMAGES.get(op.backup_key):null;
      if((op.state==='CLEANUP_PENDING'||op.state==='COMMITTED')&&!row){if(op.backup_key)await env.IMAGES.delete(op.backup_key);await env.DB.prepare("UPDATE image_operations SET state='CLEANED',updated_at=? WHERE id=?").bind(now(),op.id).run();continue;}
      if(row){if(!await env.IMAGES.head(op.object_key)){if(!backup){await env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE id=?").bind(now(),op.id).run();continue;}await env.IMAGES.put(op.object_key,await backup.arrayBuffer(),{httpMetadata:{contentType:backup.httpMetadata?.contentType}});}if(!await env.IMAGES.head(op.object_key)){await env.DB.prepare("UPDATE image_operations SET state='NEEDS_REPAIR',updated_at=? WHERE id=?").bind(now(),op.id).run();continue;}if(op.backup_key)await env.IMAGES.delete(op.backup_key);await env.DB.prepare("UPDATE image_operations SET state='COMPENSATED',updated_at=? WHERE id=?").bind(now(),op.id).run();}
      else{await env.IMAGES.delete(op.object_key);if(op.backup_key)await env.IMAGES.delete(op.backup_key);await env.DB.prepare("UPDATE image_operations SET state='CLEANED',updated_at=? WHERE id=?").bind(now(),op.id).run();}
    }
    } finally { await unlock(env.DB,op.listing_id,lease); }
  }
}
const worker = { fetch: app.fetch, scheduled: async (_controller: ScheduledController, env: Env) => { await reconcile(env); } };
export { app };
export default worker;
