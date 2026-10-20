import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidence = resolve(process.cwd(), '../../output/playwright/i06.4');
async function capture(page: import('@playwright/test').Page, name: string) {
  await mkdir(evidence, { recursive: true });
  await page.locator('img').evaluateAll(images => { for (const image of images) (image as HTMLImageElement).loading = 'eager'; });
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode().catch(() => undefined))));
  await page.screenshot({ path: resolve(evidence, name), fullPage: true });
}

test('catálogo: filtros reales, paginación y retorno conservan la búsqueda', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  let delayFirstPage = true;
  await page.route('**/api/public/listings**', async route => {
    if (delayFirstPage) {
      delayFirstPage = false;
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Buscando lugares para tu estadía');
  await expect(page.getByRole('heading', { name: /Una pausa entre la montaña y el cielo/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alojamientos para explorar' })).toBeVisible();
  await expect(page.locator('.listing-card')).toHaveCount(6);
  await expect(page.locator('.listing-card').first()).toContainText('ARS');
  const leadPhoto = page.locator('.listing-card-photo img').first();
  await expect(leadPhoto).toBeVisible();
  await expect.poll(() => leadPhoto.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const contrast = await page.locator('.listing-card').first().evaluate(card => {
    const luminance = (rgb: string) => {
      const channels = rgb.match(/[\d.]+/g)?.slice(0, 3).map(value => Number(value) / 255) ?? [];
      const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    return ['.listing-description', '.listing-price strong', '.availability-pill', '.listing-freshness', '.listing-card-cta'].map(selector => {
      const element = card.querySelector(selector)!;
      const style = getComputedStyle(element);
      let background = style.backgroundColor;
      if (background === 'rgba(0, 0, 0, 0)') background = getComputedStyle(card).backgroundColor;
      const a = luminance(style.color), b = luminance(background);
      return { selector, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
  });
  for (const color of contrast) expect(color.ratio, `${color.selector} contrast`).toBeGreaterThanOrEqual(4.5);
  await capture(page, 'catalog-desktop-1440x1000.png');

  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveClass(/skip-link/);
  expect(await page.locator(':focus').evaluate(element => getComputedStyle(element).outlineWidth)).toBe('3px');

  await page.getByRole('button', { name: /Siguiente/ }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('.listing-card')).toHaveCount(2);
  await page.locator('.listing-card h3 a').first().click();
  await expect(page).toHaveURL(/\/listings\//);
  await expect(page.getByRole('heading', { name: 'Sobre este alojamiento' })).toBeVisible();
  await expect(page.locator('main')).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('.listing-card')).toHaveCount(2);

  await page.locator('.catalog-search details summary').click();
  await page.getByLabel('Personas').selectOption('4');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page).toHaveURL(/maxOccupants=4/);
  await expect(page.locator('.listing-card')).toHaveCount(4);
  for (const card of await page.locator('.listing-card').all()) {
    const text = await card.innerText();
    const capacity = Number(text.match(/Hasta (\d+) personas?/)?.[1] ?? 0);
    expect(capacity).toBeGreaterThanOrEqual(4);
  }
  await page.locator('#filter-available').check();
  await page.getByRole('button', { name: 'Buscar alojamientos' }).click();
  await expect(page).toHaveURL(/availableOnly=true/);
  await expect(page.locator('.availability-pill.is-unavailable')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.listing-card').first()).toBeVisible();
  await capture(page, 'catalog-mobile-390x844.png');
  await page.setViewportSize({ width: 320, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await capture(page, 'catalog-mobile-320x844.png');
});

test('catálogo: error recuperable, ausencia de resultados e imagen rota', async ({ page }) => {
  let failFirstSearch = true;
  await page.route('**/api/public/listings**', async route => {
    if (failFirstSearch) {
      failFirstSearch = false;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('No pudimos actualizar el catálogo');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.locator('.listing-card')).toHaveCount(6);

  let slowStartedResolve!: () => void;
  let slowFinishedResolve!: () => void;
  const slowStarted = new Promise<void>(resolve => { slowStartedResolve = resolve; });
  const slowFinished = new Promise<void>(resolve => { slowFinishedResolve = resolve; });
  let holdUspallata = true;
  const delayedRoute = async (route: import('@playwright/test').Route) => {
    if (holdUspallata && new URL(route.request().url()).searchParams.get('location') === 'Uspallata') {
      holdUspallata = false;
      slowStartedResolve();
      await new Promise(resolve => setTimeout(resolve, 600));
      try { await route.continue(); } catch { /* client aborted this stale request */ }
      finally { slowFinishedResolve(); }
      return;
    }
    await route.continue();
  };
  await page.route('**/api/public/listings**', delayedRoute);
  await page.getByLabel('Ubicación').fill('Uspallata');
  await page.locator('.search-submit').click();
  await slowStarted;
  await page.getByLabel('Ubicación').fill('Pueblo inexistente');
  await page.locator('.search-submit').click();
  await expect(page.getByRole('status')).toContainText('No encontramos alojamientos');
  await slowFinished;
  await expect(page.getByRole('status')).toContainText('No encontramos alojamientos');
  await expect(page.locator('.listing-card')).toHaveCount(0);
  await page.unroute('**/api/public/listings**', delayedRoute);

  let failDetailOnce = true;
  const detailRoute = async (route: import('@playwright/test').Route) => {
    if (failDetailOnce) { failDetailOnce = false; await route.abort('failed'); return; }
    await route.continue();
  };
  await page.route('**/api/public/listings/synthetic-casa-rio', detailRoute);
  await page.goto('/listings/synthetic-casa-rio');
  await expect(page.getByRole('heading', { name: 'Intentemos de nuevo' })).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { name: 'Casa junto al arroyo' })).toBeVisible();
  await page.unroute('**/api/public/listings/synthetic-casa-rio', detailRoute);

  await page.route('**/media/catalog/cabana-sintetica.webp', route => route.abort('failed'));
  await page.goto('/listings/synthetic-cabana-cerro');
  await expect(page.getByRole('heading', { name: 'Cabaña del cerro' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Imagen no disponible para Cabaña del cerro' })).toBeVisible();

  await page.goto('/');
  await page.getByLabel('Ubicación').fill('Pueblo sintético inexistente');
  await page.getByRole('button', { name: 'Buscar alojamientos' }).click();
  await expect(page.getByRole('status')).toContainText('No encontramos alojamientos');
  await page.getByRole('button', { name: 'Ver todos los alojamientos' }).click();
  await expect(page.locator('.listing-card')).toHaveCount(6);
});

test('catálogo: una página guardada fuera del nuevo total vuelve a la última página válida', async ({ page }) => {
  await page.goto('/?maxOccupants=4&page=2');
  await expect(page).toHaveURL(/maxOccupants=4/);
  await expect(page).not.toHaveURL(/page=2/);
  await expect(page.locator('.listing-card')).toHaveCount(4);
  for (const card of await page.locator('.listing-card').all()) {
    const text = await card.innerText();
    const capacity = Number(text.match(/Hasta (\d+) personas?/)?.[1] ?? 0);
    expect(capacity).toBeGreaterThanOrEqual(4);
  }
});

test('ficha y consulta: D1 real local, reintento idempotente y regresión mobile #35', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/listings/synthetic-casa-rio');
  await expect(page.getByRole('heading', { name: 'Casa junto al arroyo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Disponibilidad' })).toBeVisible();
  const detailPhoto = page.locator('.detail-gallery-primary img');
  await expect.poll(() => detailPhoto.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await capture(page, 'listing-contact-desktop-1440x1000.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, 'listing-contact-mobile-390x844.png');

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const geometry = await page.locator('.public-contact-form').evaluate(form => {
      const labels = [...form.querySelectorAll('label')];
      const problems: string[] = [];
      let previousControlBottom = -1;
      for (const label of labels) {
        const text = label.querySelector('span');
        const control = label.querySelector('input,textarea');
        if (!text || !control) { problems.push('field lacks visible label or control'); continue; }
        const textRect = text.getBoundingClientRect();
        const controlRect = control.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        if (textRect.bottom > controlRect.top) problems.push(`${label.htmlFor}: label overlaps control`);
        if (previousControlBottom > textRect.top) problems.push(`${label.htmlFor}: label overlaps previous field`);
        if (labelRect.left > controlRect.left || labelRect.right < controlRect.right) problems.push(`${label.htmlFor}: control escapes label bounds`);
        const textColor = getComputedStyle(text).color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
        const paperColor = getComputedStyle(control).backgroundColor.match(/[\d.]+/g)!.slice(0, 3).map(Number);
        const luminance = (rgb: number[]) => rgb.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        const labelContrast = (Math.max(luminance(textColor), luminance(paperColor)) + 0.05) / (Math.min(luminance(textColor), luminance(paperColor)) + 0.05);
        if (labelContrast < 4.5) problems.push(`${label.htmlFor}: label contrast ${labelContrast.toFixed(2)}:1`);
        previousControlBottom = controlRect.bottom;
      }
      return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, problems };
    });
    expect(geometry.width).toBe(width);
    expect(geometry.documentWidth).toBeLessThanOrEqual(width);
    expect(geometry.problems).toEqual([]);
  }
  await capture(page, 'listing-contact-mobile-320x844.png');

  const idempotencyKeys: string[] = [];
  let attempt = 0;
  await page.route('**/api/public/listings/synthetic-casa-rio/contact', async route => {
    attempt++;
    idempotencyKeys.push(route.request().headers()['idempotency-key'] ?? '');
    if (attempt === 1) { await route.abort('failed'); return; }
    await route.continue();
  });
  await page.getByLabel('Tu nombre').fill('Ana Sintética');
  await page.getByLabel('Tu correo').fill('ana@example.test');
  await page.getByLabel('Mensaje').fill('¿Hay disponibilidad para cuatro personas?');
  await page.getByRole('button', { name: /Enviar consulta/ }).click();
  await expect(page.getByRole('alert')).toContainText('Tus datos siguen acá');
  await expect(page.getByLabel('Tu nombre')).toHaveValue('Ana Sintética');
  await expect(page.locator('.contact-feedback.success')).toHaveCount(0);
  const accepted = page.waitForResponse(response => response.url().includes('/contact') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /Enviar consulta/ }).click();
  const response = await accepted;
  expect(response.status()).toBe(201);
  await expect(response.json()).resolves.toMatchObject({ status: 'RECEIVED', id: expect.any(String) });
  expect(idempotencyKeys).toHaveLength(2);
  expect(idempotencyKeys[0]).toBeTruthy();
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
  await expect(page.getByRole('status')).toContainText('Tu consulta fue enviada');
  await expect(page.getByLabel('Tu nombre')).toHaveValue('');
});
