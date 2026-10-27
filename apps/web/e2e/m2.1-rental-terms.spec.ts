import { expect, request, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidence=resolve(process.cwd(),'../../output/playwright/m2.1');
async function capture(page:Page,name:string){await mkdir(evidence,{recursive:true});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:resolve(evidence,name),fullPage:true});}

test('M2.1 OWNER → revisión ADMIN → ficha pública, con datos sintéticos',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('owner.a@example.test');
  await page.getByLabel('Contraseña').fill('synthetic-owner-password-1');
  await page.getByRole('button',{name:'Ingresar'}).click();
  await expect(page).toHaveURL(/\/owner$/);
  await page.getByRole('button',{name:'+ Nuevo alojamiento'}).click();
  const title=`M2.1 Synthetic ${Date.now()}`;
  await page.getByLabel('Nombre del alojamiento').fill(title);
  await page.getByLabel('Descripción').fill('Alojamiento sintético para probar condiciones mensuales.');
  await page.getByLabel('Precio de referencia').fill('125000');
  await page.getByLabel('Periodicidad').selectOption('MONTH');
  await page.getByLabel('Capacidad máxima').fill('3');
  await page.getByLabel('Depósito o garantía').selectOption('FIXED_AMOUNT');
  await page.getByRole('spinbutton',{name:'Monto fijo'}).fill('250000');
  await page.getByLabel('Moneda del depósito').selectOption('ARS');
  await page.getByLabel('Internet incluido en el precio').selectOption('INCLUDED');
  await page.getByLabel('Agua incluida en el precio').selectOption('NOT_INCLUDED');
  await page.getByLabel('Electricidad incluida en el precio').selectOption('NOT_INFORMED');
  await page.getByLabel('Gas incluido en el precio').selectOption('INCLUDED');
  await page.getByLabel('¿Se permiten mascotas?').selectOption('ASK_OWNER');
  await page.getByLabel('Fecha estimada de ingreso').fill('2027-02-15');
  await expect(page.getByText('declarados por vos')).toBeVisible();
  await page.getByLabel('Periodicidad').selectOption('WEEK');
  await expect(page.getByLabel('Fecha estimada de ingreso')).toHaveCount(0);
  await page.getByLabel('Periodicidad').selectOption('MONTH');
  await page.getByLabel('Depósito o garantía').selectOption('FIXED_AMOUNT');
  await page.getByRole('spinbutton',{name:'Monto fijo'}).fill('250000');
  await page.getByLabel('Moneda del depósito').selectOption('ARS');
  await page.getByLabel('Internet incluido en el precio').selectOption('INCLUDED');
  await page.getByLabel('Agua incluida en el precio').selectOption('NOT_INCLUDED');
  await page.getByLabel('Electricidad incluida en el precio').selectOption('NOT_INFORMED');
  await page.getByLabel('Gas incluido en el precio').selectOption('INCLUDED');
  await page.getByLabel('¿Se permiten mascotas?').selectOption('ASK_OWNER');
  await page.getByLabel('Fecha estimada de ingreso').fill('2027-02-15');
  for(const width of [320,390]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await capture(page,`owner-terms-mobile-${width}.png`);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Guardar borrador'}).click();
  await expect(page.getByRole('status')).toContainText('Borrador creado');
  const ownerListings=await page.request.get('/api/listings');expect(ownerListings.status()).toBe(200);
  const listing=(await ownerListings.json() as any[]).find(item=>item.title===title);expect(listing).toBeTruthy();
  expect(listing).toMatchObject({depositStatus:'FIXED_AMOUNT',depositAmount:250000,depositCurrency:'ARS',internetIncluded:'INCLUDED',waterIncluded:'NOT_INCLUDED',petsPolicy:'ASK_OWNER',availableFrom:'2027-02-15'});
  await page.reload();
  await page.getByRole('button',{name:new RegExp(title)}).click();
  await expect(page.getByRole('spinbutton',{name:'Monto fijo'})).toHaveValue('250000');
  await expect(page.getByLabel('Fecha estimada de ingreso')).toHaveValue('2027-02-15');
  await capture(page,'owner-terms-desktop-1440.png');
  await page.getByRole('button',{name:'Enviar a revisión'}).click();
  await expect(page.getByText('En revisión',{exact:true}).first()).toBeVisible();
  const admin=await request.newContext({baseURL:'http://127.0.0.1:5175',extraHTTPHeaders:{Origin:'http://127.0.0.1:5175'}});
  try{
    const login=await admin.post('/api/auth/login',{data:{email:'admin@example.test',password:'synthetic-owner-password-1'}});expect(login.status()).toBe(200);
    const review=await admin.post(`/api/admin/listings/${listing.id}/review`,{data:{action:'approve'}});expect(review.status()).toBe(200);
    const publish=await admin.post(`/api/admin/listings/${listing.id}/publish`);expect(publish.status()).toBe(200);
  }finally{await admin.dispose();}
  await page.goto(`/listings/${encodeURIComponent(listing.id)}`);
  await expect(page.getByRole('heading',{name:'Condiciones del alquiler'})).toBeVisible();
  await expect(page.getByText('ARS 250.000 · monto fijo declarado')).toBeVisible();
  await expect(page.getByText('Incluido en el precio').first()).toBeVisible();
  await expect(page.getByText('Consultar al propietario')).toBeVisible();
  await expect(page.getByText('15 de febrero de 2027')).toBeVisible();
  await expect(page.getByText(/declaradas por el propietario/)).toBeVisible();
  await capture(page,'detail-terms-desktop-1440.png');
  for(const [width,name] of [[390,'detail-terms-mobile-390.png'],[320,'detail-terms-mobile-320.png']] as const){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByRole('heading',{name:'Condiciones del alquiler'})).toBeVisible();
    await capture(page,name);
  }
});
