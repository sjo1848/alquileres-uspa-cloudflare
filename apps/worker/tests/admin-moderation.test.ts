import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/index';

const origin='http://localhost', secret='synthetic-admin-moderation-secret-at-least-32-bytes';
const bindings={...env,DB:env.DB,JWT_SECRET:secret,MEDIA_STRATEGY:'STATIC_ASSETS'};
const fields={title:'Cabaña sintética para moderación',description:'Datos ficticios de revisión',location:'Uspallata',priceAmount:25000,pricePeriod:'MONTH',rentalDuration:'FLEXIBLE',maxOccupants:2,currency:'ARS'};
const testPng=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9AAAAAElFTkSuQmCC','base64'));
function request(path:string,method='GET',body?:unknown,cookie?:string,withOrigin=true,mediaStrategy=bindings.MEDIA_STRATEGY){return app.request(origin+path,{method,headers:{...(withOrigin?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined},{...bindings,MEDIA_STRATEGY:mediaStrategy});}
async function login(email:string){const response=await request('/auth/login','POST',{email,password:'synthetic-owner-password-1'});expect(response.status).toBe(200);return response.headers.get('set-cookie')!.split(';')[0];}

beforeAll(async()=>{
  const hash='$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS',at=new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO users(id,email,password_hash,role,created_at,updated_at) VALUES('moderation-owner','moderation.owner@example.test',?,'OWNER',?,?)").bind(hash,at,at).run();
  await env.DB.prepare("INSERT OR IGNORE INTO users(id,email,password_hash,role,created_at,updated_at) VALUES('moderation-admin','moderation.admin@example.test',?,'ADMIN',?,?)").bind(hash,at,at).run();
});

describe('ADMIN moderation and publication',()=>{
  it('protects the queue and audit, approves submitted listings atomically, and publishes them',async()=>{
    const owner=await login('moderation.owner@example.test'),admin=await login('moderation.admin@example.test');
    expect((await request('/admin/listings/review')).status).toBe(401);
    expect((await request('/admin/listings/review','GET',undefined,owner)).status).toBe(401);
    const created=await request('/listings','POST',fields,owner),listing=await created.json() as {id:string};
    expect(created.status).toBe(201);
    expect((await request(`/listings/${listing.id}/submit`,'POST',undefined,owner)).status).toBe(200);
    const queue=await request('/admin/listings/review','GET',undefined,admin),page=await queue.json() as {items:any[];nextCursor:{createdAt:string;id:string}|null};
    expect(page.items.some(item=>item.id===listing.id&&item.owner.email==='moderation.owner@example.test')).toBe(true);
    expect((await request('/admin/listings/'+listing.id+'/review','POST',{action:'approve'},admin,false)).status).toBe(403);
    const approved=await request('/admin/listings/'+listing.id+'/review','POST',{action:'approve'},admin);
    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({id:listing.id,status:'APPROVED',publicationStatus:'UNPUBLISHED',rejectionReason:null,owner:{id:'moderation-owner',email:'moderation.owner@example.test',role:'OWNER'},images:[]});
    expect((await request('/public/listings/'+listing.id)).status).toBe(404);
    const published=await request('/admin/listings/'+listing.id+'/publish','POST',undefined,admin);
    expect(await published.json()).toMatchObject({id:listing.id,status:'APPROVED',publicationStatus:'PUBLISHED'});
    const publishedAgain=await request('/admin/listings/'+listing.id+'/publish','POST',undefined,admin);
    expect(publishedAgain.status).toBe(200);
    expect(await publishedAgain.json()).toMatchObject({id:listing.id,status:'APPROVED',publicationStatus:'PUBLISHED',owner:{id:'moderation-owner',email:'moderation.owner@example.test',role:'OWNER'},images:[]});
    expect((await request('/public/listings/'+listing.id)).status).toBe(200);
    const audit=await request('/admin/listings/audit?listingId='+listing.id,'GET',undefined,admin);
    expect(await audit.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({entityType:'LISTING',entityId:listing.id,listingId:listing.id,targetOwner:{id:'moderation-owner',email:'moderation.owner@example.test',role:'OWNER'},action:'ADMIN_LISTING_APPROVED',metadata:{},actor:{id:'moderation-admin',email:'moderation.admin@example.test',role:'ADMIN'}}),
      expect.objectContaining({entityType:'LISTING',entityId:listing.id,listingId:listing.id,action:'ADMIN_LISTING_PUBLISHED',metadata:{},actor:{id:'moderation-admin',email:'moderation.admin@example.test',role:'ADMIN'}}),
    ]));
    expect((await request('/admin/listings/audit','GET',undefined,owner)).status).toBe(401);
    expect((await request('/admin/listings/'+listing.id+'/review','POST',{action:'approve'},admin)).status).toBe(200);
    expect(await env.DB.prepare('SELECT COUNT(*) FROM admin_audit_events WHERE listing_id=?').bind(listing.id).first('COUNT(*)')).toBe(4);
    await env.DB.prepare("UPDATE users SET role='OWNER' WHERE id='moderation-admin'").run();
    try { expect((await request('/admin/listings/review','GET',undefined,admin)).status).toBe(401); }
    finally { await env.DB.prepare("UPDATE users SET role='ADMIN' WHERE id='moderation-admin'").run(); }
  }, 15_000);

  it('preserves the source-compatible approve and reject routes',async()=>{
    const owner=await login('moderation.owner@example.test'),admin=await login('moderation.admin@example.test');
    const approved=await (await request('/listings','POST',{...fields,title:'Aprobación sintética por ruta fuente'},owner)).json() as {id:string};
    await request(`/listings/${approved.id}/submit`,'POST',undefined,owner);
    const at=new Date().toISOString(),approvedImageId='admin-detail-image-'+approved.id;
    await env.DB.prepare('INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at,blob_data) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(approvedImageId,approved.id,'admin-detail-object-'+approved.id,'preview.png','image/png',testPng.length,0,at,at,testPng).run();
    expect((await request(`/admin/listings/${approved.id}/approve`,'POST',undefined,owner)).status).toBe(401);
    expect((await request(`/admin/listings/${approved.id}`,'GET',undefined,owner)).status).toBe(401);
    expect((await request(`/admin/listings/${approved.id}/images/${approvedImageId}`,'GET',undefined,owner,true,'D1_BLOB')).status).toBe(401);
    const detail=await request(`/admin/listings/${approved.id}`,'GET',undefined,admin,true,'D1_BLOB');
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({id:approved.id,status:'SUBMITTED',publicationStatus:'UNPUBLISHED',owner:{id:'moderation-owner',email:'moderation.owner@example.test',role:'OWNER'},images:[{id:approvedImageId,url:`/admin/listings/${approved.id}/images/${approvedImageId}`,contentType:'image/png',sizeBytes:testPng.length,position:0}]});
    const approval=await request(`/admin/listings/${approved.id}/approve`,'POST',undefined,admin,true,'D1_BLOB');
    expect(approval.status).toBe(200);
    expect(await approval.json()).toMatchObject({id:approved.id,status:'APPROVED',publicationStatus:'UNPUBLISHED',owner:{id:'moderation-owner',email:'moderation.owner@example.test',role:'OWNER'},images:[{id:approvedImageId,url:`/admin/listings/${approved.id}/images/${approvedImageId}`}]});
    const approvalReplay=await request(`/admin/listings/${approved.id}/approve`,'POST',undefined,admin,true,'D1_BLOB');
    expect(approvalReplay.status).toBe(200);
    expect(await approvalReplay.json()).toMatchObject({id:approved.id,status:'APPROVED',owner:{id:'moderation-owner',email:'moderation.owner@example.test',role:'OWNER'},images:[{id:approvedImageId,url:`/admin/listings/${approved.id}/images/${approvedImageId}`}]});
    const publish=await request(`/admin/listings/${approved.id}/publish`,'POST',undefined,admin,true,'D1_BLOB');
    expect(publish.status).toBe(200);
    expect(await publish.json()).toMatchObject({id:approved.id,status:'APPROVED',publicationStatus:'PUBLISHED',images:[{id:approvedImageId,url:`/admin/listings/${approved.id}/images/${approvedImageId}`}]});
    const publishedImage=await request(`/admin/listings/${approved.id}/images/${approvedImageId}`,'GET',undefined,admin,true,'D1_BLOB');
    expect(publishedImage.status).toBe(200);
    expect(new Uint8Array(await publishedImage.arrayBuffer())).toEqual(testPng);

    const rejected=await (await request('/listings','POST',{...fields,title:'Rechazo sintético por ruta fuente'},owner)).json() as {id:string};
    await request(`/listings/${rejected.id}/submit`,'POST',undefined,owner);
    const rejectedImageId='admin-rejected-image-'+rejected.id;
    await env.DB.prepare('INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at,blob_data) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(rejectedImageId,rejected.id,'admin-rejected-object-'+rejected.id,'preview.png','image/png',testPng.length,0,at,at,testPng).run();
    const rejection=await request(`/admin/listings/${rejected.id}/reject`,'POST',{reason:'Faltan datos de disponibilidad.'},admin,true,'D1_BLOB');
    expect(rejection.status).toBe(200);
    expect(await rejection.json()).toMatchObject({id:rejected.id,status:'REJECTED',publicationStatus:'UNPUBLISHED',rejectionReason:'Faltan datos de disponibilidad.',owner:{id:'moderation-owner',email:'moderation.owner@example.test',role:'OWNER'},images:[{id:rejectedImageId,url:`/admin/listings/${rejected.id}/images/${rejectedImageId}`}]});
    const rejectedImage=await request(`/admin/listings/${rejected.id}/images/${rejectedImageId}`,'GET',undefined,admin,true,'D1_BLOB');
    expect(rejectedImage.status).toBe(200);
    expect(new Uint8Array(await rejectedImage.arrayBuffer())).toEqual(testPng);
    const rejectionReplay=await request(`/admin/listings/${rejected.id}/reject`,'POST',{reason:'Faltan datos de disponibilidad.'},admin);
    expect(rejectionReplay.status).toBe(200);
    expect(await rejectionReplay.json()).toMatchObject({id:rejected.id,status:'REJECTED',rejectionReason:'Faltan datos de disponibilidad.'});
    expect((await request(`/admin/listings/${rejected.id}/reject`,'POST',{reason:'Otro motivo diferente.'},admin)).status).toBe(409);
    expect(await env.DB.prepare('SELECT action FROM admin_audit_events WHERE listing_id IN (?,?) ORDER BY action').bind(approved.id,rejected.id).all()).toMatchObject({results:[{action:'ADMIN_LISTING_APPROVED'},{action:'ADMIN_LISTING_APPROVED'},{action:'ADMIN_LISTING_PUBLISHED'},{action:'ADMIN_LISTING_REJECTED'},{action:'ADMIN_LISTING_REJECTED'}]});
  },15_000);

  it('requires a meaningful rejection reason and keeps rejected listing unpublished',async()=>{
    const owner=await login('moderation.owner@example.test'),admin=await login('moderation.admin@example.test');
    const listing=await (await request('/listings','POST',{...fields,title:'Otra cabaña sintética'},owner)).json() as {id:string};
    await request(`/listings/${listing.id}/submit`,'POST',undefined,owner);
    expect((await request(`/admin/listings/${listing.id}/review`,'POST',{action:'reject',reason:'  '},admin)).status).toBe(400);
    const response=await request(`/admin/listings/${listing.id}/review`,'POST',{action:'reject',reason:'Falta confirmar servicios.'},admin);
    expect(await response.json()).toMatchObject({status:'REJECTED',publicationStatus:'UNPUBLISHED',rejectionReason:'Falta confirmar servicios.'});
    expect((await request(`/public/listings/${listing.id}`)).status).toBe(404);
    expect(await env.DB.prepare('SELECT action,entity_type,entity_id,metadata,reason FROM admin_audit_events WHERE listing_id=?').bind(listing.id).first()).toMatchObject({action:'ADMIN_LISTING_REJECTED',entity_type:'LISTING',entity_id:listing.id,metadata:'{"reason":"Falta confirmar servicios."}',reason:'Falta confirmar servicios.'});
  }, 15_000);

  it('rolls back approval if the audit record cannot be written',async()=>{
    const owner=await login('moderation.owner@example.test'),admin=await login('moderation.admin@example.test');
    const listing=await (await request('/listings','POST',{...fields,title:'Aprobación sintética con fallo de auditoría'},owner)).json() as {id:string};
    await request(`/listings/${listing.id}/submit`,'POST',undefined,owner);
    await env.DB.prepare(`CREATE TRIGGER fail_admin_audit BEFORE INSERT ON admin_audit_events WHEN NEW.listing_id='${listing.id}' BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END`).run();
    try {
      expect((await request(`/admin/listings/${listing.id}/review`,'POST',{action:'approve'},admin)).status).toBe(503);
      expect(await env.DB.prepare('SELECT status,publication_status FROM listings WHERE id=?').bind(listing.id).first()).toMatchObject({status:'SUBMITTED',publication_status:'UNPUBLISHED'});
      expect(await env.DB.prepare('SELECT COUNT(*) FROM admin_audit_events WHERE listing_id=?').bind(listing.id).first('COUNT(*)')).toBe(0);
    } finally { await env.DB.prepare('DROP TRIGGER fail_admin_audit').run(); }
  }, 15_000);

  it('uses the recent-audit index for global activity ordering',async()=>{
    const plan=await env.DB.prepare('EXPLAIN QUERY PLAN SELECT a.id,a.entity_type AS entityType,a.entity_id AS entityId,a.listing_id AS listingId,a.target_owner_id AS targetOwnerId,a.metadata,a.action,a.reason,a.created_at AS createdAt,u.id AS actorId,u.email AS actorEmail,o.email AS targetOwnerEmail FROM admin_audit_events a JOIN users u ON u.id=a.actor_id LEFT JOIN users o ON o.id=a.target_owner_id ORDER BY a.created_at DESC,a.id DESC LIMIT 30').all<any>();
    const details=plan.results.map(row=>row.detail).join('\n');
    expect(details).toContain('admin_audit_events_recent_idx');
    expect(details).not.toContain('USE TEMP B-TREE FOR ORDER BY');
  });

  it('uses a partial index for the moderation cursor order',async()=>{
    const plan=await env.DB.prepare("EXPLAIN QUERY PLAN SELECT l.id,l.owner_id AS ownerId,l.status,l.title,l.description,l.location,l.price_amount AS priceAmount,l.price_period AS pricePeriod,l.rental_duration AS rentalDuration,l.max_occupants AS maxOccupants,l.currency,l.publication_status AS publicationStatus,l.availability_status AS availabilityStatus,l.last_confirmed_at AS lastConfirmedAt,l.rejection_reason AS rejectionReason,l.created_at AS createdAt,l.updated_at AS updatedAt,u.email AS ownerEmail FROM listings l JOIN users u ON u.id=l.owner_id WHERE (l.status='SUBMITTED' OR (l.status='APPROVED' AND l.publication_status='UNPUBLISHED')) ORDER BY l.created_at DESC,l.id DESC LIMIT 101").all<any>();
    const details=plan.results.map(row=>row.detail).join('\n');
    expect(details).toContain('listings_admin_review_queue_created_idx');
    expect(details).not.toContain('USE TEMP B-TREE FOR ORDER BY');
  });

  it('retains generic source-shaped ADMIN audit metadata and nullable targets',async()=>{
    const admin=await login('moderation.admin@example.test'),at=new Date().toISOString();
    await env.DB.prepare('INSERT INTO admin_audit_events(id,actor_id,action,entity_type,entity_id,listing_id,target_owner_id,metadata,created_at) VALUES(?,?,?,?,?,NULL,NULL,?,?)').bind('generic-audit-synthetic', 'moderation-admin','OWNER_ASSISTED','USER','synthetic-target','{"source":"test"}',at).run();
    const response=await request('/admin/listings/audit?limit=100','GET',undefined,admin);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.arrayContaining([expect.objectContaining({id:'generic-audit-synthetic',entityType:'USER',entityId:'synthetic-target',listingId:null,targetOwnerId:null,targetOwner:null,metadata:{source:'test'},actor:{id:'moderation-admin',email:'moderation.admin@example.test',role:'ADMIN'}})]));
    await expect(env.DB.prepare('INSERT INTO admin_audit_events(id,actor_id,action,entity_type,metadata,created_at) VALUES(?,?,?,?,?,?)').bind('invalid-json-audit','moderation-admin','OWNER_ASSISTED','USER','not-json',at).run()).rejects.toThrow();
  });

  it('rejects fractional audit limits as a client error instead of binding them to SQLite',async()=>{
    const admin=await login('moderation.admin@example.test');
    const invalid=await request('/admin/listings/audit?limit=1.5','GET',undefined,admin);
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({error:'limit must be an integer'});
    expect((await request('/admin/listings/audit?limit=1','GET',undefined,admin)).status).toBe(200);
  });

  it('paginates the moderation queue so listings after the first 100 remain reachable',async()=>{
    const admin=await login('moderation.admin@example.test'),base=Date.UTC(2099,0,1);
    await env.DB.batch(Array.from({length:101},(_,i)=>{
      const createdAt=new Date(base+i*1000).toISOString(),id=`review-page-${String(i).padStart(3,'0')}`;
      return env.DB.prepare("INSERT INTO listings(id,owner_id,status,title,location,created_at,updated_at) VALUES(?,?,'SUBMITTED',?,?,?,?)").bind(id,'moderation-owner',`Synthetic review ${i}`,'Uspallata',createdAt,createdAt);
    }));
    try {
      const first=await (await request('/admin/listings/review','GET',undefined,admin)).json() as {items:any[];nextCursor:{createdAt:string;id:string}|null};
      expect(first.items).toHaveLength(100);
      expect(first.items[0].id).toBe('review-page-100');
      expect(first.nextCursor).toMatchObject({id:'review-page-001'});
      const cursor=first.nextCursor!;
      const second=await (await request(`/admin/listings/review?afterCreatedAt=${encodeURIComponent(cursor.createdAt)}&afterId=${encodeURIComponent(cursor.id)}`,'GET',undefined,admin)).json() as {items:any[];nextCursor:{createdAt:string;id:string}|null};
      expect(second.items.map(item=>item.id)).toContain('review-page-000');
      expect(second.nextCursor).toBeNull();
      expect((await request('/admin/listings/review?afterId=review-page-099','GET',undefined,admin)).status).toBe(400);
    } finally { await env.DB.prepare("DELETE FROM listings WHERE id LIKE 'review-page-%'").run(); }
  });

  it('flags legacy D1 rows and blocks approval and publication until media is migrated',async()=>{
    const owner=await login('moderation.owner@example.test'),admin=await login('moderation.admin@example.test');
    const listing=await (await request('/listings','POST',{...fields,title:'Publicación sintética con foto heredada'},owner)).json() as {id:string};
    await request(`/listings/${listing.id}/submit`,'POST',undefined,owner);
    const at=new Date().toISOString();
    await env.DB.prepare('INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at,blob_data) VALUES(?,?,?,?,?,?,?,?,?,NULL)').bind('legacy-'+listing.id,listing.id,'legacy:'+listing.id,'legacy.jpg','image/jpeg',12,0,at,at).run();
    const queue=await (await request('/admin/listings/review','GET',undefined,admin,true,'D1_BLOB')).json() as {items:any[]};
    expect(queue.items.find(item=>item.id===listing.id)).toMatchObject({requiresMediaRecovery:true,images:[]});
    const approval=await request(`/admin/listings/${listing.id}/review`,'POST',{action:'approve'},admin,true,'D1_BLOB');
    expect(approval.status).toBe(409);
    expect(await approval.json()).toMatchObject({code:'LEGACY_MEDIA_MIGRATION_REQUIRED'});
    expect(await env.DB.prepare('SELECT status,publication_status FROM listings WHERE id=?').bind(listing.id).first()).toMatchObject({status:'SUBMITTED',publication_status:'UNPUBLISHED'});
    await env.DB.prepare("UPDATE listings SET status='APPROVED' WHERE id=?").bind(listing.id).run();
    const publication=await request(`/admin/listings/${listing.id}/publish`,'POST',undefined,admin,true,'D1_BLOB');
    expect(publication.status).toBe(409);
    expect(await publication.json()).toMatchObject({code:'LEGACY_MEDIA_MIGRATION_REQUIRED'});
    expect(await env.DB.prepare('SELECT publication_status FROM listings WHERE id=?').bind(listing.id).first('publication_status')).toBe('UNPUBLISHED');
  }, 15_000);
});
