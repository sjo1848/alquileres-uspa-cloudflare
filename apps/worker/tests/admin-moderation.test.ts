import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/index';

const origin='http://localhost', secret='synthetic-admin-moderation-secret-at-least-32-bytes';
const bindings={...env,DB:env.DB,JWT_SECRET:secret,MEDIA_STRATEGY:'STATIC_ASSETS'};
const fields={title:'Cabaña sintética para moderación',description:'Datos ficticios de revisión',location:'Uspallata',priceAmount:25000,pricePeriod:'MONTH',rentalDuration:'FLEXIBLE',maxOccupants:2,currency:'ARS'};
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
    expect((await request('/admin/listings/review','GET',undefined,owner)).status).toBe(403);
    const created=await request('/listings','POST',fields,owner),listing=await created.json() as {id:string};
    expect(created.status).toBe(201);
    expect((await request(`/listings/${listing.id}/submit`,'POST',undefined,owner)).status).toBe(200);
    const queue=await request('/admin/listings/review','GET',undefined,admin),items=await queue.json() as any[];
    expect(items.some(item=>item.id===listing.id&&item.owner.email==='moderation.owner@example.test')).toBe(true);
    expect((await request('/admin/listings/'+listing.id+'/review','POST',{action:'approve'},admin,false)).status).toBe(403);
    const approved=await request('/admin/listings/'+listing.id+'/review','POST',{action:'approve'},admin);
    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({id:listing.id,status:'APPROVED',publicationStatus:'UNPUBLISHED',rejectionReason:null});
    expect((await request('/public/listings/'+listing.id)).status).toBe(404);
    const published=await request('/admin/listings/'+listing.id+'/publish','POST',undefined,admin);
    expect(await published.json()).toMatchObject({id:listing.id,status:'APPROVED',publicationStatus:'PUBLISHED'});
    expect((await request('/public/listings/'+listing.id)).status).toBe(200);
    const audit=await request('/admin/listings/audit?listingId='+listing.id,'GET',undefined,admin);
    expect(await audit.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({listingId:listing.id,targetOwner:{id:'moderation-owner',email:'moderation.owner@example.test',role:'OWNER'},action:'LISTING_APPROVED',actor:{id:'moderation-admin',email:'moderation.admin@example.test',role:'ADMIN'}}),
      expect.objectContaining({listingId:listing.id,action:'LISTING_PUBLISHED',actor:{id:'moderation-admin',email:'moderation.admin@example.test',role:'ADMIN'}}),
    ]));
    expect((await request('/admin/listings/audit','GET',undefined,owner)).status).toBe(403);
    expect((await request('/admin/listings/'+listing.id+'/review','POST',{action:'approve'},admin)).status).toBe(409);
    expect(await env.DB.prepare('SELECT COUNT(*) FROM admin_audit_events WHERE listing_id=?').bind(listing.id).first('COUNT(*)')).toBe(2);
  });

  it('requires a meaningful rejection reason and keeps rejected listing unpublished',async()=>{
    const owner=await login('moderation.owner@example.test'),admin=await login('moderation.admin@example.test');
    const listing=await (await request('/listings','POST',{...fields,title:'Otra cabaña sintética'},owner)).json() as {id:string};
    await request(`/listings/${listing.id}/submit`,'POST',undefined,owner);
    expect((await request(`/admin/listings/${listing.id}/review`,'POST',{action:'reject',reason:'  '},admin)).status).toBe(400);
    const response=await request(`/admin/listings/${listing.id}/review`,'POST',{action:'reject',reason:'Falta confirmar servicios.'},admin);
    expect(await response.json()).toMatchObject({status:'REJECTED',publicationStatus:'UNPUBLISHED',rejectionReason:'Falta confirmar servicios.'});
    expect((await request(`/public/listings/${listing.id}`)).status).toBe(404);
    expect(await env.DB.prepare('SELECT action,reason FROM admin_audit_events WHERE listing_id=?').bind(listing.id).first()).toMatchObject({action:'LISTING_REJECTED',reason:'Falta confirmar servicios.'});
  });

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
  });

  it('uses the recent-audit index for global activity ordering',async()=>{
    const plan=await env.DB.prepare('EXPLAIN QUERY PLAN SELECT id FROM admin_audit_events ORDER BY created_at DESC,id DESC LIMIT 30').all<any>();
    const details=plan.results.map(row=>row.detail).join('\n');
    expect(details).toContain('admin_audit_events_recent_idx');
    expect(details).not.toContain('USE TEMP B-TREE FOR ORDER BY');
  });

  it('flags legacy D1 rows and blocks approval and publication until media is migrated',async()=>{
    const owner=await login('moderation.owner@example.test'),admin=await login('moderation.admin@example.test');
    const listing=await (await request('/listings','POST',{...fields,title:'Publicación sintética con foto heredada'},owner)).json() as {id:string};
    await request(`/listings/${listing.id}/submit`,'POST',undefined,owner);
    const at=new Date().toISOString();
    await env.DB.prepare('INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at,blob_data) VALUES(?,?,?,?,?,?,?,?,?,NULL)').bind('legacy-'+listing.id,listing.id,'legacy:'+listing.id,'legacy.jpg','image/jpeg',12,0,at,at).run();
    const queue=await (await request('/admin/listings/review','GET',undefined,admin,true,'D1_BLOB')).json() as any[];
    expect(queue.find(item=>item.id===listing.id)).toMatchObject({requiresMediaRecovery:true,images:[]});
    const approval=await request(`/admin/listings/${listing.id}/review`,'POST',{action:'approve'},admin,true,'D1_BLOB');
    expect(approval.status).toBe(409);
    expect(await approval.json()).toMatchObject({code:'LEGACY_MEDIA_MIGRATION_REQUIRED'});
    expect(await env.DB.prepare('SELECT status,publication_status FROM listings WHERE id=?').bind(listing.id).first()).toMatchObject({status:'SUBMITTED',publication_status:'UNPUBLISHED'});
    await env.DB.prepare("UPDATE listings SET status='APPROVED' WHERE id=?").bind(listing.id).run();
    const publication=await request(`/admin/listings/${listing.id}/publish`,'POST',undefined,admin,true,'D1_BLOB');
    expect(publication.status).toBe(409);
    expect(await publication.json()).toMatchObject({code:'LEGACY_MEDIA_MIGRATION_REQUIRED'});
    expect(await env.DB.prepare('SELECT publication_status FROM listings WHERE id=?').bind(listing.id).first('publication_status')).toBe('UNPUBLISHED');
  });
});
