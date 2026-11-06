import { expect, test, type Page } from '@playwright/test';
import { createPrivateKey, createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const origin='http://127.0.0.1:5178';
const clientId='google-local-test-client.apps.googleusercontent.com';
const signingKeyPath=process.env.GOOGLE_AUTH_E2E_SIGNING_KEY;
if(!signingKeyPath)throw new Error('The local Google E2E runner must provide its temporary signing key.');
const testKey=createPrivateKey(await readFile(signingKeyPath));
type GoogleTestWindow=Window&{__googleAuthOptions?:{client_id:string;nonce:string;callback:(response:{credential?:string})=>void};__googleTestCredential?:string;google?:unknown};

function tokenFor(nonce:string,sub='local-google-owner-sub',email='local-google-owner@example.test'){
  const now=Math.floor(Date.now()/1000);
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const input=`${encode({alg:'RS256',typ:'JWT',kid:'google-owner-local-test'})}.${encode({iss:'https://accounts.google.com',aud:clientId,sub,email,email_verified:true,nonce,iat:now,exp:now+300})}`;
  const signer=createSign('RSA-SHA256');signer.update(input);signer.end();
  return `${input}.${signer.sign(testKey).toString('base64url')}`;
}

async function mockGoogleIdentityServices(page:Page){
  await page.route('https://accounts.google.com/gsi/client',route=>route.fulfill({status:200,contentType:'application/javascript',body:`
    window.google={accounts:{id:{
      initialize(options){window.__googleAuthOptions=options;},
      renderButton(container){const button=document.createElement('button');button.type='button';button.textContent='Continuar con Google';button.setAttribute('aria-label','Continuar con Google');button.addEventListener('click',()=>window.__googleAuthOptions.callback({credential:window.__googleTestCredential}));container.append(button);},
      disableAutoSelect(){}
    }}};
  `}));
}

async function signIn(page:Page,sub='local-google-owner-sub',email='local-google-owner@example.test'){
  await mockGoogleIdentityServices(page);
  await page.goto('/login');
  const button=page.getByRole('button',{name:'Continuar con Google'});
  await expect(button).toBeVisible();
  await expect(page.getByText('Perfil de demostración')).toHaveCount(0);
  const nonce=await page.evaluate(()=>((window as GoogleTestWindow).__googleAuthOptions?.nonce)??'');
  expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
  await page.evaluate((credential)=>{(window as GoogleTestWindow).__googleTestCredential=credential;},tokenFor(nonce,sub,email));
  await button.click();
  await expect(page).toHaveURL(/\/owner$/);
  await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();
}

test('Google OWNER login creates no public listing, restores identity/listings, and logout revokes the browser session',async({page,context})=>{
  await signIn(page);
  const cookies=await context.cookies(origin);
  const sessionCookie=cookies.find(cookie=>cookie.name==='alquileres_session');
  const browserCookie=cookies.find(cookie=>cookie.name==='__Host-alquileres_google_browser');
  expect(sessionCookie).toMatchObject({httpOnly:true,secure:true,sameSite:'Lax',path:'/'});
  expect(browserCookie).toMatchObject({httpOnly:true,secure:true,sameSite:'Strict',path:'/'});
  expect(await page.evaluate(()=>Object.values(localStorage).some(value=>/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)))).toBe(false);

  const identity=await page.evaluate(async()=>{
    const response=await fetch('/api/auth/me');
    return {status:response.status,body:await response.json()};
  });
  expect(identity.status).toBe(200);
  expect(identity.body).toMatchObject({email:'local-google-owner@example.test',role:'OWNER'});

  const created=await page.evaluate(async()=>{
    const response=await fetch('/api/listings',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'google-owner-e2e-listing'},body:JSON.stringify({title:'Alojamiento Google sintético',description:'Anuncio local de prueba.',location:'Uspallata',priceAmount:250000,pricePeriod:'MONTH',rentalDuration:'MONTHS',maxOccupants:2,currency:'ARS'})});
    return {status:response.status,body:await response.json()};
  });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({ownerId:identity.body.id,status:'DRAFT',publicationStatus:'UNPUBLISHED'});
  expect(created.body.id).toBeTruthy();

  await page.reload();
  await expect(page).toHaveURL(/\/owner$/);
  const persisted=await page.evaluate(async()=>{
    const response=await fetch('/api/listings');return {status:response.status,body:await response.json()};
  });
  expect(persisted.status).toBe(200);
  expect(persisted.body.map((listing:{id:string})=>listing.id)).toContain(created.body.id);

  await page.getByRole('button',{name:'Cerrar sesión'}).click();
  await expect(page.getByRole('link',{name:'Ingresar'})).toBeVisible();
  expect((await page.evaluate(async()=> (await fetch('/api/listings')).status))).toBe(401);

  await signIn(page);
  const restored=await page.evaluate(async()=> (await fetch('/api/auth/me')).json());
  expect(restored.id).toBe(identity.body.id);
  const afterReentry=await page.evaluate(async()=>{const response=await fetch('/api/listings');return {status:response.status,body:await response.json()};});
  expect(afterReentry.status).toBe(200);
  expect(afterReentry.body.map((listing:{id:string})=>listing.id)).toContain(created.body.id);
  await expect(page.locator('body')).not.toContainText('Continuar como administrador');
});

test('Google registration entry remains readable on a 320px viewport',async({page})=>{
  await page.setViewportSize({width:320,height:760});
  await mockGoogleIdentityServices(page);
  await page.goto('/register');
  await expect(page.getByRole('button',{name:'Continuar con Google'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByText(/La primera vez se crea una cuenta individual de propietario/)).toBeVisible();
});
