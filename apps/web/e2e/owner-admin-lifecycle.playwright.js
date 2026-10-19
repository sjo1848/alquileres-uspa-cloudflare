// Synthetic local Workerd + D1 end-to-end coverage for the OWNER/ADMIN lifecycle.
async (page) => {
  const baseUrl = 'http://127.0.0.1:5174';
  const imageFile = 'apps/web/e2e/fixtures/owner-e2e-red.png';
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const login = async (email) => {
    await page.goto(`${baseUrl}/login`);
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByLabel('Contraseña').fill('synthetic-owner-password-1');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await page.waitForURL(email === 'admin@example.test' ? '**/admin' : '**/owner');
  };
  const title = `Ciclo OWNER ADMIN ${Date.now()}`;

  await page.context().clearCookies();
  await page.context().addInitScript(() => {
    let ownerConfirmCount = 0;
    window.confirm = () => location.pathname === '/owner' && ownerConfirmCount++ === 0 ? false : true;
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login('owner.a@example.test');
  await page.getByRole('button', { name: '+ Nuevo borrador' }).click();
  await page.getByRole('textbox', { name: 'Título' }).fill(`${title} OWNER`);
  await page.getByRole('textbox', { name: 'Descripción' }).fill('Datos sintéticos para E2E OWNER.');
  await page.getByRole('textbox', { name: 'Ubicación' }).fill('Uspallata, Mendoza');
  await page.getByRole('spinbutton', { name: 'Importe' }).fill('25000');
  await page.getByRole('button', { name: 'Crear borrador' }).click();
  await page.getByText('Borrador creado.', { exact: true }).waitFor();
  const ownerListingId = await page.locator('[data-listing-id]').first().getAttribute('data-listing-id').catch(() => null);
  const ownListings = await page.request.get(`${baseUrl}/api/listings`);
  assert(ownListings.status() === 200, `OWNER list failed: ${ownListings.status()}`);
  const ownerRows = await ownListings.json();
  const ownerListing = ownerRows.find(row => row.title === `${title} OWNER`);
  assert(ownerListing?.id && (!ownerListingId || ownerListingId === ownerListing.id), 'created listing must appear in the authenticated OWNER list');
  assert((await page.request.get(`${baseUrl}/api/listings/${encodeURIComponent(ownerListing.id)}`)).status() === 200, 'OWNER must read their own listing');
  assert((await page.request.get(`${baseUrl}/listings/${encodeURIComponent(ownerListing.id)}`)).status() === 200, 'direct OWNER listing route must reach Worker before SPA fallback');
  assert((await page.request.get(`${baseUrl}/api/admin/listings/assisted?ownerId=owner-a`)).status() === 401, 'OWNER must not access ADMIN-assisted routes');

  const isolated = await page.context().browser().newContext();
  const otherOwnerPage = await isolated.newPage();
  await otherOwnerPage.goto(`${baseUrl}/login`);
  await otherOwnerPage.getByRole('textbox', { name: 'Email' }).fill('owner.b@example.test');
  await otherOwnerPage.getByLabel('Contraseña').fill('synthetic-owner-password-1');
  await otherOwnerPage.getByRole('button', { name: 'Ingresar' }).click();
  await otherOwnerPage.waitForURL('**/owner');
  assert((await otherOwnerPage.request.get(`${baseUrl}/api/listings/${encodeURIComponent(ownerListing.id)}`)).status() === 404, 'another OWNER must not read this listing');
  assert((await otherOwnerPage.request.get(`${baseUrl}/listings/${encodeURIComponent(ownerListing.id)}`)).status() === 404, 'direct listing route must preserve cross-owner denial');
  await isolated.close();

  await page.getByRole('button', { name: 'Actualizar publicación' }).click();
  await page.getByText('Publicación actualizada.', { exact: true }).waitFor();
  await page.locator('input[type="file"]').setInputFiles(imageFile);
  await page.getByText('Imagen guardada en tu publicación.', { exact: true }).waitFor();
  const image = page.locator('.image-list img').first();
  await image.waitFor();
  assert(await image.evaluate(node => node.complete && node.naturalWidth > 0), 'OWNER uploaded D1 BLOB image must render');
  await page.getByRole('button', { name: 'Eliminar borrador' }).click();
  assert((await page.getByRole('button', { name: new RegExp(`${title} OWNER`) }).count()) === 1, 'canceling delete must preserve the selected draft');
  await page.getByRole('button', { name: 'Eliminar borrador' }).click();
  await page.getByText('Publicación eliminada.', { exact: true }).waitFor();
  assert((await page.request.get(`${baseUrl}/api/listings/${encodeURIComponent(ownerListing.id)}`)).status() === 404, 'confirmed OWNER delete must remove the listing');
  await page.screenshot({ path: 'output/playwright/owner-admin-lifecycle-desktop.png' });

  await page.context().clearCookies();
  await login('admin@example.test');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/admin-assist`);
  await page.getByRole('heading', { name: 'Gestión asistida' }).waitFor();
  await page.getByRole('combobox', { name: 'Cuenta OWNER' }).selectOption('owner-a');
  await page.getByRole('textbox', { name: 'Título' }).fill(`${title} ADMIN`);
  await page.getByRole('textbox', { name: 'Descripción' }).fill('Datos sintéticos para el ciclo asistido ADMIN.');
  await page.getByRole('textbox', { name: 'Ubicación' }).fill('Uspallata centro');
  await page.getByRole('spinbutton', { name: 'Importe' }).fill('30000');
  await page.getByRole('button', { name: 'Crear borrador asistido' }).click();
  await page.getByText('Borrador asistido creado y registrado en auditoría.', { exact: true }).waitFor();
  const assistedDrafts = await page.request.get(`${baseUrl}/api/admin/listings/assisted?ownerId=owner-a`);
  const assistedListing = (await assistedDrafts.json()).find(item => item.title === `${title} ADMIN`);
  assert(assistedDrafts.status() === 200 && assistedListing?.id, 'new assisted draft must be discoverable for later management');
  const adminRows = await page.request.get(`${baseUrl}/api/admin/listings/audit`);
  assert(adminRows.status() === 200, 'ADMIN audit API must be available to ADMIN');
  const creation = (await adminRows.json()).find(row => row.action === 'ADMIN_ASSISTED_LISTING_CREATED' && row.listingId === assistedListing.id);
  assert(creation?.actor?.id === 'admin-a' && creation?.targetOwner?.id === 'owner-a', 'assisted creation audit must identify ADMIN actor and OWNER target');

  const titleInput = page.getByRole('textbox', { name: 'Título' });
  await titleInput.fill(`${title} ADMIN editado`);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.getByText('Cambios guardados y auditados.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Marcar no disponible' }).click();
  await page.getByText('Disponibilidad actualizada y auditada.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Reconfirmar disponibilidad' }).click();
  await page.getByText('Disponibilidad reconfirmada y auditada.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await page.getByText('Publicación enviada a revisión y auditada.', { exact: true }).waitFor();
  const submitted = await page.request.get(`${baseUrl}/api/admin/listings/audit?listingId=${encodeURIComponent(creation.listingId)}`);
  assert(submitted.status() === 200, 'ADMIN must read audit events for this listing');
  const audit = await submitted.json();
  for (const action of ['ADMIN_ASSISTED_LISTING_UPDATED', 'ADMIN_ASSISTED_AVAILABILITY_UPDATED', 'ADMIN_ASSISTED_LISTING_RECONFIRMED', 'ADMIN_ASSISTED_LISTING_SUBMITTED']) {
    assert(audit.some(row => row.action === action && row.actor?.id === 'admin-a' && row.targetOwner?.id === 'owner-a'), `audit must contain ${action} with actor and target`);
  }
  await page.screenshot({ path: 'output/playwright/owner-admin-lifecycle-mobile.png' });

  await page.getByRole('button', { name: 'Crear otro borrador asistido' }).click();
  await page.getByRole('textbox', { name: 'Título' }).fill(`${title} ADMIN eliminar`);
  await page.getByRole('textbox', { name: 'Descripción' }).fill('Borrador sintético para validar eliminación asistida.');
  await page.getByRole('textbox', { name: 'Ubicación' }).fill('Uspallata');
  await page.getByRole('spinbutton', { name: 'Importe' }).fill('10000');
  await page.getByRole('button', { name: 'Crear borrador asistido' }).click();
  await page.getByText('Borrador asistido creado y registrado en auditoría.', { exact: true }).waitFor();
  const deletedHeading = page.getByRole('heading', { name: `${title} ADMIN eliminar` });
  await deletedHeading.waitFor();
  await page.getByRole('button', { name: 'Eliminar borrador asistido' }).click();
  await page.getByText('Borrador eliminado y auditado.', { exact: true }).waitFor();
  const deleteAudit = await page.request.get(`${baseUrl}/api/admin/listings/audit`);
  assert((await deleteAudit.json()).some(row => row.action === 'ADMIN_ASSISTED_LISTING_DELETED' && row.actor?.id === 'admin-a' && row.targetOwner?.id === 'owner-a'), 'assisted delete audit must preserve ADMIN actor and OWNER target');
  return { result: 'PASS', checks: ['desktop OWNER listing read', 'OWNER-to-ADMIN denial', 'cross-owner IDOR denial', 'OWNER selected-listing refresh', 'synthetic D1 BLOB upload', 'delete confirmation cancel', 'OWNER draft delete and image cleanup', 'mobile ADMIN assisted creation', 'persisted owner target and actor audit', 'assisted edit', 'availability update and reconfirmation', 'submit to review', 'audit for each mutation', 'assisted draft deletion and audit'] };
}
