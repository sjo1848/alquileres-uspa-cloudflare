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
  await login('preview.owner@example.test');
  const paginatedPrefix = `Codex QA ADMIN página ${Date.now()}`;
  for (let index = 0; index < 101; index += 1) {
    const title = `${paginatedPrefix} ${String(index).padStart(3, '0')}`;
    const created = await page.request.post(`${baseUrl}/api/listings`, {
      headers: { Origin: baseUrl },
      data: { title, description: 'Publicación sintética para E2E de paginación ADMIN.', location: 'Uspallata, Mendoza', priceAmount: 25000, pricePeriod: 'MONTH', rentalDuration: 'FLEXIBLE', maxOccupants: 2, currency: 'ARS' },
    });
    assert(created.status() === 201, 'synthetic pagination listing must be created');
    const listing = await created.json();
    const submitted = await page.request.post(`${baseUrl}/api/listings/${encodeURIComponent(listing.id)}/submit`, { headers: { Origin: baseUrl } });
    assert(submitted.status() === 200, `synthetic pagination listing submit returned ${submitted.status()}: ${await submitted.text()}`);
    await page.waitForTimeout(5);
  }
  await login('e2e-admin@example.test');
  await page.goto(`${baseUrl}/admin`);
  await page.getByRole('heading', { name: 'Revisión de publicaciones' }).waitFor();
  const lastPageListing = page.getByRole('button', { name: new RegExp(`${paginatedPrefix} 000`) });
  let pagesLoaded = 0;
  while (!(await lastPageListing.count()) && pagesLoaded < 5) {
    const loadMore = page.getByRole('button', { name: 'Cargar más publicaciones' });
    if (!(await loadMore.count())) break;
    const previousCount = await page.locator('.admin-review-layout nav button').count();
    await loadMore.click();
    await page.waitForFunction(count => document.querySelectorAll('.admin-review-layout nav button').length > count, previousCount);
    pagesLoaded += 1;
  }
  assert(await lastPageListing.count() === 1 && pagesLoaded > 0, 'ADMIN load-more must make the 101st submitted listing reachable');
  const queueItems = page.locator('.admin-review-layout nav button');
  assert(await queueItems.count() >= 2, 'ADMIN queue must expose multiple synthetic listings for selection');
  await queueItems.nth(0).click();
  await page.getByLabel('Motivo si rechazás').fill('Motivo sintético de la primera publicación.');
  await queueItems.nth(1).click();
  assert(await page.getByLabel('Motivo si rechazás').inputValue() === '', 'switching listings must clear a rejection reason from the prior listing');
  assert(await page.getByRole('button', { name: 'Rechazar', exact: true }).isDisabled(), 'a new listing must not inherit another listing rejection reason');
  return { result: 'PASS', checks: ['OWNER submit', 'ADMIN role login', 'submitted D1 image review', 'approval stays unpublished', 'separate publish reaches catalog', 'rejection reason', 'admin audit', 'rejected listing stays private', 'ADMIN session expiry restores /admin destination', 'ADMIN queue reaches the 101st submitted listing through load-more', 'changing selected listing clears rejection reason'] };
}
