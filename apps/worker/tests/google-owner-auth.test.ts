import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { app } from '../src/index';

const origin='http://127.0.0.1:8787';
const clientId='google-local-test-client.apps.googleusercontent.com';
const baseBindings={...env,DB:env.DB,AUTH_STRATEGY:'GOOGLE',GOOGLE_CLIENT_ID:clientId,GOOGLE_SESSION_TTL_SECONDS:'86400',GOOGLE_AUTH_LOCAL_TEST:'true',COOKIE_SECURE:'true',COOKIE_SAME_SITE:'lax',JWT_SECRET:'google-owner-local-test-secret-at-least-32-bytes'};
let privateKey:CryptoKey;
let wrongPrivateKey:CryptoKey;
let publicJwks:string;
let counter=0;
let testIp='google-auth-test';
const runtimeBindings=(extra:Record<string,unknown>={})=>({...baseBindings,GOOGLE_AUTH_TEST_JWKS:publicJwks,...extra});

function cookiePair(response:Response,name:string,fallback?:string){
  const header=response.headers.get('Set-Cookie')??'';
  const match=new RegExp(`(?:^|,\\s*|;\\s*)${name}=([^;,]+)`).exec(header);
  if(match)return `${name}=${match[1]}`;
  const existing=fallback?.split(';').map(part=>part.trim()).find(part=>part.startsWith(`${name}=`));
  if(existing)return existing;
  throw new Error(`Missing ${name} cookie`);
}
function combine(...pairs:string[]){return pairs.join('; ');}
async function challenge(cookie?:string,settings:{url?:string;origin?:string;fetchSite?:string;env?:Record<string,unknown>}={}){
  const headers=new Headers({'CF-Connecting-IP':testIp});if(cookie)headers.set('Cookie',cookie);if(settings.origin!==undefined)headers.set('Origin',settings.origin);else headers.set('Origin',origin);if(settings.fetchSite)headers.set('Sec-Fetch-Site',settings.fetchSite);
  return app.request((settings.url??origin)+'/auth/google/challenge',{headers},runtimeBindings(settings.env));
}
async function credential(nonce:string,overrides:Record<string,unknown>={},key:CryptoKey=privateKey){
  const subject=String(overrides.sub??`google-sub-${++counter}`);
  const email=String(overrides.email??`owner-${counter}@example.test`);
  const payload={iss:'https://accounts.google.com',aud:clientId,sub:subject,email,email_verified:true,nonce,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300,...overrides};
  return new SignJWT(payload).setProtectedHeader({alg:'RS256',kid:'google-local-test-key'}).sign(key);
}
async function start(cookie?:string){
  const response=await challenge(cookie);expect(response.status).toBe(200);
  const body=await response.json() as {nonce:string};
  const browser=cookiePair(response,'__Host-alquileres_google_browser',cookie);
  return {nonce:body.nonce,browser};
}
async function exchange(binding:string,nonce:string,token:string,options:{origin?:string;body?:unknown;fetchSite?:string;env?:Record<string,unknown>}={}){
  const headers=new Headers({'Content-Type':'application/json',Cookie:binding,Origin:options.origin??origin,'CF-Connecting-IP':testIp});if(options.fetchSite)headers.set('Sec-Fetch-Site',options.fetchSite);
  return app.request(origin+'/auth/google/exchange',{method:'POST',headers,body:JSON.stringify(options.body??{credential:token})},runtimeBindings(options.env));
}
async function signIn(email?:string,sub?:string,browser?:string){
  const started=await start(browser);
  const token=await credential(started.nonce,{...(email?{email}:{}),...(sub?{sub}:{})});
  const response=await exchange(started.browser,started.nonce,token);
  return {response,browser:started.browser,session:response.status===200?cookiePair(response,'alquileres_session'):undefined,token};
}
async function me(cookie:string){return app.request(origin+'/auth/me',{headers:{Cookie:cookie}},runtimeBindings());}

beforeAll(async()=>{
  const pair=await generateKeyPair('RS256',{modulusLength:2048});privateKey=pair.privateKey;
  wrongPrivateKey=(await generateKeyPair('RS256',{modulusLength:2048})).privateKey;
  const publicJwk={...await exportJWK(pair.publicKey),kid:'google-local-test-key',alg:'RS256',use:'sig'};
  publicJwks=JSON.stringify({keys:[publicJwk]});
});
beforeEach(()=>{testIp=`google-test-${crypto.randomUUID()}`;});

describe('Google OWNER auth, local isolated D1',()=>{
  it('creates an individual OWNER once, restores the cookie session, and never auto-creates a listing',async()=>{
    const config=await app.request(origin+'/auth/config',{}, runtimeBindings());
    expect(config.status).toBe(200);expect(await config.json()).toMatchObject({strategy:'GOOGLE',googleClientId:clientId});
    const started=await start();
    const token=await credential(started.nonce,{email:'identity-owner@example.test',sub:'google-sub-first-owner'});
    const response=await exchange(started.browser,started.nonce,token,{env:{GOOGLE_AUTH_TEST_JWKS:publicJwks}});
    expect(response.status).toBe(200);expect(await response.json()).toMatchObject({user:{email:'identity-owner@example.test',role:'OWNER'},sessionExpiresAt:expect.any(Number)});
    const session=cookiePair(response,'alquileres_session'),jar=combine(session,started.browser);
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');expect(response.headers.get('Set-Cookie')).toContain('Secure');expect(response.headers.get('Set-Cookie')).toContain('SameSite=Lax');
    expect((await me(jar)).status).toBe(200);
    expect(await env.DB.prepare('SELECT role FROM users WHERE email=?').bind('identity-owner@example.test').first()).toMatchObject({role:'OWNER'});
    expect(await env.DB.prepare('SELECT email_verified_at FROM users WHERE email=?').bind('identity-owner@example.test').first()).toMatchObject({email_verified_at:null});
    expect(await env.DB.prepare('SELECT count(*) AS n FROM listings WHERE owner_id=(SELECT id FROM users WHERE email=?)').bind('identity-owner@example.test').first()).toMatchObject({n:0});
    expect(await env.DB.prepare('SELECT count(*) AS n FROM google_identities WHERE subject=?').bind('google-sub-first-owner').first()).toMatchObject({n:1});
    const listing=await app.request(origin+'/listings',{method:'POST',headers:{Origin:origin,Cookie:jar,'Content-Type':'application/json'},body:JSON.stringify({title:'Google OWNER private draft',description:'Synthetic IDOR test.',location:'Uspallata',priceAmount:100,pricePeriod:'MONTH',rentalDuration:'MONTHS',maxOccupants:1,currency:'ARS'})},runtimeBindings());
    expect(listing.status).toBe(201);const listingBody=await listing.json() as {id:string;ownerId:string};
    const ownerIdentity=await (await me(jar)).json() as {id:string};expect(listingBody.ownerId).toBe(ownerIdentity.id);
    const secondOwner=await signIn('google-owner-other@example.test','google-sub-owner-other');expect(secondOwner.response.status).toBe(200);
    const secondJar=combine(secondOwner.session!,secondOwner.browser);
    expect(await (await app.request(origin+'/listings',{headers:{Cookie:secondJar}},runtimeBindings())).json()).toEqual([]);
    expect((await app.request(origin+`/listings/${listingBody.id}`,{headers:{Cookie:secondJar}},runtimeBindings())).status).toBe(404);
    const passwordFallback=await app.request(origin+'/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'identity-owner@example.test',password:'synthetic-password-for-fallback'})},runtimeBindings({AUTH_STRATEGY:'PASSWORD',LOCAL_OWNER_AUTH_ENABLED:'true',LOCAL_EMAIL_ADAPTER:'MOCK',COOKIE_SECURE:'false'}));
    expect(passwordFallback.status).toBe(401);
    expect((await app.request(origin+'/admin/listings/review',{headers:{Cookie:jar}},runtimeBindings())).status).toBe(401);
    expect((await app.request(origin+'/auth/preview-session',{method:'POST',headers:{Origin:origin,Cookie:jar,'Content-Type':'application/json'},body:JSON.stringify({role:'ADMIN'})},runtimeBindings())).status).toBe(503);
  });

  it('rejects forged, wrong issuer/audience, expired, unverified, nonce-mismatched and replayed ID tokens',async()=>{
    const badKeyChallenge=await start();
    expect((await exchange(badKeyChallenge.browser,badKeyChallenge.nonce,await credential(badKeyChallenge.nonce,{},wrongPrivateKey),{env:{GOOGLE_AUTH_TEST_JWKS:publicJwks}})).status).toBe(401);
    const invalidClaims:[string,Record<string,unknown>][]=[
      ['issuer',{iss:'https://evil.example'}],['audience',{aud:'other-client'}],['expired',{exp:Math.floor(Date.now()/1000)-30}],
      ['email verification',{email_verified:false}],['nonce',{nonce:'not-the-challenge'}],
    ];
    for(const [label,claims] of invalidClaims){
      const started=await start();const token=await credential(started.nonce,claims);
      const response=await exchange(started.browser,started.nonce,token,{env:{GOOGLE_AUTH_TEST_JWKS:publicJwks}});
      expect(response.status,`${label} token`).toBe(401);
    }
    const replay=await start();const token=await credential(replay.nonce,{sub:'google-sub-replay',email:'replay@example.test'});
    const first=await exchange(replay.browser,replay.nonce,token,{env:{GOOGLE_AUTH_TEST_JWKS:publicJwks}});expect(first.status).toBe(200);
    expect((await exchange(replay.browser,replay.nonce,token,{env:{GOOGLE_AUTH_TEST_JWKS:publicJwks}})).status).toBe(401);
  });

  it('consumes a nonce once under concurrent replay and resolves parallel first sign-ins by Google sub',async()=>{
    const replay=await start();
    const replayToken=await credential(replay.nonce,{sub:'google-sub-concurrent-replay',email:'concurrent-replay@example.test'});
    const simultaneous=await Promise.all([
      exchange(replay.browser,replay.nonce,replayToken),
      exchange(replay.browser,replay.nonce,replayToken),
    ]);
    expect(simultaneous.map(response=>response.status).sort()).toEqual([200,401]);

    const first=await start(),second=await start();
    const credentials=await Promise.all([
      credential(first.nonce,{sub:'google-sub-concurrent-create',email:'concurrent-owner@example.test'}),
      credential(second.nonce,{sub:'google-sub-concurrent-create',email:'concurrent-owner@example.test'}),
    ]);
    const registrations=await Promise.all([
      exchange(first.browser,first.nonce,credentials[0]),
      exchange(second.browser,second.nonce,credentials[1]),
    ]);
    expect(registrations.map(response=>response.status)).toEqual([200,200]);
    const identities=await Promise.all(registrations.map(async response=>(await response.json() as {user:{id:string}}).user.id));
    expect(identities[0]).toBe(identities[1]);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM google_identities WHERE subject=?').bind('google-sub-concurrent-create').first()).toMatchObject({n:1});
    expect((await me(combine(cookiePair(registrations[0],'alquileres_session'),first.browser))).status).toBe(200);
    expect((await me(combine(cookiePair(registrations[1],'alquileres_session'),second.browser))).status).toBe(200);
  });

  it('never links by email, ignores role claims, and rejects client role fields and CSRF',async()=>{
    const existing=await env.DB.prepare("INSERT INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at,session_version) VALUES(?,?,'existing-local-hash','OWNER',?,?,?,0)")
      .bind(crypto.randomUUID(),'already-owned@example.test',new Date().toISOString(),new Date().toISOString(),new Date().toISOString()).run();expect(existing.success).toBe(true);
    const started=await start();const token=await credential(started.nonce,{email:'already-owned@example.test',sub:'different-google-sub',role:'ADMIN'});
    expect((await exchange(started.browser,started.nonce,token,{env:{GOOGLE_AUTH_TEST_JWKS:publicJwks}})).status).toBe(409);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM google_identities WHERE subject=?').bind('different-google-sub').first()).toMatchObject({n:0});
    const roleClaim=await start();const roleClaimToken=await credential(roleClaim.nonce,{email:'role-claim-owner@example.test',sub:'google-sub-role-claim-owner',role:'ADMIN'});
    const roleClaimResult=await exchange(roleClaim.browser,roleClaim.nonce,roleClaimToken);expect(roleClaimResult.status).toBe(200);
    expect(await roleClaimResult.json()).toMatchObject({user:{email:'role-claim-owner@example.test',role:'OWNER'}});
    const rejected=await start();const credentialOnly=await credential(rejected.nonce,{email:'role-claim@example.test',sub:'google-sub-role-claim',role:'ADMIN'});
    expect((await exchange(rejected.browser,rejected.nonce,credentialOnly,{body:{credential:credentialOnly,role:'ADMIN'},env:{GOOGLE_AUTH_TEST_JWKS:publicJwks}})).status).toBe(400);
    const csrf=await start();const csrfToken=await credential(csrf.nonce,{email:'csrf@example.test',sub:'google-sub-csrf'});
    expect((await exchange(csrf.browser,csrf.nonce,csrfToken,{origin:'https://attacker.example',env:{GOOGLE_AUTH_TEST_JWKS:publicJwks}})).status).toBe(403);
    expect((await exchange(csrf.browser,csrf.nonce,csrfToken,{fetchSite:'cross-site',env:{GOOGLE_AUTH_TEST_JWKS:publicJwks}})).status).toBe(403);
  });

  it('keeps sessions independent by browser, rotates same-browser sessions, and revokes only the logging-out session',async()=>{
    const first=await signIn('multi-session@example.test','google-sub-multi-session');expect(first.response.status).toBe(200);
    const firstJar=combine(first.session!,first.browser);
    const renewedChallenge=await challenge(first.browser);
    expect(renewedChallenge.status).toBe(200);
    const liveBindingCookie=renewedChallenge.headers.get('Set-Cookie')??'';
    expect(liveBindingCookie).toContain('__Host-alquileres_google_browser=');
    expect(Number(/Max-Age=(\d+)/.exec(liveBindingCookie)?.[1])).toBeGreaterThan(300);
    expect((await me(firstJar)).status).toBe(200);
    const anonymous=await start();
    const retried=await challenge(anonymous.browser);
    expect(retried.status).toBe(200);
    expect(retried.headers.get('Set-Cookie')).toMatch(/Max-Age=300/);
    const second=await signIn('multi-session@example.test','google-sub-multi-session');expect(second.response.status).toBe(200);
    const secondJar=combine(second.session!,second.browser);
    expect((await me(firstJar)).status).toBe(200);expect((await me(secondJar)).status).toBe(200);

    const replacement=await signIn('multi-session@example.test','google-sub-multi-session',second.browser);expect(replacement.response.status).toBe(200);
    const replacementJar=combine(replacement.session!,replacement.browser);
    expect((await me(secondJar)).status).toBe(401);expect((await me(replacementJar)).status).toBe(200);

    const logout=await app.request(origin+'/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:firstJar}},runtimeBindings());
    expect(logout.status).toBe(200);expect(logout.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect((await me(firstJar)).status).toBe(401);expect((await me(replacementJar)).status).toBe(200);
    const secondBrowser=await signIn('multi-session@example.test','google-sub-multi-session');expect(secondBrowser.response.status).toBe(200);
    expect((await me(combine(secondBrowser.session!,secondBrowser.browser))).status).toBe(200);

    const expiring=await signIn('expiring-session@example.test','google-sub-expiring-session');expect(expiring.response.status).toBe(200);
    const expiringUser=(await expiring.response.json()) as {user:{id:string}};
    const expiringJar=combine(expiring.session!,expiring.browser);
    expect((await me(expiringJar)).status).toBe(200);
    await env.DB.prepare('UPDATE google_auth_sessions SET created_at=unixepoch()-2,expires_at=unixepoch()-1 WHERE user_id=?').bind(expiringUser.user.id).run();
    expect((await me(expiringJar)).status).toBe(401);
  });

  it('fails closed on insecure cookie config, non-loopback test JWKS, and other auth strategies',async()=>{
    expect((await app.request(origin+'/auth/config',{}, runtimeBindings({COOKIE_SECURE:'false'}))).status).toBe(503);
    expect((await app.request('https://public.example/auth/config',{}, runtimeBindings())).status).toBe(503);
    expect((await app.request(origin+'/auth/config',{}, runtimeBindings({AUTH_STRATEGY:'ACCESS_PREVIEW'}))).status).toBe(503);
    expect((await app.request(origin+'/auth/google/challenge',{}, runtimeBindings({AUTH_STRATEGY:'PASSWORD'}))).status).toBe(503);
  });
});
