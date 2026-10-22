import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/index';
const secret='synthetic-owner-lifecycle-secret-at-least-32-bytes';
const bindings={...env,DB:env.DB,JWT_SECRET:secret,MEDIA_STRATEGY:'STATIC_ASSETS'};
const origin='http://localhost';
const fields={title:'Mi cabaña de prueba',description:'Datos sintéticos del recorrido OWNER',location:'Área Uspallata',priceAmount:120000,pricePeriod:'MONTH',rentalDuration:'FLEXIBLE',maxOccupants:3,currency:'ARS'};
function request(path:string,method='GET',body?:unknown,cookie?:string,withOrigin=true,key?:string){
  return app.request(origin+path,{method,headers:{...(withOrigin?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},body:body?JSON.stringify(body):undefined},bindings);
}
async function login(email='owner.a@example.test'){
  const result=await request('/auth/login','POST',{email,password:'synthetic-owner-password-1'});
  expect(result.status).toBe(200);
  return result.headers.get('set-cookie')!.split(';')[0];
}
async function expiredOwnerCookie(){
  const encode=(value:unknown)=>{const bytes=new TextEncoder().encode(JSON.stringify(value));let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);return btoa(raw).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');};
  const header=encode({alg:'HS256',typ:'JWT'}),payload=encode({id:'owner-a',email:'owner.a@example.test',sv:0,iat:1,exp:2}),input=`${header}.${payload}`;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(input)));let raw='';for(const byte of signature)raw+=String.fromCharCode(byte);
  return `alquileres_session=${input}.${btoa(raw).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}`;
}
beforeAll(async()=>{
  const hash='$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS',now=new Date().toISOString();
  for(const [id,email,role]of [['owner-a','owner.a@example.test','OWNER'],['owner-b','owner.b@example.test','OWNER'],['admin','admin@example.test','ADMIN']]){
    await env.DB.prepare('INSERT INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at) VALUES(?,?,?,?,?,?,?)').bind(id,email,hash,role,now,now,now).run();
  }
});
describe('OWNER cookie session and draft → review journey',()=>{
  it('restores authoritative session data, rejects bad credentials/origins and clears logout cookie',async()=>{
    expect((await request('/auth/me')).status).toBe(401);
    const cookie=await login();
    const me=await request('/auth/me','GET',undefined,cookie);
    expect(await me.json()).toEqual({id:'owner-a',email:'owner.a@example.test',role:'OWNER'});
    expect(me.headers.get('cache-control')).toContain('no-store');
    expect((await request('/auth/login','POST',{email:'owner.a@example.test',password:'incorrect-password'})).status).toBe(401);
    expect((await request('/auth/login','POST',{email:'owner.a@example.test',password:'synthetic-owner-password-1'},undefined,false)).status).toBe(403);
    const logout=await request('/auth/logout','POST',undefined,cookie);
    expect(logout.status).toBe(200);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await request('/auth/me','GET',undefined,'alquileres_session=garbage')).status).toBe(401);
  });
  it('rejects a cryptographically valid but expired OWNER cookie before protected reads or writes',async()=>{
    const expired=await expiredOwnerCookie();
    expect((await request('/auth/me','GET',undefined,expired)).status).toBe(401);
    expect((await request('/listings','GET',undefined,expired)).status).toBe(401);
    expect((await request('/listings','POST',fields,expired,true,'expired-owner-create')).status).toBe(401);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM listings WHERE title=?").bind(fields.title).first('count')).toBe(0);
  });
  it('creates, replays, edits and submits only the current OWNER draft',async()=>{
    const cookie=await login(),other=await login('owner.b@example.test'),admin=await login('admin@example.test');
    const created=await request('/listings','POST',fields,cookie,true,'owner-create-once');
    expect(created.status).toBe(201);const item=await created.json() as any;
    expect(item).toMatchObject({status:'DRAFT',publicationStatus:'UNPUBLISHED',ownerId:'owner-a'});
    const replay=await request('/listings','POST',fields,cookie,true,'owner-create-once');
    expect(await replay.json()).toEqual(item);
    expect((await (await request('/listings','GET',undefined,other)).json() as any[])).toHaveLength(0);
    expect((await request('/listings','GET',undefined,admin)).status).toBe(401);
    expect((await request('/listings','GET')).status).toBe(401);
    expect((await request(`/public/listings/${item.id}`)).status).toBe(404);
    for(const [method,path]of [['PATCH',`/listings/${item.id}`],['POST',`/listings/${item.id}/submit`]]){
      expect((await request(path,method,fields,other)).status).toBe(404);
      expect((await request(path,method,fields,cookie,false)).status).toBe(403);
    }
    expect((await request('/listings/unknown','PATCH',fields,cookie)).status).toBe(404);
    expect((await request(`/listings/${item.id}`,'PATCH',{title:'Missing rental fields'},cookie)).status).toBe(400);
    const edit=await request(`/listings/${item.id}`,'PATCH',{...fields,title:'Borrador editado',location:'ÁREA del cerro'},cookie);
    expect(edit.status).toBe(200);
    expect(await edit.json()).toMatchObject({title:'Borrador editado',location:'ÁREA del cerro',status:'DRAFT'});
    expect(await env.DB.prepare('SELECT location_search FROM listings WHERE id=?').bind(item.id).first('location_search')).toBe('área del cerro');
    const submitted=await request(`/listings/${item.id}/submit`,'POST',undefined,cookie);
    expect(submitted.status).toBe(200);const result=await submitted.json();
    expect(result).toMatchObject({status:'SUBMITTED',publicationStatus:'UNPUBLISHED'});
    expect(await (await request(`/listings/${item.id}/submit`,'POST',undefined,cookie)).json()).toEqual(result);
    expect((await request(`/listings/${item.id}`,'PATCH',fields,cookie)).status).toBe(404);
    expect((await request(`/public/listings/${item.id}`)).status).toBe(404);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM listings WHERE owner_id='owner-a'").first('count')).toBe(1);
  }, 15_000);
  it('blocks submission while an earlier image operation still requires recovery',async()=>{
    const cookie=await login();
    const item=await (await request('/listings','POST',fields,cookie)).json() as any;
    const now=new Date().toISOString();
    await env.DB.prepare("INSERT INTO image_operations(id,listing_id,kind,state,object_key,created_at,updated_at) VALUES(?,?,'ADD','PENDING',?,?,?)").bind('pending-media',item.id,'historical-local-only',now,now).run();
    expect((await request(`/listings/${item.id}/submit`,'POST',undefined,cookie)).status).toBe(503);
    expect(await env.DB.prepare('SELECT status FROM listings WHERE id=?').bind(item.id).first('status')).toBe('DRAFT');
    await env.DB.prepare("DELETE FROM image_operations WHERE id='pending-media'").run();
    expect((await request(`/listings/${item.id}/submit`,'POST',undefined,cookie)).status).toBe(200);
  });
  it('rejects migrated incomplete drafts without transitioning and allows submission after repair',async()=>{
    const cookie=await login();
    for(const column of ['price_amount','price_period','rental_duration','max_occupants','currency']){
      const item=await (await request('/listings','POST',fields,cookie)).json() as any;
      const status=column==='currency'?'REJECTED':'DRAFT';
      await env.DB.prepare(`UPDATE listings SET ${column}=NULL,status=? WHERE id=?`).bind(status,item.id).run();
      expect((await request(`/listings/${item.id}/submit`,'POST',undefined,cookie)).status).toBe(400);
      expect(await env.DB.prepare('SELECT status FROM listings WHERE id=?').bind(item.id).first('status')).toBe(status);
      expect(await env.DB.prepare('SELECT COUNT(*) FROM listing_locks WHERE listing_id=?').bind(item.id).first('COUNT(*)')).toBe(0);
      expect((await request(`/listings/${item.id}`,'PATCH',fields,cookie)).status).toBe(200);
      expect((await request(`/listings/${item.id}/submit`,'POST',undefined,cookie)).status).toBe(200);
    }
  });
});
