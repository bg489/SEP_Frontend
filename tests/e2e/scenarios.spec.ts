import { readFile } from 'node:fs/promises';
import { test, expect, content, ids } from './fixtures';

test.beforeEach(async ({ workspace: page }) => {
  await page.locator('aside').getByRole('button', { name: 'Scenario library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Canonical scenario workspace' })).toBeVisible();
  await expect(page.locator('.team-scenario-cards')).toHaveAttribute('aria-busy', 'false');
});

test('search and filters reset pagination and show matching scenarios', async ({ workspace: page, backend }) => {
  const repository = page.locator('.team-repository');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.team-pagination')).toContainText('2 / 2');

  const response = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/v1/scenarios' && url.searchParams.get('q') === 'Rain';
  });
  await repository.getByLabel('Search name or code').fill('Rain');
  expect(new URL((await response).url()).searchParams.get('page')).toBe('1');
  await repository.getByRole('combobox', { name: 'Map', exact: true }).selectOption('Town01');
  await repository.getByRole('combobox', { name: 'Weather', exact: true }).selectOption('HardRainNoon');
  await repository.getByRole('checkbox', { name: /^rain/ }).check();
  await expect.poll(() => backend.requests.some(request => {
    const url = new URL(request.url());
    return url.pathname === '/api/v1/scenarios' && url.searchParams.get('q') === 'Rain'
      && url.searchParams.get('map') === 'Town01' && url.searchParams.get('weather') === 'HardRainNoon'
      && url.searchParams.getAll('tag').includes('rain') && url.searchParams.get('page') === '1';
  })).toBe(true);
  await expect(page.locator('.team-scenario-cards')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.team-scenario-card')).toHaveCount(1);
  await expect(page.locator('.team-scenario-card')).toContainText('Rain crossing');
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await repository.getByLabel('Search name or code').fill('does not exist');
  await expect(repository.getByText('No scenarios match these filters.')).toBeVisible();
});

test('create a scenario from a situation template', async ({ workspace: page }) => {
  await page.getByRole('button', { name: 'New scenario', exact: true }).click();
  const form = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Create scenario draft' }) });
  await form.getByRole('radio', { name: /Lead vehicle braking/ }).check();
  await expect(form.getByLabel('Name', { exact: true })).toHaveValue('Lead vehicle braking');
  await expect(form.getByRole('combobox', { name: 'Category', exact: true })).toHaveValue('following');
  await form.getByLabel('Name', { exact: true }).fill('  Browser braking scenario  ');
  await form.getByLabel('Description', { exact: true }).fill('Created in a browser test');
  const request = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/scenarios');
  await form.getByRole('button', { name: 'Create draft', exact: true }).click();
  expect((await request).postDataJSON()).toEqual({ name: 'Browser braking scenario', description: 'Created in a browser test', category: 'following', template: 'lead_vehicle_brake' });
  await expect(page.getByRole('heading', { name: 'Browser braking scenario', exact: true })).toBeVisible();
  await expect(page.getByLabel('Full canonical scenario JSON')).toBeEditable();
  await expect(form).toHaveCount(0);
});

test('save and validate a draft with its revision, then publish an immutable READY version', async ({ workspace: page }) => {
  await page.getByRole('button', { name: /SCN-00001.*Draft crossing/ }).click();
  const editor = page.getByLabel('Full canonical scenario JSON');
  const publish = page.getByRole('button', { name: 'Publish READY version', exact: true });
  await expect(publish).toBeDisabled();
  const edited = { ...content, metadata: { name: 'Updated draft', description: 'Edited through the browser' } };
  await editor.fill(JSON.stringify(edited, null, 2));
  await page.getByLabel('Publication change note').fill('Reviewed crossing route');
  const save = page.waitForRequest(request => request.method() === 'PUT' && request.url().endsWith(`/scenarios/${ids.draft}/draft`));
  await page.getByRole('button', { name: 'Save and validate', exact: true }).click();
  const saved = await save;
  expect(saved.headers()['if-match']).toBe('"1"');
  expect(saved.postDataJSON()).toEqual({ content: edited });
  await expect(page.getByRole('heading', { name: 'Validation passed' })).toBeVisible();
  await expect(page.locator('.team-definition-heading')).toContainText('revision 2');
  const publication = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith(`/scenarios/${ids.draft}/versions`));
  await publish.click();
  expect((await publication).postDataJSON()).toEqual({ changeNote: 'Reviewed crossing route' });
  await expect(page.locator('.team-success')).toHaveText('Immutable READY version published.');
  await expect(editor).toHaveAttribute('readonly', '');
  expect(JSON.parse(await editor.inputValue())).toEqual(edited);
  await expect(page.getByRole('button', { name: 'Create draft', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Versions and handoff', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'v1' }).filter({ hasText: 'READY' })).toHaveCount(1);
});

test('invalid JSON cannot be saved or validated and remains in the editor', async ({ workspace: page, backend }) => {
  await page.getByRole('button', { name: /SCN-00001.*Draft crossing/ }).click();
  await page.getByLabel('Full canonical scenario JSON').fill('{ invalid JSON');
  await expect(page.getByText('JSON is incomplete or invalid. Fix its syntax before saving; your text is preserved.')).toBeVisible();
  for (const name of ['Save draft', 'Save and validate', 'Publish READY version']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  }
  await expect(page.getByLabel('Full canonical scenario JSON')).toHaveValue('{ invalid JSON');
  expect(backend.requests.filter(request => ['PUT', 'POST'].includes(request.method()))).toHaveLength(0);
});

test('validation errors block publishing and warnings require acknowledgement', async ({ workspace: page, backend }) => {
  await page.getByRole('button', { name: /SCN-00001.*Draft crossing/ }).click();
  backend.validation = { ...backend.validation, isValid: false, errors: [{ tier: 'BUSINESS', path: '/route/goal', message: 'Route goal must differ from start.' }] };
  await page.getByRole('button', { name: 'Save and validate', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configuration needs changes' })).toBeVisible();
  await expect(page.locator('.team-validation')).toContainText('Route goal must differ from start.');
  const publish = page.getByRole('button', { name: 'Publish READY version', exact: true });
  await expect(publish).toBeDisabled();

  backend.validation = { ...backend.validation, isValid: true, errors: [], warnings: [{ tier: 'CARLA', path: '/map', message: 'Review runtime map availability.' }] };
  await page.getByRole('button', { name: 'Save and validate', exact: true }).click();
  await expect(page.locator('.team-validation')).toContainText('Review runtime map availability.');
  await expect(publish).toBeDisabled();
  await page.getByRole('checkbox', { name: /^I reviewed these warnings/ }).check();
  await expect(publish).toBeEnabled();
  await page.getByLabel('Full canonical scenario JSON').fill(JSON.stringify({ ...content, execution: { timeout_s: 90 } }));
  await expect(publish).toBeDisabled();
  await expect(page.locator('.team-validation')).toHaveCount(0);
});

test('revision conflict preserves unsaved JSON and shows the backend error', async ({ workspace: page, backend }) => {
  await page.getByRole('button', { name: /SCN-00001.*Draft crossing/ }).click();
  const edited = JSON.stringify({ ...content, execution: { timeout_s: 120 } }, null, 2);
  await page.getByLabel('Full canonical scenario JSON').fill(edited);
  backend.failNext('PUT', `/api/v1/scenarios/${ids.draft}/draft`, 409, 'CONCURRENCY_CONFLICT: reload the latest draft.');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('CONCURRENCY_CONFLICT');
  await expect(page.getByLabel('Full canonical scenario JSON')).toHaveValue(edited);
  await expect(page.locator('.team-definition-heading')).toContainText('revision 1 *');
  await expect(page.getByRole('button', { name: 'Publish READY version', exact: true })).toBeDisabled();
  await expect(page.locator('.team-success')).toHaveCount(0);
});

test('archive and restore a scenario from the repository', async ({ workspace: page }) => {
  await page.getByRole('button', { name: /SCN-00002.*Rain crossing/ }).click();
  await page.getByRole('button', { name: 'Archive scenario', exact: true }).click();
  await expect(page.locator('.team-definition-heading')).toContainText('ARCHIVED');
  await expect(page.getByLabel('Scenario name', { exact: true })).toBeDisabled();
  await page.locator('.team-repository').getByLabel('Lifecycle').selectOption('ARCHIVED');
  await expect(page.locator('.team-scenario-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Restore scenario', exact: true }).click();
  await expect(page.locator('.team-definition-heading')).toContainText('ACTIVE');
  await page.locator('.team-repository').getByLabel('Lifecycle').selectOption('ACTIVE');
  await expect(page.getByRole('button', { name: /SCN-00002.*Rain crossing/ })).toBeVisible();
});

test('export the saved draft as a JSON download', async ({ workspace: page }) => {
  await page.getByRole('button', { name: /SCN-00001.*Draft crossing/ }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(`${ids.draft}-draft.json`);
  expect(JSON.parse(await readFile((await download.path())!, 'utf8'))).toEqual(content);
});
