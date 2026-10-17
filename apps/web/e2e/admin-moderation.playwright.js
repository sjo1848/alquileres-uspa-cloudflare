async (page) => {
  const baseUrl = 'http://127.0.0.1:5174';
  const redFile = 'apps/web/e2e/fixtures/owner-e2e-red.png';
  const approveTitle = `Codex QA ADMIN aprobar ${Date.now()}`;
  const rejectTitle = `Codex QA ADMIN rechazar ${Date.now()}`;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  async function login(email) {
    await page.context().clearCookies();
    await page.goto(`${baseUrl}/login`);
    await page.getByRole('textbox', { name: 'Email' }).waitFor();
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByLabel('Contraseña').fill('synthetic-owner-password-1');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await page.waitForURL(email === 'e2e-admin@example.test' ? '**/admin' : '**/owner');
  }
  async function createAndSubmit(title, addImage = false) {
    await page.goto(`${baseUrl}/owner`);
    await page.getByRole('button', { name: '+ Nuevo borrador' }).click();
    await page.getByRole('textbox', { name: 'Título' }).fill(title);
    await page.getByRole('textbox', { name: 'Descripción' }).fill('Publicación sintética para validar moderación ADMIN.');
    await page.getByRole('textbox', { name: 'Ubicación' }).fill('Uspallata, Mendoza');
    await page.getByRole('spinbutton', { name: 'Importe' }).fill('25000');
    await page.getByRole('spinbutton', { name: 'Ocupantes máximos' }).fill('2');
    await page.getByRole('button', { name: 'Crear borrador' }).click();
    await page.getByText('Borrador creado.', { exact: true }).waitFor();
    if (addImage) {
      await page.locator('input[type="file"]').setInputFiles(redFile);
      await page.getByText('Imagen guardada en tu publicación.', { exact: true }).waitFor();
    }
    await page.getByRole('button', { name: 'Enviar a revisión' }).click();
    await page.getByText('Publicación enviada a revisión.', { exact: true }).waitFor();
  }

  await page.reload();
  await login('preview.owner@example.test');
  await createAndSubmit(approveTitle, true);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await login('e2e-admin@example.test');
  await page.waitForURL('**/admin');
  await page.getByRole('heading', { name: 'Revisión de publicaciones' }).waitFor();
  await page.getByRole('button', { name: new RegExp(approveTitle) }).click();
  const previewImages = page.locator('.admin-review-images img');
  await previewImages.first().waitFor();
  assert(await previewImages.first().evaluate(image => image.complete && image.naturalWidth > 0), 'ADMIN must load the submitted D1 image');
  await page.getByRole('button', { name: 'Aprobar', exact: true }).click();
  await page.getByText('Publicación aprobada. Queda pendiente de publicación.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Publicar en catálogo' }).click();
  await page.getByText('Publicación visible en el catálogo.', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Catálogo' }).click();
  await page.getByRole('heading', { name: approveTitle }).waitFor();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await login('preview.owner@example.test');
  await createAndSubmit(rejectTitle);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await login('e2e-admin@example.test');
  await page.waitForURL('**/admin');
  await page.getByRole('button', { name: new RegExp(rejectTitle) }).click();
  await page.getByLabel('Motivo si rechazás').fill('Falta información de disponibilidad.');
  await page.getByRole('button', { name: 'Rechazar', exact: true }).click();
  await page.getByText('Publicación rechazada con motivo.', { exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Actividad reciente' }).waitFor();
  await page.locator('.admin-audit').getByText('Falta información de disponibilidad.', { exact: false }).first().waitFor();
  const body = await page.locator('body').innerText();
  assert(body.includes('LISTING_APPROVED') || body.includes('Aprobó'), 'ADMIN audit must show the approval');
  assert(body.includes('Publicó') && body.includes('Publicación visible en el catálogo'), 'ADMIN audit must show publication separately from approval');
  assert(body.includes('Falta información de disponibilidad.'), 'ADMIN audit must retain rejection reason');
  await page.screenshot({ path: 'output/playwright/admin-moderation-audit.png' });
  await page.getByRole('link', { name: 'Catálogo' }).click();
  assert(!(await page.getByText(rejectTitle, { exact: false }).count()), 'rejected listing must remain absent from catalog');
  await login('e2e-admin@example.test');
  await page.goto(`${baseUrl}/admin`);
  await page.getByRole('button', { name: 'Actualizar cola' }).waitFor();
  await page.context().clearCookies();
  await page.getByRole('button', { name: 'Actualizar cola' }).click();
  await page.waitForURL(url => url.pathname === '/login' && url.searchParams.get('redirect') === '/admin');
  await login('e2e-admin@example.test');
  await page.getByRole('heading', { name: 'Revisión de publicaciones' }).waitFor();
  return { result: 'PASS', checks: ['OWNER submit', 'ADMIN role login', 'submitted D1 image review', 'approval stays unpublished', 'separate publish reaches catalog', 'rejection reason', 'admin audit', 'rejected listing stays private', 'ADMIN session expiry restores /admin destination'] };
}
