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
    await env.DB.prepare('INSERT OR IGNORE INTO users(id,email,password_hash,role,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,email,hash,role,at,at).run();
  ownerCookie=await login('listing.mgmt.owner@example.test');otherCookie=await login('listing.mgmt.other@example.test');adminCookie=await login('listing.mgmt.admin@example.test');
});
afterAll(async()=>{
  if(listingIds.length)await env.DB.prepare(`DELETE FROM image_operations WHERE listing_id IN (${listingIds.map(()=>'?').join(',')})`).bind(...listingIds).run();
  await env.DB.prepare('DELETE FROM admin_audit_events WHERE listing_id IN ('+(listingIds.map(()=>'?').join(',')||"''")+')').bind(...listingIds).run();
  await env.DB.prepare('DELETE FROM idempotency_records WHERE (owner_id=? OR owner_id=?) AND (scope LIKE ? OR scope LIKE ?)').bind(ownerId,adminId,'OWNER_LISTING_DELETE:%','ADMIN_ASSISTED_%').run();
  if(listingIds.length)await env.DB.prepare(`DELETE FROM listings WHERE id IN (${listingIds.map(()=>'?').join(',')})`).bind(...listingIds).run();
});

describe('OWNER listing lifecycle',()=>{
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
    expect(unavailable.status).toBe(200);expect(await unavailable.json()).toMatchObject({availabilityStatus:'UNAVAILABLE',lastConfirmedAt:expect.any(String)});
    const reconfirm=await request(`/admin/listings/assisted/${created.id}/reconfirm`,'POST',undefined,adminCookie,'assisted-reconfirm-mgmt');
    expect(reconfirm.status).toBe(200);expect(await reconfirm.json()).toMatchObject({availabilityStatus:'UNAVAILABLE',lastConfirmedAt:expect.any(String)});
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
