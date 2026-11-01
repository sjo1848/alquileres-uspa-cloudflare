import {test,expect, type BrowserContext, type Page} from '@playwright/test';

const previewOrigin='https://private-alquileres-uspa-lab.sjo1848.workers.dev';
const clientId=process.env.CF_ACCESS_CLIENT_ID!;
const clientSecret=process.env.CF_ACCESS_CLIENT_SECRET!;

async function attachServiceAuth(context:BrowserContext){
  await context.route('**/*',async route=>{
    const requestUrl=new URL(route.request().url());
    const headers={...route.request().headers()};
    delete headers['cf-access-client-id'];delete headers['cf-access-client-secret'];
    if(requestUrl.origin!==previewOrigin){await route.continue({headers});return;}
    headers['cf-access-client-id']=clientId;headers['cf-access-client-secret']=clientSecret;
    await route.continue({headers});
  });
}

async function enterRole(page:Page,role:'OWNER'|'ADMIN'){
  await page.goto('/login');
  const label=role==='OWNER'?'Propietario':'Administrador';
  const button=role==='OWNER'?'Continuar como propietario':'Continuar como administrador';
  await page.getByRole('radio',{name:label}).check();
  await page.getByRole('button',{name:button,exact:true}).click();
  await page.waitForURL(role==='OWNER'?'**/owner':'**/admin');
}

async function statusFor(page:Page,path:string){
  return page.evaluate(async endpoint=>{
    const response=await fetch(endpoint,{credentials:'include'});
    return response.status;
  },`/api${path}`);
}

test('remote Preview Service Auth: fixed synthetic OWNER/ADMIN role boundaries (creates session rows in D1)',async({browser})=>{
  const ownerContext=await browser.newContext();
  await attachServiceAuth(ownerContext);
  const ownerPage=await ownerContext.newPage();
  await enterRole(ownerPage,'OWNER');
  await expect(ownerPage.getByRole('heading',{name:'Mis publicaciones'})).toBeVisible();
  expect(await statusFor(ownerPage,'/listings')).toBe(200);
  expect(await statusFor(ownerPage,'/admin/listings/review')).toBe(401);

  const adminContext=await browser.newContext();
  await attachServiceAuth(adminContext);
  const adminPage=await adminContext.newPage();
  await enterRole(adminPage,'ADMIN');
  await expect(adminPage.getByRole('heading',{name:'Revisión de publicaciones'})).toBeVisible();
  expect(await statusFor(adminPage,'/admin/listings/review')).toBe(200);
  expect(await statusFor(adminPage,'/listings')).toBe(401);

  await ownerContext.close();
  await adminContext.close();
});
