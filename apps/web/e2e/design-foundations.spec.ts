import { expect, test } from '@playwright/test';

const sizes = [
  { width: 1440, height: 1000, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile-390' },
  { width: 320, height: 844, name: 'mobile-320' },
];

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content, `document overflowed ${dimensions.viewport}px viewport`).toBeLessThanOrEqual(dimensions.viewport);
}

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = color.startsWith('rgb')
      ? color.match(/[\d.]+/g)!.slice(0, 3).map(value => Number(value) / 255)
      : color.match(/[\da-f]{2}/gi)!.slice(0, 3).map(value => parseInt(value, 16) / 255);
    const linear = channels.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  };
  const first = luminance(foreground), second = luminance(background);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

test('D3.1 shared foundation preserves role navigation and responsive shell', async ({ page }) => {
  for (const viewport of sizes) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Alquileres Uspallata, inicio' })).toBeVisible();
    await expect(page.getByText('Buscando lugares para tu estadía…')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Mis publicaciones' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Revisión', exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    const palette = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(['--color-forest', '--color-muted', '--color-canvas', '--color-clay', '--color-paper'].map(token => [token, style.getPropertyValue(token).trim()]));
    }) as Record<string, string>;
    expect(contrastRatio(palette['--color-forest'], palette['--color-canvas'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette['--color-muted'], palette['--color-canvas'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette['--color-paper'], palette['--color-clay'])).toBeGreaterThanOrEqual(4.5);
    const locationNote = await page.locator('.catalog-intro-note').evaluate(element => {
      const style = getComputedStyle(element);
      return { foreground: style.color, background: style.backgroundColor };
    });
    expect(contrastRatio(locationNote.foreground, locationNote.background), `catalog location note contrast at ${viewport.width}px`).toBeGreaterThanOrEqual(4.5);
    const heroCopy = await page.locator('.catalog-intro-copy > p').evaluate(element => {
      const hero = element.closest('.catalog-intro')!;
      const gradient = getComputedStyle(hero).backgroundImage;
      const stops = Array.from(gradient.matchAll(/rgb\([^)]*\)/g), match => match[0]);
      return { foreground: getComputedStyle(element).color, stops, copyLayer: getComputedStyle(element.parentElement!).zIndex };
    });
    expect(heroCopy.copyLayer).toBe('1');
    expect(heroCopy.stops.length).toBeGreaterThanOrEqual(3);
    for (const stop of heroCopy.stops) expect(contrastRatio(heroCopy.foreground, stop), `catalog hero copy contrast at ${viewport.width}px over ${stop}`).toBeGreaterThanOrEqual(4.5);
    const locationInput = await page.locator('#filter-location').evaluate(element => {
      const control = getComputedStyle(element);
      return {
        placeholder: getComputedStyle(element, '::placeholder').color,
        background: control.backgroundColor,
        border: control.borderTopColor,
      };
    });
    expect(contrastRatio(locationInput.placeholder, locationInput.background), `location placeholder contrast at ${viewport.width}px`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(locationInput.border, locationInput.background), `location field boundary at ${viewport.width}px`).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: `../../output/playwright/i06.6-p1/catalog-${viewport.name}.png`, fullPage: viewport.width === 1440 });

    if (viewport.width <= 768) {
      const toggle = page.getByRole('button', { name: 'Abrir menú' });
      await expect(toggle).toBeVisible();
      await toggle.focus();
      await expect(toggle).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('link', { name: 'Descubrir' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Ingresar' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeFocused();
    } else {
      await expect(page.getByRole('link', { name: 'Descubrir' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Ingresar' })).toBeVisible();
    }
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const motion = await page.evaluate(() => ({
    scroll: getComputedStyle(document.documentElement).scrollBehavior,
    transitionSeconds: parseFloat(getComputedStyle(document.querySelector('.brand')!).transitionDuration),
  }));
  expect(motion.scroll).toBe('auto');
  expect(motion.transitionSeconds).toBeLessThan(.001);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill('owner.a@example.test');
  await page.getByLabel('Contraseña').fill('synthetic-owner-password-1');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL('**/owner');
  await expect(page.getByText('Cargando tus alojamientos…')).toBeHidden();
  const statusColors = await page.evaluate(() => {
    const dashboard = document.querySelector('.owner-dashboard')!;
    const samples = ['draft', 'submitted', 'rejected', 'approved'].map(status => {
      const chip = document.createElement('span');
      chip.className = `owner-status is-${status}`;
      dashboard.append(chip);
      const style = getComputedStyle(chip);
      const colors = { foreground: style.color, background: style.backgroundColor };
      chip.remove();
      return colors;
    });
    return samples;
  });
  for (const colors of statusColors) expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
  for (const viewport of sizes) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `../../output/playwright/i06.6-p1/owner-${viewport.name}.png`, fullPage: viewport.width === 1440 });
    if (viewport.width <= 768) await page.getByRole('button', { name: 'Abrir menú' }).click();
    await expect(page.getByRole('link', { name: 'Mis publicaciones' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Revisión', exact: true })).toHaveCount(0);
    if (viewport.width <= 768) await page.getByRole('button', { name: 'Cerrar menú' }).click();
  }

  const ownerHeroLink = page.getByRole('link', { name: 'Ir a mis alojamientos' });
  await ownerHeroLink.focus();
  await expect(ownerHeroLink).toBeFocused();
  const ownerFocus = await ownerHeroLink.evaluate(element => {
    const style = getComputedStyle(element);
    return { outline: style.outlineColor, boxShadow: style.boxShadow };
  });
  expect(ownerFocus.outline).toBe('rgb(255, 255, 255)');
  expect(contrastRatio(ownerFocus.outline, '#6879dc')).toBeGreaterThanOrEqual(3);

  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill('admin@example.test');
  await page.getByLabel('Contraseña').fill('synthetic-owner-password-1');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL('**/admin');
  await expect(page.getByText('Cargando publicaciones…')).toBeHidden();
  for (const viewport of sizes) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `../../output/playwright/i06.6-p1/admin-${viewport.name}.png`, fullPage: viewport.width === 1440 });
    if (viewport.width <= 768) await page.getByRole('button', { name: 'Abrir menú' }).click();
    await expect(page.getByRole('link', { name: 'Revisión', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Gestión asistida' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mis publicaciones' })).toHaveCount(0);
    if (viewport.width <= 768) await page.getByRole('button', { name: 'Cerrar menú' }).click();
  }
});
