import { env } from 'cloudflare:workers';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT, decodeJwt } from 'jose';
import bcrypt from 'bcryptjs';
import { app } from '../src/index';
import { PREVIEW_ORIGIN, PREVIEW_ISSUER, PREVIEW_OPERATOR, PREVIEW_OWNER_ID, PREVIEW_OWNER_EMAIL, PREVIEW_ADMIN_ID, PREVIEW_ADMIN_EMAIL } from '../src/preview-auth';

const audience='a'.repeat(64);
const bindings={...env,DB:env.DB,JWT_SECRET:'synthetic-preview-session-secret-at-least-32-bytes',AUTH_STRATEGY:'ACCESS_PREVIEW',ACCESS_AUD:audience,COOKIE_SECURE:'true',MEDIA_STRATEGY:'STATIC_ASSETS'};
let privateKey: CryptoKey, wrongKey: CryptoKey;
const passwordCompare=vi.spyOn(bcrypt,'compare');
async function ticket(overrides:Record<string,unknown>={},key?:CryptoKey,omit?:string) {
  const n=Math.floor(Date.now()/1000);
  const claims:Record<string,unknown>={iss:PREVIEW_ISSUER,aud:[audience],sub:'synthetic-operator-subject',email:PREVIEW_OPERATOR,type:'app',iat:n,nbf:n,exp:n+60,...overrides};
  if(omit)delete claims[omit];
  return new SignJWT(claims).setProtectedHeader({alg:'RS256',kid:'preview-test-key'}).sign(key??privateKey);
}
function exchange(assertion?:string,options:{origin?:string|null;url?:string;env?:Partial<typeof bindings>;body?:unknown}={}) {
  const origin=options.origin===undefined?PREVIEW_ORIGIN:options.origin;
  return app.request((options.url??PREVIEW_ORIGIN)+'/auth/preview-session',{
    method:'POST',headers:{...(origin?{Origin:origin}:{}),...(assertion?{'Cf-Access-Jwt-Assertion':assertion}:{}),'Content-Type':'application/json'},
    body:JSON.stringify(options.body??{}),
  },{...bindings,...options.env});
}
function refresh(assertion:string|undefined,sessionCookie:string|undefined,options:{origin?:string|null;env?:Partial<typeof bindings>;body?:unknown;fetchSite?:string}={}){
  const origin=options.origin===undefined?PREVIEW_ORIGIN:options.origin;
  return app.request(PREVIEW_ORIGIN+'/auth/refresh',{method:'POST',headers:{...(origin?{Origin:origin}:{}),...(options.fetchSite?{'Sec-Fetch-Site':options.fetchSite}:{}),...(assertion?{'Cf-Access-Jwt-Assertion':assertion}:{}),...(sessionCookie?{Cookie:sessionCookie}:{}),...(options.body===undefined?{}:{'Content-Type':'application/json'})},...(options.body===undefined?{}:{body:JSON.stringify(options.body)})},{...bindings,...options.env});
}
beforeAll(async()=>{
  const pair=await generateKeyPair('RS256');privateKey=pair.privateKey;
  wrongKey=(await generateKeyPair('RS256')).privateKey;
  const jwk={...await exportJWK(pair.publicKey),kid:'preview-test-key',alg:'RS256',use:'sig'};
  vi.spyOn(globalThis,'fetch').mockImplementation(async(input)=>{
    expect(String(input)).toBe(PREVIEW_ISSUER+'/cdn-cgi/access/certs');
    return Response.json({keys:[jwk]});
  });
  const n=new Date().toISOString();
  await env.DB.prepare('INSERT INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at) VALUES(?,?,?,\'OWNER\',?,?,?)').bind(PREVIEW_OWNER_ID,PREVIEW_OWNER_EMAIL,'not-used',n,n,n).run();
  await env.DB.prepare('INSERT INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at) VALUES(?,?,?,\'ADMIN\',?,?,?)').bind(PREVIEW_ADMIN_ID,PREVIEW_ADMIN_EMAIL,'not-used',n,n,n).run();
});
afterAll(()=>vi.restoreAllMocks());

describe('Access identity → fixed synthetic role session, Preview only',()=>{
  it('cryptographically verifies identity and maps only the fixed synthetic owner with capped expiry',async()=>{
    const exp=Math.floor(Date.now()/1000)+45;
    const response=await exchange(await ticket({exp}),{body:{role:'OWNER'}});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({user:{id:PREVIEW_OWNER_ID,email:PREVIEW_OWNER_EMAIL,role:'OWNER'}});
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    const setCookie=response.headers.get('Set-Cookie')!;
    expect(setCookie).toContain('HttpOnly');expect(setCookie).toContain('Secure');expect(setCookie).toContain('SameSite=Lax');
    const cookie=setCookie.split(';')[0];
    expect(decodeJwt(decodeURIComponent(cookie.slice('alquileres_session='.length))).exp).toBe(exp);
    const me=await app.request(PREVIEW_ORIGIN+'/auth/me',{headers:{Cookie:cookie}},bindings);
    expect(me.status).toBe(200);
    const fields={title:'Borrador Access',description:'Sintético',location:'Uspallata',priceAmount:1,pricePeriod:'MONTH',rentalDuration:'FLEXIBLE',maxOccupants:1,currency:'ARS'};
    const create=await app.request(PREVIEW_ORIGIN+'/listings',{method:'POST',headers:{Cookie:cookie,Origin:PREVIEW_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify(fields)},bindings);
    expect(create.status).toBe(201);
    expect(await create.json()).toMatchObject({ownerId:PREVIEW_OWNER_ID,status:'DRAFT'});
    expect((await app.request(PREVIEW_ORIGIN+'/listings',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(fields)},bindings)).status).toBe(403);
  });
  it('maps the same verified Access operator to a separate ADMIN demo identity and keeps roles isolated',async()=>{
    const assertion=await ticket();
    const response=await exchange(assertion,{body:{role:'ADMIN'}});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({user:{id:PREVIEW_ADMIN_ID,email:PREVIEW_ADMIN_EMAIL,role:'ADMIN'}});
    const cookie=response.headers.get('Set-Cookie')!.split(';')[0];
    const me=await app.request(PREVIEW_ORIGIN+'/auth/me',{headers:{Cookie:cookie}},bindings);
    expect(await me.json()).toEqual({id:PREVIEW_ADMIN_ID,email:PREVIEW_ADMIN_EMAIL,role:'ADMIN'});
    expect((await app.request(PREVIEW_ORIGIN+'/admin/listings/review',{headers:{Cookie:cookie}},bindings)).status).toBe(200);
    expect((await app.request(PREVIEW_ORIGIN+'/listings/synthetic-private',{headers:{Cookie:cookie}},bindings)).status).toBe(401);

    const owner=await exchange(assertion,{body:{role:'OWNER'}});
    const ownerCookie=owner.headers.get('Set-Cookie')!.split(';')[0];
    expect((await app.request(PREVIEW_ORIGIN+'/admin/listings/review',{headers:{Cookie:ownerCookie}},bindings)).status).toBe(401);
    expect((await app.request(PREVIEW_ORIGIN+'/listings/synthetic-private',{headers:{Cookie:ownerCookie}},bindings)).status).toBe(404);
  });
  it('renews an expired internal Preview JWT only with the still-valid signed Access identity and preserves role',async()=>{
    const assertion=await ticket({exp:Math.floor(Date.now()/1000)+7200});
    const login=await exchange(assertion,{body:{role:'OWNER'},env:{JWT_EXPIRES_IN:'1s'}});
    expect(login.status).toBe(200);
    const firstCookie=login.headers.get('Set-Cookie')!.split(';')[0];
    const firstClaims=decodeJwt(decodeURIComponent(firstCookie.slice('alquileres_session='.length)));
    await new Promise(resolve=>setTimeout(resolve,1100));
    expect((await app.request(PREVIEW_ORIGIN+'/auth/me',{headers:{Cookie:firstCookie}},bindings)).status).toBe(401);
    expect((await refresh(assertion,firstCookie,{origin:'https://evil.test'})).status).toBe(403);
    expect((await refresh(assertion,firstCookie,{fetchSite:'cross-site'})).status).toBe(403);
    expect((await refresh(undefined,firstCookie)).status).toBe(401);
    expect((await refresh(assertion,undefined)).status).toBe(401);
    const tamperedCookie=firstCookie.replace(/.$/,'x');
    expect((await refresh(assertion,tamperedCookie)).status).toBe(401);
    const attemptedRoleChange=await refresh(assertion,firstCookie,{body:{role:'ADMIN'}});
    expect(attemptedRoleChange.status).toBe(400);
    expect(attemptedRoleChange.headers.has('Set-Cookie')).toBe(false);
    const renewed=await refresh(assertion,firstCookie);
    expect(renewed.status).toBe(200);
    expect(await renewed.json()).toEqual({user:{id:PREVIEW_OWNER_ID,email:PREVIEW_OWNER_EMAIL,role:'OWNER'}});
    const renewedCookie=renewed.headers.get('Set-Cookie')!.split(';')[0];
    const renewedClaims=decodeJwt(decodeURIComponent(renewedCookie.slice('alquileres_session='.length)));
    expect(renewedClaims.iat).toBeGreaterThan(firstClaims.iat as number);
    expect(renewedClaims.exp).toBeLessThanOrEqual(Math.floor(Date.now()/1000)+900);
    expect(renewedClaims.exp).toBeLessThanOrEqual(decodeJwt(assertion).exp!);
    expect((await app.request(PREVIEW_ORIGIN+'/auth/me',{headers:{Cookie:renewedCookie}},bindings)).status).toBe(200);
    expect((await app.request(PREVIEW_ORIGIN+'/admin/listings/review',{headers:{Cookie:renewedCookie}},bindings)).status).toBe(401);

    const logout=await app.request(PREVIEW_ORIGIN+'/auth/logout',{method:'POST',headers:{Origin:PREVIEW_ORIGIN,'Cf-Access-Jwt-Assertion':assertion,Cookie:renewedCookie}},bindings);
    expect(logout.status).toBe(200);
    expect(logout.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect((await refresh(assertion,renewedCookie)).status).toBe(401);
  });
  it('honors Access exp while accepting an assertion older than one hour but still valid',async()=>{
    const n=Math.floor(Date.now()/1000);
    const assertion=await ticket({iat:n-2*3600,nbf:n-2*3600,exp:n+2*86400});
    const response=await exchange(assertion,{body:{role:'ADMIN'}});
    expect(response.status).toBe(200);
    const cookie=response.headers.get('Set-Cookie')!.split(';')[0];
    const claims=decodeJwt(decodeURIComponent(cookie.slice('alquileres_session='.length)));
    expect(claims.exp).toBeLessThanOrEqual(n+900);
    expect((await app.request(PREVIEW_ORIGIN+'/auth/me',{headers:{Cookie:cookie}},bindings)).status).toBe(200);
    const expiredAccess=await ticket({iat:n-2*3600,nbf:n-2*3600,exp:n-1});
    expect((await exchange(expiredAccess,{body:{role:'ADMIN'}})).status).toBe(401);
    expect((await refresh(expiredAccess,cookie)).status).toBe(401);
    const tooOld=await ticket({iat:n-31*86400,nbf:n-31*86400,exp:n+86400});
    expect((await exchange(tooOld,{body:{role:'ADMIN'}})).status).toBe(401);
  });
  it('runs the signed-Access OWNER → ADMIN moderation flow and requires explicit publication',async()=>{
    const ownerAssertion=await ticket({exp:Math.floor(Date.now()/1000)+7200});
    const ownerLogin=await exchange(ownerAssertion,{body:{role:'OWNER'}});
    const ownerCookie=ownerLogin.headers.get('Set-Cookie')!.split(';')[0];
    const listingResponse=await app.request(PREVIEW_ORIGIN+'/listings',{method:'POST',headers:{Origin:PREVIEW_ORIGIN,Cookie:ownerCookie,'Content-Type':'application/json'},body:JSON.stringify({title:'Synthetic Access M2.1',description:'Local synthetic signed-identity test.',location:'Uspallata',priceAmount:42000,pricePeriod:'MONTH',rentalDuration:'FLEXIBLE',maxOccupants:2,currency:'ARS'})},bindings);
    expect(listingResponse.status).toBe(201);
    const listing=await listingResponse.json() as {id:string};
    expect((await app.request(PREVIEW_ORIGIN+`/listings/${listing.id}/submit`,{method:'POST',headers:{Origin:PREVIEW_ORIGIN,Cookie:ownerCookie}},bindings)).status).toBe(200);
    expect((await app.request(PREVIEW_ORIGIN+`/admin/listings/${listing.id}/review`,{method:'POST',headers:{Origin:PREVIEW_ORIGIN,Cookie:ownerCookie,'Content-Type':'application/json'},body:JSON.stringify({action:'approve'})},bindings)).status).toBe(401);

    const adminLogin=await exchange(await ticket({exp:Math.floor(Date.now()/1000)+7200}),{body:{role:'ADMIN'}});
    const adminCookie=adminLogin.headers.get('Set-Cookie')!.split(';')[0];
    const approved=await app.request(PREVIEW_ORIGIN+`/admin/listings/${listing.id}/review`,{method:'POST',headers:{Origin:PREVIEW_ORIGIN,Cookie:adminCookie,'Content-Type':'application/json'},body:JSON.stringify({action:'approve'})},bindings);
    expect(approved.status).toBe(200);
    expect((await approved.json()).publicationStatus).toBe('UNPUBLISHED');
    expect((await app.request(PREVIEW_ORIGIN+`/public/listings/${listing.id}`,{},bindings)).status).toBe(404);
    const published=await app.request(PREVIEW_ORIGIN+`/admin/listings/${listing.id}/publish`,{method:'POST',headers:{Origin:PREVIEW_ORIGIN,Cookie:adminCookie}},bindings);
    expect(published.status).toBe(200);
    expect((await published.json()).publicationStatus).toBe('PUBLISHED');
    expect((await app.request(PREVIEW_ORIGIN+`/public/listings/${listing.id}`,{},bindings)).status).toBe(200);
    expect((await app.request(PREVIEW_ORIGIN+`/admin/listings/${listing.id}/review`,{method:'POST',headers:{Origin:PREVIEW_ORIGIN,Cookie:ownerCookie,'Content-Type':'application/json'},body:JSON.stringify({action:'reject',reason:'not authorized'})},bindings)).status).toBe(401);
  });
  it('accepts only a fixed demo role and verifies that both fixed D1 identities have their expected roles',async()=>{
    const assertion=await ticket();
    for(const body of [{role:'SUPERADMIN'},{role:'ADMIN',id:'real-user',email:PREVIEW_OPERATOR},{role:'OWNER',email:'real@example.test'}]){
      const response=await exchange(assertion,{body});
      expect(response.status).toBe(400);
      expect(response.headers.has('Set-Cookie')).toBe(false);
    }
    await env.DB.prepare("UPDATE users SET role='OWNER' WHERE id=?").bind(PREVIEW_ADMIN_ID).run();
    const wrongD1Role=await exchange(assertion,{body:{role:'ADMIN'}});
    expect(wrongD1Role.status).toBe(503);
    expect(wrongD1Role.headers.has('Set-Cookie')).toBe(false);
    await env.DB.prepare("UPDATE users SET role='ADMIN' WHERE id=?").bind(PREVIEW_ADMIN_ID).run();
    await env.DB.prepare("UPDATE users SET email='changed-admin@example.test' WHERE id=?").bind(PREVIEW_ADMIN_ID).run();
    const wrongD1Email=await exchange(assertion,{body:{role:'ADMIN'}});
    expect(wrongD1Email.status).toBe(503);
    expect(wrongD1Email.headers.has('Set-Cookie')).toBe(false);
    await env.DB.prepare('UPDATE users SET email=? WHERE id=?').bind(PREVIEW_ADMIN_EMAIL,PREVIEW_ADMIN_ID).run();
  });
  it('rejects bad signatures, claims, expiration and unconfigured/mismatched service identities without issuing a session',async()=>{
    const n=Math.floor(Date.now()/1000);
    const tokens=[undefined,'garbage',await ticket({},wrongKey),await ticket({iss:'https://evil.test'}),await ticket({aud:['b'.repeat(64)]}),await ticket({exp:n-1}),await ticket({nbf:n+120}),await ticket({iat:n+120}),await ticket({email:'other@example.test'}),await ticket({type:'org'}),await ticket({sub:''}),await ticket({common_name:'synthetic-service.access'}),await ticket({},undefined,'exp'),await ticket({},undefined,'email'),await ticket({},undefined,'iat')];
    for(const token of tokens){const response=await exchange(token);expect(response.status).toBe(401);expect(response.headers.has('Set-Cookie')).toBe(false);}
    const unsigned=btoa(JSON.stringify({alg:'none'}))+'.'+btoa(JSON.stringify({email:PREVIEW_OPERATOR}))+'.';
    expect((await exchange(unsigned)).status).toBe(401);
    const serviceClientId='synthetic-playwright-client-1234';
    const service=await ticket({sub:'',email:undefined,common_name:serviceClientId,service_token_id:serviceClientId,service_token_status:true});
    expect((await exchange(service,{body:{role:'OWNER'}})).status).toBe(401);
    expect((await exchange(service,{body:{role:'OWNER'},env:{PREVIEW_QA_SERVICE_CLIENT_ID:serviceClientId}})).status).toBe(200);
    expect((await exchange(service,{body:{role:'OWNER'},env:{PREVIEW_QA_SERVICE_CLIENT_ID:'other-playwright-client-1234'}})).status).toBe(401);
    const serviceCookie=(await exchange(service,{body:{role:'OWNER'},env:{PREVIEW_QA_SERVICE_CLIENT_ID:serviceClientId}})).headers.get('Set-Cookie')!.split(';')[0];
    const otherService=await ticket({sub:'',email:undefined,common_name:'other-playwright-client-1234',service_token_id:'other-playwright-client-1234',service_token_status:true});
    expect((await refresh(otherService,serviceCookie,{env:{PREVIEW_QA_SERVICE_CLIENT_ID:serviceClientId}})).status).toBe(401);
    const forgedHeader=await app.request(PREVIEW_ORIGIN+'/auth/preview-session',{method:'POST',headers:{Origin:PREVIEW_ORIGIN,'Cf-Access-Authenticated-User-Email':PREVIEW_OPERATOR}},bindings);
    expect(forgedHeader.status).toBe(401);
  });
  it('fails closed outside the Preview or without config and denies password fallback',async()=>{
    const assertion=await ticket();
    expect((await exchange(assertion,{origin:null})).status).toBe(403);
    expect((await exchange(assertion,{origin:'https://evil.test'})).status).toBe(403);
    expect((await exchange(assertion,{url:'https://alquileres-uspa-lab.sjo1848.workers.dev'})).status).toBe(503);
    expect((await exchange(assertion,{env:{ACCESS_AUD:undefined}})).status).toBe(503);
    expect((await exchange(assertion,{env:{AUTH_STRATEGY:undefined}})).status).toBe(503);
    expect((await exchange(assertion,{env:{AUTH_STRATEGY:'TYPO'}})).status).toBe(503);
    expect((await app.request(PREVIEW_ORIGIN+'/auth/login',{method:'POST',headers:{Origin:PREVIEW_ORIGIN},body:'{}'},bindings)).status).toBe(403);
    for(const url of [PREVIEW_ORIGIN,'https://abcd1234-alquileres-uspa-lab.sjo1848.workers.dev','https://alquileres-uspa-lab.sjo1848.workers.dev']){
      for(const strategy of [undefined,'PASSWORD']){
        const broken={...bindings,AUTH_STRATEGY:strategy};
        expect((await app.request(url+'/auth/login',{method:'POST',headers:{Origin:url},body:'{}'},broken)).status).toBe(503);
        expect((await app.request(url+'/auth/config',{},broken)).status).toBe(503);
        expect((await app.request(url+'/admin/listings/review',{headers:{Cookie:'alquileres_session=synthetic-stale-admin-token'}},broken)).status).toBe(503);
        expect((await app.request(url+'/owner/contact-events',{headers:{Cookie:'alquileres_session=synthetic-stale-owner-token'}},broken)).status).toBe(503);
      }
    }
    expect(passwordCompare).not.toHaveBeenCalled();
    expect(await (await app.request(PREVIEW_ORIGIN+'/auth/config',{},bindings)).json()).toEqual({strategy:'ACCESS_PREVIEW',mediaStrategy:'STATIC_ASSETS'});
    expect((await app.request('http://localhost/auth/config',{}, {...bindings,AUTH_STRATEGY:undefined})).status).toBe(503);
    expect(await (await app.request('http://localhost/auth/config',{}, {...bindings,AUTH_STRATEGY:'PASSWORD',LOCAL_OWNER_AUTH_ENABLED:'true',LOCAL_EMAIL_ADAPTER:'MOCK'})).json()).toEqual({strategy:'PASSWORD',registration:true,recovery:true,mediaStrategy:'STATIC_ASSETS'});
  });
  it('requires the synthetic user to exist with its expected OWNER role and email',async()=>{
    await env.DB.prepare("UPDATE users SET role='ADMIN' WHERE id=?").bind(PREVIEW_OWNER_ID).run();
    expect((await exchange(await ticket(),{body:{role:'OWNER'}})).status).toBe(503);
    await env.DB.prepare("UPDATE users SET role='OWNER',email='changed@example.test' WHERE id=?").bind(PREVIEW_OWNER_ID).run();
    expect((await exchange(await ticket(),{body:{role:'OWNER'}})).status).toBe(503);
    await env.DB.prepare('UPDATE users SET email=? WHERE id=?').bind(PREVIEW_OWNER_EMAIL,PREVIEW_OWNER_ID).run();
  });
});
