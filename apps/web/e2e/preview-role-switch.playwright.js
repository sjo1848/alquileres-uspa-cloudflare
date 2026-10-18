// Focused local E2E for the Preview-only role selector and moderation journey.
// The test adapter turns the UI's Preview-session exchange into a local synthetic
// password login; Worker preview-auth tests separately verify signed Access JWTs.
async (page) => {
  const baseUrl = 'http://127.0.0.1:5199';
  const title = `Codex QA role switch ${Date.now()}`;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const rolesRequested = [];

  await page.unrouteAll({ behavior: 'wait' });
  await page.context().clearCookies();
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Contraseña').waitFor();
  assert(await page.getByRole('radio', { name: 'Administrador (demo)' }).count() === 0, 'password-auth UI must not expose the Preview demo role switch');

  await page.route('**/api/auth/config', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ strategy: 'ACCESS_PREVIEW' }),
  }));
  await page.route('**/api/auth/preview-session', async route => {
    const body = route.request().postDataJSON();
    assert(body && Object.keys(body).length === 1 && ['OWNER', 'ADMIN'].includes(body.role), 'UI must request only a fixed demo role');
    rolesRequested.push(body.role);
    const email = body.role === 'ADMIN' ? 'preview.admin@example.test' : 'preview.owner@example.test';
    const response = await route.fetch({
      url: `${baseUrl}/api/auth/login`, method: 'POST',
      headers: { Origin: baseUrl },
      data: { email, password: 'synthetic-owner-password-1' },
    });
    assert(response.ok(), `local synthetic identity adapter returned ${response.status()}`);
    await route.fulfill({ response });
  });

  async function chooseRole(role) {
    await page.getByLabel(role === 'ADMIN' ? 'Administrador (demo)' : 'Propietario (demo)').check();
    const button = role === 'ADMIN' ? 'Ingresar como administrador (demo)' : 'Ingresar como propietario (demo)';
    await page.getByRole('button', { name: button, exact: true }).click();
    await page.waitForURL(role === 'ADMIN' ? '**/admin' : '**/owner');
  }

  await page.goto(`${baseUrl}/login`);
  await page.getByRole('radio', { name: 'Propietario (demo)' }).waitFor();
  await chooseRole('OWNER');
  await page.getByRole('heading', { name: 'Mis publicaciones' }).waitFor();
  await page.getByRole('button', { name: '+ Nuevo borrador' }).click();
  await page.getByRole('textbox', { name: 'Título' }).fill(title);
  await page.getByRole('textbox', { name: 'Descripción' }).fill('Propiedad sintética para probar el cambio de identidad y publicación ADMIN.');
  await page.getByRole('textbox', { name: 'Ubicación' }).fill('Uspallata, Mendoza');
  await page.getByRole('spinbutton', { name: 'Importe' }).fill('25000');
  await page.getByRole('spinbutton', { name: 'Ocupantes máximos' }).fill('2');
  await page.getByRole('button', { name: 'Crear borrador' }).click();
  await page.getByText('Borrador creado.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await page.getByText('Publicación enviada a revisión.', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'Cambiar perfil de prueba' }).click();
  await page.getByRole('radio', { name: 'Propietario (demo)' }).waitFor();
  await chooseRole('ADMIN');
  await page.getByRole('heading', { name: 'Revisión de publicaciones' }).waitFor();
  await page.getByRole('button', { name: new RegExp(title) }).click();
  assert(await page.getByRole('link', { name: 'Revisión' }).count() === 1, 'ADMIN navigation must be visible after the synthetic ADMIN switch');
  assert(await page.getByRole('link', { name: 'Mis publicaciones' }).count() === 0, 'OWNER navigation must not remain visible in the ADMIN session');
  await page.getByRole('button', { name: 'Aprobar', exact: true }).click();
  await page.getByText('Publicación aprobada. Queda pendiente de publicación.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Publicar en catálogo' }).click();
  await page.getByText('Publicación visible en el catálogo.', { exact: true }).waitFor();
  await page.screenshot({ path: 'output/playwright/preview-admin-role-switch.png' });
  await page.getByRole('link', { name: 'Catálogo' }).click();
  await page.getByRole('heading', { name: title }).waitFor();

  assert(JSON.stringify(rolesRequested) === JSON.stringify(['OWNER', 'ADMIN']), 'the browser must explicitly request OWNER then ADMIN identities');
  await page.unrouteAll({ behavior: 'wait' });
  return {
    result: 'PASS',
    checks: [
      'Preview-only role choices are visible',
      'PASSWORD auth configuration does not expose demo role switching',
      'OWNER session creates and submits a synthetic listing',
      'explicit switch clears OWNER session and authenticates ADMIN demo identity',
      'ADMIN approves while listing remains unpublished',
      'separate ADMIN publish makes listing visible in public catalog',
    ],
    rolesRequested,
    title,
  };
}
