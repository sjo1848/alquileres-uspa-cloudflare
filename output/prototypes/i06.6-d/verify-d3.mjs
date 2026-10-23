import { chromium } from '../../../apps/web/node_modules/playwright/index.mjs';
import { mkdir } from 'node:fs/promises';

const base = 'http://127.0.0.1:4173/d3-unificada.html';
const out = 'output/playwright/i06.6-d/d3';
const views = ['catalog', 'detail', 'owner', 'admin', 'assist'];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ reducedMotion: 'reduce' });
const externalRequests = [];
page.on('request', request => {
  const url = new URL(request.url());
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalRequests.push(request.url());
});
page.on('pageerror', error => { throw error; });

async function select(view) {
  await page.locator(`[data-view="${view}"]`).click();
  await page.waitForFunction(id => document.querySelector('.screen.on')?.id === id, view);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}

for (const [width, height, name] of [[1440, 1000, 'desktop-1440x1000'], [390, 844, 'mobile-390x844']]) {
  await page.setViewportSize({ width, height });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '.bottomNav{position:static!important}.screen{min-height:0!important}' });
  for (const view of views) {
    await select(view);
    const broken = await page.evaluate(() => [...document.images].filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src));
    if (broken.length) throw new Error(`${view}: images failed: ${broken.join(', ')}`);
    await page.evaluate(() => { document.querySelector('.demo').style.display = 'none'; });
    await page.screenshot({ path: `${out}/${view}-${name}.png`, fullPage: true });
    await page.evaluate(() => { document.querySelector('.demo').style.display = ''; });
  }
}

await page.setViewportSize({ width: 320, height: 844 });
await page.goto(base, { waitUntil: 'networkidle' });
for (const view of views) {
  await select(view);
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    active: document.querySelector('.screen.on')?.id,
  }));
  if (metrics.viewport !== metrics.document || metrics.active !== view) {
    throw new Error(`320px responsive failure for ${view}: ${JSON.stringify(metrics)}`);
  }
  console.log(`320px ${view}: PASS (${metrics.document}/${metrics.viewport}px)`);
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base, { waitUntil: 'networkidle' });
await select('catalog');
await page.locator('[data-state="error"]').click();
if (await page.locator('#stateMessage').getAttribute('data-kind') !== 'error') throw new Error('catalog error state did not render');
await select('detail');
await page.locator('#guest-name').fill('Synthetic Guest');
await page.locator('#guest-email').fill('guest@example.test');
await page.locator('#guest-message').fill('Consulta sintética de Playwright');
await page.locator('#contact button[type="submit"]').click();
if (!(await page.locator('#contactResult').innerText()).includes('No se envió')) throw new Error('contact simulation did not explain the non-send');

await select('owner');
const ownerCopy = await page.locator('#owner').innerText();
if (/respondida|sin responder/i.test(ownerCopy)) throw new Error('OWNER implies a response state outside READ/UNREAD');
if (!/sin leer/i.test(ownerCopy) || !/leída/i.test(ownerCopy)) throw new Error('OWNER READ/UNREAD labels are missing');

await select('admin');
if (!(await page.locator('#reviewActions').innerText()).includes('Aprobar revisión')) throw new Error('SUBMITTED case lacks review action');
if (await page.locator('#reviewActions').getByText('Publicar en catálogo').count()) throw new Error('SUBMITTED case incorrectly exposes publish');
await page.locator('#reason').fill('No');
await page.locator('[data-admin-action="reject"]').click();
if (await page.locator('#reasonError').isHidden()) throw new Error('short rejection reason was not blocked');
await page.locator('[data-case="approved"]').click();
if (!(await page.locator('#reviewActions').innerText()).includes('Publicar en catálogo')) throw new Error('APPROVED/UNPUBLISHED case lacks publish action');
if (await page.locator('#reviewActions').getByText('Aprobar revisión').count()) throw new Error('APPROVED case incorrectly exposes approval');
await page.locator('[data-admin-action="publish"]').click();
if (!(await page.locator('#toast').innerText()).includes('no cambió')) throw new Error('publish simulation must not claim a persisted change');

await select('assist');
const assistCopy = await page.locator('#assist').innerText();
if (/motivo.*obligatorio/i.test(assistCopy)) throw new Error('assisted edit invents a mandatory reason');
await page.locator('[data-open-delete]').click();
if (await page.locator('#assistDeleteDialog').isHidden()) throw new Error('assisted delete confirmation did not open');
if (await page.evaluate(() => document.activeElement?.getAttribute('data-close-delete')) === null) throw new Error('safe cancel action did not receive focus');
await page.keyboard.press('Escape');
if (!(await page.locator('[data-open-delete]').evaluate(el => el === document.activeElement))) throw new Error('delete cancel did not restore focus');

const semantics = await page.evaluate(() => {
  const root = getComputedStyle(document.documentElement);
  const inputs = [...document.querySelectorAll('input, select, textarea')];
  const unlabeled = inputs.filter(el => !el.labels?.length && !el.getAttribute('aria-label')).map(el => el.outerHTML.slice(0, 100));
  const copy = document.body.innerText;
  const forbidden = ['favorito', 'amenidades', 'casa entera', 'relevancia', 'respondida', 'sin responder', 'workspace', 'inbox'];
  const present = forbidden.filter(term => new RegExp(term, 'i').test(copy));
  return { unlabeled, present, colorTokens: {
    canvas: root.getPropertyValue('--canvas').trim(), ink: root.getPropertyValue('--ink').trim(),
    muted: root.getPropertyValue('--muted').trim(), blue: root.getPropertyValue('--blue').trim(),
  } };
});
if (semantics.unlabeled.length) throw new Error(`unlabeled form controls: ${JSON.stringify(semantics.unlabeled)}`);
if (semantics.present.length) throw new Error(`unsupported or English UI claims: ${semantics.present.join(', ')}`);
if (externalRequests.length) throw new Error(`external request was made: ${externalRequests.join(', ')}`);
console.log('Desktop/mobile captures, synthetic-only network, states, forms, admin transitions, deletion dialog, labels, and product semantics: PASS');
console.log(`D3 color tokens: ${JSON.stringify(semantics.colorTokens)}`);
await browser.close();
