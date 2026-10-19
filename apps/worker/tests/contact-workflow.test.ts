import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/index';

const secret='synthetic-contact-workflow-secret-at-least-32-bytes';
const bindings={...env,DB:env.DB,JWT_SECRET:secret,MEDIA_STRATEGY:'STATIC_ASSETS'};
const origin='http://localhost';
function request(path:string,method='GET',body?:unknown,cookie?:string,withOrigin=true,extraHeaders:Record<string,string>={}){return app.request(origin+path,{method,headers:{...(withOrigin?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...extraHeaders},body:body?JSON.stringify(body):undefined},bindings);}
async function ownerSession(){const response=await request('/auth/login','POST',{email:'contact-owner@example.test',password:'synthetic-owner-password-1'});expect(response.status).toBe(200);return response.headers.get('set-cookie')!.split(';')[0];}
async function adminSession(){const response=await request('/auth/login','POST',{email:'contact-admin@example.test',password:'synthetic-owner-password-1'});expect(response.status).toBe(200);return response.headers.get('set-cookie')!.split(';')[0];}

beforeAll(async()=>{
  const at=new Date().toISOString(),hash='$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS';
  await env.DB.prepare('INSERT INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at) VALUES(?,?,?,?,?,?,?)').bind('contact-owner','contact-owner@example.test',hash,'OWNER',at,at,at).run();
  await env.DB.prepare('INSERT INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at) VALUES(?,?,?,?,?,?,?)').bind('contact-admin','contact-admin@example.test',hash,'ADMIN',at,at,at).run();
  await env.DB.prepare("INSERT INTO listings(id,owner_id,status,title,description,location,publication_status,availability_status,last_confirmed_at,created_at,updated_at,location_search) VALUES(?,?,'APPROVED',?,?,?,'PUBLISHED','AVAILABLE',?,?,?,?)").bind('contact-listing','contact-owner','Casa sintética','Consulta de prueba','Uspallata',at,at,at,'uspallata').run();
  await env.DB.prepare("INSERT INTO listings(id,owner_id,status,title,description,location,publication_status,availability_status,created_at,updated_at,location_search) VALUES(?,?,'APPROVED',?,?,?,'UNPUBLISHED','AVAILABLE',?,?,?)").bind('contact-hidden','contact-owner','No publicada','No debe aceptar consultas','Uspallata',at,at,'uspallata').run();
});

describe('public contact and owner availability journey',()=>{
  it('sends a bounded public query to the listing owner and lets only that owner manage it',async()=>{
    const payload={visitorName:'  Ana Pérez ',visitorEmail:' ANA@EXAMPLE.TEST ',message:'  ¿Está libre en febrero?  '};
    expect((await request('/public/listings/contact-hidden/contact','POST',payload)).status).toBe(404);
    expect((await request('/public/listings/contact-listing/contact','POST',{...payload,ownerId:'attacker'})).status).toBe(400);
    expect((await request('/public/listings/contact-listing/contact','POST',{...payload,visitorEmail:'no-es-correo'})).status).toBe(400);
    expect((await request('/public/listings/contact-listing/contact','POST',{...payload,message:'x'.repeat(12_001)})).status).toBe(400);
    expect((await request('/public/listings/contact-listing/contact','POST',payload)).status).toBe(400);
    const key={'Idempotency-Key':'public-contact-same-result'},accepted=await request('/public/listings/contact-listing/contact','POST',payload,undefined,true,key);
    expect(accepted.status).toBe(201);const result=await accepted.json();expect(result).toMatchObject({status:'RECEIVED',id:expect.any(String)});
    const replay=await request('/public/listings/contact-listing/contact','POST',payload,undefined,true,key);
    expect(replay.status).toBe(201);expect(await replay.json()).toEqual(result);
    expect((await request('/public/listings/contact-listing/contact','POST',{...payload,message:'Consulta diferente'},undefined,true,key)).status).toBe(409);
    expect((await request('/owner/contact-events')).status).toBe(401);
    const cookie=await ownerSession(),inbox=await request('/owner/contact-events','GET',undefined,cookie);
    expect(inbox.status).toBe(200);
    const page=await inbox.json() as any;
    expect(page.unreadCount).toBe(1);
    expect(page.items[0]).toMatchObject({state:'UNREAD',visitorName:'Ana Pérez',visitorEmail:'ana@example.test',message:'¿Está libre en febrero?',listing:{id:'contact-listing',title:'Casa sintética'}});
    const eventId=page.items[0].id;
    expect((await request(`/owner/contact-events/${eventId}/state`,'PATCH',{state:'READ',ownerId:'another-owner'},cookie)).status).toBe(400);
    expect((await request(`/owner/contact-events/${eventId}/state`,'PATCH',{state:'READ'},cookie,false)).status).toBe(403);
    const marked=await request(`/owner/contact-events/${eventId}/state`,'PATCH',{state:'READ'},cookie);
    expect(marked.status).toBe(200);expect(await marked.json()).toMatchObject({id:eventId,state:'READ'});
    expect((await (await request('/owner/contact-events','GET',undefined,cookie)).json() as any).unreadCount).toBe(0);
  });

  it('bounds owner inbox pages and counts unread rows in the database',async()=>{
    const at=new Date().toISOString();
    for(let i=0;i<31;i++)await env.DB.prepare("INSERT INTO contact_events(id,listing_id,owner_id,visitor_name,visitor_email,message,state,created_at) VALUES(?,? ,?,'Visita','v@example.test','Mensaje sintético','UNREAD',?)").bind(`page-contact-${i}`,'contact-listing','contact-owner',new Date(Date.now()+i).toISOString()).run();
    const cookie=await ownerSession(),first=await request('/owner/contact-events','GET',undefined,cookie),page1=await first.json() as any;
    expect(page1.items).toHaveLength(30);expect(page1.nextCursor).toMatchObject({createdAt:expect.any(String),id:expect.any(String)});
    const unread=await env.DB.prepare("SELECT COUNT(*) AS n FROM contact_events WHERE owner_id='contact-owner' AND state='UNREAD'").first<{n:number}>();expect(page1.unreadCount).toBe(unread?.n);
    const cursor=page1.nextCursor,query=new URLSearchParams({afterCreatedAt:cursor.createdAt,afterId:cursor.id});
    const second=await request(`/owner/contact-events?${query}`,'GET',undefined,cookie),page2=await second.json() as any;
    expect(page2.items.length).toBeGreaterThan(0);expect(page2.items.length).toBeLessThanOrEqual(30);expect(page2.nextCursor).toBeNull();
    expect(new Set([...page1.items,...page2.items].map((item:any)=>item.id)).size).toBe(page1.items.length+page2.items.length);
    expect((await request('/owner/contact-events?afterCreatedAt=invalid&afterId=x','GET',undefined,cookie)).status).toBe(400);
  });

  it('lets the authenticated owner change and reconfirm listing availability',async()=>{
    const cookie=await ownerSession();
    expect((await request('/listings/contact-listing/availability','PATCH',{availabilityStatus:'UNAVAILABLE',ownerId:'attacker'},cookie)).status).toBe(400);
    expect((await request('/listings/contact-listing/availability','PATCH',{availabilityStatus:'UNAVAILABLE'},cookie,false)).status).toBe(403);
    const update=await request('/listings/contact-listing/availability','PATCH',{availabilityStatus:'UNAVAILABLE'},cookie);
    expect(update.status).toBe(200);expect(await update.json()).toMatchObject({availabilityStatus:'UNAVAILABLE',lastConfirmedAt:expect.any(String)});
    expect((await request('/public/listings?availableOnly=true')).status).toBe(200);
    const reconfirm=await request('/listings/contact-listing/reconfirm','POST',undefined,cookie);
    expect(reconfirm.status).toBe(200);expect(await reconfirm.json()).toMatchObject({availabilityStatus:'UNAVAILABLE',lastConfirmedAt:expect.any(String)});
  });

  it('allows only ADMIN to create an audited draft for an existing OWNER',async()=>{
    expect((await request('/admin/owners')).status).toBe(401);
    const ownerCookie=await ownerSession();expect((await request('/admin/owners','GET',undefined,ownerCookie)).status).toBe(401);
    const adminCookie=await adminSession(),owners=await request('/admin/owners','GET',undefined,adminCookie);
    expect(await owners.json()).toEqual([{id:'contact-owner',email:'contact-owner@example.test'}]);
    const fields={ownerId:'contact-owner',title:'Borrador creado con asistencia',description:'Datos sintéticos para el recorrido asistido.',location:'Uspallata',priceAmount:50000,pricePeriod:'MONTH',rentalDuration:'FLEXIBLE',maxOccupants:2,currency:'ARS'};
    expect((await request('/admin/listings/assisted','POST',fields,adminCookie)).status).toBe(400);
    expect((await request('/admin/listings/assisted','POST',{...fields,ownerId:'missing-owner'},adminCookie,true,{'Idempotency-Key':'assist-missing'})).status).toBe(404);
    expect((await request('/admin/listings/assisted','POST',{...fields,ownerId:'contact-owner',status:'APPROVED'},adminCookie)).status).toBe(400);
    const key={'Idempotency-Key':'assist-same-result'},created=await request('/admin/listings/assisted','POST',fields,adminCookie,true,key);
    expect(created.status).toBe(201);const listing=await created.json() as any;
    expect(listing).toMatchObject({status:'DRAFT',publicationStatus:'UNPUBLISHED',owner:{id:'contact-owner',role:'OWNER'}});
    const replay=await request('/admin/listings/assisted','POST',fields,adminCookie,true,key);expect(replay.status).toBe(201);expect(await replay.json()).toEqual(listing);
    expect((await request('/admin/listings/assisted','POST',{...fields,title:'Payload distinto'},adminCookie,true,key)).status).toBe(409);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM listings WHERE title=?").bind(fields.title).first()).toMatchObject({n:1});
    const audit=await request(`/admin/listings/audit?listingId=${encodeURIComponent(listing.id)}`,'GET',undefined,adminCookie);
    expect(await audit.json()).toEqual([expect.objectContaining({action:'ADMIN_ASSISTED_LISTING_CREATED',actor:{id:'contact-admin',email:'contact-admin@example.test',role:'ADMIN'},targetOwner:{id:'contact-owner',email:'contact-owner@example.test',role:'OWNER'}})]);
    const submitted=await request(`/listings/${listing.id}/submit`,'POST',undefined,ownerCookie);
    expect(submitted.status).toBe(200);expect(await submitted.json()).toMatchObject({status:'SUBMITTED'});
    const queue=await request('/admin/listings/review','GET',undefined,adminCookie);
    expect(JSON.stringify(await queue.json())).toContain('Borrador creado con asistencia');
  });

  it('does not commit assisted creation when the listing insert affects zero rows',async()=>{
    const cookie=await adminSession(),fields={ownerId:'contact-owner',title:'Duplicate assisted target',description:'Synthetic atomicity regression.',location:'Uspallata',priceAmount:50000,pricePeriod:'MONTH',rentalDuration:'FLEXIBLE',maxOccupants:2,currency:'ARS'},key={'Idempotency-Key':'assist-zero-row-guard'};
    await env.DB.exec("CREATE TRIGGER fail_assisted_first_attempt BEFORE INSERT ON listings WHEN NEW.title='Duplicate assisted target' BEGIN SELECT RAISE(ABORT,'injected first-attempt failure'); END;");
    const first=await request('/admin/listings/assisted','POST',fields,cookie,true,key);
    await env.DB.exec('DROP TRIGGER fail_assisted_first_attempt');
    expect(first.status).toBe(503);
    const reservation=await env.DB.prepare("SELECT resource_id AS id,state FROM idempotency_records WHERE owner_id='contact-admin' AND scope='ADMIN_ASSISTED_LISTING_CREATE' AND request_key=?").bind(key['Idempotency-Key']).first<{id:string;state:string}>();
    expect(reservation?.state).toBe('PENDING');
    const at=new Date().toISOString();
    await env.DB.prepare("INSERT INTO listings(id,owner_id,status,title,description,location,location_search,publication_status,availability_status,created_at,updated_at) VALUES(?,?,'DRAFT',?,?,?,?,'UNPUBLISHED','AVAILABLE',?,?)").bind(reservation!.id,'contact-owner',fields.title,fields.description,fields.location,'uspallata',at,at).run();

    const retry=await request('/admin/listings/assisted','POST',fields,cookie,true,key);
    expect(retry.status).toBe(503);
    expect(await env.DB.prepare('SELECT id FROM admin_audit_events WHERE listing_id=?').bind(reservation!.id).first()).toBeNull();
    expect((await env.DB.prepare("SELECT state FROM idempotency_records WHERE owner_id='contact-admin' AND scope='ADMIN_ASSISTED_LISTING_CREATE' AND request_key=?").bind(key['Idempotency-Key']).first<{state:string}>())?.state).toBe('PENDING');
  });

  it('searches OWNER accounts beyond the initial assisted-management result page',async()=>{
    const at=new Date().toISOString();
    for(let i=0;i<60;i++)await env.DB.prepare('INSERT INTO users(id,email,password_hash,role,created_at,updated_at) VALUES(?,?,?,\'OWNER\',?,?)').bind(`late-owner-${i}`,`zz-late-owner-${i}@example.test`,'synthetic-only',at,at).run();
    const cookie=await adminSession(),first=await request('/admin/owners','GET',undefined,cookie),firstPage=await first.json() as any;
    expect(firstPage).toHaveLength(50);
    expect(firstPage.some((owner:any)=>owner.id==='late-owner-59')).toBe(false);
    const match=await request('/admin/owners?search=zz-late-owner-59','GET',undefined,cookie);
    expect(match.status).toBe(200);expect(await match.json()).toEqual([{id:'late-owner-59',email:'zz-late-owner-59@example.test'}]);
    expect((await request(`/admin/owners?search=${'x'.repeat(255)}`,'GET',undefined,cookie)).status).toBe(400);
  });
});
