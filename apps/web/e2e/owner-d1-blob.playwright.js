// Run from the repository root with Playwright CLI after starting the integrated
// Vite + Worker server and seeding a fresh synthetic D1 database.
async (page) => {
const baseUrl = 'http://127.0.0.1:5174';
const redFile = 'apps/web/e2e/fixtures/owner-e2e-red.png';
const blueFile = 'apps/web/e2e/fixtures/owner-e2e-blue.png';
const screenshot = 'output/playwright/owner-d1-blob-after-delete.png';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const title = `Codex QA Playwright ${Date.now()}`;
const imageOrder = async () => page.locator('.image-list li').allTextContents();
const selectListing = async () => page.getByRole('button', { name: new RegExp(title) }).click();

await page.context().clearCookies();
await page.goto(`${baseUrl}/login`);
await page.getByRole('textbox', { name: 'Email' }).fill('preview.owner@example.test');
await page.getByLabel('Contraseña').fill('synthetic-owner-password-1');
await page.getByRole('button', { name: 'Ingresar' }).click();
await page.waitForURL('**/owner');
await page.getByRole('button', { name: '+ Nuevo borrador' }).click();
await page.getByRole('textbox', { name: 'Título' }).fill(title);
await page.getByRole('textbox', { name: 'Descripción' }).fill('Fixture sintética Playwright para OWNER D1 BLOB.');
await page.getByRole('textbox', { name: 'Ubicación' }).fill('Uspallata, Mendoza');
await page.getByRole('spinbutton', { name: 'Importe' }).fill('12345');
await page.getByRole('button', { name: 'Crear borrador' }).click();
await page.getByText('Borrador creado.', { exact: true }).waitFor();

const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles(redFile);
await page.getByText('Imagen guardada en tu publicación.', { exact: true }).waitFor();
await fileInput.setInputFiles(blueFile);
await page.getByText('Imagen guardada en tu publicación.', { exact: true }).waitFor();
let order = await imageOrder();
assert(order.length === 2 && order[0].includes('1. owner-e2e-red.jpg') && order[1].includes('2. owner-e2e-blue.jpg'), 'uploads must display in dense order 1–2');
const decoded = await page.locator('.image-list img').evaluateAll(images => images.map(image => image.complete && image.naturalWidth > 0));
assert(decoded.length === 2 && decoded.every(Boolean), 'both returned image BLOBs must decode in the browser');
await page.screenshot({ path: screenshot.replace('.png', '-uploaded.png') });

await page.getByRole('button', { name: 'Mover owner-e2e-blue.jpg hacia arriba' }).click();
await page.getByText('Orden de imágenes actualizado.', { exact: true }).waitFor();
order = await imageOrder();
assert(order[0].includes('1. owner-e2e-blue.jpg') && order[1].includes('2. owner-e2e-red.jpg'), 'reorder must update visible positions');
await page.reload();
await selectListing();
await page.getByText('2. owner-e2e-red.jpg').waitFor();
order = await imageOrder();
assert(order[0].includes('1. owner-e2e-blue.jpg') && order[1].includes('2. owner-e2e-red.jpg'), 'reorder must persist after reload');
const src = await page.locator('.image-list img').first().getAttribute('src');
const imageResponse = await page.request.get(new URL(src, baseUrl).toString());
assert(imageResponse.status() === 200 && imageResponse.headers()['content-type'] === 'image/jpeg' && (await imageResponse.body()).length > 0, 'OWNER image byte endpoint must return the stored normalized JPEG');

await page.getByRole('button', { name: 'Eliminar owner-e2e-red.jpg' }).click();
await page.getByText('Imagen eliminada.', { exact: true }).waitFor();
order = await imageOrder();
assert(order.length === 1 && order[0].includes('1. owner-e2e-blue.jpg'), 'delete must compact remaining image position');
await page.reload();
await selectListing();
await page.getByText('1. owner-e2e-blue.jpg').waitFor();
order = await imageOrder();
assert(order.length === 1 && order[0].includes('owner-e2e-blue.jpg') && !order[0].includes('owner-e2e-red.jpg'), 'delete must persist after reload');
await page.screenshot({ path: screenshot });
return { result: 'PASS', title, checks: ['OWNER login', 'draft create', 'two synthetic uploads', 'browser image decode', 'image order', 'D1-backed reload persistence', 'authorized byte read', 'delete and dense compaction', 'delete persistence'] };
}
