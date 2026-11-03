import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidence = resolve(process.cwd(), '../../output/playwright/m3');
async function capture(page: import('@playwright/test').Page, name: string) {
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: resolve(evidence, name), fullPage: true });
}

test('Mi selección: guarda IDs, rehidrata API pública actual, compara y navega', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/?pricePeriod=MONTH');
  await expect(page.locator('.listing-card')).toHaveCount(4);

  const catalogResponse = await page.request.get('/api/public/listings?pricePeriod=MONTH&pageSize=6');
  expect(catalogResponse.ok()).toBe(true);
  const apiCatalog = await catalogResponse.json() as { items: { id: string; title: string }[] };
  expect(apiCatalog.items).toHaveLength(4);
  const names = apiCatalog.items.map(listing => listing.title);
  for (const listing of apiCatalog.items) {
    const card = page.locator('.listing-card').filter({ has: page.getByRole('heading', { name: listing.title }) });
    await card.getByRole('button', { name: 'Guardar para comparar' }).click();
    await expect(card.getByRole('button', { name: 'Guardado' })).toHaveAttribute('aria-pressed', 'true');
  }

  const firstCard = page.locator('.listing-card').filter({ has: page.getByRole('heading', { name: names[0] }) });
  await firstCard.getByRole('button', { name: 'Guardado' }).click();
  await expect(firstCard.getByRole('button', { name: 'Guardar para comparar' })).toHaveAttribute('aria-pressed', 'false');
  await firstCard.getByRole('button', { name: 'Guardar para comparar' }).click();
  await firstCard.getByRole('button', { name: 'Guardado' }).focus();
  await page.keyboard.press('Tab');
  await expect(firstCard.getByRole('link', { name: 'Conocer el alojamiento' })).toBeFocused();
  expect(await page.locator(':focus').evaluate(element => getComputedStyle(element).outlineWidth)).toBe('3px');

  const storedBeforeReload = await page.evaluate(() => localStorage.getItem('uspa-monthly-selection-v1'));
  const expectedIdsAfterMoveToEnd = [...apiCatalog.items.slice(1), apiCatalog.items[0]].map(listing => listing.id);
  expect(storedBeforeReload).toBe(JSON.stringify(expectedIdsAfterMoveToEnd));
  expect(storedBeforeReload).not.toContain('title');
  expect(storedBeforeReload).not.toContain('priceAmount');
  await page.reload();
  await expect(page.getByRole('link', { name: 'Mi selección 4' })).toBeVisible();

  let detailsRequests = 0;
  await page.route('**/api/public/listings/synthetic-catalog-03', async route => {
    const response = await route.fetch();
    const body = await response.json() as Record<string, unknown>;
    detailsRequests++;
    if (detailsRequests > 1) {
      body.title = 'Cabaña del Valle Alto actualizada';
      body.priceAmount = 777;
    }
    await route.fulfill({ response, json: body });
  });

  await page.getByRole('link', { name: 'Mi selección 4' }).click();
  await expect(page).toHaveURL(/\/selection$/);
  await expect(page.locator('.selection-card')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Cabaña del cerro' })).toBeVisible();
  await expect(page.locator('.selection-card-warning')).toContainText('no disponible');
  await expect(page.locator('.selection-card').filter({ hasText: 'Cabaña del cerro' })).toContainText('ARS 125.000 · declarado');
  await expect(page.locator('.selection-card').filter({ hasText: 'Cabaña del cerro' })).toContainText('Ingreso estimado');
  await expect(page.locator('.selection-card').filter({ hasText: 'Cabaña del Valle Alto' })).toContainText('No informado');
  await expect(page.getByText('Guardar no reserva.', { exact: false })).toBeVisible();
  await capture(page, 'selection-desktop-1440.png');

  await page.getByRole('button', { name: 'Actualizar datos' }).click();
  await expect(page.getByRole('heading', { name: 'Cabaña del Valle Alto actualizada' })).toBeVisible();
  await expect(page.locator('.selection-card').filter({ hasText: 'Cabaña del Valle Alto actualizada' })).toContainText('USD 777 por mes');
  expect(await page.evaluate(() => localStorage.getItem('uspa-monthly-selection-v1'))).toBe(storedBeforeReload);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(await page.locator('.selection-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
  await capture(page, 'selection-mobile-390.png');
  await page.setViewportSize({ width: 320, height: 800 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await capture(page, 'selection-mobile-320.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: 'Consultar por Cabaña del Valle Alto actualizada' }).click();
  await expect(page).toHaveURL(/\/listings\/synthetic-catalog-03#contact-form$/);
  await expect(page.getByRole('heading', { name: '¿Te interesa?' })).toBeVisible();
  await expect(page.locator('#contact-form')).toBeInViewport();
  await expect(page.getByLabel('Tu nombre')).toBeVisible();
  const detailToggle = page.getByRole('button', { name: 'Guardado en Mi selección' });
  await detailToggle.click();
  await expect(page.getByRole('button', { name: 'Guardar para comparar' })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('uspa-monthly-selection-v1'))).not.toContain('synthetic-catalog-03');
  await page.getByRole('button', { name: 'Guardar para comparar' }).click();
  await expect(page.getByRole('button', { name: 'Guardado en Mi selección' })).toHaveAttribute('aria-pressed', 'true');
});

test('Mi selección: stale IDs quedan explícitos y se pueden quitar', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('uspa-monthly-selection-v1', JSON.stringify(['synthetic-withdrawn-listing'])));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/selection');
  await expect(page.getByRole('heading', { name: 'Anuncio no disponible' })).toBeVisible();
  await expect(page.getByText('Puede haber sido retirado o despublicado.')).toBeVisible();
  await page.getByRole('button', { name: 'Quitar de mi selección' }).click();
  await expect(page.getByRole('heading', { name: 'Tu próxima comparación empieza acá.' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('uspa-monthly-selection-v1'))).toBe('[]');
});

test('Mi selección: error de API puede reintentarse sin reemplazar datos por snapshots', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('uspa-monthly-selection-v1', JSON.stringify(['synthetic-catalog-03'])));
  let fail = true;
  await page.route('**/api/public/listings/synthetic-catalog-03', async route => {
    if (fail) { fail = false; await route.abort('failed'); return; }
    await route.continue();
  });
  await page.goto('/selection');
  await expect(page.getByRole('heading', { name: 'Este alojamiento' })).toBeVisible();
  await expect(page.getByLabel('Alojamientos guardados').getByRole('button', { name: 'Quitar de mi selección' })).toBeVisible();
  await page.getByLabel('Alojamientos guardados').getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { name: 'Cabaña del Valle Alto' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('uspa-monthly-selection-v1'))).toBe('["synthetic-catalog-03"]');
});

test('Mi selección: permite quitar un anuncio cuando su ficha API falla', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('uspa-monthly-selection-v1', JSON.stringify(['synthetic-catalog-03'])));
  await page.route('**/api/public/listings/synthetic-catalog-03', route => route.abort('failed'));
  await page.goto('/selection');
  await expect(page.getByRole('heading', { name: 'Este alojamiento' })).toBeVisible();
  await page.getByLabel('Alojamientos guardados').getByRole('button', { name: 'Quitar de mi selección' }).click();
  await expect(page.getByRole('heading', { name: 'Tu próxima comparación empieza acá.' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('uspa-monthly-selection-v1'))).toBe('[]');
});

test('Mi selección: informa si el navegador bloquea el guardado desde catálogo y ficha', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'uspa-monthly-selection-v1') throw new DOMException('Storage is unavailable', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto('/?pricePeriod=MONTH');
  const card = page.locator('.listing-card').filter({ has: page.getByRole('heading', { name: 'Cabaña del Valle Alto' }) });
  await card.getByRole('button', { name: 'Guardar para comparar' }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo actualizar Mi selección en este dispositivo');
  await expect(card.getByRole('button', { name: 'Guardar para comparar' })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('uspa-monthly-selection-v1'))).toBeNull();

  await card.getByRole('link', { name: 'Conocer el alojamiento' }).click();
  await page.getByRole('button', { name: 'Guardar para comparar' }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo actualizar Mi selección en este dispositivo');
  await expect(page.getByRole('button', { name: 'Guardar para comparar' })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('uspa-monthly-selection-v1'))).toBeNull();
});

test('Mi selección: no oculta un anuncio si el navegador bloquea quitarlo', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('uspa-monthly-selection-v1', JSON.stringify(['synthetic-catalog-03']));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'uspa-monthly-selection-v1') throw new DOMException('Storage is unavailable', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto('/selection');
  await expect(page.getByRole('heading', { name: 'Cabaña del Valle Alto' })).toBeVisible();
  await page.getByRole('button', { name: 'Quitar Cabaña del Valle Alto de mi selección' }).click();
  await expect(page.getByRole('alert')).toContainText('No pudimos guardar esta selección en el dispositivo');
  await expect(page.getByRole('heading', { name: 'Cabaña del Valle Alto' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('uspa-monthly-selection-v1'))).toBe('["synthetic-catalog-03"]');
});
