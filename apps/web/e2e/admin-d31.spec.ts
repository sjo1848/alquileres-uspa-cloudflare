import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { formatAdminTimestamp } from '../src/views/admin-display';

const origin = 'http://127.0.0.1:5176';
const password = 'synthetic-owner-password-1';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL(email === 'admin@example.test' ? '**/admin' : '**/owner');
}

test('ADMIN D3.1 runtime captures from real local Worker and synthetic D1', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, 'owner.a@example.test');
  expect([401, 403]).toContain((await page.request.get(origin + '/api/admin/listings/review')).status());
  const title = `QA D31 ADMIN ${Date.now()}`;
  const created = await page.request.post(`${origin}/api/listings`, {
    headers: { Origin: origin, 'Idempotency-Key': `admin-d31-${Date.now()}` },
    data: { title, description: 'Alojamiento sintético de QA para moderación.', location: 'Uspallata, Mendoza', priceAmount: 42000, pricePeriod: 'WEEK', rentalDuration: 'WEEKS', maxOccupants: 4, currency: 'ARS' },
  });
  expect(created.status()).toBe(201);
  const listing = await created.json();
  const image = await readFile('e2e/fixtures/owner-e2e-red.png');
  const uploaded = await page.request.post(`${origin}/api/listings/${listing.id}/images`, {
    headers: { Origin: origin, 'Content-Type': 'image/png', 'X-Image-Name': 'synthetic-qa.png', 'Idempotency-Key': `admin-d31-image-${Date.now()}` },
    data: image,
  });
  expect(uploaded.status()).toBe(201);
  const submitted = await page.request.post(`${origin}/api/listings/${listing.id}/submit`, { headers: { Origin: origin } });
  expect(submitted.status()).toBe(200);
  await page.context().clearCookies();
  await login(page, 'admin@example.test');
  expect([401, 403]).toContain((await page.request.get(origin + '/api/listings/' + listing.id)).status());
  await expect(page.getByRole('heading', { name: 'Revisión de publicaciones' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(title) }).waitFor();
  await expect(page.locator('.admin-review-images img').first()).toBeVisible();
  await expect(page.locator('.admin-review-images img').first()).toHaveJSProperty('naturalWidth', 48);
  await expect(page.getByText('42.000 ARS / semana').first()).toBeVisible();
  await expect(page.getByText('Hasta 4 personas')).toBeVisible();
  await page.screenshot({ path: '../../output/playwright/i06.6-admin/after/admin-moderation-desktop-1440x1000.png', fullPage: true });

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Revisión de publicaciones' })).toBeVisible();
    await page.getByRole('button', { name: new RegExp(title) }).waitFor();
    const queueRow = page.getByRole('button', { name: new RegExp(title) });
    await queueRow.click();
    await expect(page.getByRole('button', { name: '← Volver a la lista' })).toBeVisible();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.getByRole('button', { name: '← Volver a la lista' }).focus();
    await page.keyboard.press('Enter');
    await expect(queueRow).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: '← Volver a la lista' })).toBeVisible();
    expect(await page.locator('body').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `../../output/playwright/i06.6-admin/after/admin-moderation-mobile-${width}x844.png`, fullPage: true });
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin-assist');
  await expect(page.getByRole('heading', { name: 'Gestión asistida' })).toBeVisible();
  await page.locator('.admin-assist-sidebar select').first().waitFor();
  await page.screenshot({ path: '../../output/playwright/i06.6-admin/after/admin-assist-desktop-1440x1000.png', fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.reload();
    await expect(page.locator('.admin-assist-sidebar select').first()).toBeVisible();
    expect(await page.locator('body').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(width);
    const aligned = await page.locator('.admin-assist-editor form label').evaluateAll(labels => labels.every(label => {
      const control = label.querySelector('input,select,textarea');
      return !control || control.getBoundingClientRect().top >= label.getBoundingClientRect().top + 16;
    }));
    expect(aligned).toBe(true);
    await page.screenshot({ path: `../../output/playwright/i06.6-admin/after/admin-assist-mobile-${width}x844.png`, fullPage: true });
  }
});

test('ADMIN decisions, assisted persistence, audit and Mendoza timestamp regression', async ({ page }) => {
  expect(formatAdminTimestamp('2026-10-19T16:11:22.876Z')).toBe('19/10/2026, 13:11');
  expect(formatAdminTimestamp('2026-10-20T02:10:00.000Z')).toBe('19/10/2026, 23:10');
  expect(formatAdminTimestamp('2026-10-20T12:05:00.000Z')).toBe('20/10/2026, 09:05');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, 'owner.a@example.test');
  const title = 'QA D31 decision ' + Date.now();
  const created = await page.request.post(origin + '/api/listings', {
    headers: { Origin: origin, 'Idempotency-Key': 'admin-d31-review-' + Date.now() },
    data: { title, description: 'Registro sintético de regresión de moderación.', location: 'Uspallata, Mendoza', priceAmount: 52000, pricePeriod: 'MONTH', rentalDuration: 'MONTHS', maxOccupants: 3, currency: 'ARS' },
  });
  expect(created.status()).toBe(201);
  const listing = await created.json();
  const submitted = await page.request.post(origin + '/api/listings/' + listing.id + '/submit', { headers: { Origin: origin } });
  expect(submitted.status()).toBe(200);
  await page.context().clearCookies();
  await login(page, 'admin@example.test');
  await page.goto('/admin');
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await page.getByRole('button', { name: 'Aprobar revisión' }).click();
  await expect(page.getByText('Aprobada · sin publicar').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publicar en catálogo' })).toBeVisible();
  await page.getByRole('button', { name: 'Publicar en catálogo' }).click();
  await expect(page.getByText('La publicación ya está visible en el catálogo.')).toBeVisible();
  const persisted = await page.request.get(origin + '/api/admin/listings/' + listing.id);
  expect(persisted.status()).toBe(200);
  expect((await persisted.json()).publicationStatus).toBe('PUBLISHED');
  await page.context().clearCookies();
  await login(page, 'owner.a@example.test');
  const rejectedTitle = 'QA D31 rechazo ' + Date.now();
  const rejectedCreate = await page.request.post(origin + '/api/listings', {
    headers: { Origin: origin, 'Idempotency-Key': 'admin-d31-reject-' + Date.now() },
    data: { title: rejectedTitle, description: 'Registro sintético que será rechazado.', location: 'Uspallata', priceAmount: 18000, pricePeriod: 'WEEK', rentalDuration: 'WEEKS', maxOccupants: 2, currency: 'ARS' },
  });
  expect(rejectedCreate.status()).toBe(201);
  const rejectedListing = await rejectedCreate.json();
  expect((await page.request.post(origin + '/api/listings/' + rejectedListing.id + '/submit', { headers: { Origin: origin } })).status()).toBe(200);
  await page.context().clearCookies();
  await login(page, 'admin@example.test');
  await page.goto('/admin');
  await page.getByRole('button', { name: new RegExp(rejectedTitle) }).click();
  await page.getByLabel(/Motivo del rechazo/).fill('Falta completar la información requerida.');
  await page.getByRole('button', { name: 'Rechazar con motivo' }).click();
  await expect(page.getByText('Publicación rechazada con el motivo registrado.')).toBeVisible();
  await expect(page.getByText('Falta completar la información requerida.')).toBeVisible();
  await page.goto('/admin-assist');
  await page.locator('.admin-assist-sidebar select').first().selectOption({ label: 'owner.a@example.test' });
  await page.getByLabel('Título', { exact: true }).fill('Borrador asistido de prueba');
  await page.getByLabel('Descripción', { exact: true }).fill('Descripción sintética guardada por ADMIN.');
  await page.getByLabel('Ubicación', { exact: true }).fill('Uspallata, Mendoza');
  await page.getByLabel('Importe', { exact: true }).fill('31000');
  await page.getByRole('button', { name: 'Crear borrador asistido' }).click();
  await expect(page.getByRole('heading', { name: 'Borrador asistido de prueba' })).toBeVisible();
  await page.getByLabel('Título', { exact: true }).fill('Borrador asistido persistido');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('heading', { name: 'Borrador asistido persistido' })).toBeVisible();
  await page.getByRole('button', { name: 'Auditoría', exact: true }).click();
  await expect(page.getByText(/Creó un borrador asistido|Editó los datos del borrador/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Disponibilidad', exact: true }).click();
  await page.getByRole('button', { name: 'Marcar no disponible' }).click();
  await expect(page.locator('.admin-availability-card strong')).toHaveText('No disponible');
  await page.getByRole('button', { name: 'Reconfirmar disponibilidad' }).click();
  await expect(page.locator('.admin-availability-card').getByText(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/)).toBeVisible();
  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await expect(page.getByText('La publicación ya está en revisión.')).toBeVisible();
  await page.getByRole('button', { name: 'Auditoría', exact: true }).click();
  await expect(page.getByText('Envió el borrador a revisión')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('body').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(390);
});
