import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidence = resolve(process.cwd(), '../../output/playwright/i06.5');
const redPhoto = resolve(process.cwd(), 'e2e/fixtures/owner-e2e-red.png');
const bluePhoto = resolve(process.cwd(), 'e2e/fixtures/owner-e2e-blue.png');
async function capture(page: import('@playwright/test').Page, name: string) {
  await mkdir(evidence, { recursive: true });
  await page.locator('img').evaluateAll(images => { for (const image of images) (image as HTMLImageElement).loading = 'eager'; });
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode().catch(() => undefined))));
  await page.screenshot({ path: resolve(evidence, name), fullPage: true });
}
async function login(page: import('@playwright/test').Page, email: string, password='synthetic-owner-password-1') {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/owner$/);
  await expect(page.getByRole('heading', { name: 'Tu lugar en Uspallata' })).toBeVisible();
}

test('identidad OWNER local: registro, verificación MOCK, recuperación, login y logout', async ({ page }) => {
  const email = `owner-${Date.now()}@example.test`;
  const password = 'local-synthetic-owner-2026';
  const newPassword = 'local-synthetic-owner-reset-2026';
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Creá tu cuenta de propietario' })).toBeVisible();
  await expect(page.getByText('Entorno local de prueba.')).toBeVisible();
  await page.getByLabel('Correo de prueba').fill(email);
  await page.getByLabel(/Contraseña/).fill(password);
  // Drain messages retained by a reused local Worker between Playwright runs.
  for (let attempt=0;attempt<20;attempt++) {
    const pending=await page.request.get('/api/__local/mailbox');
    expect(pending.status()).toBe(200);
    if(!(await pending.json() as {message?:unknown}).message)break;
  }
  await page.getByRole('button', { name: 'Crear cuenta de propietario' }).click();
  await expect(page.getByRole('status')).toContainText('Si la dirección puede registrarse');
  const verificationResponse = await page.request.get('/api/__local/mailbox');
  expect(verificationResponse.status()).toBe(200);
  const verificationMessage = (await verificationResponse.json()).message as { purpose: string; to: string; url: string };
  expect(verificationMessage).toMatchObject({ purpose: 'VERIFY_EMAIL', to: email });
  expect(verificationMessage.url).toContain('/verify-email?token=');
  await page.goto(new URL(verificationMessage.url).pathname + new URL(verificationMessage.url).search);
  await page.getByRole('button', { name: 'Verificar correo de prueba' }).click();
  await expect(page.getByRole('status')).toContainText('Correo verificado');

  await page.goto('/login');
  await capture(page, 'owner-auth-desktop-1440x1000.png');
  await page.getByRole('link', { name: 'Alquileres Uspallata, inicio' }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator(':focus')).toHaveClass(/skip-link/);
  await expect(page.locator(':focus')).toBeVisible();
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/owner$/);
  await expect(page.getByRole('heading', { name: 'Tu lugar en Uspallata' })).toBeVisible();
  await capture(page, 'owner-dashboard-empty-desktop-1440x1000.png');

  await page.getByRole('button', { name: '+ Nuevo borrador' }).click();
  await page.getByLabel('Nombre del alojamiento').fill('Borrador que no debe perderse al salir');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  const logoutDialog=page.getByRole('alertdialog', { name: '¿Salir sin guardar?' });
  await expect(logoutDialog).toBeVisible();
  const keepEditing=logoutDialog.getByRole('button', { name: 'Seguir editando' });
  await expect(keepEditing).toBeFocused();
  await keepEditing.click();
  await expect(page).toHaveURL(/\/owner$/);
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeFocused();
  await expect(page.getByLabel('Nombre del alojamiento')).toHaveValue('Borrador que no debe perderse al salir');
  expect((await page.request.get('/api/auth/me')).status()).toBe(200);
  await page.getByLabel('Nombre del alojamiento').fill('');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/recover');
  const localOrigin={ Origin: 'http://127.0.0.1:5175' };
  const unknown = await page.request.post('/api/auth/password-reset/request', { data: { email: 'unknown@example.test' }, headers: localOrigin });
  const known = await page.request.post('/api/auth/password-reset/request', { data: { email }, headers: localOrigin });
  expect(unknown.status()).toBe(202);
  expect(known.status()).toBe(202);
  expect(await unknown.json()).toEqual(await known.json());
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByRole('button', { name: 'Solicitar recuperación' }).click();
  await expect(page.getByRole('status')).toContainText('Si la cuenta existe');
  const resetResponse = await page.request.get('/api/__local/mailbox');
  const resetMessage = (await resetResponse.json()).message as { purpose: string; to: string; url: string };
  expect(resetMessage).toMatchObject({ purpose: 'RESET_PASSWORD', to: email });
  await page.goto(new URL(resetMessage.url).pathname + new URL(resetMessage.url).search);
  await page.getByLabel('Nueva contraseña').fill(newPassword);
  await page.getByRole('button', { name: 'Guardar contraseña nueva' }).click();
  await expect(page).toHaveURL(/\/login\?reset=1/);
  await expect(page.getByRole('status')).toContainText('La contraseña fue actualizada');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('alert')).toContainText('Email o contraseña incorrectos');
  await page.getByLabel('Contraseña').fill(newPassword);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/owner$/);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL('/');
  const sessionAfterLogout = await page.request.get('/api/auth/me');
  expect(sessionAfterLogout.status()).toBe(401);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await capture(page, 'owner-auth-mobile-390x844.png');
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await capture(page, 'owner-auth-mobile-320x844.png');
});

test('OWNER: fotos aprobadas, edición segura, imágenes D1 BLOB, disponibilidad, consulta e inbox', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, 'owner.a@example.test');
  const configRetryPage=await page.context().newPage();let configAttempts=0;
  await configRetryPage.route('**/auth/config',async route=>{
    configAttempts++;
    if(configAttempts<=2)await route.fulfill({status:503,contentType:'application/json',body:'{"error":"synthetic temporary failure"}'});
    else await route.continue();
  });
  await configRetryPage.goto('/owner');
  await expect(configRetryPage).toHaveURL(/\/owner$/);
  await configRetryPage.getByRole('button',{name:/Casa aprobada con fotos/}).click();
  await expect(configRetryPage.getByRole('alert')).toContainText('No pudimos comprobar cómo se gestionan las fotos');
  await configRetryPage.getByRole('button',{name:'Reintentar configuración de fotos'}).click();
  await expect(configRetryPage.getByRole('alert')).toHaveCount(0);
  await expect(configRetryPage.getByText(/no se pueden combinar con nuevas cargas/)).toBeVisible();
  await expect(configRetryPage.locator('input[type="file"]')).toHaveCount(0);
  expect(configAttempts).toBe(3);
  await configRetryPage.close();
  await capture(page, 'owner-dashboard-desktop-1440x1000.png');
  const approved = page.getByRole('button', { name: /Casa aprobada con fotos/ });
  await expect(approved).toBeVisible();
  await approved.click();
  const approvedStaticPhoto = page.getByRole('img', { name: 'Foto 1 de Casa aprobada con fotos' });
  await expect(approvedStaticPhoto).toBeVisible();
  await expect.poll(() => approvedStaticPhoto.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const approvedPhoto = page.getByRole('img', { name: 'Foto 2 de Casa aprobada con fotos' });
  await expect(approvedPhoto).toBeVisible();
  await expect.poll(() => approvedPhoto.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText('Las fotos de una publicación aprobada se muestran en modo lectura.')).toBeVisible();
  await expect(page.getByText('Esta publicación no tiene fotos guardadas.')).toHaveCount(0);
  await expect(page.getByLabel('Agregar fotos')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Eliminar foto aprobada.png' })).toHaveCount(0);
  await capture(page, 'owner-approved-photos-desktop-1440x1000.png');

  await page.getByRole('button', { name: /Borrador con foto administrada/ }).click();
  await expect(page.getByText('Esta publicación tiene fotos administradas desde el repositorio; no se pueden combinar con nuevas cargas.')).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByRole('button', { name: /Casa aprobada con fotos/ }).click();

  await page.getByRole('button', { name: 'Marcar no disponible' }).click();
  await expect(page.locator('.owner-availability-card h3')).toHaveText('No disponible');
  await expect(page.locator('.owner-availability-card')).not.toContainText('Todavía no confirmaste');
  await page.getByRole('button', { name: 'Sigue vigente' }).click();
  await expect(page.getByRole('status')).toContainText('Disponibilidad confirmada');

  const contact = await page.request.post('/api/public/listings/owner-approved-photo/contact', {
    data: { visitorName: 'Consulta sintética', visitorEmail: 'visitante@example.test', message: '¿Sigue disponible para febrero?' },
    headers: { 'Idempotency-Key': 'i065-owner-inbox-contact-1' },
  });
  expect(contact.status()).toBe(201);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Consultas recibidas' })).toBeVisible();
  const inbox = page.locator('#owner-inbox');
  await expect(inbox.getByText('Consulta sintética')).toBeVisible();
  await expect(inbox.getByText('1 sin leer')).toBeVisible();
  await inbox.getByRole('button', { name: 'Marcar leída' }).click();
  await expect(page.getByRole('status')).toContainText(/consulta/i);
  await expect(inbox.getByText('0 sin leer')).toHaveCount(0);

  await page.getByRole('button', { name: '+ Nuevo borrador' }).click();
  await page.getByLabel('Nombre del alojamiento').fill('Refugio de prueba OWNER');
  await page.getByLabel('Descripción').fill('Un lugar sintético para probar la experiencia completa del propietario.');
  await page.getByLabel('Ubicación').fill('Uspallata, Mendoza');
  await page.getByLabel('Precio de referencia').fill('62000');
  await page.getByLabel('Periodicidad').selectOption('MONTH');
  await page.getByLabel('Duración').selectOption('FLEXIBLE');
  await page.getByLabel('Capacidad máxima').fill('3');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('status')).toContainText('Borrador creado');
  const draftsResponse = await page.request.get('/api/listings');
  const draft = (await draftsResponse.json() as Array<{id:string;title:string}>).find(item => item.title === 'Refugio de prueba OWNER');
  expect(draft?.id).toBeTruthy();

  let rejectNextSave = true;
  await page.route(`**/api/listings/${draft!.id}`, async route => {
    if (route.request().method() === 'PATCH' && rejectNextSave) {
      rejectNextSave = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'synthetic transient failure' }) });
      return;
    }
    await route.continue();
  });
  await page.getByLabel('Nombre del alojamiento').fill('Refugio de prueba OWNER editado');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('alert')).toContainText('No pudimos confirmar');
  await expect(page.getByLabel('Nombre del alojamiento')).toHaveValue('Refugio de prueba OWNER editado');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status')).toContainText('Cambios guardados');
  await page.unroute(`**/api/listings/${draft!.id}`);

  await page.getByLabel('Descripción').fill('Cambio pendiente que se debe preservar ante navegación.');
  const discoverLink=page.getByRole('link', { name: 'Descubrir' });
  await discoverLink.click();
  const leaveDialog = page.getByRole('alertdialog', { name: '¿Salir sin guardar?' });
  await expect(leaveDialog).toBeVisible();
  const leaveButton=leaveDialog.getByRole('button', { name: 'Salir y descartar cambios' });
  const keepEditing=leaveDialog.getByRole('button', { name: 'Seguir editando' });
  await expect(keepEditing).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(leaveButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(keepEditing).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(leaveDialog).toHaveCount(0);
  await expect(discoverLink).toBeFocused();
  await expect(page.getByLabel('Descripción')).toHaveValue('Cambio pendiente que se debe preservar ante navegación.');
  await discoverLink.click();
  await expect(page.getByRole('alertdialog', { name: '¿Salir sin guardar?' }).getByRole('button', { name: 'Seguir editando' })).toBeFocused();
  await page.getByRole('alertdialog', { name: '¿Salir sin guardar?' }).getByRole('button', { name: 'Seguir editando' }).click();
  await expect(page).toHaveURL(/\/owner$/);
  await expect(discoverLink).toBeFocused();
  await expect(page.getByLabel('Descripción')).toHaveValue('Cambio pendiente que se debe preservar ante navegación.');
  await page.getByRole('link', { name: 'Descubrir' }).click();
  await page.getByRole('alertdialog', { name: '¿Salir sin guardar?' }).getByRole('button', { name: 'Salir y descartar cambios' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/owner');
  await expect(page.getByRole('heading', { name: 'Tu lugar en Uspallata' })).toBeVisible();
  await page.getByRole('button', { name: /Refugio de prueba OWNER editado/ }).click();

  const photoInput = page.locator('input[type="file"]');
  await photoInput.setInputFiles(redPhoto);
  const localPreview = page.getByRole('img', { name: 'Vista previa de owner-e2e-red.png' });
  await expect(localPreview).toBeVisible();
  await expect(localPreview).toHaveAttribute('src', /blob:/);
  await expect(page.getByText('Todavía no se guardó')).toBeVisible();
  await page.getByRole('button', { name: 'Actualizar lista' }).click();
  const photoReloadDialog=page.getByRole('alertdialog', { name: 'Hay cambios sin guardar' });
  await expect(photoReloadDialog).toBeVisible();
  await photoReloadDialog.getByRole('button', { name: 'Seguir editando' }).click();
  await expect(localPreview).toBeVisible();
  await expect(page.getByRole('button', { name: 'Actualizar desde servidor' })).toBeDisabled();
  await page.getByRole('button', { name: 'Actualizar lista' }).click();
  await page.getByRole('alertdialog', { name: 'Hay cambios sin guardar' }).getByRole('button', { name: 'Descartar y actualizar' }).click();
  await expect(localPreview).toHaveCount(0);
  await photoInput.setInputFiles(redPhoto);
  await expect(page.getByRole('img', { name: 'Vista previa de owner-e2e-red.png' })).toBeVisible();
  let failUploadOnce = true;
  await page.route(`**/api/listings/${draft!.id}/images`, async route => {
    if (route.request().method() === 'POST' && failUploadOnce) {
      failUploadOnce = false;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Guardar foto' }).click();
  await expect(page.getByRole('alert')).toContainText('No pudimos confirmar');
  await expect(localPreview).toBeVisible();
  await page.getByRole('button', { name: 'Guardar foto' }).click();
  await expect(page.getByRole('status')).toContainText('Imagen guardada');
  await page.unroute(`**/api/listings/${draft!.id}/images`);

  await photoInput.setInputFiles(bluePhoto);
  await expect(page.getByRole('img', { name: 'Vista previa de owner-e2e-blue.png' })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar foto' }).click();
  await expect(page.getByRole('status')).toContainText('Imagen guardada');
  const blueName = 'owner-e2e-blue.jpg';
  await page.getByRole('button', { name: `Mover ${blueName} hacia arriba` }).click();
  await expect(page.getByRole('status')).toContainText('Orden de imágenes actualizado');
  await expect(page.locator('.owner-image-card').first()).toContainText(blueName);
  await page.reload();
  await page.getByRole('button', { name: /Refugio de prueba OWNER editado/ }).click();
  await expect(page.locator('.owner-image-card').first()).toContainText(blueName);
  await capture(page, 'owner-listing-editor-desktop-1440x1000.png');

  const redName = 'owner-e2e-red.jpg';
  await page.getByRole('button', { name: `Eliminar ${redName}` }).click();
  const imageDelete = page.getByRole('alertdialog', { name: `¿Quitar “${redName}”?` });
  await expect(imageDelete).toBeVisible();
  const photoDeleteTrigger=page.getByRole('button', { name: `Eliminar ${redName}` });
  const keepPhoto=imageDelete.getByRole('button', { name: 'Conservar foto' });
  await expect(keepPhoto).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(imageDelete.getByRole('button', { name: 'Eliminar foto' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(keepPhoto).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(imageDelete.getByRole('button', { name: 'Eliminar foto' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(imageDelete).toHaveCount(0);
  await expect(photoDeleteTrigger).toBeFocused();
  await photoDeleteTrigger.click();
  const reopenedImageDelete=page.getByRole('alertdialog', { name: `¿Quitar “${redName}”?` });
  await expect(reopenedImageDelete.getByRole('button', { name: 'Conservar foto' })).toBeFocused();
  await reopenedImageDelete.getByRole('button', { name: 'Conservar foto' }).click();
  await expect(photoDeleteTrigger).toBeFocused();
  await expect(page.locator('.owner-image-card')).toHaveCount(2);
  await photoDeleteTrigger.click();
  await page.getByRole('alertdialog', { name: `¿Quitar “${redName}”?` }).getByRole('button', { name: 'Eliminar foto' }).click();
  await expect(page.getByRole('status')).toContainText('Imagen eliminada');
  await expect(page.locator('#owner-images-title')).toBeFocused();
  await expect(page.locator('.owner-image-card')).toHaveCount(1);

  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await expect(page.getByRole('status')).toContainText('enviada a revisión');
  await expect(page.getByRole('button', { name: /Refugio de prueba OWNER editado/ })).toContainText('En revisión');
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();

  await page.getByRole('button', { name: '+ Nuevo borrador' }).click();
  await page.getByLabel('Nombre del alojamiento').fill('Borrador para confirmar eliminación');
  await page.getByLabel('Descripción').fill('Borrador sintético de eliminación segura.');
  await page.getByLabel('Precio de referencia').fill('12000');
  await page.getByLabel('Capacidad máxima').fill('2');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('status')).toContainText('Borrador creado');
  await photoInput.setInputFiles(redPhoto);
  await expect(page.getByRole('img', { name: 'Vista previa de owner-e2e-red.png' })).toBeVisible();
  const listingDeleteTrigger=page.getByRole('button', { name: 'Eliminar borrador' });
  await listingDeleteTrigger.click();
  const deleteDialog = page.getByRole('alertdialog', { name: '¿Eliminar “Borrador para confirmar eliminación”?'});
  await expect(deleteDialog).toBeVisible();
  const keepDraft=deleteDialog.getByRole('button', { name: 'Conservar borrador' });
  await expect(keepDraft).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(deleteDialog.getByRole('button', { name: 'Eliminar alojamiento' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(keepDraft).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(deleteDialog).toHaveCount(0);
  await expect(listingDeleteTrigger).toBeFocused();
  await expect(page.getByRole('img', { name: 'Vista previa de owner-e2e-red.png' })).toBeVisible();
  await listingDeleteTrigger.click();
  const reopenedDeleteDialog=page.getByRole('alertdialog', { name: '¿Eliminar “Borrador para confirmar eliminación”?' });
  await expect(reopenedDeleteDialog.getByRole('button', { name: 'Conservar borrador' })).toBeFocused();
  await reopenedDeleteDialog.getByRole('button', { name: 'Conservar borrador' }).click();
  await expect(listingDeleteTrigger).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Borrador para confirmar eliminación' })).toBeVisible();
  await listingDeleteTrigger.click();
  await page.getByRole('alertdialog', { name: '¿Eliminar “Borrador para confirmar eliminación”?'}).getByRole('button', { name: 'Eliminar alojamiento' }).click();
  await expect(page.getByRole('status')).toContainText('Publicación eliminada');
  await expect(page.locator('#owner-listings-title')).toBeFocused();
  await expect(page.getByRole('img', { name: 'Vista previa de owner-e2e-red.png' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Descubrir' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('alertdialog', { name: '¿Salir sin guardar?' })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/owner');
  await expect(page.getByRole('heading', { name: 'Tu lugar en Uspallata' })).toBeVisible();
  await capture(page, 'owner-dashboard-mobile-390x844.png');
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await capture(page, 'owner-dashboard-mobile-320x844.png');

  const adminContext = await page.context().browser()!.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto('/login');
  await adminPage.getByLabel('Correo electrónico').fill('admin@example.test');
  await adminPage.getByLabel('Contraseña').fill('synthetic-owner-password-1');
  await adminPage.getByRole('button', { name: 'Ingresar' }).click();
  await expect(adminPage).toHaveURL(/\/admin$/);
  await adminPage.goto('/owner');
  await expect(adminPage).toHaveURL('/');
  const deniedOwnerApi = await adminPage.request.get('/api/listings');
  expect(deniedOwnerApi.status()).toBe(401);
  await adminContext.close();
});
