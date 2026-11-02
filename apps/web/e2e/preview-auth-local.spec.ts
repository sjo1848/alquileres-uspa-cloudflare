import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createSign, createPrivateKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const origin='http://127.0.0.1:5177';
const audience='6'.repeat(64);
const serviceClientId='local-playwright-test-client-12345';
const issuer='https://access-test.invalid';
const testKey=createPrivateKey(await readFile(new URL('./fixtures/preview-auth-test-private.pem',import.meta.url)));

function accessAssertion(exp=Math.floor(Date.now()/1000)+120){
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const input=`${encode({alg:'RS256',typ:'JWT',kid:'preview-auth-e2e'})}.${encode({iss:issuer,aud:[audience],sub:'',common_name:serviceClientId,service_token_id:serviceClientId,service_token_status:true,type:'app',iat:Math.floor(Date.now()/1000),nbf:Math.floor(Date.now()/1000),exp})}`;
  const signer=createSign('RSA-SHA256');signer.update(input);signer.end();
  return `${input}.${signer.sign(testKey).toString('base64url')}`;
}

async function enableLocalServiceAuth(context:BrowserContext,onRefresh?:()=>void,tokenForRequest:(url:URL)=>string=( )=>accessAssertion()){
  await context.route(`${origin}/api/**`,async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/auth/refresh')onRefresh?.();
    await route.continue({headers:{...route.request().headers(),'Cf-Access-Jwt-Assertion':tokenForRequest(url)}});
  });
}

async function signIn(page:Page,role:'OWNER'|'ADMIN'){
  await page.goto('/login');
  await page.locator(`input[type="radio"][value="${role}"]`).check();
  await page.getByRole('button',{name:role==='OWNER'?'Continuar como propietario':'Continuar como administrador'}).click();
  await expect(page).toHaveURL(role==='OWNER'?/\/owner$/:/\/admin$/);
}

test('local Preview auth: preventive renewal, expired-cookie reopen, OWNER→ADMIN, and per-browser logout',async()=>{
  test.setTimeout(120_000);
  const profile=await mkdtemp(join(tmpdir(),'cf-au-i64-preview-auth-'));
  const contexts: BrowserContext[] = [];
  try {
    let expireNextLogout=false;
    const tokenForRequest=(url:URL)=>{
      if(expireNextLogout&&url.pathname==='/api/auth/logout'){
        expireNextLogout=false;
        return accessAssertion(Math.floor(Date.now()/1000)-10);
      }
      return accessAssertion();
    };
    let context=await chromium.launchPersistentContext(profile,{headless:true});
    contexts.push(context);
    let refreshCount=0;
    await enableLocalServiceAuth(context,()=>refreshCount++,tokenForRequest);
    const ownerPage=context.pages()[0]??await context.newPage();
    await signIn(ownerPage,'OWNER');

    let cookies=await context.cookies(`${origin}/api/auth/refresh`);
    let shortCookie=cookies.find(cookie=>cookie.name==='alquileres_session');
    const durableCookie=cookies.find(cookie=>cookie.name==='alquileres_refresh');
    expect(shortCookie).toMatchObject({httpOnly:true,secure:false,sameSite:'Lax',path:'/'});
    expect(shortCookie!.expires-Math.floor(Date.now()/1000)).toBeLessThanOrEqual(6);
    expect(durableCookie).toMatchObject({httpOnly:true,secure:false,sameSite:'Lax',path:'/api/auth'});
    expect(durableCookie!.expires-Math.floor(Date.now()/1000)).toBeGreaterThan(6*24*3600);
    expect(await ownerPage.evaluate(()=>Object.keys(localStorage))).toEqual([]);

    await expect.poll(()=>refreshCount,{timeout:8_000}).toBeGreaterThan(0);
    cookies=await context.cookies(`${origin}/api/auth/refresh`);shortCookie=cookies.find(cookie=>cookie.name==='alquileres_session');
    expect(shortCookie).toBeDefined();
    expect(shortCookie!.expires-Math.floor(Date.now()/1000)).toBeGreaterThan(2);

    await context.close();
    await new Promise(resolve=>setTimeout(resolve,5_500));
    context=await chromium.launchPersistentContext(profile,{headless:true});
    contexts.push(context);
    await enableLocalServiceAuth(context,undefined,tokenForRequest);
    const restoredPage=context.pages()[0]??await context.newPage();
    cookies=await context.cookies(`${origin}/api/auth/refresh`);
    expect(cookies.some(cookie=>cookie.name==='alquileres_session')).toBe(false);
    expect(cookies.some(cookie=>cookie.name==='alquileres_refresh')).toBe(true);
    await restoredPage.goto('/owner');
    await expect(restoredPage).toHaveURL(/\/owner$/);
    await expect(restoredPage.getByRole('heading',{name:'Mis alojamientos'})).toBeVisible();
    expect(await restoredPage.evaluate(async()=> (await fetch('/api/auth/me')).status)).toBe(200);

    const otherOwnerContext=await context.browser()!.newContext({baseURL:origin});
    contexts.push(otherOwnerContext);
    await enableLocalServiceAuth(otherOwnerContext);
    const otherOwnerPage=await otherOwnerContext.newPage();
    await signIn(otherOwnerPage,'OWNER');
    const adminContext=await context.browser()!.newContext({baseURL:origin});
    contexts.push(adminContext);
    await enableLocalServiceAuth(adminContext);
    const adminPage=await adminContext.newPage();
    await signIn(adminPage,'ADMIN');

    const title=`Preview renewal lifecycle ${Date.now()}`;
    await restoredPage.getByRole('button',{name:'+ Nuevo alojamiento'}).click();
    await restoredPage.getByLabel('Nombre del alojamiento').fill(title);
    await restoredPage.getByLabel('Descripción').fill('Registro sintético del recorrido local OWNER a ADMIN.');
    await restoredPage.getByLabel('Ubicación').fill('Uspallata, Mendoza');
    await restoredPage.getByLabel('Precio de referencia').fill('42000');
    await restoredPage.getByLabel('Periodicidad').selectOption('MONTH');
    await restoredPage.getByLabel('Duración').selectOption('FLEXIBLE');
    await restoredPage.getByLabel('Capacidad máxima').fill('2');
    await restoredPage.getByRole('button',{name:'Guardar borrador'}).click();
    await expect(restoredPage.locator('.owner-feedback[role="status"]')).toContainText('Borrador creado');
    const createdListing=await restoredPage.evaluate(async(title)=>{
      const response=await fetch('/api/listings');
      const listings=await response.json() as Array<{id:string;title:string}>;
      return listings.find(listing=>listing.title===title)??null;
    },title);
    expect(createdListing).not.toBeNull();
    execFileSync('node',['scripts/seed-preview-auth-e2e-listing-image.mjs',createdListing!.id],{stdio:'inherit',env:process.env});
    await restoredPage.reload();
    await restoredPage.getByRole('button',{name:new RegExp(title)}).click();
    await restoredPage.getByRole('tab',{name:/Fotografías/}).click();
    const retainedPhoto=restoredPage.getByRole('img',{name:`Foto 1 de ${title}`});
    await expect(retainedPhoto).toBeVisible();
    await expect.poll(()=>retainedPhoto.evaluate(image=>(image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await restoredPage.getByRole('tab',{name:'Información'}).click();
    await restoredPage.getByRole('button',{name:'Enviar a revisión'}).click();
    await expect(restoredPage.locator('.owner-feedback[role="status"]')).toContainText('enviada a revisión');

    await adminPage.goto('/admin');
    await adminPage.getByRole('button',{name:new RegExp(title)}).click();
    await adminPage.getByRole('button',{name:'Aprobar revisión'}).click();
    await expect(adminPage.getByRole('button',{name:'Publicar en catálogo'})).toBeVisible();
    await adminPage.getByRole('button',{name:'Publicar en catálogo'}).click();
    await expect(adminPage.getByText('La publicación ya está visible en el catálogo.')).toBeVisible();
    const publicResults=await adminPage.evaluate(async()=>{
      const response=await fetch('/api/public/listings');
      return {status:response.status,body:await response.json() as {items:Array<{id:string;title:string}>}};
    });
    expect(publicResults.status).toBe(200);
    expect(publicResults.body.items.some(item=>item.id===createdListing!.id&&item.title===title)).toBe(true);
    const initialPublic=await adminPage.evaluate(async(id)=>{
      const response=await fetch(`/api/public/listings/${id}`);
      return {status:response.status,listing:await response.json() as {id:string;title:string;priceAmount:number;availabilityStatus:string;lastConfirmedAt:string|null;images:Array<{id:string;url?:string;position:number}>}};
    },createdListing!.id);
    expect(initialPublic).toMatchObject({status:200,listing:{id:createdListing!.id,title,priceAmount:42000,availabilityStatus:'AVAILABLE'}});
    expect(initialPublic.listing.images).toHaveLength(1);
    expect(initialPublic.listing.images[0].url).toBe('/media/catalog/cabana-cerro.svg');

    await adminPage.goto(`/listings/${createdListing!.id}`);
    await adminPage.getByLabel('Tu nombre').fill('Visita sintética');
    await adminPage.getByLabel('Tu correo').fill('visita@example.test');
    await adminPage.getByLabel('Mensaje').fill('Consulta sintética previa a proponer cambios.');
    const contactResponse=adminPage.waitForResponse(response=>response.url().includes('/contact')&&response.request().method()==='POST');
    await adminPage.getByRole('button',{name:/Enviar consulta/}).click();
    const acceptedContact=await contactResponse;
    expect(acceptedContact.status()).toBe(201);
    const contactId=(await acceptedContact.json() as {id:string}).id;

    await restoredPage.goto('/owner');
    await restoredPage.getByRole('button',{name:new RegExp(title)}).click();
    await restoredPage.getByRole('tab',{name:'Disponibilidad'}).click();
    await restoredPage.getByRole('button',{name:'Marcar no disponible'}).click();
    await expect(restoredPage.getByRole('heading',{name:'No disponible'})).toBeVisible();
    await expect(restoredPage.locator('.owner-feedback[role="status"]')).toContainText('Disponibilidad actualizada');
    await restoredPage.getByRole('tab',{name:'Información'}).click();

    const editedTitle=`${title} — edición aprobada`;
    await restoredPage.getByLabel('Nombre del alojamiento').fill(editedTitle);
    await restoredPage.getByLabel('Precio de referencia').fill('46000');
    await restoredPage.getByRole('button',{name:'Guardar cambios',exact:true}).click();
    await expect(restoredPage.locator('.owner-feedback[role="status"]')).toContainText('Borrador de cambios guardado');
    await expect(restoredPage.locator('.owner-feedback[role="status"]')).toContainText('publicación original sigue visible');
    let stillOriginal=await adminPage.evaluate(async(id)=>{
      const response=await fetch(`/api/public/listings/${id}`);
      return {status:response.status,listing:await response.json() as {id:string;title:string;priceAmount:number;availabilityStatus:string;lastConfirmedAt:string|null;images:Array<{id:string;position:number}>}};
    },createdListing!.id);
    expect(stillOriginal).toMatchObject({status:200,listing:{id:createdListing!.id,title,priceAmount:42000,availabilityStatus:'UNAVAILABLE'}});
    const priorConfirmation=stillOriginal.listing.lastConfirmedAt;
    expect(priorConfirmation).toBeTruthy();
    expect(stillOriginal.listing.images).toEqual(initialPublic.listing.images);

    await restoredPage.getByRole('button',{name:'Enviar a revisión'}).click();
    await expect(restoredPage.locator('.owner-feedback[role="status"]')).toContainText('Cambios enviados a revisión');
    await adminPage.goto('/admin');
    await adminPage.getByRole('button',{name:'Actualizar revisiones'}).click();
    await expect(adminPage.getByRole('heading',{name:editedTitle})).toBeVisible();
    await adminPage.getByRole('button',{name:'Aprobar cambios'}).click();
    await expect(adminPage.locator('.admin-audit-panel .admin-feedback[role="status"]')).toContainText('Revisión aprobada; aún no se publicó');
    await expect(adminPage.getByRole('button',{name:'Publicar cambios aprobados'})).toBeVisible();
    stillOriginal=await adminPage.evaluate(async(id)=>{
      const response=await fetch(`/api/public/listings/${id}`);
      return {status:response.status,listing:await response.json() as {id:string;title:string;priceAmount:number;availabilityStatus:string;lastConfirmedAt:string|null;images:Array<{id:string;position:number}>}};
    },createdListing!.id);
    expect(stillOriginal).toMatchObject({status:200,listing:{id:createdListing!.id,title,priceAmount:42000,availabilityStatus:'UNAVAILABLE',lastConfirmedAt:priorConfirmation}});
    expect(stillOriginal.listing.images).toEqual(initialPublic.listing.images);
    await adminPage.getByRole('button',{name:'Publicar cambios aprobados'}).click();
    await expect(adminPage.locator('.admin-audit-panel .admin-feedback[role="status"]')).toContainText('Cambios publicados sobre el mismo alojamiento');
    const finalPublic=await adminPage.evaluate(async(id)=>{
      const response=await fetch(`/api/public/listings/${id}`);
      return {status:response.status,listing:await response.json() as {id:string;title:string;priceAmount:number;availabilityStatus:string;lastConfirmedAt:string|null;images:Array<{id:string;position:number}>}};
    },createdListing!.id);
    expect(finalPublic).toMatchObject({status:200,listing:{id:createdListing!.id,title:editedTitle,priceAmount:46000,availabilityStatus:'UNAVAILABLE',lastConfirmedAt:priorConfirmation}});
    expect(finalPublic.listing.images).toEqual(initialPublic.listing.images);
    const ownerContacts=await restoredPage.evaluate(async()=>{
      const response=await fetch('/api/owner/contact-events');
      return {status:response.status,body:await response.json() as {items:Array<{id:string;state:string;visitorName:string;visitorEmail:string;message:string;listing:{id:string}}>}};
    });
    expect(ownerContacts.status).toBe(200);
    expect(ownerContacts.body.items).toContainEqual(expect.objectContaining({
      id:contactId,state:'UNREAD',visitorName:'Visita sintética',visitorEmail:'visita@example.test',
      message:'Consulta sintética previa a proponer cambios.',listing:expect.objectContaining({id:createdListing!.id}),
    }));

    expireNextLogout=true;
    await restoredPage.getByRole('button',{name:'Cerrar sesión'}).click();
    await expect(restoredPage.getByRole('alert')).toContainText('No pudimos cerrar la sesión');
    await expect(restoredPage).toHaveURL(/\/owner$/);
    expect(await restoredPage.evaluate(async()=> (await fetch('/api/auth/me')).status)).toBe(200);
    await restoredPage.getByRole('button',{name:'Cerrar sesión'}).click();
    await expect(restoredPage).toHaveURL('/');
    expect(await restoredPage.evaluate(async()=> (await fetch('/api/auth/me')).status)).toBe(401);
    expect(await otherOwnerPage.evaluate(async()=> (await fetch('/api/auth/me')).status)).toBe(200);
    expect(await adminPage.evaluate(async()=> (await fetch('/api/auth/me')).status)).toBe(200);

  } finally {
    await Promise.all(contexts.map(browserContext=>browserContext.close().catch(()=>undefined)));
    await rm(profile,{recursive:true,force:true});
  }
});
