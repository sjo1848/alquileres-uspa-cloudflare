import bcrypt from 'bcryptjs';

export type LocalOwnerAuthEnv = {
  DB: D1Database;
  JWT_SECRET: string;
  AUTH_STRATEGY?: string;
  LOCAL_OWNER_AUTH_ENABLED?: string;
  LOCAL_EMAIL_ADAPTER?: string;
};

const encoder = new TextEncoder();
const registrationMessage='Si la dirección puede registrarse, encontrarás instrucciones en el buzón de prueba local.';
const resetMessage='Si la cuenta existe, encontrarás instrucciones en el buzón de prueba local.';
const outbox: Array<{ to: string; purpose: 'VERIFY_EMAIL'|'RESET_PASSWORD'; url: string; createdAt: number }> = [];
let rateLimitPrunedAt = 0;
const json = (body: unknown, status=200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const loopback = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
async function readJson(request: Request, maximum=4096) {
  const reader=request.body?.getReader(); if(!reader)return null;
  const chunks:Uint8Array[]=[];let size=0;
  try { for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){await reader.cancel();return null;}chunks.push(value);} }
  finally { reader.releaseLock(); }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}
}

export function localOwnerAuthEnabled(request: Request, env: LocalOwnerAuthEnv) {
  try {
    const url = new URL(request.url);
    return env.LOCAL_OWNER_AUTH_ENABLED === 'true' && env.LOCAL_EMAIL_ADAPTER === 'MOCK' && env.AUTH_STRATEGY === 'PASSWORD' &&
      loopback(url.hostname);
  } catch { return false; }
}

function responseForGuard(request: Request, env: LocalOwnerAuthEnv) {
  return localOwnerAuthEnabled(request, env) ? null : json({ error: 'Local synthetic OWNER authentication is unavailable' }, 404);
}
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let raw=''; for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  let raw=''; for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function validEmail(email: string) { return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
export async function localRateAllowed(env: LocalOwnerAuthEnv, key: string, maximum: number, windowSeconds=900) {
  const current=Math.floor(Date.now()/1000), bucket=await digest(key);
  if(current-rateLimitPrunedAt>3600){rateLimitPrunedAt=current;await env.DB.prepare('DELETE FROM auth_rate_limits WHERE updated_at<?').bind(current-86400).run();}
  const result=await env.DB.prepare(`INSERT INTO auth_rate_limits(bucket,window_started_at,attempts,updated_at) VALUES(?,?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN window_started_at<=? THEN 1 ELSE attempts+1 END,
    window_started_at=CASE WHEN window_started_at<=? THEN ? ELSE window_started_at END,updated_at=? RETURNING attempts`)
    .bind(bucket,current,current,current-windowSeconds,current-windowSeconds,current,current).first<{attempts:number}>();
  return Boolean(result && result.attempts <= maximum);
}
async function issue(env: LocalOwnerAuthEnv, userId: string, email: string, purpose: 'VERIFY_EMAIL'|'RESET_PASSWORD', base: string) {
  const token=randomToken(), tokenHash=await digest(token), expires=Math.floor(Date.now()/1000)+3600;
  const at=new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM auth_action_tokens WHERE user_id=? AND purpose=?').bind(userId,purpose),
    env.DB.prepare('INSERT INTO auth_action_tokens(token_hash,user_id,purpose,expires_at,created_at) VALUES(?,?,?,?,?)').bind(tokenHash,userId,purpose,expires,at),
  ]);
  const path=purpose==='VERIFY_EMAIL'?'/verify-email':'/reset-password';
  outbox.push({to:email,purpose,url:`${base}${path}?token=${encodeURIComponent(token)}`,createdAt:Date.now()});
  if(outbox.length>20)outbox.splice(0,outbox.length-20);
}

export async function localRegister(request: Request, env: LocalOwnerAuthEnv) {
  const blocked=responseForGuard(request,env); if(blocked)return blocked;
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'same-origin request required'},403);
  const body=await readJson(request) as any;
  if(!body || Object.keys(body).some(k=>!['email','password'].includes(k)) || typeof body.email!=='string' || typeof body.password!=='string')return json({error:'validation failed'},400);
  const email=body.email.trim().toLowerCase(), password=body.password;
  if(!validEmail(email)||password.length<12||password.length>128||encoder.encode(password).byteLength>72)return json({error:'validation failed'},400);
  const ip=request.headers.get('CF-Connecting-IP')??'loopback';
  if(!await localRateAllowed(env,`register-ip:${ip}`,20)||!await localRateAllowed(env,`register-email:${email}`,5))return json({message:registrationMessage},202);
  // Hash before checking uniqueness so new and duplicate addresses follow the same expensive path.
  const passwordHash=await bcrypt.hash(password,12), userId=crypto.randomUUID(), at=new Date().toISOString();
  const created=await env.DB.prepare("INSERT INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at) VALUES(?,?,?,'OWNER',?,?,NULL) ON CONFLICT(email) DO NOTHING")
    .bind(userId,email,passwordHash,at,at).run();
  if(created.meta.changes===1){try{await issue(env,userId,email,'VERIFY_EMAIL',new URL(request.url).origin);}catch{return json({message:registrationMessage},202);}}
  else {
    const pending=await env.DB.prepare("SELECT id,email FROM users WHERE email=? AND email_verified_at IS NULL AND role='OWNER'").bind(email).first<{id:string;email:string}>();
    if(pending)try{await issue(env,pending.id,pending.email,'VERIFY_EMAIL',new URL(request.url).origin);}catch{}
  }
  return json({message:registrationMessage},202);
}

export async function localVerifyEmail(request: Request, env: LocalOwnerAuthEnv) {
  const blocked=responseForGuard(request,env); if(blocked)return blocked;
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'same-origin request required'},403);
  const body=await readJson(request) as any;
  if(!body||Object.keys(body).length!==1||typeof body.token!=='string'||body.token.length>128)return json({error:'verification unavailable or expired'},400);
  if(!await localRateAllowed(env,`verify-ip:${request.headers.get('CF-Connecting-IP')??'loopback'}`,30))return json({error:'verification unavailable or expired'},400);
  const hash=await digest(body.token), at=new Date().toISOString(), now=Math.floor(Date.now()/1000);
  const result=await env.DB.prepare(`UPDATE users SET email_verified_at=?,updated_at=? WHERE id=(SELECT user_id FROM auth_action_tokens WHERE token_hash=? AND purpose='VERIFY_EMAIL' AND consumed_at IS NULL AND expires_at>?) AND role='OWNER' AND email_verified_at IS NULL`)
    .bind(at,at,hash,now).run();
  if(result.meta.changes!==1)return json({error:'verification unavailable or expired'},400);
  await env.DB.prepare('UPDATE auth_action_tokens SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL').bind(now,hash).run();
  return json({ok:true});
}

export async function localRequestPasswordReset(request: Request, env: LocalOwnerAuthEnv) {
  const blocked=responseForGuard(request,env); if(blocked)return blocked;
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'same-origin request required'},403);
  const body=await readJson(request) as any;
  if(!body||Object.keys(body).length!==1||typeof body.email!=='string'||body.email.length>254)return json({message:resetMessage},202);
  const email=body.email.trim().toLowerCase();
  if(!await localRateAllowed(env,`reset-ip:${request.headers.get('CF-Connecting-IP')??'loopback'}`,20)||!await localRateAllowed(env,`reset-email:${email}`,5))return json({message:resetMessage},202);
  if(validEmail(email)){
    const user=await env.DB.prepare("SELECT id,email FROM users WHERE email=? AND role='OWNER' AND email_verified_at IS NOT NULL").bind(email).first<{id:string;email:string}>();
    if(user)try{await issue(env,user.id,user.email,'RESET_PASSWORD',new URL(request.url).origin);}catch{}
  }
  return json({message:resetMessage},202);
}

export async function localCompletePasswordReset(request: Request, env: LocalOwnerAuthEnv) {
  const blocked=responseForGuard(request,env); if(blocked)return blocked;
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'same-origin request required'},403);
  const body=await readJson(request) as any;
  if(!body||Object.keys(body).some(k=>!['token','password'].includes(k))||typeof body.token!=='string'||body.token.length>128||typeof body.password!=='string'||body.password.length<12||body.password.length>128||encoder.encode(body.password).byteLength>72)return json({error:'reset unavailable or expired'},400);
  if(!await localRateAllowed(env,`reset-complete-ip:${request.headers.get('CF-Connecting-IP')??'loopback'}`,10))return json({error:'reset unavailable or expired'},400);
  const hash=await digest(body.token), now=Math.floor(Date.now()/1000), at=new Date().toISOString();
  const row=await env.DB.prepare("SELECT user_id FROM auth_action_tokens WHERE token_hash=? AND purpose='RESET_PASSWORD' AND consumed_at IS NULL AND expires_at>?").bind(hash,now).first<{user_id:string}>();
  if(!row)return json({error:'reset unavailable or expired'},400);
  // Consume first so concurrent replays cannot both pass. Failure after consumption is fail-closed;
  // the user can request a fresh reset link.
  const consumed=await env.DB.prepare("UPDATE auth_action_tokens SET consumed_at=? WHERE token_hash=? AND purpose='RESET_PASSWORD' AND consumed_at IS NULL AND expires_at>?").bind(now,hash,now).run();
  if(consumed.meta.changes!==1)return json({error:'reset unavailable or expired'},400);
  const passwordHash=await bcrypt.hash(body.password,12);
  const updated=await env.DB.prepare("UPDATE users SET password_hash=?,session_version=session_version+1,updated_at=? WHERE id=? AND role='OWNER'").bind(passwordHash,at,row.user_id).run();
  if(updated.meta.changes!==1)return json({error:'reset unavailable or expired'},400);
  return json({ok:true});
}

export async function localMockMailbox(request: Request, env: LocalOwnerAuthEnv) {
  const blocked=responseForGuard(request,env); if(blocked)return blocked;
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'same-origin request required'},403);
  if(request.method!=='GET')return json({error:'not found'},404);
  const latest=outbox.at(-1);
  if(!latest)return json({message:null});
  outbox.pop();
  return json({message:latest});
}
