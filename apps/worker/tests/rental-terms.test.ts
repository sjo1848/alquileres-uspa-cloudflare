import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/index';

const origin='http://localhost',secret='synthetic-rental-terms-secret-at-least-32-bytes';
const base={title:'Casa mensual sintética',description:'Datos locales de prueba',location:'Uspallata',priceAmount:125000,pricePeriod:'MONTH',rentalDuration:'MONTHS',maxOccupants:3,currency:'ARS'};
const terms={depositStatus:'FIXED_AMOUNT',depositAmount:250000,depositCurrency:'ARS',internetIncluded:'INCLUDED',waterIncluded:'NOT_INCLUDED',electricityIncluded:'NOT_INFORMED',gasIncluded:'INCLUDED',petsPolicy:'ASK_OWNER',availableFrom:'2027-02-15'};
function request(path:string,method='GET',body?:unknown,cookie?:string,key?:string){return app.request(origin+path,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)},{...env,DB:env.DB,JWT_SECRET:secret,MEDIA_STRATEGY:'D1_BLOB'});}
async function login(email:string){const response=await request('/auth/login','POST',{email,password:'synthetic-owner-password-1'});expect(response.status).toBe(200);return response.headers.get('set-cookie')!.split(';')[0];}
async function fingerprint(value:unknown){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))));let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);return btoa(raw).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}

beforeAll(async()=>{
  const hash='$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS',at=new Date().toISOString();
  for(const [id,email,role]of [['terms-owner-a','terms-a@example.test','OWNER'],['terms-owner-b','terms-b@example.test','OWNER'],['terms-admin','terms-admin@example.test','ADMIN']])await env.DB.prepare('INSERT INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at) VALUES(?,?,?,?,?,?,?)').bind(id,email,hash,role,at,at,at).run();
});

describe('M2.1 owner-declared rental terms',()=>{
  it('persists optional monthly terms for their OWNER, exposes them to public detail and read-only ADMIN, and preserves NULL history',async()=>{
    const owner=await login('terms-a@example.test'),other=await login('terms-b@example.test'),admin=await login('terms-admin@example.test');
    const created=await request('/listings','POST',{...base,...terms},owner,'terms-create-once');expect(created.status).toBe(201);const item=await created.json() as any;
    expect(item).toMatchObject({...terms,status:'DRAFT',ownerId:'terms-owner-a'});
    const replay=await request('/listings','POST',{...base,...terms},owner,'terms-create-once');expect(replay.status).toBe(201);expect(await replay.json()).toEqual(item);
    expect((await request('/listings','POST',{...base,...terms,availableFrom:'2027-02-16'},owner,'terms-create-once')).status).toBe(409);
    expect((await request(`/listings/${item.id}`,'GET',undefined,other)).status).toBe(404);
    expect((await request(`/listings/${item.id}`,'PATCH',{...base,...terms,petsPolicy:'ALLOWED'},other)).status).toBe(404);
    expect((await request(`/admin/listings/assisted/${item.id}`,'PATCH',{...base,...terms,expectedUpdatedAt:item.updatedAt},admin)).status).toBe(400);
    expect(await env.DB.prepare('SELECT deposit_status,deposit_amount,deposit_currency,available_from FROM listings WHERE id=?').bind(item.id).first()).toEqual({deposit_status:'FIXED_AMOUNT',deposit_amount:250000,deposit_currency:'ARS',available_from:'2027-02-15'});
    await env.DB.prepare("UPDATE listings SET status='APPROVED',publication_status='PUBLISHED' WHERE id=?").bind(item.id).run();
    const publicRead=await request(`/public/listings/${item.id}`);expect(publicRead.status).toBe(200);expect(await publicRead.json()).toMatchObject(terms);
    const adminRead=await request(`/admin/listings/${item.id}`,'GET',undefined,admin);expect(adminRead.status).toBe(200);expect(await adminRead.json()).toMatchObject(terms);
    expect((await request(`/listings/${item.id}`,'PATCH',{...base,...terms,depositAmount:300000},owner)).status).toBe(404);
    const historicalId=`terms-old-${crypto.randomUUID()}`;
    await env.DB.prepare("INSERT INTO listings(id,owner_id,status,title,description,location,location_search,price_amount,price_period,rental_duration,max_occupants,currency,publication_status,availability_status,created_at,updated_at) VALUES(?,'terms-owner-a','APPROVED','Histórico sintético','Descripción','Uspallata','uspallata',100000,'MONTH','MONTHS',2,'ARS','PUBLISHED','AVAILABLE',?,?)").bind(historicalId,new Date().toISOString(),new Date().toISOString()).run();
    const historical=await request(`/public/listings/${historicalId}`);expect(historical.status).toBe(200);expect(await historical.json()).toMatchObject({depositStatus:null,internetIncluded:null,waterIncluded:null,petsPolicy:null,availableFrom:null});
  });

  it('rejects invalid, contradictory or out-of-range declarations without creating a listing',async()=>{
    const owner=await login('terms-a@example.test');
    for(const invalid of [
      {...terms,depositStatus:'NOT_REQUIRED'},
      {...terms,depositAmount:0},
      {...terms,depositCurrency:'EUR'},
      {...terms,internetIncluded:'FREE'},
      {...terms,petsPolicy:'SOMETIMES'},
      {...terms,availableFrom:'2027-02-30'},
      {...terms,availableFrom:'15/02/2027'},
    ])expect((await request('/listings','POST',{...base,...invalid},owner)).status).toBe(400);
    const sparse={...base,title:'Condiciones pendientes',depositStatus:'ASK_OWNER',depositAmount:null,depositCurrency:null,internetIncluded:'NOT_INFORMED',waterIncluded:'NOT_INFORMED',electricityIncluded:'NOT_INFORMED',gasIncluded:'NOT_INFORMED',petsPolicy:'NOT_INFORMED',availableFrom:null};
    const created=await request('/listings','POST',sparse,owner);expect(created.status).toBe(201);const item=await created.json() as any;expect(item).toMatchObject({depositStatus:'ASK_OWNER',depositAmount:null,depositCurrency:null});
    const submitted=await request(`/listings/${item.id}/submit`,'POST',undefined,owner);expect(submitted.status).toBe(200);expect(await submitted.json()).toMatchObject({status:'SUBMITTED',internetIncluded:'NOT_INFORMED',petsPolicy:'NOT_INFORMED',availableFrom:null});
    expect((await env.DB.prepare("SELECT COUNT(*) AS count FROM listings WHERE owner_id='terms-owner-a' AND title=?").bind(base.title).first<{count:number}>())?.count).toBe(1);
  });

  it('keeps monthly conditions off weekly rentals at create and when changing period',async()=>{
    const owner=await login('terms-a@example.test');
    expect((await request('/listings','POST',{...base,pricePeriod:'WEEK',...terms},owner)).status).toBe(400);
    const weekly=await request('/listings','POST',{...base,title:'Weekly synthetic',pricePeriod:'WEEK'},owner);expect(weekly.status).toBe(201);
    const item=await weekly.json() as any;expect(item).toMatchObject({pricePeriod:'WEEK',depositStatus:'NOT_INFORMED',depositAmount:null,petsPolicy:'NOT_INFORMED',availableFrom:null});
    expect((await request(`/listings/${item.id}`,'PATCH',{...base,pricePeriod:'WEEK',...terms},owner)).status).toBe(400);
    const monthly=await request('/listings','POST',{...base,title:'Monthly to weekly synthetic',...terms},owner);expect(monthly.status).toBe(201);
    const monthlyItem=await monthly.json() as any;
    const changed=await request(`/listings/${monthlyItem.id}`,'PATCH',{...base,pricePeriod:'WEEK'},owner);expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({pricePeriod:'WEEK',depositStatus:'NOT_INFORMED',depositAmount:null,depositCurrency:null,internetIncluded:'NOT_INFORMED',waterIncluded:'NOT_INFORMED',electricityIncluded:'NOT_INFORMED',gasIncluded:'NOT_INFORMED',petsPolicy:'NOT_INFORMED',availableFrom:null});
    expect(await env.DB.prepare('SELECT price_period,deposit_status,deposit_amount,pets_policy,available_from FROM listings WHERE id=?').bind(monthlyItem.id).first()).toEqual({price_period:'WEEK',deposit_status:'NOT_INFORMED',deposit_amount:null,pets_policy:'NOT_INFORMED',available_from:null});
  });

  it('prevents ADMIN-assisted period changes or submission from bypassing monthly-term validation',async()=>{
    const owner=await login('terms-a@example.test'),admin=await login('terms-admin@example.test');
    const created=await request('/listings','POST',{...base,title:'Admin weekly guard synthetic',...terms},owner);expect(created.status).toBe(201);const item=await created.json() as any;
    const patch={title:item.title,description:item.description,location:item.location,priceAmount:item.priceAmount,pricePeriod:'WEEK',rentalDuration:'WEEKS',maxOccupants:item.maxOccupants,currency:item.currency,expectedUpdatedAt:item.updatedAt};
    expect((await request(`/admin/listings/assisted/${item.id}`,'PATCH',patch,admin,'terms-assisted-weekly-change')).status).toBe(400);
    expect(await env.DB.prepare('SELECT price_period,deposit_status,deposit_amount FROM listings WHERE id=?').bind(item.id).first()).toEqual({price_period:'MONTH',deposit_status:'FIXED_AMOUNT',deposit_amount:250000});
    await env.DB.prepare("UPDATE listings SET price_period='WEEK' WHERE id=?").bind(item.id).run();
    expect((await request(`/admin/listings/assisted/${item.id}/submit`,'POST',undefined,admin,'terms-assisted-weekly-submit')).status).toBe(400);
    expect(await env.DB.prepare('SELECT status,price_period,deposit_status,deposit_amount FROM listings WHERE id=?').bind(item.id).first()).toEqual({status:'DRAFT',price_period:'WEEK',deposit_status:'FIXED_AMOUNT',deposit_amount:250000});
  });

  it('replays a pre-M2.1 create idempotency record using the original fingerprint',async()=>{
    const owner=await login('terms-a@example.test'),listingId=`legacy-terms-${crypto.randomUUID()}`,at=new Date().toISOString(),legacyInput={...base,title:'Legacy replay synthetic'};
    const fingerprintValue={title:legacyInput.title,description:legacyInput.description,location:legacyInput.location,priceAmount:legacyInput.priceAmount,pricePeriod:legacyInput.pricePeriod,rentalDuration:legacyInput.rentalDuration,maxOccupants:legacyInput.maxOccupants,currency:legacyInput.currency};
    const legacyResult={id:listingId,ownerId:'terms-owner-a',status:'DRAFT',...legacyInput,publicationStatus:'UNPUBLISHED',availabilityStatus:'AVAILABLE',lastConfirmedAt:null,rejectionReason:null,createdAt:at,updatedAt:at};
    await env.DB.prepare("INSERT INTO listings(id,owner_id,status,title,description,location,location_search,price_amount,price_period,rental_duration,max_occupants,currency,created_at,updated_at) VALUES(?,'terms-owner-a','DRAFT',?,?,?,?,?,?,?,?,?,?,?)").bind(listingId,legacyInput.title,legacyInput.description,legacyInput.location,legacyInput.location.normalize('NFC').toLowerCase(),legacyInput.priceAmount,legacyInput.pricePeriod,legacyInput.rentalDuration,legacyInput.maxOccupants,legacyInput.currency,at,at).run();
    await env.DB.prepare("INSERT INTO idempotency_records(owner_id,scope,request_key,request_fingerprint,resource_id,state,result_json,created_at,updated_at) VALUES('terms-owner-a','LISTING_CREATE','pre-m2-create',?,?,'COMMITTED',?,?,?)").bind(await fingerprint(fingerprintValue),listingId,JSON.stringify(legacyResult),at,at).run();
    const replay=await request('/listings','POST',legacyInput,owner,'pre-m2-create');expect(replay.status).toBe(201);expect(await replay.json()).toEqual(legacyResult);
    expect((await request('/listings','POST',{...legacyInput,priceAmount:legacyInput.priceAmount+1},owner,'pre-m2-create')).status).toBe(409);
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM listings WHERE id=?').bind(listingId).first('count')).toBe(1);
  });
});
