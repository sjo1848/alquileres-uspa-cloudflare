import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { localCompletePasswordReset, localMockMailbox, localOwnerAuthEnabled, localRateAllowed, localRegister, localRequestPasswordReset, localVerifyEmail, type LocalOwnerAuthEnv } from './local-owner-auth';
import { previewAuthConfigured, verifyPreviewIdentity, PREVIEW_DEMO_USERS, type PreviewAuthEnv, type PreviewDemoRole, type PreviewIdentity } from './preview-auth';
import { cleanImageName, d1BlobBytes, D1_IMAGE_MAX_BYTES, D1_IMAGE_MAX_COUNT, D1_MEDIA_QUOTA_BYTES, readBoundedBody, validateImageBytes } from './d1-blob-media';

type Env = PreviewAuthEnv & LocalOwnerAuthEnv & { MEDIA_STRATEGY?:string; IMAGES: R2Bucket; JWT_EXPIRES_IN?: string; MAX_IMAGE_BYTES?: string; COOKIE_SAME_SITE?: string; COOKIE_SECURE?: string; NODE_ENV?: string };
type User = { id: string; email: string; role: 'OWNER'|'ADMIN'; session_version?: number };
type ImageRow = { id:string; listing_id:string; object_key:string; original_name:string; mime_type:string; byte_size:number; position:number; created_at:string; blob_data?:unknown };
const app = new Hono<{ Bindings: Env; Variables: { user: User; previewIdentity: PreviewIdentity } }>();
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
const TERM_FIELDS=['depositStatus','depositAmount','depositCurrency','internetIncluded','waterIncluded','electricityIncluded','gasIncluded','petsPolicy','availableFrom'] as const;
const TERM_DEFAULTS={depositStatus:'NOT_INFORMED',depositAmount:null,depositCurrency:null,internetIncluded:'NOT_INFORMED',waterIncluded:'NOT_INFORMED',electricityIncluded:'NOT_INFORMED',gasIncluded:'NOT_INFORMED',petsPolicy:'NOT_INFORMED',availableFrom:null};
function rentalTerms(x:any){return Object.fromEntries(TERM_FIELDS.map(key=>[key,(x?.[key]===undefined||((['depositStatus','internetIncluded','waterIncluded','electricityIncluded','gasIncluded','petsPolicy'] as string[]).includes(key)&&x[key]===null))?TERM_DEFAULTS[key]:x[key]]));}
function validDateOnly(value:unknown){if(value===null)return true;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(`${value}T00:00:00.000Z`);return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;}
function validRentalTerms(x:any){
  if(!x||!['NOT_INFORMED','ASK_OWNER','NOT_REQUIRED','FIXED_AMOUNT'].includes(x.depositStatus))return false;
  const fixed=x.depositStatus==='FIXED_AMOUNT';
  if(fixed?(!Number.isInteger(x.depositAmount)||x.depositAmount<1||x.depositAmount>2147483647||!['ARS','USD'].includes(x.depositCurrency)):(x.depositAmount!==null||x.depositCurrency!==null))return false;
  if(!['INCLUDED','NOT_INCLUDED','NOT_INFORMED'].includes(x.internetIncluded)||!['INCLUDED','NOT_INCLUDED','NOT_INFORMED'].includes(x.waterIncluded)||!['INCLUDED','NOT_INCLUDED','NOT_INFORMED'].includes(x.electricityIncluded)||!['INCLUDED','NOT_INCLUDED','NOT_INFORMED'].includes(x.gasIncluded))return false;
  return ['ALLOWED','NOT_ALLOWED','ASK_OWNER','NOT_INFORMED'].includes(x.petsPolicy)&&validDateOnly(x.availableFrom);
}
function hasDeclaredRentalTerms(x:any){const values=rentalTerms(x);return TERM_FIELDS.some(key=>values[key]!==TERM_DEFAULTS[key]);}
function listingDto(id:string,owner:string,x:any,t:string){return {id,ownerId:owner,status:'DRAFT',title:x.title,description:x.description,location:x.location,priceAmount:x.priceAmount,pricePeriod:x.pricePeriod,rentalDuration:x.rentalDuration,maxOccupants:x.maxOccupants,currency:x.currency,...Object.fromEntries(TERM_FIELDS.map(key=>[key,x?.[key]??null])),publicationStatus:'UNPUBLISHED',availabilityStatus:'AVAILABLE',lastConfirmedAt:null,rejectionReason:null,createdAt:t,updatedAt:t};}
function b64(bytes: Uint8Array) { let s=''; for (const b of bytes) s+=String.fromCharCode(b); return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function unb64(s:string) { if(!/^[A-Za-z0-9_-]+$/.test(s)) throw Error('bad token'); const x=s.replace(/-/g,'+').replace(/_/g,'/'); return Uint8Array.from(atob(x+'='.repeat((4-x.length%4)%4)),c=>c.charCodeAt(0)); }
async function boundedJson(request:Request,maxBytes:number){const reader=request.body?.getReader();if(!reader)return null;const chunks:Uint8Array[]=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();return null;}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}}
async function hasRequestBody(request:Request){const reader=request.body?.getReader();if(!reader)return false;try{for(;;){const{done,value}=await reader.read();if(done)return false;if(value?.byteLength){await reader.cancel();return true;}}}finally{reader.releaseLock();}}
function lifetime(env:Env) { const m=/^(\d+)(s|m|h|d)$/.exec(env.JWT_EXPIRES_IN??'15m'); if(!m) throw Error('bad jwt expiry'); return Number(m[1])*({s:1,m:60,h:3600,d:86400}[m[2]]!); }
function jwtSecretBytes(env:Env) { if(typeof env.JWT_SECRET!=='string')throw Error('jwt secret unavailable');const secret=te.encode(env.JWT_SECRET);if(secret.length<32)throw Error('jwt secret too short');return secret; }
function jwtSecretConfigured(env:Env) { try{jwtSecretBytes(env);return true;}catch{return false;} }
const PREVIEW_SESSION_MAX_AGE=7*24*60*60;
type SessionClaims = { id:string; email:string; role:'OWNER'|'ADMIN'; sessionVersion:number; iat:number; exp:number; sessionId?:string; previewSource?:PreviewIdentity['source']; previewServiceClientId?:string; previewBinding?:string };
type SignedSession={token:string;expiresAt:number};
async function sign(u:User,env:Env,expiresAt=Infinity,previewIdentity?:PreviewIdentity,sessionId?:string):Promise<SignedSession> { const n=Math.floor(Date.now()/1000), exp=Math.min(n+lifetime(env),expiresAt), claims={id:u.id,email:u.email,role:u.role,sv:u.session_version??0,iat:n,exp,...(sessionId?{sid:sessionId}:{}),...(previewIdentity?{previewSource:previewIdentity.source,previewBinding:previewIdentity.binding,...(previewIdentity.serviceClientId?{previewServiceClientId:previewIdentity.serviceClientId}:{})}:{})}, a=b64(te.encode(JSON.stringify({alg:'HS256',typ:'JWT'}))), p=b64(te.encode(JSON.stringify(claims))), input=`${a}.${p}`, key=await crypto.subtle.importKey('raw',jwtSecretBytes(env),{name:'HMAC',hash:'SHA-256'},false,['sign']); return {token:`${input}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,te.encode(input))))}`,expiresAt:exp}; }
async function verify(token:string,env:Env,allowExpired=false) { if(token.length>8192) throw Error(); const p=token.split('.'); if(p.length!==3) throw Error(); const h=JSON.parse(new TextDecoder().decode(unb64(p[0]))), c=JSON.parse(new TextDecoder().decode(unb64(p[1]))), n=Math.floor(Date.now()/1000); if(h.alg!=='HS256'||!Number.isFinite(c.exp)||!Number.isSafeInteger(c.iat)||c.iat>n+30||c.exp<=c.iat||c.exp-c.iat>lifetime(env)+2||(!allowExpired&&c.exp<=n)||!['OWNER','ADMIN'].includes(c.role)||typeof c.id!=='string'||typeof c.email!=='string'||!Number.isSafeInteger(c.sv)) throw Error(); const key=await crypto.subtle.importKey('raw',jwtSecretBytes(env),{name:'HMAC',hash:'SHA-256'},false,['verify']); if(!await crypto.subtle.verify('HMAC',key,unb64(p[2]),te.encode(`${p[0]}.${p[1]}`))) throw Error(); return {...c,sessionVersion:c.sv,sessionId:typeof c.sid==='string'?c.sid:undefined} as SessionClaims; }
function cookieNamed(raw:string|null,name:string) { return raw?.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${name}=`))?.slice(name.length+1); }
function cookie(raw:string|null) { return cookieNamed(raw,'alquileres_session'); }
function refreshCookie(raw:string|null) { return cookieNamed(raw,'alquileres_refresh'); }
function setCookie(name:string,value:string,env:Env,options:{path:string;maxAge:number;clear?:boolean}) { const same=['strict','none'].includes(env.COOKIE_SAME_SITE??'')?env.COOKIE_SAME_SITE:'lax'; const secure=env.COOKIE_SECURE==='true'||env.NODE_ENV==='production'||same==='none'; const clear=options.clear===true; return `${name}=${clear?'':encodeURIComponent(value)}; Path=${options.path}; ${clear?'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT':`Max-Age=${Math.max(0,Math.floor(options.maxAge))}`}; HttpOnly; SameSite=${same![0].toUpperCase()+same!.slice(1)}${secure?'; Secure':''}`; }
function setPreviewCookies(c:any,signed:SignedSession,refreshToken:string,refreshMaxAge:number){c.header('Set-Cookie',setCookie('alquileres_session',signed.token,c.env,{path:'/',maxAge:Math.max(0,signed.expiresAt-Math.floor(Date.now()/1000))}));c.header('Set-Cookie',setCookie('alquileres_refresh',refreshToken,c.env,{path:'/api/auth',maxAge:refreshMaxAge}),{append:true});}
function clearPreviewCookies(c:any){c.header('Set-Cookie',setCookie('alquileres_session','',c.env,{path:'/',maxAge:0,clear:true}));c.header('Set-Cookie',setCookie('alquileres_refresh','',c.env,{path:'/api/auth',maxAge:0,clear:true}),{append:true});}
function previewAccessCookieMaxAge(identity:PreviewIdentity,env:Env){return Math.min(900,identity.expiresAt-Math.floor(Date.now()/1000),lifetime(env));}
function refreshExpiry(now:number){return now+PREVIEW_SESSION_MAX_AGE;}
function randomSecret(){return b64(crypto.getRandomValues(new Uint8Array(32)));}
async function refreshSecretHash(secret:string){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(secret))));}
function parseRefreshCookie(value:string|undefined){if(!value)return null;const [id,secret,...rest]=value.split('.');if(rest.length||!id||!secret||!/^[0-9a-f-]{36}$/i.test(id)||!/^[A-Za-z0-9_-]{43}$/.test(secret))return null;return {id,secret};}
async function createPreviewSession(db:D1Database,user:User,identity:PreviewIdentity){
  const createdAt=Math.floor(Date.now()/1000),expiresAt=refreshExpiry(createdAt),sessionId=crypto.randomUUID(),secret=randomSecret(),hash=await refreshSecretHash(secret);
  await db.prepare('DELETE FROM preview_auth_sessions WHERE expires_at<=? OR revoked_at IS NOT NULL').bind(createdAt).run();
  await db.prepare('INSERT INTO preview_auth_sessions(id,user_id,role,identity_source,identity_binding,service_client_id,session_version,refresh_token_hash,created_at,expires_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .bind(sessionId,user.id,user.role,identity.source,identity.binding,identity.serviceClientId??null,user.session_version??0,hash,createdAt,expiresAt,createdAt).run();
  return {sessionId,refreshToken:`${sessionId}.${secret}`,expiresAt};
}
async function previewSessionUser(db:D1Database,claims:SessionClaims,identity:PreviewIdentity){
  if(!claims.sessionId||claims.previewSource!==identity.source||claims.previewBinding!==identity.binding||
    (identity.source==='playwright-service'&&claims.previewServiceClientId!==identity.serviceClientId))return null;
  return db.prepare(`SELECT u.id,u.email,u.role,u.session_version FROM preview_auth_sessions s JOIN users u ON u.id=s.user_id
    WHERE s.id=? AND s.user_id=? AND s.role=? AND s.identity_source=? AND s.identity_binding=? AND s.session_version=?
      AND s.revoked_at IS NULL AND s.expires_at>unixepoch() AND u.id=? AND u.email=? AND u.role=? AND u.session_version=s.session_version`)
    .bind(claims.sessionId,claims.id,claims.role,identity.source,identity.binding,claims.sessionVersion,claims.id,claims.email,claims.role).first<User>();
}
async function refreshSession(db:D1Database,refreshValue:string|undefined,identity:PreviewIdentity){
  const parsed=parseRefreshCookie(refreshValue);if(!parsed)return null;
  const hash=await refreshSecretHash(parsed.secret);
  return db.prepare(`SELECT s.id AS sessionId,s.user_id AS userId,s.role,s.identity_source AS identitySource,
    s.identity_binding AS identityBinding,s.service_client_id AS serviceClientId,s.session_version AS sessionVersion,
    s.expires_at AS expiresAt,s.refresh_token_hash AS refreshTokenHash,
    u.id,u.email,u.role AS userRole,u.session_version AS userSessionVersion
    FROM preview_auth_sessions s JOIN users u ON u.id=s.user_id
    WHERE s.id=? AND s.refresh_token_hash=? AND s.revoked_at IS NULL AND s.expires_at>unixepoch()
      AND u.session_version=s.session_version AND s.identity_source=? AND s.identity_binding=?
      AND ((?='operator' AND s.service_client_id IS NULL) OR (?='playwright-service' AND s.service_client_id=?))`)
    .bind(parsed.id,hash,identity.source,identity.binding,identity.source,identity.source,identity.serviceClientId??'').first<any>();
}
async function authenticatedUser(c:any,claims:SessionClaims){
  const user=await c.env.DB.prepare('SELECT id,email,role,session_version FROM users WHERE id=?').bind(claims.id).first() as User|null;
  if(!user||user.email!==claims.email||user.session_version!==claims.sessionVersion)return null;
  if(c.env.AUTH_STRATEGY==='ACCESS_PREVIEW'){
    const identity=c.get('previewIdentity') as PreviewIdentity|undefined;
    if(!identity)return null;
    return previewSessionUser(c.env.DB,claims,identity);
  }
  return user;
}
function sameOriginPost(c:any){const origin=new URL(c.req.url).origin;return c.req.header('Origin')===origin&&(!c.req.header('Sec-Fetch-Site')||c.req.header('Sec-Fetch-Site')==='same-origin');}
app.use('*',async(c,next)=>{ c.header('Cache-Control','no-store'); c.header('X-Content-Type-Options','nosniff'); await next(); });
app.use('*',async(c,next)=>{
  const strategy=c.env.AUTH_STRATEGY;
  const protectedPath=/^\/auth(?:\/|$)/.test(c.req.path)||/^\/listings(?:\/|$)/.test(c.req.path)||/^\/owner(?:\/|$)/.test(c.req.path)||/^\/admin(?:\/|$)/.test(c.req.path);
  const origin=new URL(c.req.url).origin;
  const localMode=localOwnerAuthEnabled(c.req.raw,c.env);
  const previewMode=strategy==='ACCESS_PREVIEW'&&previewAuthConfigured(c.env,origin);
  if(protectedPath&&!localMode&&!previewMode)return c.json({error:'Authentication configuration unavailable'},503);
  if(protectedPath&&previewMode){
    let identity:PreviewIdentity;
    try{identity=await verifyPreviewIdentity(c.req.header('Cf-Access-Jwt-Assertion')??'',c.env,origin);}
    catch{return c.json({error:'Current Access identity required'},401);}
    c.set('previewIdentity',identity);
  }
  await next();
});
app.get('/auth/config',c=>{
  const origin=new URL(c.req.url).origin;
  const mediaStrategy=c.env.MEDIA_STRATEGY??'UNKNOWN';
  if(c.env.AUTH_STRATEGY==='ACCESS_PREVIEW'&&previewAuthConfigured(c.env,origin))return c.json({strategy:'ACCESS_PREVIEW',mediaStrategy});
  if(localOwnerAuthEnabled(c.req.raw,c.env))return c.json({strategy:'PASSWORD',registration:true,recovery:true,mediaStrategy});
  return c.json({error:'Authentication is unavailable'},503);
});
app.post('/auth/register',c=>localRegister(c.req.raw,c.env));
app.post('/auth/verify-email',c=>localVerifyEmail(c.req.raw,c.env));
app.post('/auth/password-reset/request',c=>localRequestPasswordReset(c.req.raw,c.env));
app.post('/auth/password-reset/complete',c=>localCompletePasswordReset(c.req.raw,c.env));
app.get('/__local/mailbox',c=>localMockMailbox(c.req.raw,c.env));
app.post('/auth/preview-session',async c=>{
  if(!previewAuthConfigured(c.env,new URL(c.req.url).origin)||!jwtSecretConfigured(c.env))return c.json({error:'Preview authentication unavailable'},503);
  if(!sameOriginPost(c))return c.json({error:'same-origin request required'},403);
  const identity=c.get('previewIdentity') as PreviewIdentity;
  const request=await c.req.json().catch(()=>null) as {role?:unknown}|null;
  if(!request||Object.keys(request).some(key=>key!=='role')||!['OWNER','ADMIN'].includes(String(request.role)))return c.json({error:'Choose a demo identity'},400);
  const role=request.role as PreviewDemoRole, expected=PREVIEW_DEMO_USERS[role];
  const user=await c.env.DB.prepare('SELECT id,email,role,session_version FROM users WHERE id=? AND email=? AND role=?').bind(expected.id,expected.email,role).first<User>();
  if(!user)return c.json({error:'Synthetic demo identity unavailable'},503);
  const accessMaxAge=previewAccessCookieMaxAge(identity,c.env);
  if(accessMaxAge<=0)return c.json({error:'Access session expired'},401);
  const session=await createPreviewSession(c.env.DB,user,identity);
  const signed=await sign(user,c.env,identity.expiresAt,identity,session.sessionId);
  setPreviewCookies(c,signed,session.refreshToken,session.expiresAt-Math.floor(Date.now()/1000));
  return c.json({user:{id:user.id,email:user.email,role:user.role},sessionExpiresAt:signed.expiresAt,refreshExpiresAt:session.expiresAt});
});
app.post('/auth/refresh',async c=>{
  const origin=new URL(c.req.url).origin;
  if(c.env.AUTH_STRATEGY!=='ACCESS_PREVIEW'||!previewAuthConfigured(c.env,origin)||!jwtSecretConfigured(c.env))return c.json({error:'Preview session renewal unavailable'},503);
  if(!sameOriginPost(c))return c.json({error:'same-origin request required'},403);
  if(await hasRequestBody(c.req.raw))return c.json({error:'Preview renewal accepts no request body'},400);
  const identity=c.get('previewIdentity') as PreviewIdentity;
  const session=await refreshSession(c.env.DB,refreshCookie(c.req.header('Cookie')??null),identity);
  if(!session)return c.json({error:'Preview refresh session expired or revoked'},401);
  const expected=PREVIEW_DEMO_USERS[session.role as PreviewDemoRole];
  if(!expected||session.id!==expected.id||session.email!==expected.email||session.userRole!==session.role||
    session.userSessionVersion!==session.sessionVersion||session.expiresAt<=Math.floor(Date.now()/1000))return c.json({error:'Synthetic Preview session unavailable'},401);
  const touch=await c.env.DB.prepare('UPDATE preview_auth_sessions SET last_seen_at=? WHERE id=? AND refresh_token_hash=? AND revoked_at IS NULL AND expires_at>unixepoch()')
    .bind(Math.floor(Date.now()/1000),session.sessionId,session.refreshTokenHash).run();
  if(touch.meta.changes!==1)return c.json({error:'Preview refresh session expired or revoked'},401);
  const user:User={id:session.id,email:session.email,role:session.role,session_version:session.sessionVersion};
  const signed=await sign(user,c.env,identity.expiresAt,identity,session.sessionId);
  const remaining=session.expiresAt-Math.floor(Date.now()/1000);
  setPreviewCookies(c,signed,refreshCookie(c.req.header('Cookie')??null)!,remaining);
  return c.json({user:{id:user.id,email:user.email,role:user.role},sessionExpiresAt:signed.expiresAt,refreshExpiresAt:session.expiresAt});
});
app.get('/health',c=>c.json({ok:true}));
app.all('/__fixture/*',c=>c.json({error:'not found'},404));
app.post('/auth/login',async c=>{
  if(c.env.AUTH_STRATEGY==='ACCESS_PREVIEW')return c.json({error:'Password login is unavailable in this Preview'},403);
  if(!localOwnerAuthEnabled(c.req.raw,c.env))return c.json({error:'Local synthetic OWNER authentication is unavailable'},404);
  if(!jwtSecretConfigured(c.env))return c.json({error:'authentication unavailable'},503);
  if(c.req.header('Origin')!==new URL(c.req.url).origin)return c.json({error:'same-origin request required'},403);
  const input=await boundedJson(c.req.raw,4096) as any;
  if(!input||Object.keys(input).some(k=>!['email','password'].includes(k))||typeof input.email!=='string'||input.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())||typeof input.password!=='string'||input.password.length<8||te.encode(input.password).byteLength>72)return c.json({error:'validation failed'},400);
  const normalized=input.email.trim().toLowerCase(),ip=c.req.header('CF-Connecting-IP')??'loopback';
  const [ipAllowed,emailAllowed]=await Promise.all([localRateAllowed(c.env,`login-ip:${ip}`,200),localRateAllowed(c.env,`login-email:${normalized}`,25)]);
  const dummyHash='$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS';
  if(!ipAllowed||!emailAllowed){await bcrypt.compare(input.password,dummyHash);return c.json({error:'Invalid credentials'},401);}
  const account=await c.env.DB.prepare('SELECT id,email,password_hash,role,session_version,email_verified_at FROM users WHERE email=?').bind(normalized).first<any>();
  const matches=account?await bcrypt.compare(input.password,account.password_hash):await bcrypt.compare(input.password,dummyHash);
  if(!account||!matches||!account.email_verified_at)return c.json({error:'Invalid credentials'},401);
  const user:User={id:account.id,email:account.email,role:account.role,session_version:account.session_version};
  const signed=await sign(user,c.env);
  return c.json({user:{id:user.id,email:user.email,role:user.role}},200,{'Set-Cookie':setCookie('alquileres_session',signed.token,c.env,{path:'/',maxAge:900})});
});
app.get('/auth/me',async c=>{
  if(!jwtSecretConfigured(c.env))return c.json({error:'authentication unavailable'},503);
  const auth=c.req.header('Authorization'),raw=auth?.startsWith('Bearer ')?auth.slice(7):cookie(c.req.header('Cookie')??null);
  if(!raw)return c.json({error:'Invalid or expired token'},401);
  let claims:SessionClaims;try{claims=await verify(decodeURIComponent(raw),c.env);}catch{return c.json({error:'Invalid or expired token'},401);}
  const user=await authenticatedUser(c,claims);
  if(!user)return c.json({error:'Invalid or expired token'},401);
  return c.json({id:user.id,email:user.email,role:user.role,...(c.env.AUTH_STRATEGY==='ACCESS_PREVIEW'?{sessionExpiresAt:claims.exp}:{})});
});
app.post('/auth/logout',async c=>{
  if(!sameOriginPost(c))return c.json({error:'same-origin request required'},403);
  if(c.env.AUTH_STRATEGY==='ACCESS_PREVIEW'){
    if(!jwtSecretConfigured(c.env))return c.json({error:'Preview logout unavailable'},503);
    const identity=c.get('previewIdentity') as PreviewIdentity,raw=cookie(c.req.header('Cookie')??null),refresh=parseRefreshCookie(refreshCookie(c.req.header('Cookie')??null));
    let claims:SessionClaims|undefined;
    if(raw){try{claims=await verify(decodeURIComponent(raw),c.env,true);}catch{}}
    if(claims?.sessionId&&claims.previewSource===identity.source&&claims.previewBinding===identity.binding&&
      (identity.source!=='playwright-service'||claims.previewServiceClientId===identity.serviceClientId)){
      const expected=PREVIEW_DEMO_USERS[claims.role];
      if(expected&&claims.id===expected.id&&claims.email===expected.email){
        try{await c.env.DB.prepare(`UPDATE preview_auth_sessions SET revoked_at=COALESCE(revoked_at,?)
          WHERE id=? AND user_id=? AND role=? AND identity_source=? AND identity_binding=? AND session_version=?`)
          .bind(Math.floor(Date.now()/1000),claims.sessionId,claims.id,claims.role,identity.source,identity.binding,claims.sessionVersion).run();}
        catch{return c.json({error:'Preview logout unavailable'},503);}
      }
    }else if(refresh){
      try{
        const session=await refreshSession(c.env.DB,refreshCookie(c.req.header('Cookie')??null),identity);
        if(session){
          const expected=PREVIEW_DEMO_USERS[session.role as PreviewDemoRole];
          if(expected&&session.id===expected.id&&session.email===expected.email&&session.userRole===session.role&&session.sessionVersion===session.userSessionVersion)
            await c.env.DB.prepare(`UPDATE preview_auth_sessions SET revoked_at=COALESCE(revoked_at,?)
              WHERE id=? AND refresh_token_hash=? AND identity_source=? AND identity_binding=? AND revoked_at IS NULL`)
              .bind(Math.floor(Date.now()/1000),session.sessionId,session.refreshTokenHash,identity.source,identity.binding).run();
        }
      }catch{return c.json({error:'Preview logout unavailable'},503);}
    }
    clearPreviewCookies(c);
    return c.json({ok:true});
  }
  if(localOwnerAuthEnabled(c.req.raw,c.env)){
    const authorization=c.req.header('Authorization')??'';
    const bearer=authorization.startsWith('Bearer ')?authorization.slice(7):null;
    const sessionCookie=cookie(c.req.header('Cookie')??null);
    for(const token of new Set([bearer,sessionCookie].filter((value):value is string=>Boolean(value)))){
      let claims:{id:string;email:string;sessionVersion:number}|undefined;
      try{claims=await verify(decodeURIComponent(token),c.env);}catch{}
      if(!claims)continue;
      try{
        await c.env.DB.prepare('UPDATE users SET session_version=session_version+1,updated_at=? WHERE id=? AND email=? AND session_version=?').bind(now(),claims.id,claims.email,claims.sessionVersion??0).run();
      }catch{return c.json({error:'Session revocation unavailable'},503);}
    }
  }
  return c.json({ok:true},200,{'Set-Cookie':setCookie('alquileres_session','',c.env,{path:'/',maxAge:0,clear:true})});
});
app.use('/listings/*',async(c,next)=>{ if(!jwtSecretConfigured(c.env))return c.json({error:'authentication unavailable'},503);const auth=c.req.header('Authorization'); const raw=auth?.startsWith('Bearer ')?auth.slice(7):cookie(c.req.header('Cookie')??null); if(!raw)return c.json({error:'Invalid or expired token'},401); if(!auth?.startsWith('Bearer ')&&['POST','PATCH','DELETE','PUT'].includes(c.req.method)){const origin=c.req.header('Origin');if(!origin||origin!==new URL(c.req.url).origin)return c.json({error:'same-origin request required'},403);}let claims:SessionClaims;try { claims=await verify(decodeURIComponent(raw),c.env); } catch { return c.json({error:'Invalid or expired token'},401); }const u=await authenticatedUser(c,claims);if(!u)return c.json({error:'Invalid or expired token'},401);if(u.role!=='OWNER')return c.json({error:'Insufficient role'},401);c.set('user',u);await next(); });
app.use('/owner/*',async(c,next)=>{if(!jwtSecretConfigured(c.env))return c.json({error:'authentication unavailable'},503);const auth=c.req.header('Authorization'),raw=auth?.startsWith('Bearer ')?auth.slice(7):cookie(c.req.header('Cookie')??null);if(!raw)return c.json({error:'Invalid or expired token'},401);if(!auth?.startsWith('Bearer ')&&['POST','PATCH','DELETE','PUT'].includes(c.req.method)){const origin=c.req.header('Origin');if(!origin||origin!==new URL(c.req.url).origin)return c.json({error:'same-origin request required'},403);}let claims:SessionClaims;try{claims=await verify(decodeURIComponent(raw),c.env);}catch{return c.json({error:'Invalid or expired token'},401);}const user=await authenticatedUser(c,claims);if(!user)return c.json({error:'Invalid or expired token'},401);if(user.role!=='OWNER')return c.json({error:'Insufficient role'},403);c.set('user',user);await next();});
app.use('/listings/*',async(c,next)=>{if(c.env.MEDIA_STRATEGY==='STATIC_ASSETS'&&['POST','PATCH','PUT','DELETE'].includes(c.req.method)&&/\/images(?:\/|$)/.test(c.req.path))return c.json({error:'Owner image changes are not available for repository-managed media'},503);await next();});
app.use('/admin/*',async(c,next)=>{
  if(!jwtSecretConfigured(c.env))return c.json({error:'authentication unavailable'},503);
  const auth=c.req.header('Authorization'),raw=auth?.startsWith('Bearer ')?auth.slice(7):cookie(c.req.header('Cookie')??null);
  if(!raw)return c.json({error:'Invalid or expired token'},401);
  if(!auth?.startsWith('Bearer ')&&['POST','PATCH','DELETE','PUT'].includes(c.req.method)&&c.req.header('Origin')!==new URL(c.req.url).origin)return c.json({error:'same-origin request required'},403);
  let claims:SessionClaims;try{claims=await verify(decodeURIComponent(raw),c.env);}catch{return c.json({error:'Invalid or expired token'},401);}
  const user=await authenticatedUser(c,claims);
  if(!user)return c.json({error:'Invalid or expired token'},401);
  if(user.role!=='ADMIN')return c.json({error:'Invalid or expired token'},401);
  c.set('user',user);await next();
});
// Proposed edits to already approved listings are moderated separately from new listings.
app.get('/admin/listings/revisions',async c=>{
  const afterUpdatedAt=c.req.query('afterUpdatedAt'),afterListingId=c.req.query('afterListingId'),hasCursor=afterUpdatedAt!==undefined||afterListingId!==undefined;
  if(hasCursor&&(!afterUpdatedAt||!afterListingId||afterUpdatedAt.length>40||afterListingId.length>100||!Number.isFinite(Date.parse(afterUpdatedAt))))return c.json({error:'invalid revision cursor'},400);
  const cursorClause=hasCursor?' AND (r.updated_at<? OR (r.updated_at=? AND r.listing_id>?))':'';
  const query=`SELECT r.listing_id AS listingId,r.state,r.payload,r.version,r.base_updated_at AS baseUpdatedAt,r.rejection_reason AS rejectionReason,r.updated_at AS updatedAt,l.title AS currentTitle,l.description AS currentDescription,l.location AS currentLocation,l.price_amount AS currentPriceAmount,l.price_period AS currentPricePeriod,l.rental_duration AS currentRentalDuration,l.max_occupants AS currentMaxOccupants,l.currency AS currentCurrency,l.deposit_status AS currentDepositStatus,l.deposit_amount AS currentDepositAmount,l.deposit_currency AS currentDepositCurrency,l.internet_included AS currentInternetIncluded,l.water_included AS currentWaterIncluded,l.electricity_included AS currentElectricityIncluded,l.gas_included AS currentGasIncluded,l.pets_policy AS currentPetsPolicy,l.available_from AS currentAvailableFrom,l.publication_status AS publicationStatus,l.status AS listingStatus,l.updated_at AS listingUpdatedAt,u.email AS ownerEmail FROM listing_change_revisions r JOIN listings l ON l.id=r.listing_id JOIN users u ON u.id=l.owner_id AND u.role='OWNER' WHERE r.state IN ('SUBMITTED','APPROVED') AND l.publication_status='PUBLISHED'${cursorClause} ORDER BY r.updated_at DESC,r.listing_id ASC LIMIT 101`;
  const fetched=(hasCursor?await c.env.DB.prepare(query).bind(afterUpdatedAt,afterUpdatedAt,afterListingId).all<any>():await c.env.DB.prepare(query).all<any>()).results;
  const hasMore=fetched.length>100,rows=fetched.slice(0,100),last=rows.at(-1);
  return c.json({items:rows.map(row=>{const {payload,...rest}=row;return {...rest,fields:JSON.parse(payload)};}),nextCursor:hasMore&&last?{updatedAt:last.updatedAt,listingId:last.listingId}:null});
});
app.post('/admin/listings/:id/revision/review',async c=>{
  const lid=c.req.param('id'),input=await boundedJson(c.req.raw,1024) as any;
  if(!input||Object.keys(input).some(key=>!['action','reason','expectedVersion'].includes(key))||
    !['approve','reject'].includes(input.action)||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1||
    (input.action==='approve'&&input.reason!==undefined)||
    (input.action==='reject'&&(typeof input.reason!=='string'||input.reason.trim().length<3||input.reason.trim().length>1000)))
    return c.json({error:'invalid revision decision'},400);
  const listing=await sourceAdminListing(c.env.DB,lid,c.env.MEDIA_STRATEGY);
  if(!listing)return c.json({error:'not found'},404);
  const lease=await lock(c.env.DB,lid);if(!lease)return c.json({error:'listing busy; retry'},409);
  try{
    const revision=await getListingRevision(c.env.DB,lid);
    const current=await sourceAdminListing(c.env.DB,lid,c.env.MEDIA_STRATEGY);
  if(!current||current.status!=='APPROVED'||current.publicationStatus!=='PUBLISHED'||!revision||revision.state!=='SUBMITTED'||revision.version!==input.expectedVersion||revision.baseUpdatedAt!==current.updatedAt)return c.json({error:'revision changed or listing is not publicly published'},409);
    const at=monotonicTimestamp(revision.updatedAt),reason=input.action==='reject'?input.reason.trim():null,state=input.action==='approve'?'APPROVED':'REJECTED';
    const action=input.action==='approve'?'ADMIN_LISTING_REVISION_APPROVED':'ADMIN_LISTING_REVISION_REJECTED';
    const update=c.env.DB.prepare("UPDATE listing_change_revisions SET state=?,rejection_reason=?,version=version+1,reviewed_at=?,updated_at=? WHERE listing_id=? AND state='SUBMITTED' AND version=? AND base_updated_at=? AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())").bind(state,reason,at,at,lid,input.expectedVersion,current.updatedAt,lid,lease);
    const audit=sourceAuditInsert(c,id(),lid,action,reason,at,"l.id=? AND owner.role='OWNER' AND changes()=1 AND EXISTS(SELECT 1 FROM listing_change_revisions r WHERE r.listing_id=l.id AND r.state=? AND r.version=?)",[lid,state,input.expectedVersion+1],{revisionVersion:input.expectedVersion+1});
    const results=await c.env.DB.batch([update,audit,c.env.DB.prepare(revisionAtomicGuard)]);
    if(results[0]?.meta?.changes!==1||results[1]?.meta?.changes!==1)return c.json({error:'revision review conflict'},409);
    return c.json({revision:revisionDto(await getListingRevision(c.env.DB,lid))});
  }catch{return c.json({error:'revision review unavailable'},503);}
  finally{await unlock(c.env.DB,lid,lease);}
});
app.post('/admin/listings/:id/revision/publish',async c=>{
  const lid=c.req.param('id'),input=await boundedJson(c.req.raw,512) as any;
  if(!input||Object.keys(input).some(key=>key!=='expectedVersion')||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1)return c.json({error:'expectedVersion required'},400);
  const before=await sourceAdminListing(c.env.DB,lid,c.env.MEDIA_STRATEGY);
  if(!before)return c.json({error:'not found'},404);
  const lease=await lock(c.env.DB,lid);if(!lease)return c.json({error:'listing busy; retry'},409);
  try{
    const current=await sourceAdminListing(c.env.DB,lid,c.env.MEDIA_STRATEGY),revision=await getListingRevision(c.env.DB,lid);
    if(!current||current.status!=='APPROVED'||current.publicationStatus!=='PUBLISHED'||!revision||revision.state!=='APPROVED'||revision.version!==input.expectedVersion||revision.baseUpdatedAt!==current.updatedAt)return c.json({error:'revision no longer ready for publication'},409);
    const fields=proposedRevisionFields(JSON.parse(revision.payload));
    if(!fields)return c.json({error:'revision contains invalid fields'},409);
    const at=monotonicTimestamp(current.updatedAt);
    const update=c.env.DB.prepare("UPDATE listings SET title=?,description=?,location=?,location_search=?,price_amount=?,price_period=?,rental_duration=?,max_occupants=?,currency=?,deposit_status=?,deposit_amount=?,deposit_currency=?,internet_included=?,water_included=?,electricity_included=?,gas_included=?,pets_policy=?,available_from=?,updated_at=? WHERE id=? AND owner_id=? AND status='APPROVED' AND updated_at=? AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch()) AND EXISTS(SELECT 1 FROM listing_change_revisions r WHERE r.listing_id=listings.id AND r.state='APPROVED' AND r.version=? AND r.base_updated_at=listings.updated_at)").bind(fields.title,fields.description,fields.location,fields.location.normalize('NFC').toLowerCase(),fields.priceAmount,fields.pricePeriod,fields.rentalDuration,fields.maxOccupants,fields.currency,...TERM_FIELDS.map(key=>fields[key]),at,lid,revision.ownerId,current.updatedAt,lid,lease,input.expectedVersion);
    const applied=c.env.DB.prepare("UPDATE listing_change_revisions SET state='APPLIED',version=version+1,applied_at=?,updated_at=? WHERE listing_id=? AND state='APPROVED' AND version=? AND base_updated_at=? AND EXISTS(SELECT 1 FROM listings WHERE id=? AND updated_at=? AND status='APPROVED')").bind(at,at,lid,input.expectedVersion,current.updatedAt,lid,at);
    const audit=sourceAuditInsert(c,id(),lid,'ADMIN_LISTING_REVISION_PUBLISHED',null,at,"l.id=? AND owner.role='OWNER' AND changes()=1 AND EXISTS(SELECT 1 FROM listing_change_revisions r WHERE r.listing_id=l.id AND r.state='APPLIED' AND r.version=? AND r.applied_at=?)",[lid,input.expectedVersion+1,at],{revisionVersion:input.expectedVersion+1});
    const result=await c.env.DB.batch([update,c.env.DB.prepare(revisionAtomicGuard),applied,audit,c.env.DB.prepare(revisionAtomicGuard)]);
    if(result.length!==5||result[0]?.meta?.changes!==1||result[2]?.meta?.changes!==1||result[3]?.meta?.changes!==1)return c.json({error:'revision publication needs recovery; inspect audit and listing'},503);
    return c.json({listing:await sourceAdminListing(c.env.DB,lid,c.env.MEDIA_STRATEGY),revision:revisionDto(await getListingRevision(c.env.DB,lid))});
  }catch{return c.json({error:'revision publication outcome uncertain; inspect before retry'},503);}
  finally{await unlock(c.env.DB,lid,lease);}
});

app.get('/admin/listings/review',async c=>{
  const afterCreatedAt=c.req.query('afterCreatedAt'),afterId=c.req.query('afterId');
  const hasCursor=afterCreatedAt!==undefined||afterId!==undefined;
  if(hasCursor&&(!afterCreatedAt||!afterId||afterCreatedAt.length>40||afterId.length>64||!Number.isFinite(Date.parse(afterCreatedAt))))return c.json({error:'invalid review cursor'},400);
  const cursorClause=hasCursor?' AND (l.created_at<? OR (l.created_at=? AND l.id<?))':'';
  const query=`SELECT l.id,l.owner_id AS ownerId,l.status,l.title,l.description,l.location,l.price_amount AS priceAmount,l.price_period AS pricePeriod,l.rental_duration AS rentalDuration,l.max_occupants AS maxOccupants,l.currency,l.publication_status AS publicationStatus,l.availability_status AS availabilityStatus,l.last_confirmed_at AS lastConfirmedAt,l.rejection_reason AS rejectionReason,l.created_at AS createdAt,l.updated_at AS updatedAt,u.email AS ownerEmail FROM listings l JOIN users u ON u.id=l.owner_id WHERE u.role='OWNER' AND (l.status='SUBMITTED' OR (l.status='APPROVED' AND l.publication_status='UNPUBLISHED'))${cursorClause} ORDER BY l.created_at DESC,l.id DESC LIMIT 101`;
  const statement=c.env.DB.prepare(query);
  const fetched=hasCursor
    ? (await statement.bind(afterCreatedAt,afterCreatedAt,afterId).all<any>()).results
    : (await statement.all<any>()).results;
  const hasMore=fetched.length>100,rows=fetched.slice(0,100);
  if(!rows.length)return c.json({items:[],nextCursor:null});
  const images=await publicImages(c.env.DB,rows.map(row=>row.id),c.env.MEDIA_STRATEGY==='STATIC_ASSETS',d1ImageStatus(c));
  const legacyIds=new Set<string>();
  if(d1ImageStatus(c)){
    const slots=rows.map(()=>'?').join(',');
    const legacy=(await c.env.DB.prepare(`SELECT DISTINCT listing_id AS listingId FROM listing_images WHERE listing_id IN (${slots}) AND blob_data IS NULL`).bind(...rows.map(row=>row.id)).all<any>()).results;
    for(const row of legacy)legacyIds.add(row.listingId);
  }
  const byListing=new Map<string,any[]>();for(const image of images){const collection=byListing.get(image.listingId)??[];collection.push({...image,url:image.url??`/admin/listings/${encodeURIComponent(image.listingId)}/images/${encodeURIComponent(image.id)}`});byListing.set(image.listingId,collection);}
  return c.json({items:rows.map(row=>({...row,freshnessStatus:publicFreshness(row.lastConfirmedAt),owner:{id:row.ownerId,email:row.ownerEmail,role:'OWNER'},images:byListing.get(row.id)??[],requiresMediaRecovery:legacyIds.has(row.id)})),nextCursor:hasMore?{createdAt:rows.at(-1)!.createdAt,id:rows.at(-1)!.id}:null});
});
app.get('/admin/owners',async c=>{const search=(c.req.query('search')??'').trim();if(search.length>254)return c.json({error:'search is too long'},400);const statement=search?"SELECT id,email FROM users WHERE role='OWNER' AND instr(lower(email),lower(?))>0 ORDER BY email,id LIMIT 50":"SELECT id,email FROM users WHERE role='OWNER' ORDER BY email,id LIMIT 50";const result=await c.env.DB.prepare(statement).bind(...(search?[search]:[])).all<{id:string;email:string}>();return c.json(result.results);});
app.get('/admin/listings/assisted',async c=>{
  const owner=c.req.query('ownerId');
  if(!owner||owner.length>100)return c.json({error:'a valid ownerId is required'},400);
  const afterUpdatedAt=c.req.query('afterUpdatedAt'),afterId=c.req.query('afterId'),hasCursor=afterUpdatedAt!==undefined||afterId!==undefined;
  if(hasCursor&&(!afterUpdatedAt||!afterId||afterUpdatedAt.length>40||afterId.length>100))return c.json({error:'invalid draft cursor'},400);
  const base="SELECT l.id,l.owner_id AS ownerId,l.status,l.title,l.description,l.location,l.price_amount AS priceAmount,l.price_period AS pricePeriod,l.rental_duration AS rentalDuration,l.max_occupants AS maxOccupants,l.currency,l.deposit_status AS depositStatus,l.deposit_amount AS depositAmount,l.deposit_currency AS depositCurrency,l.internet_included AS internetIncluded,l.water_included AS waterIncluded,l.electricity_included AS electricityIncluded,l.gas_included AS gasIncluded,l.pets_policy AS petsPolicy,l.available_from AS availableFrom,l.publication_status AS publicationStatus,l.availability_status AS availabilityStatus,l.last_confirmed_at AS lastConfirmedAt,l.rejection_reason AS rejectionReason,l.created_at AS createdAt,l.updated_at AS updatedAt,u.email AS ownerEmail FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.owner_id=? AND u.role='OWNER' AND l.status IN ('DRAFT','REJECTED')";
  const statement=hasCursor?`${base} AND (l.updated_at<? OR (l.updated_at=? AND l.id<?)) ORDER BY l.updated_at DESC,l.id DESC LIMIT 51`:`${base} ORDER BY l.updated_at DESC,l.id DESC LIMIT 51`;
  const rows=await c.env.DB.prepare(statement).bind(...(hasCursor?[owner,afterUpdatedAt,afterUpdatedAt,afterId]:[owner])).all<any>();
  const hasMore=rows.results.length>50,page=rows.results.slice(0,50),last=page.at(-1);
  return c.json({items:page.map(row=>{const {ownerId,ownerEmail,...item}=row;return {...item,owner:{id:ownerId,email:ownerEmail,role:'OWNER'}};}),nextCursor:hasMore&&last?{updatedAt:last.updatedAt,id:last.id}:null});
});
app.post('/admin/listings/assisted',async c=>{
  const input=await boundedJson(c.req.raw,12_000) as any;
  const allowed=['ownerId','title','description','location','priceAmount','pricePeriod','rentalDuration','maxOccupants','currency'];
  if(!input||Object.keys(input).some(key=>!allowed.includes(key))||typeof input.ownerId!=='string'||input.ownerId.length<1||input.ownerId.length>100||!validListingInput(input))return c.json({error:'validation failed'},400);
  const supplied=requestKey(c);if(!supplied)return c.json({error:'a valid Idempotency-Key is required'},400);
  const normalized={ownerId:input.ownerId,title:input.title,description:input.description,location:input.location,priceAmount:input.priceAmount,pricePeriod:input.pricePeriod,rentalDuration:input.rentalDuration,maxOccupants:input.maxOccupants,currency:input.currency};
  const requestFingerprint=await fingerprint(normalized),actor=c.get('user').id,scope='ADMIN_ASSISTED_LISTING_CREATE';
  let record:any;
  try{record=await c.env.DB.prepare('SELECT request_fingerprint,resource_id,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(actor,scope,supplied).first<any>();}catch{return c.json({error:'assisted creation outcome unavailable; retry with the same idempotency key'},503);}
  if(record){
    if(record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reused with different request'},409);
    if(record.state==='COMMITTED'&&typeof record.result_json==='string'){try{return c.json(JSON.parse(record.result_json),201);}catch{return c.json({error:'assisted creation replay requires recovery'},503);}}
    if(record.state!=='PENDING'||typeof record.result_json!=='string')return c.json({error:'assisted creation requires recovery; retry with the same idempotency key'},503);
  }else{
    const owner=await c.env.DB.prepare("SELECT id,email FROM users WHERE id=? AND role='OWNER'").bind(input.ownerId).first<{id:string;email:string}>();
    if(!owner)return c.json({message:'Owner not found'},404);
    const at=now(),listingId=id(),item=listingDto(listingId,owner.id,normalized,at),{ownerId:ignoredOwnerId,...fields}=item;
    const snapshot={...fields,owner:{id:owner.id,email:owner.email,role:'OWNER'},images:[],...(c.env.MEDIA_STRATEGY==='D1_BLOB'?{requiresMediaRecovery:false}:{})};
    try{await c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,result_json,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?,?)").bind(actor,scope,supplied,requestFingerprint,listingId,JSON.stringify(snapshot),at,at).run();record={request_fingerprint:requestFingerprint,resource_id:listingId,state:'PENDING',result_json:JSON.stringify(snapshot)};}
    catch{try{record=await c.env.DB.prepare('SELECT request_fingerprint,resource_id,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(actor,scope,supplied).first<any>();}catch{return c.json({error:'assisted creation reservation unavailable; retry with the same idempotency key'},503);}if(!record||record.request_fingerprint!==requestFingerprint)return c.json({error:'idempotency key reused with different request'},409);if(record.state==='COMMITTED'&&typeof record.result_json==='string')return c.json(JSON.parse(record.result_json),201);if(record.state!=='PENDING'||typeof record.result_json!=='string')return c.json({error:'assisted creation requires recovery; retry with the same idempotency key'},503);}
  }
  const snapshot=record.result_json,listingId=record.resource_id;
  let item:any;try{item=JSON.parse(snapshot);}catch{return c.json({error:'assisted creation replay requires recovery'},503);}
  const owner=await c.env.DB.prepare("SELECT id FROM users WHERE id=? AND role='OWNER'").bind(input.ownerId).first<{id:string}>();
  if(!owner)return c.json({message:'Owner not found'},404);
  const eventId=id(),at=now();
  try{
    const results=await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO listings(id,owner_id,status,title,description,location,location_search,price_amount,price_period,rental_duration,max_occupants,currency,publication_status,availability_status,last_confirmed_at,rejection_reason,created_at,updated_at) SELECT ?,?,'DRAFT',?,?,?,?,?,?,?,?,?,'UNPUBLISHED','AVAILABLE',NULL,NULL,?,? WHERE EXISTS(SELECT 1 FROM users WHERE id=? AND role='OWNER') AND NOT EXISTS(SELECT 1 FROM listings WHERE id=?)").bind(listingId,owner.id,item.title,item.description,item.location,item.location.normalize('NFC').toLowerCase(),item.priceAmount,item.pricePeriod,item.rentalDuration,item.maxOccupants,item.currency,item.createdAt,item.updatedAt,owner.id,listingId),
      c.env.DB.prepare("INSERT INTO admin_audit_events(id,actor_id,action,entity_type,entity_id,listing_id,target_owner_id,metadata,reason,created_at) SELECT ?,?,'ADMIN_ASSISTED_LISTING_CREATED','LISTING',id,id,owner_id,'{}',NULL,? FROM listings WHERE id=? AND changes()=1").bind(eventId,actor,at,listingId),
      // An invalid state intentionally violates the CHECK constraint if either side effect is missing;
      // D1 batch then rolls the listing/audit inserts back instead of committing a false success.
      c.env.DB.prepare("UPDATE idempotency_records SET state=CASE WHEN EXISTS(SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status='DRAFT' AND publication_status='UNPUBLISHED') AND EXISTS(SELECT 1 FROM admin_audit_events WHERE id=? AND actor_id=? AND action='ADMIN_ASSISTED_LISTING_CREATED' AND listing_id=? AND target_owner_id=?) THEN 'COMMITTED' ELSE 'INVALID' END,updated_at=? WHERE owner_id=? AND scope=? AND request_key=? AND request_fingerprint=? AND state='PENDING'").bind(listingId,owner.id,eventId,actor,listingId,owner.id,at,actor,scope,supplied,requestFingerprint)
    ]);
    if(results.some(result=>result.meta?.changes!==1)){
      record=await c.env.DB.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(actor,scope,supplied).first<any>();
      if(record?.request_fingerprint===requestFingerprint&&record.state==='COMMITTED'&&record.result_json===snapshot)return c.json(JSON.parse(snapshot),201);
      return c.json({error:'assisted creation could not be confirmed; retry with the same idempotency key'},503);
    }
  }catch{
    try{record=await c.env.DB.prepare('SELECT request_fingerprint,state,result_json FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(actor,scope,supplied).first<any>();if(record?.request_fingerprint===requestFingerprint&&record.state==='COMMITTED'&&record.result_json===snapshot)return c.json(JSON.parse(snapshot),201);}catch{}
    return c.json({error:'assisted creation outcome unknown; retry with the same idempotency key'},503);
  }
  return c.json(JSON.parse(snapshot),201);
});
async function runAssistedMutation(c:any,action:string,payload:unknown,prepare:(listing:any,lease:string,at:string,eventId:string)=>{update?:D1PreparedStatement;auditAction:string;metadata?:Record<string,unknown>;snapshot:any;auditWhere:string;auditArgs:unknown[]}|Promise<{update?:D1PreparedStatement;auditAction:string;metadata?:Record<string,unknown>;snapshot:any;auditWhere:string;auditArgs:unknown[]}>) {
  const listingId=c.req.param('id'),actor=ownerId(c),key=requestKey(c);
  if(!key)return c.json({error:'a valid Idempotency-Key is required'},400);
  const scope=`ADMIN_ASSISTED_${action}:${listingId}`,requestFingerprint=await fingerprint({action,listingId,payload});
  let replay:any;try{replay=await mutationReplay(c.env.DB,actor,scope,key,requestFingerprint);}catch{return c.json({error:'assisted mutation outcome unavailable; retry with the same idempotency key'},503);}
  if(replay?.conflict)return c.json({error:'idempotency key reused with a different assisted mutation'},409);
  if(replay?.pending)return c.json({error:'assisted mutation requires recovery; retry with the same idempotency key'},503);
  if(replay)return c.json(replay.result,200);
  const exists=await c.env.DB.prepare("SELECT l.id FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=? AND u.role='OWNER'").bind(listingId).first();
  if(!exists)return c.json({message:'Listing not found'},404);
  const lease=await lock(c.env.DB,listingId);if(!lease)return c.json({error:'listing is busy; retry with the same idempotency key'},409);
  try{
    const listing=await c.env.DB.prepare("SELECT l.id,l.owner_id AS ownerId,l.status,l.title,l.description,l.location,l.price_amount AS priceAmount,l.price_period AS pricePeriod,l.rental_duration AS rentalDuration,l.max_occupants AS maxOccupants,l.currency,l.publication_status AS publicationStatus,l.availability_status AS availabilityStatus,l.last_confirmed_at AS lastConfirmedAt,l.rejection_reason AS rejectionReason,l.created_at AS createdAt,l.updated_at AS updatedAt,u.email AS ownerEmail,EXISTS(SELECT 1 FROM listing_images i WHERE i.listing_id=l.id AND i.blob_data IS NULL) AS hasLegacyMedia FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=? AND u.role='OWNER'").bind(listingId).first() as any;
    if(!listing)return c.json({message:'Listing not found'},404);
    const currentSnapshot=await sourceAdminListing(c.env.DB,listingId,c.env.MEDIA_STRATEGY);
    if(!currentSnapshot)return c.json({message:'Listing not found'},404);
    Object.assign(listing,Object.fromEntries(TERM_FIELDS.map(key=>[key,currentSnapshot[key]??null])));
    listing.snapshot=currentSnapshot;
    const at=monotonicTimestamp(listing.updatedAt),eventId=id(),prepared=await prepare(listing,lease,at,eventId);
    const audit=sourceAuditInsert(c,eventId,listingId,prepared.auditAction,null,at,prepared.auditWhere,prepared.auditArgs,prepared.metadata);
    const resultJson=JSON.stringify(prepared.snapshot);
    const receipt=c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,result_json,created_at,updated_at) SELECT ?,?,?,?,?, 'COMMITTED',?,?,? WHERE EXISTS(SELECT 1 FROM admin_audit_events WHERE id=? AND actor_id=? AND listing_id=? AND target_owner_id=?) AND EXISTS(SELECT 1 FROM listings WHERE id=? AND owner_id=? AND updated_at=?)").bind(actor,scope,key,requestFingerprint,listingId,resultJson,at,at,eventId,actor,listingId,listing.ownerId,listingId,listing.ownerId,prepared.snapshot.updatedAt);
    const statements=[...(prepared.update?[prepared.update]:[]),audit,receipt];
    let results:D1Result[];try{results=await c.env.DB.batch(statements) as D1Result[];}catch{return c.json({error:'assisted mutation outcome unknown; retry with the same idempotency key'},503);}
    if(results.length!==statements.length||results.some(result=>result.meta?.changes!==1))return c.json({error:'assisted mutation was not committed; reload and retry'},409);
    return c.json(prepared.snapshot,200);
  }finally{await unlock(c.env.DB,listingId,lease);}
}
function assistedMutationError(c:any,error:any,message:(error:any)=>string){
  const status=error?.status;
  if(!Number.isInteger(status)||status<400||status>=600)throw error;
  return c.json({error:message(error)},status);
}
app.patch('/admin/listings/assisted/:id',async c=>{
  const input=await boundedJson(c.req.raw,12_000) as any,allowed=['title','description','location','priceAmount','pricePeriod','rentalDuration','maxOccupants','currency','expectedUpdatedAt'];
  if(!input||Object.keys(input).some(key=>!allowed.includes(key))||['priceAmount','pricePeriod','rentalDuration','maxOccupants','currency'].some(key=>input[key]===undefined)||typeof input.expectedUpdatedAt!=='string'||input.expectedUpdatedAt.length>40||!Number.isFinite(Date.parse(input.expectedUpdatedAt)))return c.json({error:'rental fields and expectedUpdatedAt are required'},400);
  return runAssistedMutation(c,'UPDATE',input,(listing,lease,at,eventId)=>{
    if(!['DRAFT','REJECTED'].includes(listing.status))throw Object.assign(new Error('listing is not editable'),{status:409});
    if(listing.snapshot.updatedAt!==input.expectedUpdatedAt)throw Object.assign(new Error('listing changed since it was opened'),{status:409});
    const current={...listing,...input};if(!validListingInput(current))throw Object.assign(new Error('validation failed'),{status:400});
    const {expectedUpdatedAt,...fields}=input,snapshot={...listing.snapshot,...fields,updatedAt:at};
    const update=c.env.DB.prepare("UPDATE listings SET title=?,description=?,location=?,location_search=?,price_amount=?,price_period=?,rental_duration=?,max_occupants=?,currency=?,updated_at=? WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED') AND updated_at=? AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())").bind(current.title,current.description,current.location,current.location.normalize('NFC').toLowerCase(),current.priceAmount,current.pricePeriod,current.rentalDuration,current.maxOccupants,current.currency,at,listing.id,listing.ownerId,expectedUpdatedAt,listing.id,lease);
    return {update,auditAction:'ADMIN_ASSISTED_LISTING_UPDATED',metadata:{},snapshot,auditWhere:"l.id=? AND owner.role='OWNER' AND changes()=1 AND l.updated_at=? AND l.status IN ('DRAFT','REJECTED')",auditArgs:[listing.id,at]};
  }).catch((error:any)=>assistedMutationError(c,error,error=>error?.message==='validation failed'?'validation failed':'listing is not editable'));
});
app.patch('/admin/listings/assisted/:id/availability',async c=>{
  const input=await boundedJson(c.req.raw,1024) as any;
  if(!input||Object.keys(input).length!==1||!['AVAILABLE','UNAVAILABLE'].includes(input.availabilityStatus))return c.json({error:'availabilityStatus must be AVAILABLE or UNAVAILABLE'},400);
  return runAssistedMutation(c,'AVAILABILITY',input,(listing,lease,at)=>{
    if(!['DRAFT','REJECTED'].includes(listing.status))throw Object.assign(new Error('listing is not editable'),{status:409});
    const snapshot={...listing.snapshot,availabilityStatus:input.availabilityStatus,lastConfirmedAt:at,freshnessStatus:publicFreshness(at),updatedAt:at};
    const update=c.env.DB.prepare("UPDATE listings SET availability_status=?,last_confirmed_at=?,updated_at=? WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED') AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())").bind(input.availabilityStatus,at,at,listing.id,listing.ownerId,listing.id,lease);
    return {update,auditAction:'ADMIN_ASSISTED_AVAILABILITY_UPDATED',metadata:{availabilityStatus:input.availabilityStatus},snapshot,auditWhere:"l.id=? AND owner.role='OWNER' AND changes()=1 AND l.updated_at=? AND l.status IN ('DRAFT','REJECTED') AND l.availability_status=? AND l.last_confirmed_at=?",auditArgs:[listing.id,at,input.availabilityStatus,at]};
  }).catch((error:any)=>assistedMutationError(c,error,()=> 'listing is not editable'));
});
app.post('/admin/listings/assisted/:id/reconfirm',async c=>runAssistedMutation(c,'RECONFIRM',{},(listing,lease,at)=>{
  if(!['DRAFT','REJECTED'].includes(listing.status))throw Object.assign(new Error('listing is not editable'),{status:409});
  const snapshot={...listing.snapshot,lastConfirmedAt:at,freshnessStatus:publicFreshness(at),updatedAt:at};
  const update=c.env.DB.prepare("UPDATE listings SET last_confirmed_at=?,updated_at=? WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED') AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())").bind(at,at,listing.id,listing.ownerId,listing.id,lease);
  return {update,auditAction:'ADMIN_ASSISTED_LISTING_RECONFIRMED',metadata:{},snapshot,auditWhere:"l.id=? AND owner.role='OWNER' AND changes()=1 AND l.updated_at=? AND l.last_confirmed_at=? AND l.status IN ('DRAFT','REJECTED')",auditArgs:[listing.id,at,at]};
}).catch((error:any)=>assistedMutationError(c,error,()=> 'listing is not editable')));
app.post('/admin/listings/assisted/:id/submit',async c=>{
  const listingId=c.req.param('id');
  return runAssistedMutation(c,'SUBMIT',{},async(listing,lease,at)=>{
    if(!['DRAFT','REJECTED'].includes(listing.status))throw Object.assign(new Error('listing cannot be submitted in its current status'),{status:409});
    if(!validListingInput(listing))throw Object.assign(new Error('complete all required listing fields before submission'),{status:400});
    if(d1ImageStatus(c)&&listing.hasLegacyMedia)throw Object.assign(new Error('legacy media migration required'),{status:409});
    if(await hasPendingDeleteRecovery(c.env.DB,listingId,listing.ownerId)||await hasPendingReorder(c.env.DB,listing.ownerId,listingId)||await c.env.DB.prepare("SELECT 1 FROM image_operations WHERE listing_id=? AND kind='ADD' AND state IN ('PENDING','NEEDS_REPAIR') LIMIT 1").bind(listingId).first())throw Object.assign(new Error('image operation requires recovery'),{status:503});
    if(listing.status!=='SUBMITTED'){
      const update=c.env.DB.prepare("UPDATE listings SET status='SUBMITTED',rejection_reason=NULL,updated_at=? WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED') AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())").bind(at,listing.id,listing.ownerId,listing.id,lease);
      const snapshot={...listing.snapshot,status:'SUBMITTED',rejectionReason:null,updatedAt:at};
      return {update,auditAction:'ADMIN_ASSISTED_LISTING_SUBMITTED',metadata:{},snapshot,auditWhere:"l.id=? AND owner.role='OWNER' AND changes()=1 AND l.status='SUBMITTED' AND l.updated_at=?",auditArgs:[listing.id,at]};
    }
    throw Object.assign(new Error('listing cannot be submitted in its current status'),{status:409});
  }).catch((error:any)=>assistedMutationError(c,error,error=>error?.message==='complete all required listing fields before submission'?'complete all required listing fields before submission':error?.message==='legacy media migration required'?'legacy media migration required':error?.message==='image operation requires recovery'?'image operation requires recovery':'listing cannot be submitted in its current status'));
});
app.delete('/admin/listings/assisted/:id',async c=>deleteAssistedListing(c));
async function deleteAssistedListing(c:any){
  const listingId=c.req.param('id'),actor=ownerId(c),key=requestKey(c);
  if(!key)return c.json({error:'a valid Idempotency-Key is required'},400);
  const scope=`ADMIN_ASSISTED_DELETE:${listingId}`,requestFingerprint=await fingerprint({action:'ADMIN_ASSISTED_DELETE',listingId});
  let replay:any;try{replay=await mutationReplay(c.env.DB,actor,scope,key,requestFingerprint);}catch{return c.json({error:'assisted deletion outcome unavailable; retry with the same idempotency key'},503);}
  if(replay?.conflict)return c.json({error:'idempotency key reused with a different assisted deletion'},409);
  if(replay?.pending)return c.json({error:'assisted deletion requires recovery; retry with the same idempotency key'},503);
  if(replay)return c.json(replay.result,200);
  const exists=await c.env.DB.prepare("SELECT l.status FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=? AND u.role='OWNER'").bind(listingId).first() as any;
  if(!exists||!['DRAFT','REJECTED'].includes(exists.status))return c.json({message:'Listing not found'},404);
  if(await hasUnsupportedExternalMedia(c.env.DB,listingId,c.env.MEDIA_STRATEGY))return c.json({code:'MEDIA_DELETE_UNSUPPORTED',error:'listing deletion is unavailable because this media configuration cannot guarantee safe cleanup'},409);
  const lease=await lock(c.env.DB,listingId);if(!lease)return c.json({error:'listing is busy; retry with the same idempotency key'},409);
  try{
    const listing=await c.env.DB.prepare("SELECT l.id,l.owner_id AS ownerId,l.status,u.email AS ownerEmail FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=? AND u.role='OWNER'").bind(listingId).first() as any;
    if(!listing||!['DRAFT','REJECTED'].includes(listing.status))return c.json({message:'Listing not found'},404);
    if(await hasUnsupportedExternalMedia(c.env.DB,listingId,c.env.MEDIA_STRATEGY))return c.json({code:'MEDIA_DELETE_UNSUPPORTED',error:'listing deletion is unavailable because this media configuration cannot guarantee safe cleanup'},409);
    if(d1ImageStatus(c)&&await hasLegacyD1Images(c.env.DB,listingId))return legacyD1Conflict(c);
    const snapshot=await sourceAdminListing(c.env.DB,listingId,c.env.MEDIA_STRATEGY);if(!snapshot)return c.json({message:'Listing not found'},404);
    const at=now(),eventId=id(),resultJson=JSON.stringify(snapshot);
    const remove=c.env.DB.prepare("DELETE FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED') AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch()) AND EXISTS(SELECT 1 FROM users WHERE id=? AND role='OWNER')").bind(listingId,listing.ownerId,listingId,lease,listing.ownerId);
    const audit=c.env.DB.prepare("INSERT INTO admin_audit_events(id,actor_id,entity_type,entity_id,listing_id,target_owner_id,action,metadata,reason,created_at) SELECT ?,?,'LISTING',?,?,?,'ADMIN_ASSISTED_LISTING_DELETED','{}',NULL,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM users WHERE id=? AND role='ADMIN') AND EXISTS(SELECT 1 FROM users WHERE id=? AND role='OWNER')").bind(eventId,actor,listingId,listingId,listing.ownerId,at,actor,listing.ownerId);
    const receipt=c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,result_json,created_at,updated_at) SELECT ?,?,?,?,?, 'COMMITTED',?,?,? WHERE EXISTS(SELECT 1 FROM admin_audit_events WHERE id=? AND actor_id=? AND action='ADMIN_ASSISTED_LISTING_DELETED' AND listing_id=? AND target_owner_id=?)").bind(actor,scope,key,requestFingerprint,listingId,resultJson,at,at,eventId,actor,listingId,listing.ownerId);
    let results:D1Result[];try{results=await c.env.DB.batch([remove,audit,receipt]) as D1Result[];}catch{return c.json({error:'assisted deletion outcome unknown; retry with the same idempotency key'},503);}
    if(results.length!==3||!results[0]?.meta?.changes||results[1]?.meta?.changes!==1||results[2]?.meta?.changes!==1)return c.json({error:'assisted listing changed; reload and retry'},409);
    return c.json(snapshot,200);
  }finally{await unlock(c.env.DB,listingId,lease);}
}
async function sourceAdminListing(db:D1Database,listingId:string,mediaStrategy?:string){
  const listing=await db.prepare(`SELECT l.id,l.title,l.description,l.location,l.price_amount AS priceAmount,l.price_period AS pricePeriod,l.rental_duration AS rentalDuration,l.max_occupants AS maxOccupants,l.currency,l.deposit_status AS depositStatus,l.deposit_amount AS depositAmount,l.deposit_currency AS depositCurrency,l.internet_included AS internetIncluded,l.water_included AS waterIncluded,l.electricity_included AS electricityIncluded,l.gas_included AS gasIncluded,l.pets_policy AS petsPolicy,l.available_from AS availableFrom,l.status,l.publication_status AS publicationStatus,l.availability_status AS availabilityStatus,l.last_confirmed_at AS lastConfirmedAt,l.rejection_reason AS rejectionReason,l.created_at AS createdAt,l.updated_at AS updatedAt,u.id AS ownerId,u.email AS ownerEmail,u.role AS ownerRole FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=?`).bind(listingId).first<any>();
  if(!listing||listing.ownerRole!=='OWNER')return null;
  const staticImages=(await db.prepare('SELECT id,asset_path AS url,mime_type AS contentType,byte_size AS sizeBytes,position FROM static_listing_images WHERE listing_id=?').bind(listingId).all<any>()).results.map(image=>({...image,originalName:image.url.split('/').pop()??image.url}));
  const usesD1Blob=mediaStrategy==='D1_BLOB';
  const storedImages=(await db.prepare(`SELECT id,original_name AS originalName,mime_type AS contentType,byte_size AS sizeBytes,position FROM listing_images WHERE listing_id=?${usesD1Blob?' AND blob_data IS NOT NULL':''}`).bind(listingId).all<any>()).results.map(image=>({...image,url:`/admin/listings/${encodeURIComponent(listingId)}/images/${encodeURIComponent(image.id)}`}));
  const legacyMedia=usesD1Blob?await db.prepare('SELECT EXISTS(SELECT 1 FROM listing_images WHERE listing_id=? AND blob_data IS NULL) AS hasLegacy').bind(listingId).first<{hasLegacy:number}>():null;
  const images=(mediaStrategy==='STATIC_ASSETS'?staticImages:[...staticImages,...storedImages]).sort((a:any,b:any)=>a.position-b.position||a.id.localeCompare(b.id));
  const {ownerId,ownerEmail,ownerRole,...fields}=listing;
  return {...fields,freshnessStatus:publicFreshness(fields.lastConfirmedAt),owner:{id:ownerId,email:ownerEmail,role:ownerRole},images,...(usesD1Blob?{requiresMediaRecovery:!!legacyMedia?.hasLegacy}:{})};
}
function sourceAuditInsert(c:any,eventId:string,listingId:string,action:string,reason:string|null,at:string,whereSql:string,whereArgs:unknown[],metadataValue?:Record<string,unknown>){
  const metadata=JSON.stringify(metadataValue??(reason?{reason}:{}));
  return c.env.DB.prepare(`INSERT INTO admin_audit_events(id,actor_id,entity_type,entity_id,listing_id,target_owner_id,action,metadata,reason,created_at) SELECT ?,?,'LISTING',l.id,l.id,l.owner_id,?,?,?,? FROM listings l JOIN users owner ON owner.id=l.owner_id WHERE ${whereSql}`).bind(eventId,c.get('user').id,action,metadata,reason,at,...whereArgs);
}
async function adminReviewSource(c:any,actionValue:'approve'|'reject',providedInput?:any){
  const listingId=c.req.param('id'),input=actionValue==='reject'?(providedInput??await c.req.json().catch(()=>null)):null;
  const reason=actionValue==='reject'&&typeof input?.reason==='string'?input.reason.trim():null;
  if(actionValue==='reject'&&(reason===null||reason.length<3||reason.length>1000))return c.json({error:'rejection reason must contain 3 to 1000 non-blank characters'},400);
  const current=await c.env.DB.prepare('SELECT l.status,l.publication_status AS publicationStatus,l.rejection_reason AS rejectionReason,u.role AS ownerRole,EXISTS(SELECT 1 FROM listing_images i WHERE i.listing_id=l.id AND i.blob_data IS NULL) AS hasLegacyMedia FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=?').bind(listingId).first() as any;
  if(!current||current.ownerRole!=='OWNER')return c.json({message:'Listing not found'},404);
  if(actionValue==='approve'&&d1ImageStatus(c)&&current.hasLegacyMedia)return legacyD1Conflict(c);
  const at=now(),eventId=id(),action=actionValue==='approve'?'ADMIN_LISTING_APPROVED':'ADMIN_LISTING_REJECTED',status=actionValue==='approve'?'APPROVED':'REJECTED';
  if((actionValue==='approve'&&current.status==='APPROVED')||(actionValue==='reject'&&current.status==='REJECTED'&&current.rejectionReason===reason)){
    const conditions=actionValue==='approve'?"l.status='APPROVED'":"l.status='REJECTED' AND l.rejection_reason=?",args=actionValue==='approve'?[]:[reason];
    try{const results=await c.env.DB.batch([sourceAuditInsert(c,eventId,listingId,action,reason,at,`l.id=? AND owner.role='OWNER' AND ${conditions}`,[listingId,...args])]);if(results[0]?.meta?.changes!==1)return c.json({error:'listing changed during review'},409);}
    catch{return c.json({error:'review outcome could not be confirmed'},503);}
    const result=await sourceAdminListing(c.env.DB,listingId,c.env.MEDIA_STRATEGY);return result?c.json(result):c.json({message:'Listing not found'},404);
  }
  if(actionValue==='reject'&&current.status==='REJECTED')return c.json({error:'listing already rejected with another reason'},409);
  if(current.status!=='SUBMITTED')return c.json({error:'listing is no longer awaiting review'},409);
  const updated=actionValue==='approve'
    ? c.env.DB.prepare("UPDATE listings SET status='APPROVED',rejection_reason=NULL,updated_at=? WHERE id=? AND status='SUBMITTED' AND EXISTS (SELECT 1 FROM users WHERE users.id=listings.owner_id AND users.role='OWNER')").bind(at,listingId)
    : c.env.DB.prepare("UPDATE listings SET status='REJECTED',rejection_reason=?,updated_at=? WHERE id=? AND status='SUBMITTED' AND EXISTS (SELECT 1 FROM users WHERE users.id=listings.owner_id AND users.role='OWNER')").bind(reason,at,listingId);
  const audit=sourceAuditInsert(c,eventId,listingId,action,reason,at,`l.id=? AND owner.role='OWNER' AND changes()=1 AND l.status=? AND l.updated_at=?`,[listingId,status,at]);
  try{
    const results=await c.env.DB.batch([updated,audit]);
    if(results[0]?.meta?.changes!==1||results[1]?.meta?.changes!==1)return c.json({error:'listing changed during review'},409);
  }catch{return c.json({error:'review outcome could not be confirmed'},503);}
  const result=await sourceAdminListing(c.env.DB,listingId,c.env.MEDIA_STRATEGY);return result?c.json(result):c.json({message:'Listing not found'},404);
}
app.post('/admin/listings/:id/review',async c=>{const input=await c.req.json().catch(()=>null) as any;if(!input||!['approve','reject'].includes(input.action))return c.json({error:'invalid review action'},400);if(input.action==='approve'&&input.reason!==undefined)return c.json({error:'approval does not accept a rejection reason'},400);return adminReviewSource(c,input.action,input);});
app.post('/admin/listings/:id/approve',c=>adminReviewSource(c,'approve'));
app.post('/admin/listings/:id/reject',c=>adminReviewSource(c,'reject'));
app.post('/admin/listings/:id/publish',async c=>{
  const listingId=c.req.param('id');
  const current=await c.env.DB.prepare('SELECT l.status,l.publication_status AS publicationStatus,u.role AS ownerRole,EXISTS(SELECT 1 FROM listing_images i WHERE i.listing_id=l.id AND i.blob_data IS NULL) AS hasLegacyMedia FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=?').bind(listingId).first() as any;
  if(!current||current.ownerRole!=='OWNER')return c.json({message:'Listing not found'},404);
  if(d1ImageStatus(c)&&current.hasLegacyMedia)return legacyD1Conflict(c);
  const at=now(),eventId=id(),action='ADMIN_LISTING_PUBLISHED';
  if(current.status==='APPROVED'&&current.publicationStatus==='PUBLISHED'){
    try{const results=await c.env.DB.batch([sourceAuditInsert(c,eventId,listingId,action,null,at,"l.id=? AND owner.role='OWNER' AND l.status='APPROVED' AND l.publication_status='PUBLISHED'",[listingId])]);if(results[0]?.meta?.changes!==1)return c.json({error:'listing changed during publication'},409);}
    catch{return c.json({error:'publication outcome could not be confirmed'},503);}
    const result=await sourceAdminListing(c.env.DB,listingId,c.env.MEDIA_STRATEGY);return result?c.json(result):c.json({message:'Listing not found'},404);
  }
  if(current.status!=='APPROVED'||current.publicationStatus!=='UNPUBLISHED')return c.json({error:'only an approved unpublished listing can be published'},409);
  const updated=c.env.DB.prepare("UPDATE listings SET publication_status='PUBLISHED',updated_at=? WHERE id=? AND status='APPROVED' AND publication_status='UNPUBLISHED' AND EXISTS (SELECT 1 FROM users WHERE users.id=listings.owner_id AND users.role='OWNER')").bind(at,listingId);
  const audit=sourceAuditInsert(c,eventId,listingId,action,null,at,"l.id=? AND owner.role='OWNER' AND changes()=1 AND l.status='APPROVED' AND l.publication_status='PUBLISHED' AND l.updated_at=?",[listingId,at]);
  try{const results=await c.env.DB.batch([updated,audit]);if(results[0]?.meta?.changes!==1||results[1]?.meta?.changes!==1)return c.json({error:'only an approved unpublished listing can be published'},409);}
  catch{return c.json({error:'publication outcome could not be confirmed'},503);}
  const result=await sourceAdminListing(c.env.DB,listingId,c.env.MEDIA_STRATEGY);return result?c.json(result):c.json({message:'Listing not found'},404);
});
app.get('/admin/listings/audit',async c=>{
  const listingId=c.req.query('listingId'),requestedLimit=Number(c.req.query('limit')??50);
  if(!Number.isInteger(requestedLimit))return c.json({error:'limit must be an integer'},400);
  const limit=Math.min(Math.max(requestedLimit||50,1),100);
  const columns='SELECT a.id,a.entity_type AS entityType,a.entity_id AS entityId,a.listing_id AS listingId,a.target_owner_id AS targetOwnerId,a.metadata,a.action,a.reason,a.created_at AS createdAt,u.id AS actorId,u.email AS actorEmail,o.email AS targetOwnerEmail FROM admin_audit_events a JOIN users u ON u.id=a.actor_id LEFT JOIN users o ON o.id=a.target_owner_id';
  const rows=listingId
    ? (await c.env.DB.prepare(`${columns} WHERE a.listing_id=? ORDER BY a.created_at DESC,a.id DESC LIMIT ?`).bind(listingId,limit).all<any>()).results
    : (await c.env.DB.prepare(`${columns} ORDER BY a.created_at DESC,a.id DESC LIMIT ?`).bind(limit).all<any>()).results;
  return c.json(rows.map(row=>({...row,metadata:JSON.parse(row.metadata),actor:{id:row.actorId,email:row.actorEmail,role:'ADMIN'},targetOwner:row.targetOwnerId?{id:row.targetOwnerId,email:row.targetOwnerEmail,role:'OWNER'}:null})));
});
app.get('/admin/listings/:id',async c=>{const result=await sourceAdminListing(c.env.DB,c.req.param('id'),c.env.MEDIA_STRATEGY);return result?c.json(result):c.json({message:'Listing not found'},404);});
app.get('/admin/listings/:listingId/images/:imageId',async c=>{
  const listingId=c.req.param('listingId'),imageId=c.req.param('imageId');
  if(c.env.MEDIA_STRATEGY==='STATIC_ASSETS'){
    const row=await c.env.DB.prepare("SELECT i.asset_path AS url FROM static_listing_images i JOIN listings l ON l.id=i.listing_id JOIN users owner ON owner.id=l.owner_id WHERE i.listing_id=? AND i.id=? AND owner.role='OWNER'").bind(listingId,imageId).first<{url:string}>();
    return row?c.redirect(row.url,302):c.json({error:'image not found'},404);
  }
  if(d1ImageStatus(c)){
    const row=await c.env.DB.prepare("SELECT i.blob_data,i.mime_type,i.byte_size FROM listing_images i JOIN listings l ON l.id=i.listing_id JOIN users owner ON owner.id=l.owner_id WHERE i.listing_id=? AND i.id=? AND owner.role='OWNER'").bind(listingId,imageId).first<any>();
    if(!row)return c.json({error:'image not found'},404);const bytes=d1BlobBytes(row.blob_data);if(!bytes||bytes.byteLength!==row.byte_size)return c.json({error:'image data unavailable'},503);return imageResponse(bytes,row.mime_type,true);
  }
  const row=await c.env.DB.prepare("SELECT i.object_key AS objectKey,i.mime_type AS mimeType,i.byte_size AS byteSize FROM listing_images i JOIN listings l ON l.id=i.listing_id JOIN users owner ON owner.id=l.owner_id WHERE i.listing_id=? AND i.id=? AND owner.role='OWNER'").bind(listingId,imageId).first<any>();
  if(!row)return c.json({error:'image not found'},404);const object=await c.env.IMAGES.get(row.objectKey);return object?new Response(object.body,{headers:{'Content-Type':row.mimeType,'Content-Length':String(row.byteSize),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}}):c.json({error:'image not found'},404);
});
app.get('/listings',async c=>{const rows=await c.env.DB.prepare('SELECT id,owner_id AS ownerId,status,title,description,location,price_amount AS priceAmount,price_period AS pricePeriod,rental_duration AS rentalDuration,max_occupants AS maxOccupants,currency,deposit_status AS depositStatus,deposit_amount AS depositAmount,deposit_currency AS depositCurrency,internet_included AS internetIncluded,water_included AS waterIncluded,electricity_included AS electricityIncluded,gas_included AS gasIncluded,pets_policy AS petsPolicy,available_from AS availableFrom,publication_status AS publicationStatus,availability_status AS availabilityStatus,last_confirmed_at AS lastConfirmedAt,rejection_reason AS rejectionReason,created_at AS createdAt,updated_at AS updatedAt FROM listings WHERE owner_id=? ORDER BY updated_at DESC').bind(c.get('user').id).all();return c.json(rows.results);});
app.get('/listings/:id',async c=>{const listing=await ownerListing(c.env.DB,c.req.param('id'),ownerId(c));return listing?c.json(listing):c.json({error:'not found'},404);});

type ListingRevision = {
  listingId:string;ownerId:string;state:'DRAFT'|'SUBMITTED'|'REJECTED'|'APPROVED'|'APPLIED';
  payload:string;baseUpdatedAt:string;version:number;rejectionReason:string|null;
  createdAt:string;updatedAt:string;reviewedAt:string|null;appliedAt:string|null;
};
// D1 batch is transactional, but a zero-row guarded UPDATE does not raise by itself.
// The statement below raises on a zero-row predecessor so the entire batch rolls back.
const revisionAtomicGuard="SELECT json_extract('REVISION_ATOMIC_ASSERT_INVALID_JSON','$.failed') WHERE changes()!=1";
const revisionColumns="listing_id AS listingId,owner_id AS ownerId,state,payload,base_updated_at AS baseUpdatedAt,version,rejection_reason AS rejectionReason,created_at AS createdAt,updated_at AS updatedAt,reviewed_at AS reviewedAt,applied_at AS appliedAt";
const revisionFields=['title','description','location','priceAmount','pricePeriod','rentalDuration','maxOccupants','currency',...TERM_FIELDS] as const;
function proposedRevisionFields(value:any){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!(revisionFields as readonly string[]).includes(key)))return null;
  const fields={...value,...rentalTerms(value)};
  return validListingInput(fields)?fields:null;
}
function revisionDto(row:ListingRevision|null){
  if(!row)return null;
  const {payload,...meta}=row;
  return {...meta,fields:JSON.parse(payload)};
}
async function getListingRevision(db:D1Database,lid:string){
  return db.prepare('SELECT '+revisionColumns+' FROM listing_change_revisions WHERE listing_id=?').bind(lid).first<ListingRevision>();
}
// A published listing is NEVER modified by the OWNER revision endpoints.
app.get('/listings/:id/revision',async c=>{
  const lid=c.req.param('id');
  const listing=await ownerListing(c.env.DB,lid,ownerId(c));
  if(!listing)return c.json({error:'not found'},404);
  if(listing.status!=='APPROVED')return c.json({error:'only approved listings can have change proposals'},409);
  return c.json({listingUpdatedAt:listing.updatedAt,revision:revisionDto(await getListingRevision(c.env.DB,lid))});
});
app.put('/listings/:id/revision',async c=>{
  const lid=c.req.param('id'),owner=ownerId(c),input=await boundedJson(c.req.raw,12000) as any;
  if(!input||Object.keys(input).some(key=>!['expectedVersion','baseUpdatedAt','fields'].includes(key))||
    !Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0||
    typeof input.baseUpdatedAt!=='string'||input.baseUpdatedAt.length>40||
    !Number.isFinite(Date.parse(input.baseUpdatedAt)))return c.json({error:'expectedVersion, baseUpdatedAt and fields required'},400);
  const proposed=proposedRevisionFields(input.fields);
  if(!proposed)return c.json({error:'invalid proposed listing fields'},400);
  const listing=await ownerListing(c.env.DB,lid,owner);
  if(!listing)return c.json({error:'not found'},404);
  if(listing.status!=='APPROVED'||listing.publicationStatus!=='PUBLISHED')return c.json({error:'listing must be published before proposing changes'},409);
  const lease=await lock(c.env.DB,lid);if(!lease)return c.json({error:'listing busy; retry'},409);
  try{
    const current=await ownerListing(c.env.DB,lid,owner);
    if(!current||current.status!=='APPROVED'||current.publicationStatus!=='PUBLISHED'||current.updatedAt!==input.baseUpdatedAt)return c.json({error:'listing changed or is not publicly published; reload before editing'},409);
    const previous=await getListingRevision(c.env.DB,lid);
    if(previous && (previous.version!==input.expectedVersion||!['DRAFT','REJECTED','APPLIED'].includes(previous.state)))return c.json({error:'revision changed or awaiting review'},409);
    if(!previous && input.expectedVersion!==0)return c.json({error:'revision already changed'},409);
    const at=monotonicTimestamp(previous?.updatedAt??current.updatedAt),payload=JSON.stringify(proposed);
    const result=previous
      ? await c.env.DB.prepare("UPDATE listing_change_revisions SET state='DRAFT',payload=?,base_updated_at=?,version=version+1,rejection_reason=NULL,updated_at=?,reviewed_at=NULL,applied_at=NULL WHERE listing_id=? AND owner_id=? AND version=? AND state IN ('DRAFT','REJECTED','APPLIED') AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())").bind(payload,current.updatedAt,at,lid,owner,input.expectedVersion,lid,lease).run()
      : await c.env.DB.prepare("INSERT INTO listing_change_revisions(listing_id,owner_id,state,payload,base_updated_at,version,created_at,updated_at) SELECT ?,?,'DRAFT',?,?,1,?,? WHERE EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch()) AND EXISTS(SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status='APPROVED' AND updated_at=?)").bind(lid,owner,payload,current.updatedAt,at,at,lid,lease,lid,owner,current.updatedAt).run();
    if(result.meta.changes!==1)return c.json({error:'revision save conflict'},409);
    return c.json({revision:revisionDto(await getListingRevision(c.env.DB,lid))});
  }catch{return c.json({error:'revision save unavailable; no public listing changes'},503);}
  finally{await unlock(c.env.DB,lid,lease);}
});
app.post('/listings/:id/revision/submit',async c=>{
  const lid=c.req.param('id'),owner=ownerId(c),input=await boundedJson(c.req.raw,512) as any;
  if(!input||Object.keys(input).some(key=>key!=='expectedVersion')||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1)return c.json({error:'expectedVersion required'},400);
  const listing=await ownerListing(c.env.DB,lid,owner);if(!listing)return c.json({error:'not found'},404);
  const lease=await lock(c.env.DB,lid);if(!lease)return c.json({error:'listing busy; retry'},409);
  try{
    const current=await ownerListing(c.env.DB,lid,owner),revision=await getListingRevision(c.env.DB,lid);
    if(!current||current.status!=='APPROVED'||current.publicationStatus!=='PUBLISHED'||!revision||revision.ownerId!==owner||revision.state!=='DRAFT'||revision.version!==input.expectedVersion||revision.baseUpdatedAt!==current.updatedAt)return c.json({error:'revision requires a published listing and a current saved draft'},409);
    if(!proposedRevisionFields(JSON.parse(revision.payload)))return c.json({error:'invalid stored revision'},409);
    const at=monotonicTimestamp(revision.updatedAt);
    const result=await c.env.DB.prepare("UPDATE listing_change_revisions SET state='SUBMITTED',version=version+1,updated_at=? WHERE listing_id=? AND owner_id=? AND state='DRAFT' AND version=? AND base_updated_at=? AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())").bind(at,lid,owner,input.expectedVersion,current.updatedAt,lid,lease).run();
    if(result.meta.changes!==1)return c.json({error:'revision changed during submission'},409);
    return c.json({revision:revisionDto(await getListingRevision(c.env.DB,lid))});
  }catch{return c.json({error:'revision submission unavailable'},503);}
  finally{await unlock(c.env.DB,lid,lease);}
});

app.patch('/listings/:id/availability',async c=>{const input=await boundedJson(c.req.raw,1024) as any;if(!input||Object.keys(input).some(key=>key!=='availabilityStatus')||!['AVAILABLE','UNAVAILABLE'].includes(input.availabilityStatus))return c.json({error:'availabilityStatus must be AVAILABLE or UNAVAILABLE'},400);return updateOwnerAvailability(c,c.req.param('id'),input.availabilityStatus);});
app.post('/listings/:id/reconfirm',async c=>updateOwnerAvailability(c,c.req.param('id')));
async function updateOwnerAvailability(c:any,listingId:string,availabilityStatus?:'AVAILABLE'|'UNAVAILABLE'){
  const owner=ownerId(c),existing=await ownerListing(c.env.DB,listingId,owner);if(!existing)return c.json({error:'not found'},404);
  const lease=await lock(c.env.DB,listingId);if(!lease)return c.json({error:'listing is busy; retry with the same idempotency key'},409);
  try{
    const current=await ownerListing(c.env.DB,listingId,owner);if(!current)return c.json({error:'not found'},404);
    const at=monotonicTimestamp(current.updatedAt);
    const update=availabilityStatus
      ?c.env.DB.prepare("UPDATE listings SET availability_status=?,last_confirmed_at=?,updated_at=? WHERE id=? AND owner_id=? AND updated_at=? AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())").bind(availabilityStatus,at,at,listingId,owner,current.updatedAt,listingId,lease)
      :c.env.DB.prepare("UPDATE listings SET last_confirmed_at=?,updated_at=? WHERE id=? AND owner_id=? AND updated_at=? AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())").bind(at,at,listingId,owner,current.updatedAt,listingId,lease);
    const revision=await getListingRevision(c.env.DB,listingId);
    if(revision&&revision.baseUpdatedAt===current.updatedAt){
      const rebase=c.env.DB.prepare("UPDATE listing_change_revisions SET base_updated_at=? WHERE listing_id=? AND owner_id=? AND state=? AND version=? AND base_updated_at=? AND EXISTS(SELECT 1 FROM listings WHERE id=? AND owner_id=? AND status='APPROVED' AND publication_status='PUBLISHED' AND updated_at=?) AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())").bind(at,listingId,owner,revision.state,revision.version,current.updatedAt,listingId,owner,at,listingId,lease);
      const results=await c.env.DB.batch([update,rebase,c.env.DB.prepare(revisionAtomicGuard)]) as D1Result[];
      if(results.length!==3||results[0]?.meta?.changes!==1||results[1]?.meta?.changes!==1)return c.json({error:'revision changed during availability update; reload and retry'},409);
    }else if((await update.run()).meta.changes!==1)return c.json({error:'listing changed; retry with the same idempotency key'},409);
    return c.json(await ownerListing(c.env.DB,listingId,owner));
  }catch{return c.json({error:'availability update outcome uncertain; reload before retry'},503);}
  finally{await unlock(c.env.DB,listingId,lease);}
}
app.get('/owner/contact-events',async c=>{
  const owner=ownerId(c),afterCreatedAt=c.req.query('afterCreatedAt'),afterId=c.req.query('afterId'),hasCursor=afterCreatedAt!==undefined||afterId!==undefined;
  if(hasCursor&&(!afterCreatedAt||!afterId||afterCreatedAt.length>40||afterId.length>128||!Number.isFinite(Date.parse(afterCreatedAt))))return c.json({error:'invalid contact cursor'},400);
  const cursorClause=hasCursor?' AND (e.created_at<? OR (e.created_at=? AND e.id<?))':'';
  const query=`SELECT e.id,e.state,e.visitor_name AS visitorName,e.visitor_email AS visitorEmail,e.message,e.created_at AS createdAt,l.id AS listingId,l.title AS listingTitle,l.location AS listingLocation FROM contact_events e JOIN listings l ON l.id=e.listing_id WHERE e.owner_id=? AND l.owner_id=?${cursorClause} ORDER BY e.created_at DESC,e.id DESC LIMIT 31`;
  const rows=(hasCursor?await c.env.DB.prepare(query).bind(owner,owner,afterCreatedAt,afterCreatedAt,afterId).all<any>():await c.env.DB.prepare(query).bind(owner,owner).all<any>()).results;
  const hasMore=rows.length>30,items=rows.slice(0,30);
  const count=await c.env.DB.prepare("SELECT COUNT(*) AS unreadCount FROM contact_events e JOIN listings l ON l.id=e.listing_id WHERE e.owner_id=? AND l.owner_id=? AND e.state='UNREAD'").bind(owner,owner).first<{unreadCount:number}>();
  return c.json({items:items.map(row=>({id:row.id,state:row.state,visitorName:row.visitorName,visitorEmail:row.visitorEmail,message:row.message,createdAt:row.createdAt,listing:{id:row.listingId,title:row.listingTitle,location:row.listingLocation}})),unreadCount:count?.unreadCount??0,nextCursor:hasMore?{createdAt:items.at(-1)!.createdAt,id:items.at(-1)!.id}:null});
});
app.patch('/owner/contact-events/:id/state',async c=>{const input=await boundedJson(c.req.raw,1024) as any;if(!input||Object.keys(input).length!==1||!['UNREAD','READ'].includes(input.state))return c.json({error:'state must be UNREAD or READ'},400);const event=await c.env.DB.prepare('SELECT e.id,e.state,e.visitor_name AS visitorName,e.visitor_email AS visitorEmail,e.message,e.created_at AS createdAt,l.id AS listingId,l.title AS listingTitle,l.location AS listingLocation FROM contact_events e JOIN listings l ON l.id=e.listing_id WHERE e.id=? AND e.owner_id=? AND l.owner_id=?').bind(c.req.param('id'),ownerId(c),ownerId(c)).first<any>();if(!event)return c.json({error:'contact event not found'},404);const updated=await c.env.DB.prepare('UPDATE contact_events SET state=? WHERE id=? AND owner_id=? AND EXISTS(SELECT 1 FROM listings WHERE listings.id=contact_events.listing_id AND listings.owner_id=?)').bind(input.state,event.id,ownerId(c),ownerId(c)).run();if(updated.meta.changes!==1)return c.json({error:'contact event not found'},404);return c.json({id:event.id,state:input.state,visitorName:event.visitorName,visitorEmail:event.visitorEmail,message:event.message,createdAt:event.createdAt,listing:{id:event.listingId,title:event.listingTitle,location:event.listingLocation}});});
function validListingInput(x:any){
  if(!x||typeof x.title!=='string'||x.title.length<1||x.title.length>120||typeof x.description!=='string'||x.description.length>5000||typeof x.location!=='string'||x.location.length<1||x.location.length>240||!Number.isInteger(x.priceAmount)||x.priceAmount<0||x.priceAmount>2147483647||!['WEEK','MONTH'].includes(x.pricePeriod)||!['WEEKS','MONTHS','PERMANENT','FLEXIBLE'].includes(x.rentalDuration)||!Number.isInteger(x.maxOccupants)||x.maxOccupants<1||x.maxOccupants>2147483647||!['ARS','USD'].includes(x.currency))return false;
  return validRentalTerms(rentalTerms(x))&&(x.pricePeriod==='MONTH'||!hasDeclaredRentalTerms(x));
}
app.post('/listings',async c=>{
  const input=await c.req.json().catch(()=>null) as any;
  const x=input?{...input,...rentalTerms(input)}:null;
  if(!validListingInput(x))return c.json({error:'validation failed'},400);
  const user=c.get('user'), supplied=requestKey(c);if(supplied===false)return c.json({error:'invalid idempotency key'},400);
  // Preserve the pre-M2.1 fingerprint when an older client replays a create
  // request without the new fields. Requests that declare terms bind them into
  // the fingerprint so reusing a key with changed terms remains a conflict.
  const fingerprintInput={title:x.title,description:x.description,location:x.location,priceAmount:x.priceAmount,pricePeriod:x.pricePeriod,rentalDuration:x.rentalDuration,maxOccupants:x.maxOccupants,currency:x.currency,...(TERM_FIELDS.some(key=>Object.prototype.hasOwnProperty.call(input,key))?rentalTerms(x):{})};
  const requestFingerprint=await fingerprint(fingerprintInput);
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
  const insert=c.env.DB.prepare("INSERT INTO listings(id,owner_id,status,title,description,location,location_search,price_amount,price_period,rental_duration,max_occupants,currency,deposit_status,deposit_amount,deposit_currency,internet_included,water_included,electricity_included,gas_included,pets_policy,available_from,created_at,updated_at) VALUES(?,?,'DRAFT',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(listingId,user.id,x.title,x.description,x.location,x.location.normalize('NFC').toLowerCase(),x.priceAmount,x.pricePeriod,x.rentalDuration,x.maxOccupants,x.currency,x.depositStatus,x.depositAmount,x.depositCurrency,x.internetIncluded,x.waterIncluded,x.electricityIncluded,x.gasIncluded,x.petsPolicy,x.availableFrom,t,t);
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
async function ownerListing(db:D1Database,listingId:string,owner:string){return db.prepare("SELECT id,owner_id AS ownerId,status,title,description,location,price_amount AS priceAmount,price_period AS pricePeriod,rental_duration AS rentalDuration,max_occupants AS maxOccupants,currency,deposit_status AS depositStatus,deposit_amount AS depositAmount,deposit_currency AS depositCurrency,internet_included AS internetIncluded,water_included AS waterIncluded,electricity_included AS electricityIncluded,gas_included AS gasIncluded,pets_policy AS petsPolicy,available_from AS availableFrom,publication_status AS publicationStatus,availability_status AS availabilityStatus,last_confirmed_at AS lastConfirmedAt,rejection_reason AS rejectionReason,created_at AS createdAt,updated_at AS updatedAt FROM listings WHERE id=? AND owner_id=?").bind(listingId,owner).first<any>();}
app.delete('/listings/:id',async c=>{
  const listingId=c.req.param('id'),owner=ownerId(c),key=requestKey(c);
  if(!key)return c.json({error:'a valid Idempotency-Key is required'},400);
  const scope=`OWNER_LISTING_DELETE:${listingId}`,requestFingerprint=await fingerprint({action:'DELETE_LISTING',listingId});
  let replay:any;try{replay=await mutationReplay(c.env.DB,owner,scope,key,requestFingerprint);}catch{return c.json({error:'listing delete outcome unavailable; retry with the same idempotency key'},503);}
  if(replay?.conflict)return c.json({error:'idempotency key reused with a different delete'},409);
  if(replay?.pending)return c.json({error:'listing delete requires recovery; retry with the same idempotency key'},503);
  if(replay)return c.json(replay.result,200);
  const initial=await c.env.DB.prepare("SELECT id,status FROM listings WHERE id=? AND owner_id=?").bind(listingId,owner).first<any>();
  if(!initial||!['DRAFT','REJECTED'].includes(initial.status))return c.json({error:'not found'},404);
  if(await hasUnsupportedExternalMedia(c.env.DB,listingId,c.env.MEDIA_STRATEGY))return c.json({code:'MEDIA_DELETE_UNSUPPORTED',error:'listing deletion is unavailable because this media configuration cannot guarantee safe cleanup'},409);
  const lease=await lock(c.env.DB,listingId);if(!lease)return c.json({error:'listing is busy; retry with the same idempotency key'},409);
  try{
    const current=await c.env.DB.prepare("SELECT id,status FROM listings WHERE id=? AND owner_id=?").bind(listingId,owner).first<any>();
    if(!current||!['DRAFT','REJECTED'].includes(current.status))return c.json({error:'not found'},404);
    if(await hasUnsupportedExternalMedia(c.env.DB,listingId,c.env.MEDIA_STRATEGY))return c.json({code:'MEDIA_DELETE_UNSUPPORTED',error:'listing deletion is unavailable because this media configuration cannot guarantee safe cleanup'},409);
    if(d1ImageStatus(c)&&await hasLegacyD1Images(c.env.DB,listingId))return legacyD1Conflict(c);
    const at=now(),snapshot={id:listingId,deleted:true},resultJson=JSON.stringify(snapshot);
    const remove=c.env.DB.prepare("DELETE FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED') AND EXISTS(SELECT 1 FROM users WHERE users.id=listings.owner_id AND users.role='OWNER') AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())").bind(listingId,owner,listingId,lease);
    const receipt=c.env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,result_json,created_at,updated_at) SELECT ?,?,?,?,?, 'COMMITTED',?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM users WHERE id=? AND role='OWNER')").bind(owner,scope,key,requestFingerprint,listingId,resultJson,at,at,owner);
    let results:D1Result[];try{results=await c.env.DB.batch([remove,receipt]) as D1Result[];}catch{return c.json({error:'listing delete outcome unknown; retry with the same idempotency key'},503);}
    if(results.length!==2||!results[0]?.meta?.changes||results[1]?.meta?.changes!==1)return c.json({error:'listing changed; reload and retry'},409);
    return c.json(snapshot,200);
  }finally{await unlock(c.env.DB,listingId,lease);}
});
app.patch('/listings/:id',async c=>{
  const lid=c.req.param('id'),owner=ownerId(c),input=await c.req.json().catch(()=>null) as any;
  if(!input||['priceAmount','pricePeriod','rentalDuration','maxOccupants','currency'].some(key=>input[key]===undefined))return c.json({error:'Rental fields are required'},400);
  if(!await ownerListing(c.env.DB,lid,owner))return c.json({error:'not found'},404);
  const lease=await lock(c.env.DB,lid);if(!lease)return c.json({error:'Listing is busy; retry shortly'},503);
  try{
    const current=await ownerListing(c.env.DB,lid,owner);if(!current||!['DRAFT','REJECTED'].includes(current.status))return c.json({error:'not found'},404);
    const x={...current,...Object.fromEntries(['title','description','location','priceAmount','pricePeriod','rentalDuration','maxOccupants','currency',...TERM_FIELDS].filter(key=>input[key]!==undefined).map(key=>[key,input[key]]))};
    if(x.pricePeriod==='WEEK'&&TERM_FIELDS.every(key=>input[key]===undefined))Object.assign(x,TERM_DEFAULTS);
    if(!validListingInput(x))return c.json({error:'validation failed'},400);
    const result=await c.env.DB.prepare("UPDATE listings SET title=?,description=?,location=?,location_search=?,price_amount=?,price_period=?,rental_duration=?,max_occupants=?,currency=?,deposit_status=?,deposit_amount=?,deposit_currency=?,internet_included=?,water_included=?,electricity_included=?,gas_included=?,pets_policy=?,available_from=?,updated_at=? WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED') AND EXISTS(SELECT 1 FROM listing_locks WHERE listing_id=? AND token=? AND expires_at>unixepoch())").bind(x.title,x.description,x.location,x.location.normalize('NFC').toLowerCase(),x.priceAmount,x.pricePeriod,x.rentalDuration,x.maxOccupants,x.currency,...TERM_FIELDS.map(key=>x[key]),now(),lid,owner,lid,lease).run();
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
function imageDto(x:ImageRow){return {id:x.id,originalName:x.original_name,contentType:x.mime_type,sizeBytes:x.byte_size,position:x.position,createdAt:x.created_at,source:'OWNER_UPLOAD' as const};}
async function ordered(db:D1Database,lid:string){return (await db.prepare('SELECT * FROM listing_images WHERE listing_id=? ORDER BY position').bind(lid).all<ImageRow>()).results;}
async function orderedD1Images(db:D1Database,lid:string){return (await db.prepare('SELECT id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at FROM listing_images WHERE listing_id=? AND blob_data IS NOT NULL ORDER BY position,id').bind(lid).all<ImageRow>()).results;}
async function hasLegacyD1Images(db:D1Database,lid:string){return !!await db.prepare('SELECT 1 FROM listing_images WHERE listing_id=? AND blob_data IS NULL LIMIT 1').bind(lid).first();}
async function hasPublicLegacyD1Images(db:D1Database,lids:string[]){if(!lids.length)return false;const slots=lids.map(()=>'?').join(',');return !!await db.prepare(`SELECT 1 FROM listing_images i JOIN listings l ON l.id=i.listing_id WHERE i.listing_id IN (${slots}) AND i.blob_data IS NULL AND l.status='APPROVED' AND l.publication_status='PUBLISHED' LIMIT 1`).bind(...lids).first();}
function legacyD1Conflict(c:any){return c.json({code:'LEGACY_MEDIA_MIGRATION_REQUIRED',message:'La publicación conserva imágenes de un almacenamiento anterior; necesita migración antes de usar D1 BLOB.'},409);}
function imageResponse(bytes:Uint8Array,type:string,privateImage=true){return new Response(bytes.slice().buffer as ArrayBuffer,{headers:{'Content-Type':type,'Content-Length':String(bytes.byteLength),'Cache-Control':privateImage?'private, no-store':'no-store','X-Content-Type-Options':'nosniff'}});}
function d1ImageStatus(c:any){return c.env.MEDIA_STRATEGY==='D1_BLOB';}
async function hasUnsupportedExternalMedia(db:D1Database,listingId:string,mediaStrategy?:string){
  if(mediaStrategy==='D1_BLOB')return false;
  // Unknown/unset strategies retain the legacy external-object contract. There is
  // no R2 cleanup path in this lab, so refuse whole-listing deletion before any
  // lock, audit, receipt, or cascade can erase recovery provenance.
  if(mediaStrategy!=='STATIC_ASSETS')return true;
  try{
    // STATIC_ASSETS files are repository-managed and are not deleted here. Rows
    // or incomplete operation records from a dynamic/external media workflow are
    // different: this endpoint cannot safely clean or recover those objects.
    const image=await db.prepare('SELECT 1 FROM listing_images WHERE listing_id=? LIMIT 1').bind(listingId).first();
    if(image)return true;
    return !!await db.prepare("SELECT 1 FROM image_operations WHERE listing_id=? AND (cleanup_complete=0 OR state IN ('PENDING','COMMITTED','NEEDS_REPAIR','CLEANUP_PENDING')) LIMIT 1").bind(listingId).first();
  }catch{
    // Media provenance is part of the deletion safety check. An unavailable
    // check must fail closed rather than allow the listing cascade to proceed.
    return true;
  }
}
function monotonicTimestamp(previous:string){const previousMs=Date.parse(previous);return new Date(Math.max(Date.now(),Number.isFinite(previousMs)?previousMs+1:0)).toISOString();}
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
  if(!await validateImageBytes(bytes,type))return c.json({error:'unsupported or invalid JPEG, PNG, or WebP image'},400);
  const owner=ownerId(c),scope=`IMAGE_ADD:${lid}`,contentHash=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.slice().buffer as ArrayBuffer)));
  const requestFingerprint=await fingerprint({listingId:lid,name:originalName,type,size:bytes.byteLength,contentHash});
  const lease=await lock(c.env.DB,lid);if(!lease)return c.json({error:'listing is busy; retry with the same idempotency key'},409);
  try{
    if(!await owned(c,lid))return c.json({error:'not found'},404);
    if(await hasLegacyD1Images(c.env.DB,lid))return legacyD1Conflict(c);
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
    if(await hasLegacyD1Images(c.env.DB,lid))return legacyD1Conflict(c);
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
    if(await hasLegacyD1Images(c.env.DB,lid))return legacyD1Conflict(c);
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
app.get('/listings/:id/images',async c=>{
  const lid=c.req.param('id');if(!await ownerListing(c.env.DB,lid,ownerId(c)))return c.json({error:'not found'},404);
  if(d1ImageStatus(c)&&await hasLegacyD1Images(c.env.DB,lid))return legacyD1Conflict(c);
  const staticRows=(await c.env.DB.prepare('SELECT id,asset_path AS assetPath,mime_type AS contentType,byte_size AS sizeBytes,position FROM static_listing_images WHERE listing_id=? ORDER BY position,id').bind(lid).all<any>()).results.map(row=>({id:row.id,originalName:row.assetPath.split('/').pop()??row.assetPath,contentType:row.contentType,sizeBytes:row.sizeBytes,position:row.position,source:'STATIC_ASSET' as const}));
  const rows=d1ImageStatus(c)?await orderedD1Images(c.env.DB,lid):await ordered(c.env.DB,lid);
  if(!rows.every((row,index)=>row.position===index))return c.json({error:'image ordering requires recovery; retry after recovery'},503);
  const dynamicRows=(c.env.MEDIA_STRATEGY==='STATIC_ASSETS'?[]:rows.map(imageDto));
  return c.json([...staticRows,...dynamicRows].sort((a:any,b:any)=>a.position-b.position||a.id.localeCompare(b.id)));
});
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
app.get('/listings/:id/images/:imageId',async c=>{const lid=c.req.param('id'),imageId=c.req.param('imageId');if(!await ownerListing(c.env.DB,lid,ownerId(c)))return c.json({error:'not found'},404);const staticImage=await c.env.DB.prepare('SELECT asset_path FROM static_listing_images WHERE listing_id=? AND id=?').bind(lid,imageId).first<{asset_path:string}>();if(staticImage){return new Response(null,{status:302,headers:{Location:staticImage.asset_path,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}if(d1ImageStatus(c)){if(await hasLegacyD1Images(c.env.DB,lid))return legacyD1Conflict(c);const row=await c.env.DB.prepare('SELECT blob_data,mime_type,byte_size FROM listing_images WHERE listing_id=? AND id=? AND blob_data IS NOT NULL').bind(lid,imageId).first<any>();if(!row)return c.json({error:'not found'},404);const bytes=d1BlobBytes(row.blob_data);if(!bytes||bytes.byteLength!==row.byte_size)return c.json({error:'image data unavailable'},503);return imageResponse(bytes,row.mime_type,true);}const row=await c.env.DB.prepare('SELECT * FROM listing_images WHERE listing_id=? AND id=?').bind(lid,imageId).first<ImageRow>();if(!row)return c.json({error:'not found'},404);const obj=await c.env.IMAGES.get(row.object_key);if(!obj)return c.json({error:'not found'},404);return new Response(obj.body,{headers:{'Content-Type':row.mime_type,'Content-Length':String(row.byte_size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});});
const PUBLIC_FRESHNESS_MS=30*24*60*60*1000;
const PUBLIC_ENUMS={currency:['ARS','USD'],pricePeriod:['WEEK','MONTH'],rentalDuration:['WEEKS','MONTHS','PERMANENT','FLEXIBLE']} as const;
function publicInteger(value:string|null,min:number,max:number,name:string,defaultValue?:number){if(value===null)return defaultValue; if(!/^(0|[1-9]\d*)$/.test(value))throw Error(`${name} must be an integer`);const parsed=Number(value);if(!Number.isSafeInteger(parsed)||parsed<min||parsed>max)throw Error(`${name} is outside the allowed range`);return parsed;}
function publicFreshness(lastConfirmedAt:string|null){if(!lastConfirmedAt)return 'UNCONFIRMED';const time=Date.parse(lastConfirmedAt);if(!Number.isFinite(time))return 'UNCONFIRMED';return time>Date.now()?'UNCONFIRMED':Date.now()-time<=PUBLIC_FRESHNESS_MS?'FRESH':'STALE';}
function publicDomainStatus(row:any){return row.priceAmount!==null&&row.pricePeriod!==null&&row.rentalDuration!==null&&row.maxOccupants!==null&&row.currency!==null?'COMPLETE':'MISSING';}
function publicListingDto(row:any,images:any[]){return {id:row.id,title:row.title,description:row.description,location:row.location,priceAmount:row.priceAmount,pricePeriod:row.pricePeriod,rentalDuration:row.rentalDuration,maxOccupants:row.maxOccupants,currency:row.currency,depositStatus:row.depositStatus,depositAmount:row.depositAmount,depositCurrency:row.depositCurrency,internetIncluded:row.internetIncluded,waterIncluded:row.waterIncluded,electricityIncluded:row.electricityIncluded,gasIncluded:row.gasIncluded,petsPolicy:row.petsPolicy,availableFrom:row.availableFrom,domainDataStatus:publicDomainStatus(row),availabilityStatus:row.availabilityStatus,lastConfirmedAt:row.lastConfirmedAt,freshnessStatus:publicFreshness(row.lastConfirmedAt),images:images.map(image=>({id:image.id,contentType:image.contentType,sizeBytes:image.sizeBytes,position:image.position,...(image.url?{url:image.url}:{})}))};}
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
  const rows=listed.results,totalItems=Number(count?.totalItems??0);if(d1ImageStatus(c)&&await hasPublicLegacyD1Images(c.env.DB,rows.map((row:any)=>row.id)))return legacyD1Conflict(c);const imageRows=await publicImages(c.env.DB,rows.map((row:any)=>row.id),c.env.MEDIA_STRATEGY==='STATIC_ASSETS',d1ImageStatus(c));
  const byListing=new Map<string,any[]>();for(const image of imageRows){const images=byListing.get(image.listingId)??[];images.push({id:image.id,contentType:image.contentType,sizeBytes:image.sizeBytes,position:image.position,...(image.url?{url:image.url}:{})});byListing.set(image.listingId,images);}
  return c.json({items:rows.map((row:any)=>publicListingDto(row,byListing.get(row.id)??[])),page,pageSize,totalItems,totalPages:Math.ceil(totalItems/pageSize)});
});
app.get('/public/listings/:id/images/:imageId',async c=>{
  if(c.env.MEDIA_STRATEGY==='STATIC_ASSETS'){const row=await c.env.DB.prepare("SELECT i.asset_path AS url FROM static_listing_images i JOIN listings l ON l.id=i.listing_id WHERE i.listing_id=? AND i.id=? AND l.status='APPROVED' AND l.publication_status='PUBLISHED'").bind(c.req.param('id'),c.req.param('imageId')).first<{url:string}>();return row?c.redirect(row.url,302):c.json({message:'Image not found'},404);}
  if(d1ImageStatus(c)){
    const lid=c.req.param('id'),imageId=c.req.param('imageId');
    if(await hasPublicLegacyD1Images(c.env.DB,[lid]))return legacyD1Conflict(c);
    const staticRow=await c.env.DB.prepare("SELECT i.asset_path AS url FROM static_listing_images i JOIN listings l ON l.id=i.listing_id WHERE i.listing_id=? AND i.id=? AND l.status='APPROVED' AND l.publication_status='PUBLISHED'").bind(lid,imageId).first<{url:string}>();
    if(staticRow)return c.redirect(staticRow.url,302);
    const row=await c.env.DB.prepare("SELECT i.blob_data AS blobData,i.mime_type AS contentType,i.byte_size AS sizeBytes FROM listing_images i JOIN listings l ON l.id=i.listing_id WHERE i.listing_id=? AND i.id=? AND i.blob_data IS NOT NULL AND l.status='APPROVED' AND l.publication_status='PUBLISHED'").bind(lid,imageId).first<any>();
    if(!row){const legacy=await c.env.DB.prepare("SELECT 1 FROM listing_images i JOIN listings l ON l.id=i.listing_id WHERE i.listing_id=? AND i.id=? AND i.blob_data IS NULL AND l.status='APPROVED' AND l.publication_status='PUBLISHED'").bind(lid,imageId).first();return legacy?legacyD1Conflict(c):c.json({message:'Image not found'},404);}const bytes=d1BlobBytes(row.blobData);if(!bytes||bytes.byteLength!==row.sizeBytes)return c.json({message:'Image data unavailable'},503);return imageResponse(bytes,row.contentType,false);
  }
  const row=await c.env.DB.prepare("SELECT i.object_key AS objectKey,i.mime_type AS contentType,i.byte_size AS sizeBytes FROM listing_images i JOIN listings l ON l.id=i.listing_id WHERE i.listing_id=? AND i.id=? AND l.status='APPROVED' AND l.publication_status='PUBLISHED'").bind(c.req.param('id'),c.req.param('imageId')).first<any>();
  if(!row)return c.json({message:'Image not found'},404);const object=await c.env.IMAGES.get(row.objectKey);if(!object)return c.json({message:'Image not found'},404);
  return new Response(object.body,{headers:{'Content-Type':row.contentType,'Content-Length':String(row.sizeBytes),'Cache-Control':'no-store, no-cache','X-Content-Type-Options':'nosniff'}});
});
app.post('/public/listings/:id/contact',async c=>{const input=await boundedJson(c.req.raw,12_000) as any;if(!input||Object.keys(input).some(key=>!['visitorName','visitorEmail','message'].includes(key))||typeof input.visitorName!=='string'||typeof input.visitorEmail!=='string'||typeof input.message!=='string')return c.json({message:'invalid contact request'},400);const visitorName=input.visitorName.trim(),visitorEmail=input.visitorEmail.trim().toLowerCase(),message=input.message.trim();if(visitorName.length<1||visitorName.length>120||visitorEmail.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitorEmail)||message.length<1||message.length>2000)return c.json({message:'invalid contact request'},400);const listing=await c.env.DB.prepare("SELECT id,owner_id AS ownerId FROM listings WHERE id=? AND status='APPROVED' AND publication_status='PUBLISHED'").bind(c.req.param('id')).first<any>();if(!listing)return c.json({message:'Listing not found'},404);const supplied=requestKey(c);if(!supplied)return c.json({error:'a valid Idempotency-Key is required'},400);const values={listingId:listing.id,visitorName,visitorEmail,message},requestFingerprint=await fingerprint(values);await c.env.DB.prepare("INSERT INTO contact_events(id,listing_id,owner_id,visitor_name,visitor_email,message,state,created_at,submission_key,submission_fingerprint) VALUES(?,?,?,?,?,?,'UNREAD',?,?,?) ON CONFLICT(listing_id,submission_key) DO NOTHING").bind(id(),listing.id,listing.ownerId,visitorName,visitorEmail,message,now(),supplied,requestFingerprint).run();const result=await c.env.DB.prepare('SELECT id,submission_fingerprint AS requestFingerprint FROM contact_events WHERE listing_id=? AND submission_key=?').bind(listing.id,supplied).first<any>();if(!result)return c.json({error:'contact submission outcome unavailable; retry with the same idempotency key'},503);if(result.requestFingerprint!==requestFingerprint)return c.json({error:'idempotency key reused with different request'},409);return c.json({status:'RECEIVED',id:result.id},201);});
app.get('/public/listings/:id',async c=>{
  const row=await c.env.DB.prepare("SELECT id,title,description,location,price_amount AS priceAmount,price_period AS pricePeriod,rental_duration AS rentalDuration,max_occupants AS maxOccupants,currency,deposit_status AS depositStatus,deposit_amount AS depositAmount,deposit_currency AS depositCurrency,internet_included AS internetIncluded,water_included AS waterIncluded,electricity_included AS electricityIncluded,gas_included AS gasIncluded,pets_policy AS petsPolicy,available_from AS availableFrom,availability_status AS availabilityStatus,last_confirmed_at AS lastConfirmedAt FROM listings WHERE id=? AND status='APPROVED' AND publication_status='PUBLISHED'").bind(c.req.param('id')).first<any>();
  if(!row)return c.json({message:'Listing not found'},404);if(d1ImageStatus(c)&&await hasPublicLegacyD1Images(c.env.DB,[row.id]))return legacyD1Conflict(c);const images=await publicImages(c.env.DB,[row.id],c.env.MEDIA_STRATEGY==='STATIC_ASSETS',d1ImageStatus(c));return c.json(publicListingDto(row,images));
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
