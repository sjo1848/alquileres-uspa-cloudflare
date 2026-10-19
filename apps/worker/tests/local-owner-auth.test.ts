import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { app } from '../src/index';
import { localRateAllowed } from '../src/local-owner-auth';

const base='http://localhost';
const secret='synthetic-owner-auth-test-secret-at-least-32-bytes';
const bindings={...env,DB:env.DB,JWT_SECRET:secret,AUTH_STRATEGY:'PASSWORD',LOCAL_OWNER_AUTH_ENABLED:'true',LOCAL_EMAIL_ADAPTER:'MOCK',MEDIA_STRATEGY:'STATIC_ASSETS'};
const request=(path:string,method='GET',body?:unknown,cookie?:string,host=base,origin=host,ip='198.51.100.45')=>app.request(host+path,{method,headers:{...(origin?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),'CF-Connecting-IP':ip},body:body===undefined?undefined:JSON.stringify(body)},bindings);
const address=()=>`owner-${crypto.randomUUID()}@example.test`;
const password='synthetic-owner-password-2026';
async function mailbox(){const response=await request('/__local/mailbox');expect(response.status).toBe(200);return (await response.json() as any).message as {to:string;purpose:string;url:string}|null;}

describe('local synthetic OWNER authentication lifecycle',()=>{
  it('enforces an atomic fixed-window rate limit using only a hashed bucket key',async()=>{
    const key=`rate-test:${crypto.randomUUID()}`;
    expect(await localRateAllowed(bindings,key,3,60)).toBe(true);
    expect(await localRateAllowed(bindings,key,3,60)).toBe(true);
    expect(await localRateAllowed(bindings,key,3,60)).toBe(true);
    expect(await localRateAllowed(bindings,key,3,60)).toBe(false);
    expect(await env.DB.prepare('SELECT bucket FROM auth_rate_limits WHERE bucket=?').bind(key).first()).toBeNull();
  });
  it('fails closed outside loopback and rejects cross-origin or role-injection attempts',async()=>{
    expect((await request('/auth/config','GET',undefined,undefined,'https://preview.example')).status).toBe(503);
    expect((await request('/auth/register','POST',{email:address(),password},undefined,'https://preview.example')).status).toBe(503);
    expect((await request('/__local/mailbox','GET',undefined,undefined,'https://preview.example')).status).toBe(404);
    expect((await request('/owner/listings','GET',undefined,undefined,'https://unprotected.example')).status).toBe(503);
    expect((await request('/auth/me','GET',undefined,undefined,'https://unprotected.example')).status).toBe(503);
    expect((await app.request('https://unconfigured.example/auth/me',{}, {...bindings,AUTH_STRATEGY:undefined})).status).toBe(503);
    expect((await request('/auth/register','POST',{email:address(),password},undefined,base,'https://attacker.example')).status).toBe(403);
    expect((await request('/auth/register','POST',{email:address(),password,role:'ADMIN'})).status).toBe(400);
  });

  it('registers OWNER only, verifies once, logs in, and revokes sessions on logout',async()=>{
    const email=address();
    const created=await request('/auth/register','POST',{email:email.toUpperCase(),password});
    const duplicate=await request('/auth/register','POST',{email,password});
    expect(created.status).toBe(202);expect(await created.json()).toEqual(await duplicate.json());
    const user=await env.DB.prepare('SELECT id,email,role,password_hash,email_verified_at FROM users WHERE email=?').bind(email).first<any>();
    expect(user).toMatchObject({email,role:'OWNER',email_verified_at:null});expect(user.password_hash).not.toBe(password);
    expect((await request('/auth/login','POST',{email,password})).status).toBe(401);
    const verification=await mailbox();expect(verification).toMatchObject({to:email,purpose:'VERIFY_EMAIL'});
    const token=new URL(verification!.url).searchParams.get('token')!;
    const stored=await env.DB.prepare("SELECT token_hash FROM auth_action_tokens WHERE user_id=? AND purpose='VERIFY_EMAIL'").bind(user.id).first<{token_hash:string}>();
    expect(stored?.token_hash).not.toBe(token);expect((await request('/auth/verify-email','POST',{token})).status).toBe(200);
    expect((await request('/auth/verify-email','POST',{token})).status).toBe(400);
    const login=await request('/auth/login','POST',{email,password});expect(login.status).toBe(200);
    expect(login.headers.get('set-cookie')).toContain('HttpOnly');
    const cookie=login.headers.get('set-cookie')!.split(';')[0];
    const secondLogin=await request('/auth/login','POST',{email,password}),secondCookie=secondLogin.headers.get('set-cookie')!.split(';')[0];
    expect(await (await request('/auth/me','GET',undefined,cookie)).json()).toEqual({id:user.id,email,role:'OWNER'});
    expect((await request('/auth/logout','POST',undefined,cookie)).status).toBe(200);
    expect((await request('/auth/me','GET',undefined,cookie)).status).toBe(401);
    expect((await request('/auth/me','GET',undefined,secondCookie)).status).toBe(401);
  },20_000);

  it('uses generic reset responses, rejects expired/replayed links, and revokes all prior sessions',async()=>{
    const email=address();
    await request('/auth/register','POST',{email,password});
    const verification=await mailbox(),verifyToken=new URL(verification!.url).searchParams.get('token')!;
    expect((await request('/auth/verify-email','POST',{token:verifyToken})).status).toBe(200);
    const oldLogin=await request('/auth/login','POST',{email,password}),oldCookie=oldLogin.headers.get('set-cookie')!.split(';')[0];
    const unknown=await request('/auth/password-reset/request','POST',{email:address()}),known=await request('/auth/password-reset/request','POST',{email});
    expect(await unknown.json()).toEqual(await known.json());
    const reset=await mailbox(),token=new URL(reset!.url).searchParams.get('token')!;
    await env.DB.prepare("UPDATE auth_action_tokens SET expires_at=0 WHERE purpose='RESET_PASSWORD' AND user_id=(SELECT id FROM users WHERE email=?)").bind(email).run();
    expect((await request('/auth/password-reset/complete','POST',{token,password:'different-synthetic-password-2026'})).status).toBe(400);
    await request('/auth/password-reset/request','POST',{email});
    const fresh=await mailbox(),freshToken=new URL(fresh!.url).searchParams.get('token')!,newPassword='replacement-synthetic-password-2026';
    expect((await request('/auth/password-reset/complete','POST',{token:freshToken,password:'á'.repeat(40)})).status).toBe(400);
    expect((await request('/auth/password-reset/complete','POST',{token:freshToken,password:newPassword})).status).toBe(200);
    expect((await request('/auth/password-reset/complete','POST',{token:freshToken,password})).status).toBe(400);
    expect((await request('/auth/me','GET',undefined,oldCookie)).status).toBe(401);
    expect((await request('/auth/login','POST',{email,password})).status).toBe(401);
    expect((await request('/auth/login','POST',{email,password:newPassword})).status).toBe(200);
  },30_000);
});
