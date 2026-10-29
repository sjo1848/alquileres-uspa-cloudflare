import { env } from 'cloudflare:workers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/index';

const secret='synthetic-owner-admin-management-secret-at-least-32-bytes';
const bindings={...env,DB:env.DB,JWT_SECRET:secret,MEDIA_STRATEGY:'D1_BLOB'};
const origin='http://localhost';
const UNSET_MEDIA_STRATEGY=Symbol('unset-media-strategy');
const fields={title:'Casa sintética',description:'Datos de prueba',location:'Uspallata',priceAmount:25000,pricePeriod:'MONTH',rentalDuration:'FLEXIBLE',maxOccupants:2,currency:'ARS'};
const png=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9AAAAAElFTkSuQmCC','base64'));
const ownerId='listing-mgmt-owner',otherId='listing-mgmt-other',adminId='listing-mgmt-admin';
let ownerCookie='',otherCookie='',adminCookie='';
const listingIds:string[]=[];
function request(path:string,method='GET',body?:unknown,cookie?:string,key?:string,withOrigin=true,mediaStrategy:string|undefined|typeof UNSET_MEDIA_STRATEGY=bindings.MEDIA_STRATEGY){
  const testBindings:{[key:string]:unknown}={...bindings};if(mediaStrategy===UNSET_MEDIA_STRATEGY)delete testBindings.MEDIA_STRATEGY;else testBindings.MEDIA_STRATEGY=mediaStrategy;
  return app.request(origin+path,{method,headers:{...(withOrigin?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...(key?{'Idempotency-Key':key}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)},testBindings as typeof bindings);
}
async function login(email:string){const response=await request('/auth/login','POST',{email,password:'synthetic-owner-password-1'});expect(response.status).toBe(200);return response.headers.get('set-cookie')!.split(';')[0];}
async function create(owner=ownerCookie,title=fields.title){const response=await request('/listings','POST',{...fields,title},owner,crypto.randomUUID());expect(response.status).toBe(201);const result=await response.json() as {id:string;updatedAt:string};listingIds.push(result.id);return result;}
beforeAll(async()=>{
  const hash='$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS',at=new Date().toISOString();
  for(const [id,email,role] of [[ownerId,'listing.mgmt.owner@example.test','OWNER'],[otherId,'listing.mgmt.other@example.test','OWNER'],[adminId,'listing.mgmt.admin@example.test','ADMIN']])
    await env.DB.prepare('INSERT INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email_verified_at=excluded.email_verified_at').bind(id,email,hash,role,at,at,at).run();
  ownerCookie=await login('listing.mgmt.owner@example.test');otherCookie=await login('listing.mgmt.other@example.test');adminCookie=await login('listing.mgmt.admin@example.test');
});
afterAll(async()=>{
  await env.DB.prepare('DELETE FROM idempotency_records WHERE (owner_id=? OR owner_id=?) AND (scope LIKE ? OR scope LIKE ?)').bind(ownerId,adminId,'OWNER_LISTING_DELETE:%','ADMIN_ASSISTED_%').run();
  for(let start=0;start<listingIds.length;start+=50){
    const batch=listingIds.slice(start,start+50),slots=batch.map(()=>'?').join(',');
    await env.DB.prepare(`DELETE FROM image_operations WHERE listing_id IN (${slots})`).bind(...batch).run();
    await env.DB.prepare(`DELETE FROM admin_audit_events WHERE listing_id IN (${slots})`).bind(...batch).run();
    await env.DB.prepare(`DELETE FROM listings WHERE id IN (${slots})`).bind(...batch).run();
  }
});

describe('OWNER listing lifecycle',()=>{
  it('validates rental terms and permits retry after ADMIN rejects a change proposal',async()=>{
    const item=await create(ownerCookie,'Alquiler sintético revisable');
    await env.DB.prepare("UPDATE listings SET status='APPROVED',publication_status='PUBLISHED' WHERE id=?").bind(item.id).run();
    const baseline=await env.DB.prepare('SELECT title,updated_at AS updatedAt FROM listings WHERE id=?').bind(item.id).first<{title:string;updatedAt:string}>();
    expect(baseline).not.toBeNull();
    const baseUpdatedAt=baseline!.updatedAt;
    const invalidDeposit={...fields,depositStatus:'FIXED_AMOUNT',depositAmount:20000,depositCurrency:null};
    expect((await request('/listings/'+item.id+'/revision','PUT',{expectedVersion:0,baseUpdatedAt,fields:invalidDeposit},ownerCookie)).status).toBe(400);
    const invalidWeekly={...fields,pricePeriod:'WEEK',petsPolicy:'ALLOWED'};
    expect((await request('/listings/'+item.id+'/revision','PUT',{expectedVersion:0,baseUpdatedAt,fields:invalidWeekly},ownerCookie)).status).toBe(400);
    const proposed={...fields,title:'Alquiler corregido',petsPolicy:'ALLOWED',internetIncluded:'INCLUDED'};
    const saved=await request('/listings/'+item.id+'/revision','PUT',{expectedVersion:0,baseUpdatedAt,fields:proposed},ownerCookie);
    expect(saved.status,await saved.clone().text()).toBe(200);
    const submit=await request('/listings/'+item.id+'/revision/submit','POST',{expectedVersion:1},ownerCookie);
    expect(submit.status).toBe(200);
    const reject=await request('/admin/listings/'+item.id+'/revision/review','POST',{action:'reject',expectedVersion:2,reason:'La ubicación requiere aclaración'},adminCookie);
    expect(reject.status,await reject.clone().text()).toBe(200);
    expect((await reject.json() as any).revision).toMatchObject({state:'REJECTED',version:3,rejectionReason:'La ubicación requiere aclaración'});
    expect(await env.DB.prepare('SELECT title,updated_at AS updatedAt FROM listings WHERE id=?').bind(item.id).first()).toEqual(baseline);
    const edited=await request('/listings/'+item.id+'/revision','PUT',{expectedVersion:3,baseUpdatedAt,fields:{...proposed,description:'Descripción corregida'}},ownerCookie);
    expect(edited.status,await edited.clone().text()).toBe(200);
    expect((await edited.json() as any).revision).toMatchObject({state:'DRAFT',version:4,rejectionReason:null,fields:{description:'Descripción corregida'}});
    expect((await request('/listings/'+item.id+'/revision/submit','POST',{expectedVersion:3},ownerCookie)).status).toBe(409);
    expect(await env.DB.prepare('SELECT title,updated_at AS updatedAt FROM listings WHERE id=?').bind(item.id).first()).toEqual(baseline);
  });


  it('keeps a published listing immutable while OWNER saves and submits a private revision',async()=>{
    const item=await create(ownerCookie,'Alojamiento publicado sintético');
    await env.DB.prepare("UPDATE listings SET status='APPROVED',publication_status='PUBLISHED' WHERE id=?").bind(item.id).run();
    const original=await env.DB.prepare('SELECT title,price_amount AS priceAmount,updated_at AS updatedAt,status,publication_status AS publicationStatus FROM listings WHERE id=?').bind(item.id).first<any>();
    expect((await request(`/public/listings/${item.id}`)).status).toBe(200);
    expect(await (await request(`/public/listings/${item.id}`)).json()).toMatchObject({title:original.title,priceAmount:original.priceAmount});
    expect(original.status).toBe('APPROVED');
    expect((await request('/listings/'+item.id+'/revision','GET',undefined,otherCookie)).status).toBe(404);
    expect((await request('/listings/'+item.id+'/revision','PUT',{expectedVersion:0,baseUpdatedAt:original.updatedAt,fields:{...fields,title:'Edición ajena'}},otherCookie)).status).toBe(404);
    const get=await request('/listings/'+item.id+'/revision','GET',undefined,ownerCookie);
    expect(get.status).toBe(200);expect((await get.json() as any).revision).toBeNull();
    const changes={...fields,title:'Casa sintética revisada',priceAmount:35000,depositStatus:'NOT_REQUIRED',petsPolicy:'ALLOWED'};
    const saved=await request('/listings/'+item.id+'/revision','PUT',{expectedVersion:0,baseUpdatedAt:original.updatedAt,fields:changes},ownerCookie);
    expect(saved.status,await saved.clone().text()).toBe(200);
    const revision=(await saved.json() as any).revision;
    expect(revision).toMatchObject({listingId:item.id,ownerId,state:'DRAFT',version:1,fields:{title:changes.title,priceAmount:35000,depositStatus:'NOT_REQUIRED',petsPolicy:'ALLOWED'}});
    expect((await request('/listings/'+item.id+'/revision','PUT',{expectedVersion:0,baseUpdatedAt:original.updatedAt,fields:changes},ownerCookie)).status).toBe(409);
    expect((await request('/listings/'+item.id+'/revision/submit','POST',{expectedVersion:0},ownerCookie)).status).toBe(400);
    const submitted=await request('/listings/'+item.id+'/revision/submit','POST',{expectedVersion:1},ownerCookie);
    expect(submitted.status,await submitted.clone().text()).toBe(200);
    expect((await submitted.json() as any).revision).toMatchObject({state:'SUBMITTED',version:2});
    expect((await request('/listings/'+item.id+'/revision','PUT',{expectedVersion:2,baseUpdatedAt:original.updatedAt,fields:changes},ownerCookie)).status).toBe(409);
    expect(await env.DB.prepare('SELECT title,price_amount AS priceAmount,updated_at AS updatedAt,status,publication_status AS publicationStatus FROM listings WHERE id=?').bind(item.id).first()).toEqual(original);
    expect(await (await request(`/public/listings/${item.id}`)).json()).toMatchObject({title:original.title,priceAmount:original.priceAmount});
    const waiting=await request('/admin/listings/revisions','GET',undefined,adminCookie);
    expect(waiting.status).toBe(200);
    expect((await waiting.json() as any).items).toEqual(expect.arrayContaining([
      expect.objectContaining({listingId:item.id,state:'SUBMITTED',version:2,ownerEmail:'listing.mgmt.owner@example.test'}),
    ]));
    expect((await request('/admin/listings/'+item.id+'/revision/review','POST',{action:'approve',expectedVersion:2},ownerCookie)).status).toBe(401);
    const approved=await request('/admin/listings/'+item.id+'/revision/review','POST',{action:'approve',expectedVersion:2},adminCookie);
    expect(approved.status,await approved.clone().text()).toBe(200);
    expect((await approved.json() as any).revision).toMatchObject({state:'APPROVED',version:3});
    expect(await env.DB.prepare('SELECT title,price_amount AS priceAmount,updated_at AS updatedAt,status,publication_status AS publicationStatus FROM listings WHERE id=?').bind(item.id).first()).toEqual(original);
    expect(await (await request(`/public/listings/${item.id}`)).json()).toMatchObject({title:original.title,priceAmount:original.priceAmount});
    const published=await request('/admin/listings/'+item.id+'/revision/publish','POST',{expectedVersion:3},adminCookie);
    expect(published.status,await published.clone().text()).toBe(200);
    const final=(await published.json() as any);
    expect(final.revision).toMatchObject({state:'APPLIED',version:4});
    expect(final.listing).toMatchObject({id:item.id,title:changes.title,priceAmount:35000,status:'APPROVED',publicationStatus:'PUBLISHED'});
    expect(await (await request(`/public/listings/${item.id}`)).json()).toMatchObject({title:changes.title,priceAmount:35000});
    const refreshed=await env.DB.prepare('SELECT title,price_amount AS priceAmount,status,publication_status AS publicationStatus FROM listings WHERE id=?').bind(item.id).first();
    expect(refreshed).toMatchObject({title:changes.title,priceAmount:35000,status:'APPROVED',publicationStatus:'PUBLISHED'});
    expect((await request('/admin/listings/'+item.id+'/revision/publish','POST',{expectedVersion:3},adminCookie)).status).toBe(409);
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_events WHERE listing_id=? AND action IN (?,?,?)').bind(item.id,'ADMIN_LISTING_REVISION_APPROVED','ADMIN_LISTING_REVISION_REJECTED','ADMIN_LISTING_REVISION_PUBLISHED').first('n')).toBe(2);
  });
  it('serializes concurrent revision saves, decisions and publication with version conflicts',async()=>{
    const item=await create(ownerCookie,'Publicación para carreras sintéticas');
    await env.DB.prepare("UPDATE listings SET status='APPROVED',publication_status='PUBLISHED' WHERE id=?").bind(item.id).run();
    const original=await env.DB.prepare('SELECT updated_at AS updatedAt FROM listings WHERE id=?').bind(item.id).first<{updatedAt:string}>();
    const baseUpdatedAt=original!.updatedAt;
    const candidates=['Propuesta concurrente A','Propuesta concurrente B'];
    const saves=await Promise.all(candidates.map(title=>request(`/listings/${item.id}/revision`,'PUT',{expectedVersion:0,baseUpdatedAt,fields:{...fields,title}},ownerCookie)));
    expect(saves.map(response=>response.status).sort()).toEqual([200,409]);
    const saved=await env.DB.prepare('SELECT state,version,payload FROM listing_change_revisions WHERE listing_id=?').bind(item.id).first<{state:string;version:number;payload:string}>();
    expect(saved).toMatchObject({state:'DRAFT',version:1});
    const winnerTitle=(JSON.parse(saved!.payload) as {title:string}).title;
    expect(candidates).toContain(winnerTitle);
    const submissions=await Promise.all([
      request(`/listings/${item.id}/revision/submit`,'POST',{expectedVersion:1},ownerCookie),
      request(`/listings/${item.id}/revision/submit`,'POST',{expectedVersion:1},ownerCookie),
    ]);
    expect(submissions.map(response=>response.status).sort()).toEqual([200,409]);
    const decisions=await Promise.all([
      request(`/admin/listings/${item.id}/revision/review`,'POST',{action:'approve',expectedVersion:2},adminCookie),
      request(`/admin/listings/${item.id}/revision/review`,'POST',{action:'approve',expectedVersion:2},adminCookie),
    ]);
    expect(decisions.map(response=>response.status).sort()).toEqual([200,409]);
    const publications=await Promise.all([
      request(`/admin/listings/${item.id}/revision/publish`,'POST',{expectedVersion:3},adminCookie),
      request(`/admin/listings/${item.id}/revision/publish`,'POST',{expectedVersion:3},adminCookie),
    ]);
    expect(publications.map(response=>response.status).sort()).toEqual([200,409]);
    expect(await env.DB.prepare('SELECT state,version FROM listing_change_revisions WHERE listing_id=?').bind(item.id).first()).toEqual({state:'APPLIED',version:4});
    expect(await env.DB.prepare('SELECT title,status,publication_status AS publicationStatus FROM listings WHERE id=?').bind(item.id).first()).toMatchObject({title:winnerTitle,status:'APPROVED',publicationStatus:'PUBLISHED'});
    expect(Number(await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit_events WHERE listing_id=? AND action IN ('ADMIN_LISTING_REVISION_APPROVED','ADMIN_LISTING_REVISION_PUBLISHED')").bind(item.id).first('n'))).toBe(2);
  });

  it('rolls back approval and publication atomically when revision audit insertion fails',async()=>{
    const item=await create(ownerCookie,'Publicación para rollback transaccional');
    await env.DB.prepare("UPDATE listings SET status='APPROVED',publication_status='PUBLISHED' WHERE id=?").bind(item.id).run();
    const original=await env.DB.prepare('SELECT title,price_amount AS priceAmount,updated_at AS updatedAt,status,publication_status AS publicationStatus FROM listings WHERE id=?').bind(item.id).first<any>();
    const changes={...fields,title:'Cambio que no debe quedar parcial',priceAmount:41000};
    expect((await request(`/listings/${item.id}/revision`,'PUT',{expectedVersion:0,baseUpdatedAt:original.updatedAt,fields:changes},ownerCookie)).status).toBe(200);
    expect((await request(`/listings/${item.id}/revision/submit`,'POST',{expectedVersion:1},ownerCookie)).status).toBe(200);

    await env.DB.prepare("CREATE TRIGGER fail_revision_approval_audit BEFORE INSERT ON admin_audit_events WHEN NEW.action='ADMIN_LISTING_REVISION_APPROVED' BEGIN SELECT RAISE(ABORT,'synthetic approval audit failure'); END").run();
    try {
      expect((await request(`/admin/listings/${item.id}/revision/review`,'POST',{action:'approve',expectedVersion:2},adminCookie)).status).toBe(503);
      expect(await env.DB.prepare('SELECT state,version FROM listing_change_revisions WHERE listing_id=?').bind(item.id).first()).toEqual({state:'SUBMITTED',version:2});
      expect(await env.DB.prepare('SELECT title,price_amount AS priceAmount,updated_at AS updatedAt,status,publication_status AS publicationStatus FROM listings WHERE id=?').bind(item.id).first()).toEqual(original);
      expect(Number(await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit_events WHERE listing_id=? AND action='ADMIN_LISTING_REVISION_APPROVED'").bind(item.id).first('n'))).toBe(0);
    } finally { await env.DB.prepare('DROP TRIGGER IF EXISTS fail_revision_approval_audit').run(); }

    expect((await request(`/admin/listings/${item.id}/revision/review`,'POST',{action:'approve',expectedVersion:2},adminCookie)).status).toBe(200);
    await env.DB.prepare("CREATE TRIGGER fail_revision_publication_audit BEFORE INSERT ON admin_audit_events WHEN NEW.action='ADMIN_LISTING_REVISION_PUBLISHED' BEGIN SELECT RAISE(ABORT,'synthetic publication audit failure'); END").run();
    try {
      expect((await request(`/admin/listings/${item.id}/revision/publish`,'POST',{expectedVersion:3},adminCookie)).status).toBe(503);
      expect(await env.DB.prepare('SELECT state,version FROM listing_change_revisions WHERE listing_id=?').bind(item.id).first()).toEqual({state:'APPROVED',version:3});
      expect(await env.DB.prepare('SELECT title,price_amount AS priceAmount,updated_at AS updatedAt,status,publication_status AS publicationStatus FROM listings WHERE id=?').bind(item.id).first()).toEqual(original);
      expect(Number(await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit_events WHERE listing_id=? AND action='ADMIN_LISTING_REVISION_PUBLISHED'").bind(item.id).first('n'))).toBe(0);
    } finally { await env.DB.prepare('DROP TRIGGER IF EXISTS fail_revision_publication_audit').run(); }

    const retry=await request(`/admin/listings/${item.id}/revision/publish`,'POST',{expectedVersion:3},adminCookie);
    expect(retry.status,await retry.clone().text()).toBe(200);
    expect(await env.DB.prepare('SELECT title,price_amount AS priceAmount,status,publication_status AS publicationStatus FROM listings WHERE id=?').bind(item.id).first()).toMatchObject({title:changes.title,priceAmount:changes.priceAmount,status:'APPROVED',publicationStatus:'PUBLISHED'});
  });

  it('preserves photos and contacts through monthly publication and accepts term-free weekly revisions',async()=>{
    const monthly=await create(ownerCookie,'Alquiler mensual con medios y consulta');
    await env.DB.prepare("UPDATE listings SET status='APPROVED',publication_status='PUBLISHED' WHERE id=?").bind(monthly.id).run();
    const at=new Date().toISOString(),blobId=`revision-blob-${monthly.id}`,staticId=`revision-static-${monthly.id}`,contactId=`revision-contact-${monthly.id}`;
    await env.DB.prepare('INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at,blob_data) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(blobId,monthly.id,`d1blob:${blobId}`,'synthetic.png','image/png',png.byteLength,0,at,at,png).run();
    await env.DB.prepare('INSERT INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES(?,?,?,?,?,?)').bind(staticId,monthly.id,'/media/catalog/revision-synthetic.svg','image/svg+xml',91,1).run();
    await env.DB.prepare("INSERT INTO contact_events(id,listing_id,owner_id,visitor_name,visitor_email,message,state,created_at) VALUES(?,?,?,'Visitante sintético','visitor@example.test','Consulta sintética','UNREAD',?)").bind(contactId,monthly.id,ownerId,at).run();
    const base=await env.DB.prepare('SELECT updated_at AS updatedAt FROM listings WHERE id=?').bind(monthly.id).first<{updatedAt:string}>();
    const changes={...fields,title:'Mensual con condiciones confirmadas',depositStatus:'FIXED_AMOUNT',depositAmount:30000,depositCurrency:'ARS',internetIncluded:'INCLUDED',availableFrom:'2026-12-01'};
    expect((await request(`/listings/${monthly.id}/revision`,'PUT',{expectedVersion:0,baseUpdatedAt:base!.updatedAt,fields:changes},ownerCookie)).status).toBe(200);
    expect((await request(`/listings/${monthly.id}/revision/submit`,'POST',{expectedVersion:1},ownerCookie)).status).toBe(200);
    expect((await request(`/admin/listings/${monthly.id}/revision/review`,'POST',{action:'approve',expectedVersion:2},adminCookie)).status).toBe(200);
    const published=await request(`/admin/listings/${monthly.id}/revision/publish`,'POST',{expectedVersion:3},adminCookie);
    expect(published.status,await published.clone().text()).toBe(200);
    expect(await env.DB.prepare('SELECT price_period AS pricePeriod,deposit_status AS depositStatus,deposit_amount AS depositAmount,deposit_currency AS depositCurrency,internet_included AS internetIncluded,available_from AS availableFrom FROM listings WHERE id=?').bind(monthly.id).first()).toEqual({pricePeriod:'MONTH',depositStatus:'FIXED_AMOUNT',depositAmount:30000,depositCurrency:'ARS',internetIncluded:'INCLUDED',availableFrom:'2026-12-01'});
    expect(await env.DB.prepare('SELECT id,object_key AS objectKey,byte_size AS byteSize,position,blob_data FROM listing_images WHERE id=?').bind(blobId).first()).toMatchObject({id:blobId,objectKey:`d1blob:${blobId}`,byteSize:png.byteLength,position:0,blob_data:expect.anything()});
    expect(await env.DB.prepare('SELECT id,asset_path AS assetPath,mime_type AS mimeType,byte_size AS byteSize,position FROM static_listing_images WHERE id=?').bind(staticId).first()).toEqual({id:staticId,assetPath:'/media/catalog/revision-synthetic.svg',mimeType:'image/svg+xml',byteSize:91,position:1});
    expect(await env.DB.prepare('SELECT id,listing_id AS listingId,owner_id AS ownerId,state,message FROM contact_events WHERE id=?').bind(contactId).first()).toEqual({id:contactId,listingId:monthly.id,ownerId,state:'UNREAD',message:'Consulta sintética'});
    expect(Number(await env.DB.prepare('SELECT COUNT(*) AS n FROM contact_events WHERE listing_id=?').bind(monthly.id).first('n'))).toBe(1);

    const weekly=await create(ownerCookie,'Alquiler semanal sin condiciones mensuales');
    await env.DB.prepare("UPDATE listings SET status='APPROVED',publication_status='PUBLISHED',price_period='WEEK' WHERE id=?").bind(weekly.id).run();
    const weekBase=await env.DB.prepare('SELECT updated_at AS updatedAt FROM listings WHERE id=?').bind(weekly.id).first<{updatedAt:string}>();
    const weeklyFields={...fields,pricePeriod:'WEEK',depositStatus:'NOT_INFORMED',depositAmount:null,depositCurrency:null,internetIncluded:'NOT_INFORMED',waterIncluded:'NOT_INFORMED',electricityIncluded:'NOT_INFORMED',gasIncluded:'NOT_INFORMED',petsPolicy:'NOT_INFORMED',availableFrom:null};
    const weeklySave=await request(`/listings/${weekly.id}/revision`,'PUT',{expectedVersion:0,baseUpdatedAt:weekBase!.updatedAt,fields:weeklyFields},ownerCookie);
    expect(weeklySave.status,await weeklySave.clone().text()).toBe(200);
    expect((await request(`/listings/${weekly.id}/revision/submit`,'POST',{expectedVersion:1},ownerCookie)).status).toBe(200);
    expect((await request(`/admin/listings/${weekly.id}/revision/review`,'POST',{action:'approve',expectedVersion:2},adminCookie)).status).toBe(200);
    expect((await request(`/admin/listings/${weekly.id}/revision/publish`,'POST',{expectedVersion:3},adminCookie)).status).toBe(200);
    expect(await env.DB.prepare('SELECT price_period AS pricePeriod,deposit_status AS depositStatus,pets_policy AS petsPolicy FROM listings WHERE id=?').bind(weekly.id).first()).toMatchObject({pricePeriod:'WEEK',depositStatus:'NOT_INFORMED',petsPolicy:'NOT_INFORMED'});
    const weeklyUpdated=await env.DB.prepare('SELECT updated_at AS updatedAt FROM listings WHERE id=?').bind(weekly.id).first<{updatedAt:string}>();
    expect((await request(`/listings/${weekly.id}/revision`,'PUT',{expectedVersion:4,baseUpdatedAt:weeklyUpdated!.updatedAt,fields:{...weeklyFields,petsPolicy:'ALLOWED'}},ownerCookie)).status).toBe(400);
  });

  it('denies anonymous, cross-role and cross-owner access to revision endpoints',async()=>{
    const item=await create(ownerCookie,'Acceso restringido a revisión');
    await env.DB.prepare("UPDATE listings SET status='APPROVED',publication_status='PUBLISHED' WHERE id=?").bind(item.id).run();
    const base=await env.DB.prepare('SELECT updated_at AS updatedAt FROM listings WHERE id=?').bind(item.id).first<{updatedAt:string}>();
    const body={expectedVersion:0,baseUpdatedAt:base!.updatedAt,fields:{...fields,title:'No autorizado'}};
    for(const method of ['GET','PUT'] as const){
      expect((await request(`/listings/${item.id}/revision`,method,method==='PUT'?body:undefined)).status).toBe(401);
      expect((await request(`/listings/${item.id}/revision`,method,method==='PUT'?body:undefined,adminCookie)).status).toBe(401);
      expect((await request(`/listings/${item.id}/revision`,method,method==='PUT'?body:undefined,otherCookie)).status).toBe(404);
    }
    expect((await request(`/listings/${item.id}/revision/submit`,'POST',{expectedVersion:1})).status).toBe(401);
    expect((await request(`/listings/${item.id}/revision/submit`,'POST',{expectedVersion:1},adminCookie)).status).toBe(401);
    expect((await request('/admin/listings/revisions')).status).toBe(401);
    expect((await request('/admin/listings/revisions','GET',undefined,ownerCookie)).status).toBe(401);
    for(const path of [`/admin/listings/${item.id}/revision/review`,`/admin/listings/${item.id}/revision/publish`]){
      expect((await request(path,'POST',{action:'approve',expectedVersion:1},ownerCookie)).status).toBe(401);
      expect((await request(path,'POST',{action:'approve',expectedVersion:1},otherCookie)).status).toBe(401);
    }
    expect(await env.DB.prepare('SELECT listing_id FROM listing_change_revisions WHERE listing_id=?').bind(item.id).first()).toBeNull();
    expect(await env.DB.prepare('SELECT title FROM listings WHERE id=?').bind(item.id).first('title')).toBe('Acceso restringido a revisión');
  });

  it('keeps approved but unpublished listings on the existing first-publication flow',async()=>{
    const item=await create(ownerCookie,'Aprobada antes de la primera publicación');
    await env.DB.prepare("UPDATE listings SET status='APPROVED',publication_status='UNPUBLISHED' WHERE id=?").bind(item.id).run();
    const current=await env.DB.prepare('SELECT updated_at AS updatedAt FROM listings WHERE id=?').bind(item.id).first<{updatedAt:string}>();
    const get=await request(`/listings/${item.id}/revision`,'GET',undefined,ownerCookie);
    expect(get.status).toBe(200);expect((await get.json() as any).revision).toBeNull();
    const proposal={expectedVersion:0,baseUpdatedAt:current!.updatedAt,fields:{...fields,title:'Cambio previo a publicación'}};
    expect((await request(`/listings/${item.id}/revision`,'PUT',proposal,ownerCookie)).status).toBe(409);
    expect((await request(`/listings/${item.id}/revision/submit`,'POST',{expectedVersion:1},ownerCookie)).status).toBe(409);
    const queue=await request('/admin/listings/revisions','GET',undefined,adminCookie);
    expect((await queue.json() as any).items.some((revision:any)=>revision.listingId===item.id)).toBe(false);
    expect((await request(`/admin/listings/${item.id}/revision/review`,'POST',{action:'approve',expectedVersion:1},adminCookie)).status).toBe(409);
    expect((await request(`/admin/listings/${item.id}/revision/publish`,'POST',{expectedVersion:1},adminCookie)).status).toBe(409);
    expect((await request(`/admin/listings/${item.id}/publish`,'POST',{},adminCookie)).status).toBe(200);
    const published=await env.DB.prepare('SELECT updated_at AS updatedAt,publication_status AS publicationStatus FROM listings WHERE id=?').bind(item.id).first<{updatedAt:string;publicationStatus:string}>();
    expect(published?.publicationStatus).toBe('PUBLISHED');
    expect((await request(`/listings/${item.id}/revision`,'PUT',{...proposal,baseUpdatedAt:published!.updatedAt},ownerCookie)).status).toBe(200);
  });

  it('keeps availability and reconfirmation compatible with an in-flight owner revision',async()=>{
    const item=await create(ownerCookie,'Publicación con revisión y disponibilidad');
    await env.DB.prepare("UPDATE listings SET status='APPROVED',publication_status='PUBLISHED' WHERE id=?").bind(item.id).run();
    const initial=await env.DB.prepare('SELECT updated_at AS updatedAt FROM listings WHERE id=?').bind(item.id).first<{updatedAt:string}>();
    expect((await request(`/listings/${item.id}/revision`,'PUT',{expectedVersion:0,baseUpdatedAt:initial!.updatedAt,fields:{...fields,title:'Cambio sometido'}},ownerCookie)).status).toBe(200);
    expect((await request(`/listings/${item.id}/revision/submit`,'POST',{expectedVersion:1},ownerCookie)).status).toBe(200);

    await env.DB.prepare("CREATE TRIGGER fail_revision_availability_rebase BEFORE UPDATE OF base_updated_at ON listing_change_revisions WHEN NEW.base_updated_at!=OLD.base_updated_at BEGIN SELECT RAISE(ABORT,'synthetic revision baseline failure'); END").run();
    try{
      expect((await request(`/listings/${item.id}/availability`,'PATCH',{availabilityStatus:'UNAVAILABLE'},ownerCookie)).status).toBe(503);
      expect(await env.DB.prepare('SELECT availability_status AS availabilityStatus,updated_at AS updatedAt FROM listings WHERE id=?').bind(item.id).first()).toMatchObject({availabilityStatus:'AVAILABLE',updatedAt:initial!.updatedAt});
      expect(await env.DB.prepare('SELECT state,version,base_updated_at AS baseUpdatedAt FROM listing_change_revisions WHERE listing_id=?').bind(item.id).first()).toMatchObject({state:'SUBMITTED',version:2,baseUpdatedAt:initial!.updatedAt});
    }finally{await env.DB.prepare('DROP TRIGGER IF EXISTS fail_revision_availability_rebase').run();}
    const changed=await request(`/listings/${item.id}/availability`,'PATCH',{availabilityStatus:'UNAVAILABLE'},ownerCookie);
    expect(changed.status,await changed.clone().text()).toBe(200);
    const afterChange=await changed.json() as any;
    const afterChangeRevision=await env.DB.prepare('SELECT state,version,base_updated_at AS baseUpdatedAt FROM listing_change_revisions WHERE listing_id=?').bind(item.id).first();
    expect(afterChangeRevision).toMatchObject({state:'SUBMITTED',version:2,baseUpdatedAt:afterChange.updatedAt});
    const rejected=await request(`/admin/listings/${item.id}/revision/review`,'POST',{action:'reject',reason:'Ajustar ubicación propuesta',expectedVersion:2},adminCookie);
    expect(rejected.status,await rejected.clone().text()).toBe(200);
    expect((await rejected.json() as any).revision).toMatchObject({state:'REJECTED',version:3});

    const rebased=await env.DB.prepare('SELECT updated_at AS updatedAt FROM listings WHERE id=?').bind(item.id).first<{updatedAt:string}>();
    expect((await request(`/listings/${item.id}/revision`,'PUT',{expectedVersion:3,baseUpdatedAt:rebased!.updatedAt,fields:{...fields,title:'Cambio corregido'}},ownerCookie)).status).toBe(200);
    expect((await request(`/listings/${item.id}/revision/submit`,'POST',{expectedVersion:4},ownerCookie)).status).toBe(200);
    expect((await request(`/admin/listings/${item.id}/revision/review`,'POST',{action:'approve',expectedVersion:5},adminCookie)).status).toBe(200);

    const reconfirmed=await request(`/listings/${item.id}/reconfirm`,'POST',undefined,ownerCookie);
    expect(reconfirmed.status,await reconfirmed.clone().text()).toBe(200);
    const afterReconfirm=await reconfirmed.json() as any;
    const approvedRevision=await env.DB.prepare('SELECT state,version,base_updated_at AS baseUpdatedAt FROM listing_change_revisions WHERE listing_id=?').bind(item.id).first();
    expect(approvedRevision).toMatchObject({state:'APPROVED',version:6,baseUpdatedAt:afterReconfirm.updatedAt});
    expect((await request(`/admin/listings/${item.id}/revision/publish`,'POST',{expectedVersion:6},adminCookie)).status).toBe(200);
    expect(await env.DB.prepare('SELECT title,availability_status AS availabilityStatus,last_confirmed_at AS lastConfirmedAt FROM listings WHERE id=?').bind(item.id).first()).toMatchObject({title:'Cambio corregido',availabilityStatus:'UNAVAILABLE',lastConfirmedAt:afterReconfirm.lastConfirmedAt});
  });

  it('paginates the ADMIN revision queue beyond 100 records without omissions',async()=>{
    const stale=(await env.DB.prepare("SELECT id FROM listings WHERE id LIKE 'revision-page-%'").all<{id:string}>()).results.map(row=>row.id);
    for(let start=0;start<stale.length;start+=50){const batch=stale.slice(start,start+50),slots=batch.map(()=>'?').join(',');await env.DB.prepare(`DELETE FROM admin_audit_events WHERE listing_id IN (${slots})`).bind(...batch).run();await env.DB.prepare(`DELETE FROM listings WHERE id IN (${slots})`).bind(...batch).run();}
    const at=new Date().toISOString(),prefix=`revision-page-${crypto.randomUUID().slice(0,8)}`,ids=Array.from({length:101},(_,index)=>`${prefix}-${String(index).padStart(3,'0')}`),payload=JSON.stringify(fields);
    await env.DB.batch(ids.map((listingId,index)=>env.DB.prepare("INSERT INTO listings(id,owner_id,status,title,description,location,location_search,price_amount,price_period,rental_duration,max_occupants,currency,publication_status,availability_status,last_confirmed_at,rejection_reason,created_at,updated_at) VALUES(?,?,'APPROVED',?,'Synthetic revision pagination','Uspallata','uspallata',25000,'MONTH','FLEXIBLE',2,'ARS','PUBLISHED','AVAILABLE',NULL,NULL,?,?)").bind(listingId,ownerId,`Revisión ${index}`,at,at)));
    listingIds.push(...ids);
    await env.DB.batch(ids.map(listingId=>env.DB.prepare("INSERT INTO listing_change_revisions(listing_id,owner_id,state,payload,base_updated_at,version,created_at,updated_at) VALUES(?,?,'SUBMITTED',?,?,1,?,?)").bind(listingId,ownerId,payload,at,at,at)));
    const first=await request('/admin/listings/revisions','GET',undefined,adminCookie),page1=await first.json() as any;
    expect(first.status).toBe(200);expect(page1.items).toHaveLength(100);
    expect(page1.nextCursor).toMatchObject({updatedAt:at,listingId:expect.any(String)});
    const cursor=page1.nextCursor;
    const second=await request(`/admin/listings/revisions?afterUpdatedAt=${encodeURIComponent(cursor.updatedAt)}&afterListingId=${encodeURIComponent(cursor.listingId)}`,'GET',undefined,adminCookie);
    const page2=await second.json() as any;
    expect(second.status).toBe(200);expect(page2.items,JSON.stringify({cursor,page2First:page2.items[0]?.listingId,page2Last:page2.items.at(-1)?.listingId,page2Cursor:page2.nextCursor})).toHaveLength(1);expect(page2.nextCursor).toBeNull();
    expect([...page1.items,...page2.items].map((item:any)=>item.listingId).sort()).toEqual(ids.sort());
    expect((await request('/admin/listings/revisions?afterUpdatedAt=invalid','GET',undefined,adminCookie)).status).toBe(400);
  });

  it('GET is OWNER-scoped and includes source listing state; role and missing IDs are denied',async()=>{
    const listing=await create();
    expect((await request(`/listings/${listing.id}`)).status).toBe(401);
    expect((await request(`/listings/${listing.id}`,'GET',undefined,adminCookie)).status).toBe(401);
    expect((await request(`/listings/${listing.id}`,'GET',undefined,otherCookie)).status).toBe(404);
    const response=await request(`/listings/${listing.id}`,'GET',undefined,ownerCookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({id:listing.id,ownerId,status:'DRAFT',publicationStatus:'UNPUBLISHED',availabilityStatus:'AVAILABLE',title:fields.title,location:fields.location});
    expect((await request('/listings/missing-owner-row','GET',undefined,ownerCookie)).status).toBe(404);
  });

  it('DELETE requires an editable owned listing, confirms replay and cascades D1 image accounting',async()=>{
    const listing=await create(),at=new Date().toISOString(),imageId=`listing-mgmt-image-${listing.id}`;
    await env.DB.prepare('INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at,blob_data) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(imageId,listing.id,`d1blob:${imageId}`,'synthetic.png','image/png',png.byteLength,0,at,at,png).run();
    await env.DB.prepare('INSERT INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES(?,?,?,?,?,?)').bind(`static-${listing.id}`,listing.id,'/media/catalog/synthetic.svg','image/svg+xml',64,1).run();
    const before=Number(await env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first('used_bytes'));
    expect((await request(`/listings/${listing.id}`,'DELETE',undefined,ownerCookie,undefined,false)).status).toBe(403);
    expect((await request(`/listings/${listing.id}`,'DELETE',undefined,otherCookie,'owner-delete-mgmt')).status).toBe(404);
    expect((await request(`/listings/${listing.id}`,'DELETE',undefined,ownerCookie)).status).toBe(400);
    const first=await request(`/listings/${listing.id}`,'DELETE',undefined,ownerCookie,'owner-delete-mgmt');
    expect(first.status,await first.clone().text()).toBe(200);expect(await first.json()).toEqual({id:listing.id,deleted:true});
    const replay=await request(`/listings/${listing.id}`,'DELETE',undefined,ownerCookie,'owner-delete-mgmt');
    expect(replay.status).toBe(200);expect(await replay.json()).toEqual({id:listing.id,deleted:true});
    expect(await env.DB.prepare('SELECT id FROM listings WHERE id=?').bind(listing.id).first()).toBeNull();
    expect(await env.DB.prepare('SELECT id FROM listing_images WHERE id=?').bind(imageId).first()).toBeNull();
    expect(await env.DB.prepare('SELECT id FROM static_listing_images WHERE listing_id=?').bind(listing.id).first()).toBeNull();
    expect(Number(await env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first('used_bytes'))).toBe(before-png.byteLength);
    expect(await env.DB.prepare("SELECT state FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?").bind(ownerId,`OWNER_LISTING_DELETE:${listing.id}`,'owner-delete-mgmt').first('state')).toBe('COMMITTED');
  });

  it('does not delete submitted or concurrent locked listings',async()=>{
    const submitted=await create();
    await request(`/listings/${submitted.id}/submit`,'POST',undefined,ownerCookie);
    expect((await request(`/listings/${submitted.id}`,'DELETE',undefined,ownerCookie,'delete-submitted')).status).toBe(404);
    const locked=await create();
    await env.DB.prepare('INSERT INTO listing_locks(listing_id,token,expires_at) VALUES(?,?,?)').bind(locked.id,'synthetic-held-lock',Math.floor(Date.now()/1000)+60).run();
    expect((await request(`/listings/${locked.id}`,'DELETE',undefined,ownerCookie,'delete-while-busy')).status).toBe(409);
    expect(await env.DB.prepare('SELECT id FROM listings WHERE id=?').bind(locked.id).first()).not.toBeNull();
    expect(await env.DB.prepare("SELECT request_key FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key='delete-while-busy'").bind(ownerId,`OWNER_LISTING_DELETE:${locked.id}`).first()).toBeNull();
    await env.DB.prepare('DELETE FROM listing_locks WHERE listing_id=?').bind(locked.id).run();
  });

  it('fails closed for external media strategies before deletion even when operation metadata has no image row',async()=>{
    const cases=[
      {name:'unset strategy without media rows',strategy:UNSET_MEDIA_STRATEGY,operation:null},
      {name:'unknown strategy without media rows',strategy:'OBJECT_STORAGE',operation:null},
      {name:'R2 with pending ADD and no image row',strategy:'R2',operation:{kind:'ADD',state:'PENDING',objectKey:'synthetic-pending-add'}},
      {name:'R2 with pending DELETE backup and no image row',strategy:'R2',operation:{kind:'DELETE',state:'CLEANUP_PENDING',objectKey:'synthetic-delete-object',backupKey:'synthetic-delete-backup'}},
    ] as const;
    for(const [index,scenario] of cases.entries()){
      const listing=await create(ownerCookie,`External media deletion guard ${index}`),operationId=`external-op-${listing.id}`;
      if(scenario.operation){
        const op=scenario.operation;
        await env.DB.prepare('INSERT INTO image_operations(id,listing_id,kind,state,object_key,backup_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(operationId,listing.id,op.kind,op.state,op.objectKey,'backupKey' in op?op.backupKey:null,new Date().toISOString(),new Date().toISOString()).run();
      }
      expect(await env.DB.prepare('SELECT id FROM listing_images WHERE listing_id=?').bind(listing.id).first()).toBeNull();
      const ownerKey=`external-owner-delete-${index}`,adminKey=`external-admin-delete-${index}`;
      const ownerDelete=await request(`/listings/${listing.id}`,'DELETE',undefined,ownerCookie,ownerKey,true,scenario.strategy);
      expect(ownerDelete.status,scenario.name).toBe(409);expect(await ownerDelete.json()).toMatchObject({code:'MEDIA_DELETE_UNSUPPORTED'});
      const adminDelete=await request(`/admin/listings/assisted/${listing.id}`,'DELETE',undefined,adminCookie,adminKey,true,scenario.strategy);
      expect(adminDelete.status,scenario.name).toBe(409);expect(await adminDelete.json()).toMatchObject({code:'MEDIA_DELETE_UNSUPPORTED'});
      expect(await env.DB.prepare('SELECT id FROM listings WHERE id=?').bind(listing.id).first()).not.toBeNull();
      if(scenario.operation)expect(await env.DB.prepare('SELECT id,kind,state,object_key,backup_key,cleanup_complete FROM image_operations WHERE id=?').bind(operationId).first()).toMatchObject({id:operationId,kind:scenario.operation.kind,state:scenario.operation.state,object_key:scenario.operation.objectKey,backup_key:'backupKey' in scenario.operation?scenario.operation.backupKey:null,cleanup_complete:0});
      expect(await env.DB.prepare("SELECT request_key FROM idempotency_records WHERE (owner_id=? OR owner_id=?) AND resource_id=? AND request_key IN (?,?)").bind(ownerId,adminId,listing.id,ownerKey,adminKey).first()).toBeNull();
      expect(await env.DB.prepare("SELECT id FROM admin_audit_events WHERE listing_id=? AND action='ADMIN_ASSISTED_LISTING_DELETED'").bind(listing.id).first()).toBeNull();
    }
  });

  it('fails closed for STATIC_ASSETS when legacy dynamic media or recovery metadata exists',async()=>{
    const at=new Date().toISOString();
    for(const [index,kind] of ['operation','image-row'].entries()){
      const listing=await create(ownerCookie,`Static strategy dynamic recovery guard ${index}`),operationId=`static-op-${listing.id}`,imageId=`static-dynamic-image-${listing.id}`;
      if(kind==='operation')await env.DB.prepare('INSERT INTO image_operations(id,listing_id,kind,state,object_key,backup_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(operationId,listing.id,'ADD','NEEDS_REPAIR','synthetic-orphan-object',null,at,at).run();
      else await env.DB.prepare('INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(imageId,listing.id,`synthetic-external:${imageId}`,'external.png','image/png',128,0,at,at).run();
      const ownerKey=`static-owner-delete-${index}`,adminKey=`static-admin-delete-${index}`;
      for(const [role,key] of [['OWNER',ownerKey],['ADMIN',adminKey]] as const){
        const response=role==='OWNER'
          ?await request(`/listings/${listing.id}`,'DELETE',undefined,ownerCookie,key,true,'STATIC_ASSETS')
          :await request(`/admin/listings/assisted/${listing.id}`,'DELETE',undefined,adminCookie,key,true,'STATIC_ASSETS');
        expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:'MEDIA_DELETE_UNSUPPORTED'});
      }
      expect(await env.DB.prepare('SELECT id FROM listings WHERE id=?').bind(listing.id).first()).not.toBeNull();
      if(kind==='operation')expect(await env.DB.prepare('SELECT id,state,object_key FROM image_operations WHERE id=?').bind(operationId).first()).toMatchObject({id:operationId,state:'NEEDS_REPAIR',object_key:'synthetic-orphan-object'});
      else expect(await env.DB.prepare('SELECT id,object_key FROM listing_images WHERE id=?').bind(imageId).first()).toMatchObject({id:imageId,object_key:`synthetic-external:${imageId}`});
      expect(await env.DB.prepare('SELECT request_key FROM idempotency_records WHERE (owner_id=? OR owner_id=?) AND resource_id=? AND request_key IN (?,?)').bind(ownerId,adminId,listing.id,ownerKey,adminKey).first()).toBeNull();
      expect(await env.DB.prepare("SELECT id FROM admin_audit_events WHERE listing_id=? AND action='ADMIN_ASSISTED_LISTING_DELETED'").bind(listing.id).first()).toBeNull();
    }
  });
});

describe('ADMIN-assisted lifecycle',()=>{
  it('lists only editable owner drafts; edits, confirms, submits and audits with idempotent replay',async()=>{
    const response=await request('/admin/listings/assisted','POST',{ownerId,...fields,title:'Asistida sintética'},adminCookie,'create-assisted-mgmt');
    expect(response.status).toBe(201);const created=await response.json() as any;listingIds.push(created.id);
    expect(created).toMatchObject({status:'DRAFT',owner:{id:ownerId,role:'OWNER'}});
    expect((await request(`/admin/listings/assisted/${created.id}`,'PATCH',fields,adminCookie,'assisted-missing-version-mgmt')).status).toBe(400);
    expect((await request(`/admin/listings/assisted?ownerId=${ownerId}`)).status).toBe(401);
    expect((await request(`/admin/listings/assisted?ownerId=${ownerId}`,'GET',undefined,ownerCookie)).status).toBe(401);
    const drafts=await request(`/admin/listings/assisted?ownerId=${ownerId}`,'GET',undefined,adminCookie);
    expect(drafts.status).toBe(200);expect(((await drafts.json() as any).items as any[]).some(item=>item.id===created.id)).toBe(true);
    const patch={...fields,title:'Asistida editada',location:'Uspallata norte',expectedUpdatedAt:created.updatedAt};
    expect((await request(`/admin/listings/assisted/${created.id}`,'PATCH',{...patch,ownerId:otherId,actorId:otherId},adminCookie,'assisted-reassign-denied')).status).toBe(400);
    expect((await request(`/admin/listings/assisted/${created.id}`,'PATCH',patch,ownerCookie,'admin-edit-denied')).status).toBe(401);
    expect((await request(`/admin/listings/assisted/${created.id}`,'PATCH',patch,adminCookie)).status).toBe(400);
    const updated=await request(`/admin/listings/assisted/${created.id}`,'PATCH',patch,adminCookie,'assisted-update-mgmt');
    expect(updated.status).toBe(200);const updatedBody=await updated.json() as any;
    expect(updatedBody).toMatchObject({title:patch.title,location:patch.location,owner:{id:ownerId,email:'listing.mgmt.owner@example.test',role:'OWNER'}});
    expect(await (await request(`/admin/listings/assisted/${created.id}`,'PATCH',patch,adminCookie,'assisted-update-mgmt')).json()).toEqual(updatedBody);
    expect((await request(`/admin/listings/assisted/${created.id}`,'PATCH',{...patch,title:'Key reutilizada'},adminCookie,'assisted-update-mgmt')).status).toBe(409);
    const unavailable=await request(`/admin/listings/assisted/${created.id}/availability`,'PATCH',{availabilityStatus:'UNAVAILABLE'},adminCookie,'assisted-availability-mgmt');
    expect(unavailable.status).toBe(200);expect(await unavailable.json()).toMatchObject({availabilityStatus:'UNAVAILABLE',freshnessStatus:'FRESH',lastConfirmedAt:expect.any(String)});
    const reconfirm=await request(`/admin/listings/assisted/${created.id}/reconfirm`,'POST',undefined,adminCookie,'assisted-reconfirm-mgmt');
    expect(reconfirm.status).toBe(200);expect(await reconfirm.json()).toMatchObject({availabilityStatus:'UNAVAILABLE',freshnessStatus:'FRESH',lastConfirmedAt:expect.any(String)});
    const submitted=await request(`/admin/listings/assisted/${created.id}/submit`,'POST',undefined,adminCookie,'assisted-submit-mgmt');
    expect(submitted.status).toBe(200);const submittedBody=await submitted.json();expect(submittedBody).toMatchObject({status:'SUBMITTED',publicationStatus:'UNPUBLISHED'});
    expect(await (await request(`/admin/listings/assisted/${created.id}/submit`,'POST',undefined,adminCookie,'assisted-submit-mgmt')).json()).toEqual(submittedBody);
    expect((await request(`/admin/listings/assisted/${created.id}/submit`,'POST',undefined,adminCookie,'assisted-submit-new-key')).status).toBe(409);
    expect((await request(`/admin/listings/assisted/${created.id}`,'PATCH',patch,adminCookie,'edit-after-submit')).status).toBe(409);
    expect((await request(`/admin/listings/assisted/${created.id}/availability`,'PATCH',{availabilityStatus:'AVAILABLE'},adminCookie,'assisted-availability-after-submit')).status).toBe(409);
    expect((await request(`/admin/listings/assisted/${created.id}/reconfirm`,'POST',undefined,adminCookie,'assisted-reconfirm-after-submit')).status).toBe(409);
    await env.DB.prepare("UPDATE listings SET status='APPROVED' WHERE id=?").bind(created.id).run();
    expect((await request(`/admin/listings/assisted/${created.id}/availability`,'PATCH',{availabilityStatus:'AVAILABLE'},adminCookie,'assisted-availability-after-approval')).status).toBe(409);
    expect((await request(`/admin/listings/assisted/${created.id}/reconfirm`,'POST',undefined,adminCookie,'assisted-reconfirm-after-approval')).status).toBe(409);
    const rows=await (await request(`/admin/listings/audit?listingId=${created.id}`,'GET',undefined,adminCookie)).json() as any[];
    expect(rows.filter(item=>item.action==='ADMIN_ASSISTED_LISTING_UPDATED')).toHaveLength(1);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit_events WHERE listing_id=? AND action='ADMIN_ASSISTED_LISTING_SUBMITTED'").bind(created.id).first('n')).toBe(1);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit_events WHERE listing_id=? AND action IN ('ADMIN_ASSISTED_AVAILABILITY_UPDATED','ADMIN_ASSISTED_LISTING_RECONFIRMED')").bind(created.id).first('n')).toBe(2);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({action:'ADMIN_ASSISTED_LISTING_UPDATED',actor:{id:adminId,email:'listing.mgmt.admin@example.test',role:'ADMIN'},targetOwner:{id:ownerId,email:'listing.mgmt.owner@example.test',role:'OWNER'}}),
      expect.objectContaining({action:'ADMIN_ASSISTED_AVAILABILITY_UPDATED',metadata:{availabilityStatus:'UNAVAILABLE'}}),
      expect.objectContaining({action:'ADMIN_ASSISTED_LISTING_RECONFIRMED'}),
      expect.objectContaining({action:'ADMIN_ASSISTED_LISTING_SUBMITTED'}),
    ]));
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit_events WHERE listing_id=? AND action='ADMIN_ASSISTED_LISTING_UPDATED'").bind(created.id).first('n')).toBe(1);
  });

  it('deletes an assisted DRAFT atomically with an audit row and original replay snapshot',async()=>{
    const createdResponse=await request('/admin/listings/assisted','POST',{ownerId,...fields,title:'Asistida para eliminar'},adminCookie,'create-assisted-delete-mgmt');
    expect(createdResponse.status).toBe(201);const created=await createdResponse.json() as any;listingIds.push(created.id);
    const imageId=`assisted-delete-image-${created.id}`,at=new Date().toISOString();
    await env.DB.prepare('INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at,blob_data) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(imageId,created.id,`d1blob:${imageId}`,'synthetic.png','image/png',png.byteLength,0,at,at,png).run();
    const before=Number(await env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first('used_bytes'));
    expect((await request(`/admin/listings/assisted/${created.id}`,'DELETE',undefined,ownerCookie,'assisted-delete-denied')).status).toBe(401);
    const response=await request(`/admin/listings/assisted/${created.id}`,'DELETE',undefined,adminCookie,'assisted-delete-mgmt');
    expect(response.status,await response.clone().text()).toBe(200);const original=await response.json() as any;
    expect(original).toMatchObject({id:created.id,status:'DRAFT',owner:{id:ownerId,role:'OWNER'},images:[{id:imageId,sizeBytes:png.byteLength}]});
    expect(await (await request(`/admin/listings/assisted/${created.id}`,'DELETE',undefined,adminCookie,'assisted-delete-mgmt')).json()).toEqual(original);
    expect(await env.DB.prepare('SELECT id FROM listings WHERE id=?').bind(created.id).first()).toBeNull();
    expect(await env.DB.prepare('SELECT id FROM listing_images WHERE id=?').bind(imageId).first()).toBeNull();
    expect(Number(await env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first('used_bytes'))).toBe(before-png.byteLength);
    const audit=await env.DB.prepare("SELECT actor_id,target_owner_id,action,entity_id,listing_id,metadata FROM admin_audit_events WHERE listing_id=? AND action='ADMIN_ASSISTED_LISTING_DELETED'").bind(created.id).first<any>();
    expect(audit).toMatchObject({actor_id:adminId,target_owner_id:ownerId,action:'ADMIN_ASSISTED_LISTING_DELETED',entity_id:created.id,listing_id:created.id,metadata:'{}'});
  });

  it('rolls back assisted changes when the audit insert fails and leaves no idempotency receipt',async()=>{
    const createdResponse=await request('/admin/listings/assisted','POST',{ownerId,...fields,title:'Atomicidad audit'},adminCookie,'create-assisted-atomic-mgmt');
    expect(createdResponse.status).toBe(201);const created=await createdResponse.json() as any;listingIds.push(created.id);
    await env.DB.exec("CREATE TRIGGER reject_assisted_update_audit BEFORE INSERT ON admin_audit_events WHEN NEW.action='ADMIN_ASSISTED_LISTING_UPDATED' BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END;");
    try{
      const response=await request(`/admin/listings/assisted/${created.id}`,'PATCH',{...fields,title:'No debe persistir',expectedUpdatedAt:created.updatedAt},adminCookie,'atomic-assist-update-mgmt');
      expect(response.status).toBe(503);
      expect(await env.DB.prepare('SELECT title FROM listings WHERE id=?').bind(created.id).first('title')).toBe('Atomicidad audit');
      expect(await env.DB.prepare('SELECT request_key FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?').bind(adminId,`ADMIN_ASSISTED_UPDATE:${created.id}`,'atomic-assist-update-mgmt').first()).toBeNull();
    }finally{await env.DB.exec('DROP TRIGGER reject_assisted_update_audit');}
  });

  it('serializes OWNER availability with an assisted snapshot and replays the committed state',async()=>{
    const listing=await create();
    let enterBatch!:()=>void,releaseBatch!:()=>void;
    const batchReached=new Promise<void>(resolve=>{enterBatch=resolve;});
    const batchGate=new Promise<void>(resolve=>{releaseBatch=resolve;});
    const db=new Proxy(env.DB,{get(target,property){
      if(property==='batch')return async(statements:D1PreparedStatement[])=>{enterBatch();await batchGate;return target.batch(statements);};
      const value=Reflect.get(target,property,target);return typeof value==='function'?value.bind(target):value;
    }}) as D1Database;
    const adminWrite=app.request(`${origin}/admin/listings/assisted/${listing.id}/availability`,{method:'PATCH',headers:{Origin:origin,Cookie:adminCookie,'Idempotency-Key':'assisted-availability-race','Content-Type':'application/json'},body:JSON.stringify({availabilityStatus:'UNAVAILABLE'})},{...bindings,DB:db});
    await batchReached;
    const ownerWrite=await request(`/listings/${listing.id}/availability`,'PATCH',{availabilityStatus:'AVAILABLE'},ownerCookie);
    expect(ownerWrite.status).toBe(409);
    expect((await request(`/listings/${listing.id}/reconfirm`,'POST',undefined,ownerCookie)).status).toBe(409);
    expect(await env.DB.prepare('SELECT availability_status FROM listings WHERE id=?').bind(listing.id).first('availability_status')).toBe('AVAILABLE');
    releaseBatch();
    const committed=await adminWrite;expect(committed.status).toBe(200);const snapshot=await committed.json() as any;
    expect(snapshot).toMatchObject({id:listing.id,availabilityStatus:'UNAVAILABLE',lastConfirmedAt:snapshot.updatedAt});
    const row=await env.DB.prepare('SELECT availability_status AS availabilityStatus,last_confirmed_at AS lastConfirmedAt,updated_at AS updatedAt FROM listings WHERE id=?').bind(listing.id).first<any>();
    expect(snapshot).toMatchObject(row);expect(Date.parse(row.updatedAt)).toBeGreaterThanOrEqual(Date.parse(listing.updatedAt));
    const replay=await request(`/admin/listings/assisted/${listing.id}/availability`,'PATCH',{availabilityStatus:'UNAVAILABLE'},adminCookie,'assisted-availability-race');
    expect(replay.status).toBe(200);expect(await replay.json()).toEqual(snapshot);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit_events WHERE listing_id=? AND action='ADMIN_ASSISTED_AVAILABILITY_UPDATED'").bind(listing.id).first('n')).toBe(1);
  });

  it('rejects an assisted edit based on an older OWNER version without losing the newer edit',async()=>{
    const created=await create();
    const stalePayload={...fields,title:'Edición ADMIN con versión vieja',expectedUpdatedAt:created.updatedAt};
    const ownerEdit=await request(`/listings/${created.id}`,'PATCH',{...fields,title:'Edición OWNER más nueva'},ownerCookie);
    expect(ownerEdit.status).toBe(200);
    const deterministicNewerVersion=new Date(Date.now()+60_000).toISOString();
    await env.DB.prepare('UPDATE listings SET updated_at=? WHERE id=?').bind(deterministicNewerVersion,created.id).run();
    const rejected=await request(`/admin/listings/assisted/${created.id}`,'PATCH',stalePayload,adminCookie,'assisted-stale-version-mgmt');
    expect(rejected.status).toBe(409);
    expect(await env.DB.prepare('SELECT title,updated_at FROM listings WHERE id=?').bind(created.id).first()).toMatchObject({title:'Edición OWNER más nueva',updated_at:deterministicNewerVersion});
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit_events WHERE listing_id=? AND action='ADMIN_ASSISTED_LISTING_UPDATED'").bind(created.id).first('n')).toBe(0);
    expect(await env.DB.prepare("SELECT request_key FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key='assisted-stale-version-mgmt'").bind(adminId,`ADMIN_ASSISTED_UPDATE:${created.id}`).first()).toBeNull();
    const latest=await request(`/admin/listings/${created.id}`,'GET',undefined,adminCookie),current=await latest.json() as any;
    const accepted=await request(`/admin/listings/assisted/${created.id}`,'PATCH',{...fields,title:'Edición ADMIN actualizada',expectedUpdatedAt:current.updatedAt},adminCookie,'assisted-current-version-mgmt');
    expect(accepted.status).toBe(200);expect(await accepted.json()).toMatchObject({title:'Edición ADMIN actualizada'});
  });

  it('rolls back assisted deletion, image cleanup and audit receipt when audit insertion fails',async()=>{
    const createdResponse=await request('/admin/listings/assisted','POST',{ownerId,...fields,title:'Atomicidad de borrado'},adminCookie,'create-assisted-delete-atomic-mgmt');
    expect(createdResponse.status).toBe(201);const created=await createdResponse.json() as any;listingIds.push(created.id);
    const imageId=`assisted-delete-atomic-image-${created.id}`,at=new Date().toISOString();
    await env.DB.prepare('INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at,blob_data) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(imageId,created.id,`d1blob:${imageId}`,'synthetic.png','image/png',png.byteLength,0,at,at,png).run();
    const before=Number(await env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first('used_bytes'));
    await env.DB.exec("CREATE TRIGGER reject_assisted_delete_audit BEFORE INSERT ON admin_audit_events WHEN NEW.action='ADMIN_ASSISTED_LISTING_DELETED' BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END;");
    try{
      const response=await request(`/admin/listings/assisted/${created.id}`,'DELETE',undefined,adminCookie,'atomic-assisted-delete-mgmt');
      expect(response.status).toBe(503);
      expect(await env.DB.prepare('SELECT id FROM listings WHERE id=?').bind(created.id).first()).not.toBeNull();
      expect(await env.DB.prepare('SELECT id FROM listing_images WHERE id=?').bind(imageId).first()).not.toBeNull();
      expect(Number(await env.DB.prepare('SELECT used_bytes FROM media_storage_usage WHERE id=1').first('used_bytes'))).toBe(before);
      expect(await env.DB.prepare("SELECT request_key FROM idempotency_records WHERE owner_id=? AND scope=? AND request_key=?").bind(adminId,`ADMIN_ASSISTED_DELETE:${created.id}`,'atomic-assisted-delete-mgmt').first()).toBeNull();
      expect(await env.DB.prepare("SELECT id FROM admin_audit_events WHERE listing_id=? AND action='ADMIN_ASSISTED_LISTING_DELETED'").bind(created.id).first()).toBeNull();
    }finally{await env.DB.exec('DROP TRIGGER reject_assisted_delete_audit');}
    const retry=await request(`/admin/listings/assisted/${created.id}`,'DELETE',undefined,adminCookie,'atomic-assisted-delete-mgmt');
    expect(retry.status).toBe(200);expect(await retry.json()).toMatchObject({id:created.id,status:'DRAFT'});
  });

  it('surfaces unexpected storage failures as server errors instead of editable-state conflicts',async()=>{
    const createdResponse=await request('/admin/listings/assisted','POST',{ownerId,...fields,title:'Error interno sintético'},adminCookie,'create-assisted-storage-error-mgmt');
    expect(createdResponse.status).toBe(201);const created=await createdResponse.json() as any;listingIds.push(created.id);
    await env.DB.exec('ALTER TABLE listing_images RENAME TO listing_images_disabled');
    let response:Response;
    try{response=await request(`/admin/listings/assisted/${created.id}/reconfirm`,'POST',undefined,adminCookie,'assisted-storage-error-mgmt');}
    finally{await env.DB.exec('ALTER TABLE listing_images_disabled RENAME TO listing_images');}
    expect(response!.status).toBe(500);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit_events WHERE listing_id=? AND action='ADMIN_ASSISTED_LISTING_RECONFIRMED'").bind(created.id).first('n')).toBe(0);
  });

  it('paginates ADMIN draft discovery beyond the first 50 without crossing owners',async()=>{
    const at=new Date().toISOString(),ids=Array.from({length:51},(_,index)=>`assisted-page-${String(index).padStart(2,'0')}`);
    await env.DB.batch(ids.map((listingId,index)=>env.DB.prepare("INSERT INTO listings(id,owner_id,status,title,description,location,location_search,price_amount,price_period,rental_duration,max_occupants,currency,publication_status,availability_status,last_confirmed_at,rejection_reason,created_at,updated_at) VALUES(?,?,'DRAFT',?,'Synthetic pagination fixture','Uspallata','uspallata',10000,'MONTH','FLEXIBLE',1,'ARS','UNPUBLISHED','AVAILABLE',NULL,NULL,?,?)").bind(listingId,otherId,`Paginar ${index}`,at,at)));
    listingIds.push(...ids);
    expect((await request(`/admin/listings/assisted?ownerId=${otherId}`)).status).toBe(401);
    expect((await request(`/admin/listings/assisted?ownerId=${otherId}&afterUpdatedAt=${encodeURIComponent(at)}`,'GET',undefined,adminCookie)).status).toBe(400);
    const first=await request(`/admin/listings/assisted?ownerId=${otherId}`,'GET',undefined,adminCookie);
    expect(first.status).toBe(200);const page1=await first.json() as any;
    expect(page1.items).toHaveLength(50);expect(page1.nextCursor).toMatchObject({updatedAt:at,id:expect.any(String)});
    expect(page1.items.every((item:any)=>item.owner.id===otherId)).toBe(true);
    const cursor=page1.nextCursor;
    const second=await request(`/admin/listings/assisted?ownerId=${otherId}&afterUpdatedAt=${encodeURIComponent(cursor.updatedAt)}&afterId=${encodeURIComponent(cursor.id)}`,'GET',undefined,adminCookie);
    expect(second.status).toBe(200);const page2=await second.json() as any;
    expect(page2.items).toHaveLength(1);expect(page2.nextCursor).toBeNull();
    expect([...page1.items,...page2.items].map((item:any)=>item.id).sort()).toEqual(ids.sort());
    const scoped=await request(`/admin/listings/assisted?ownerId=${ownerId}`,'GET',undefined,adminCookie);
    expect((await scoped.json() as any).items.every((item:any)=>item.owner.id===ownerId)).toBe(true);
  });
});
