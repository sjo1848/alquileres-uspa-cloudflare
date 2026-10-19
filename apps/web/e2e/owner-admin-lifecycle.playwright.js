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
  const ownerTitleField = page.getByRole('textbox', { name: 'Título' });
  await ownerTitleField.fill(`${title} OWNER cambio sin guardar`);
  assert(await page.getByRole('button', { name: 'Actualizar publicación' }).isDisabled(), 'OWNER refresh must be disabled while editable form values are dirty');
  const storedOwnerBeforeRefresh = await page.request.get(`${baseUrl}/api/listings/${encodeURIComponent(ownerListing.id)}`);
  assert((await storedOwnerBeforeRefresh.json()).title === `${title} OWNER`, 'blocked OWNER refresh must not alter persisted state');
  await ownerTitleField.fill(`${title} OWNER`);
  assert(await page.getByRole('button', { name: 'Actualizar publicación' }).isEnabled(), 'OWNER refresh is available after reverting unsaved edits');
  const publicDetailPage = await page.request.get(`${baseUrl}/listings/${encodeURIComponent(ownerListing.id)}`);
  assert(publicDetailPage.status() === 200 && publicDetailPage.headers()['content-type']?.includes('text/html') && (await publicDetailPage.text()).includes('id="app"'), 'public property detail URL must serve the SPA shell, not the OWNER API');
  assert((await page.request.get(`${baseUrl}/api/admin/listings/assisted?ownerId=owner-a`)).status() === 401, 'OWNER must not access ADMIN-assisted routes');

  const isolated = await page.context().browser().newContext();
  const otherOwnerPage = await isolated.newPage();
  await otherOwnerPage.goto(`${baseUrl}/login`);
  await otherOwnerPage.getByRole('textbox', { name: 'Email' }).fill('owner.b@example.test');
  await otherOwnerPage.getByLabel('Contraseña').fill('synthetic-owner-password-1');
  await otherOwnerPage.getByRole('button', { name: 'Ingresar' }).click();
  await otherOwnerPage.waitForURL('**/owner');
  assert((await otherOwnerPage.request.get(`${baseUrl}/api/listings/${encodeURIComponent(ownerListing.id)}`)).status() === 404, 'another OWNER must not read this listing');
  const publicPageForOtherUser = await otherOwnerPage.request.get(`${baseUrl}/listings/${encodeURIComponent(ownerListing.id)}`);
  assert(publicPageForOtherUser.status() === 200 && publicPageForOtherUser.headers()['content-type']?.includes('text/html'), 'public property URL remains a page for another identity; listing API remains owner-scoped');
  await isolated.close();

  await page.getByRole('button', { name: 'Actualizar publicación' }).click();
  await page.getByText('Publicación actualizada.', { exact: true }).waitFor();
  await page.getByRole('button', { name: '+ Nuevo borrador' }).click();
  await page.getByRole('textbox', { name: 'Título' }).fill(`${title} OWNER revisión`);
  await page.getByRole('textbox', { name: 'Descripción' }).fill('Borrador sintético que se enviará a revisión.');
  await page.getByRole('textbox', { name: 'Ubicación' }).fill('Uspallata, Mendoza');
  await page.getByRole('spinbutton', { name: 'Importe' }).fill('26000');
  await page.getByRole('button', { name: 'Crear borrador' }).click();
  await page.getByText('Borrador creado.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await page.getByText('Publicación enviada a revisión.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Actualizar publicación' }).click();
  await page.getByText('Publicación actualizada.', { exact: true }).waitFor();
  assert(await page.getByText('La publicación ya no está disponible para editar.').count() === 0, 'refreshing a submitted listing must not attempt editable-only image loading');
  await page.locator('.listing-choice').filter({ hasText: `${title} OWNER` }).filter({ hasText: 'Borrador' }).click();
  await page.locator('input[type="file"]').setInputFiles(imageFile);
  await page.getByText('Imagen guardada en tu publicación.', { exact: true }).waitFor();
  const image = page.locator('.image-list img').first();
  await image.waitFor();
  assert(await image.evaluate(node => node.complete && node.naturalWidth > 0), 'OWNER uploaded D1 BLOB image must render');
  await page.getByRole('button', { name: 'Eliminar borrador' }).click();
  assert((await page.locator('.listing-choice').filter({ hasText: `${title} OWNER` }).filter({ hasText: 'Borrador' }).count()) === 1, 'canceling delete must preserve the selected draft');
  await page.getByRole('button', { name: 'Eliminar borrador' }).click();
  await page.getByText('Publicación eliminada.', { exact: true }).waitFor();
  assert((await page.request.get(`${baseUrl}/api/listings/${encodeURIComponent(ownerListing.id)}`)).status() === 404, 'confirmed OWNER delete must remove the listing');
  await page.screenshot({ path: 'output/playwright/owner-admin-lifecycle-desktop.png' });

  await page.context().clearCookies();
  await login('admin@example.test');
  await page.setViewportSize({ width: 390, height: 844 });
  for (let index = 0; index < 51; index++) {
    const fixture = await page.request.post(`${baseUrl}/api/admin/listings/assisted`, {
      data: { ownerId: 'owner-a', title: `E2E draft page ${String(index).padStart(2, '0')}`, description: 'Synthetic cursor fixture.', location: 'Uspallata', priceAmount: 10000, currency: 'ARS', pricePeriod: 'MONTH', rentalDuration: 'FLEXIBLE', maxOccupants: 1 },
      headers: { Origin: baseUrl, 'Idempotency-Key': `e2e-draft-page-${index}-${Date.now()}` },
    });
    assert(fixture.status() === 201, `synthetic pagination fixture ${index} failed: ${fixture.status()}`);
  }
  await page.goto(`${baseUrl}/admin-assist`);
  await page.getByRole('heading', { name: 'Gestión asistida' }).waitFor();
  const ownerPicker = page.getByRole('combobox', { name: 'Cuenta OWNER' });
  await ownerPicker.selectOption('owner-b');
  await page.getByText('No hay borradores asistidos pendientes para esta cuenta.', { exact: true }).waitFor();
  let releaseOwnerAResponse;
  const ownerAResponseGate = new Promise(resolve => { releaseOwnerAResponse = resolve; });
  const ownerARequest = /\/api\/admin\/listings\/assisted\?ownerId=owner-a$/;
  const delayOwnerAResponse = async route => { await ownerAResponseGate; await route.continue(); };
  await page.route(ownerARequest, delayOwnerAResponse);
  const staleOwnerAResponsePromise = page.waitForResponse(response => ownerARequest.test(response.url()));
  await ownerPicker.selectOption('owner-a');
  await page.getByRole('status').filter({ hasText: 'Cargando borradores' }).waitFor();
  await ownerPicker.selectOption('owner-b');
  await page.getByText('No hay borradores asistidos pendientes para esta cuenta.', { exact: true }).waitFor();
  releaseOwnerAResponse();
  const staleOwnerAResponse = await staleOwnerAResponsePromise;
  assert(staleOwnerAResponse.status() === 200 && (await staleOwnerAResponse.json()).items.length === 50, 'delayed OWNER A page must complete successfully for the stale-response regression');
  assert(await page.getByLabel('Borrador asistido existente').count() === 0, 'stale OWNER A drafts must not appear after switching to OWNER B');
  await page.unroute(ownerARequest, delayOwnerAResponse);
  await ownerPicker.selectOption('owner-a');
  await page.getByRole('button', { name: 'Cargar más borradores' }).waitFor();
  const secondDraftPagePromise = page.waitForResponse(response => {
    if (!response.url().includes('/api/admin/listings/assisted?')) return false;
    return new URL(response.url()).searchParams.has('afterId');
  });
  await page.getByRole('button', { name: 'Cargar más borradores' }).click();
  const secondDraftPage = await secondDraftPagePromise;
  const secondDraftPayload = await secondDraftPage.json();
  assert(secondDraftPage.status() === 200 && secondDraftPayload.items.length === 1 && secondDraftPayload.nextCursor === null, 'ADMIN draft cursor must return the final older draft');
  const draftPicker = page.getByLabel('Borrador asistido existente');
  await page.waitForFunction(() => {
    const label = [...document.querySelectorAll('label')].find(item => item.textContent?.includes('Borrador asistido existente'));
    return label?.querySelectorAll('option').length === 52;
  });
  const optionCount = await draftPicker.locator('option').count();
  assert(optionCount === 52, `ADMIN must discover all 51 drafts across cursor pages; got ${optionCount} options`);
  await page.getByRole('textbox', { name: 'Título' }).fill(`${title} ADMIN`);
  await page.getByRole('textbox', { name: 'Descripción' }).fill('Datos sintéticos para el ciclo asistido ADMIN.');
  await page.getByRole('textbox', { name: 'Ubicación' }).fill('Uspallata centro');
  await page.getByRole('spinbutton', { name: 'Importe' }).fill('30000');
  await page.getByRole('button', { name: 'Crear borrador asistido' }).click();
  await page.getByText('Borrador asistido creado y registrado en auditoría.', { exact: true }).waitFor();
  const assistedDrafts = await page.request.get(`${baseUrl}/api/admin/listings/assisted?ownerId=owner-a`);
  const assistedListing = (await assistedDrafts.json()).items.find(item => item.title === `${title} ADMIN`);
  assert(assistedDrafts.status() === 200 && assistedListing?.id, 'new assisted draft must be discoverable for later management');
  const adminRows = await page.request.get(`${baseUrl}/api/admin/listings/audit`);
  assert(adminRows.status() === 200, 'ADMIN audit API must be available to ADMIN');
  const creation = (await adminRows.json()).find(row => row.action === 'ADMIN_ASSISTED_LISTING_CREATED' && row.listingId === assistedListing.id);
  assert(creation?.actor?.id === 'admin-a' && creation?.targetOwner?.id === 'owner-a', 'assisted creation audit must identify ADMIN actor and OWNER target');

  const titleInput = page.getByRole('textbox', { name: 'Título' });
  await titleInput.fill(`${title} ADMIN editado`);
  assert(await page.getByRole('button', { name: 'Enviar a revisión' }).isDisabled(), 'ADMIN cannot submit a listing while the assisted editor contains unsaved changes');
  const storedBeforeSave = await page.request.get(`${baseUrl}/api/admin/listings/${encodeURIComponent(assistedListing.id)}`);
  assert((await storedBeforeSave.json()).title === `${title} ADMIN`, 'blocked submit must leave the persisted draft unchanged');
  const ownerEditContext = await page.context().browser().newContext();
  const ownerEditPage = await ownerEditContext.newPage();
  await ownerEditPage.goto(`${baseUrl}/login`);
  await ownerEditPage.getByRole('textbox', { name: 'Email' }).fill('owner.a@example.test');
  await ownerEditPage.getByLabel('Contraseña').fill('synthetic-owner-password-1');
  await ownerEditPage.getByRole('button', { name: 'Ingresar' }).click();
  await ownerEditPage.waitForURL('**/owner');
  await ownerEditPage.waitForTimeout(10);
  const ownerConcurrentEdit = await ownerEditPage.request.patch(`${baseUrl}/api/listings/${encodeURIComponent(assistedListing.id)}`, {
    data: { title: `${title} OWNER newer`, description: 'Cambio OWNER sintético concurrente.', location: 'Uspallata norte', priceAmount: 30000, currency: 'ARS', pricePeriod: 'MONTH', rentalDuration: 'FLEXIBLE', maxOccupants: 1 },
    headers: { Origin: baseUrl },
  });
  assert(ownerConcurrentEdit.status() === 200, `concurrent OWNER edit failed: ${ownerConcurrentEdit.status()}`);
  await ownerEditContext.close();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.getByText('Recargá la versión actual antes de continuar.').waitFor();
  const reloadCurrent = page.getByRole('button', { name: 'Recargar versión actual (descarta mis cambios)' });
  await reloadCurrent.waitFor();
  assert((await page.getByRole('textbox', { name: 'Título' }).inputValue()) === `${title} ADMIN editado`, 'stale form retains edits until the operator explicitly reloads');
  await reloadCurrent.click();
  await page.getByText('Se recargó la versión actual del borrador.', { exact: true }).waitFor();
  assert((await page.getByRole('textbox', { name: 'Título' }).inputValue()) === `${title} OWNER newer`, 'explicit reload shows the newer OWNER edit');
  await titleInput.fill(`${title} ADMIN editado`);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.getByText('Cambios guardados y auditados.', { exact: true }).waitFor();
  assert(await page.getByRole('button', { name: 'Enviar a revisión' }).isEnabled(), 'saving assisted edits must re-enable submit');
  await page.getByRole('button', { name: 'Marcar no disponible' }).click();
  await page.getByText('Disponibilidad actualizada y auditada.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Reconfirmar disponibilidad' }).click();
  await page.getByText('Disponibilidad reconfirmada y auditada.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await page.getByText('Publicación enviada a revisión y auditada.', { exact: true }).waitFor();
  assert(await page.getByRole('button', { name: 'Marcar no disponible' }).count() === 0 && await page.getByRole('button', { name: 'Reconfirmar disponibilidad' }).count() === 0, 'submitted assisted listings must not expose availability actions');
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
  return { result: 'PASS', checks: ['desktop OWNER listing read', 'OWNER-to-ADMIN denial', 'cross-owner API IDOR denial', 'public detail URL serves SPA shell for either identity', 'OWNER selected-listing refresh including submitted-state handling', 'OWNER refresh blocked with unsaved edits', 'synthetic D1 BLOB upload', 'delete confirmation cancel', 'OWNER draft delete and image cleanup', 'mobile ADMIN assisted creation', 'ADMIN stale owner-page response discarded after selection change', 'ADMIN discovers drafts beyond the first 50', 'persisted owner target and actor audit', 'submit blocked until assisted edits are saved', 'stale ADMIN edit rejected after a newer OWNER save; explicit reload', 'assisted edit', 'availability update and reconfirmation', 'submitted ADMIN listing hides availability controls', 'submit to review rejects a fresh-key duplicate without audit', 'audit for each mutation', 'assisted draft deletion and audit'] };
}
