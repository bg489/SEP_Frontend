import { test, expect, ids } from './fixtures';

test.use({ devRole: 'TEST_ENGINEER' });
test.beforeEach(async ({ workspace: page }) => {
  await page.locator('aside').getByRole('button', { name: 'Campaigns', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Campaign library', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Safety regression', exact: true })).toBeVisible();
});

test('search campaigns by name or status and show an empty search result', async ({ workspace: page }) => {
  const search = page.getByPlaceholder('Search name, code or status…');
  await search.fill('Safety');
  await expect(page.getByRole('button', { name: 'Safety regression', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Completed campaign', exact: true })).toHaveCount(0);
  await search.fill('Completed');
  await expect(page.getByRole('button', { name: 'Completed campaign', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Safety regression', exact: true })).toHaveCount(0);
  await search.fill('missing campaign');
  await expect(page.getByText('No campaign matches your search.')).toBeVisible();
});

test('build a campaign with READY versions, preserve selection across filters, reorder and save SUT settings', async ({ workspace: page }) => {
  await page.getByRole('button', { name: 'Build campaign', exact: true }).click();
  const form = page.getByRole('form', { name: 'Campaign builder' });
  const save = form.getByRole('button', { name: 'Save campaign', exact: true });
  await expect(save).toBeDisabled();
  await expect(form.getByRole('checkbox', { name: /Draft crossing/ })).toHaveCount(0);
  await form.getByLabel('Campaign name', { exact: true }).fill('  Browser campaign  ');
  await form.getByLabel('Description', { exact: true }).fill('Selected and ordered through the browser');
  await form.getByRole('combobox', { name: 'Strategy', exact: true }).selectOption('random');
  await form.getByRole('combobox', { name: 'Driving behavior', exact: true }).selectOption('cautious');
  await form.getByLabel('SUT CARLA version', { exact: false }).fill('0.9.16');
  await form.getByRole('checkbox', { name: /Rain crossing/ }).check();
  await form.getByLabel('Search', { exact: true }).fill('Highway');
  await form.getByRole('checkbox', { name: /Highway braking/ }).check();
  await expect(form.locator('.ops-selection-row')).toHaveCount(2);
  await form.locator('.ops-selection-row').filter({ hasText: 'Highway braking' }).getByRole('button', { name: 'Move up', exact: true }).click();
  await expect(form.locator('.ops-selection-row').first()).toContainText('Highway braking');
  await form.locator('.ops-selection-row').filter({ hasText: 'Rain crossing' }).getByRole('button', { name: 'Remove scenario', exact: true }).click();
  await form.getByLabel('Search', { exact: true }).fill('Rain');
  await form.getByRole('checkbox', { name: /Rain crossing/ }).check();

  const creation = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/campaigns');
  await save.click();
  expect((await creation).postDataJSON()).toEqual({
    name: 'Browser campaign', description: 'Selected and ordered through the browser', strategy: 'random',
    scenarioVersionIds: ['00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000102'],
    sutType: 'behavior_agent', sutBehavior: 'cautious', sutCarlaVersion: '0.9.16',
  });
  await expect(form).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Browser campaign', exact: true })).toBeVisible();
  await expect(page.locator('.ops-version-chips > span').first()).toContainText('Highway braking');
  await expect(page.getByRole('status').filter({ hasText: 'Campaign saved to the backend.' })).toBeVisible();
});

test('edit a draft campaign and switch its SUT to Autopilot', async ({ workspace: page }) => {
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Safety regression', exact: true }) });
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  const form = page.getByRole('form', { name: 'Campaign builder' });
  await expect(form.getByLabel('Campaign name', { exact: true })).toHaveValue('Safety regression');
  await form.getByLabel('Campaign name', { exact: true }).fill('Updated regression');
  await form.getByRole('combobox', { name: 'SUT agent', exact: true }).selectOption('autopilot');
  await expect(form.getByRole('combobox', { name: 'Driving behavior', exact: true })).toBeDisabled();
  const update = page.waitForRequest(request => request.method() === 'PATCH' && request.url().endsWith(`/campaigns/${ids.campaign}`));
  await form.getByRole('button', { name: 'Save campaign', exact: true }).click();
  expect((await update).postDataJSON()).toMatchObject({ name: 'Updated regression', sutType: 'autopilot', scenarioVersionIds: ['00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103'] });
  await expect(page.getByRole('row').filter({ hasText: 'Updated regression' })).toContainText('autopilot');
});

test('failed campaign creation keeps the builder values for a retry', async ({ workspace: page, backend }) => {
  await page.getByRole('button', { name: 'Build campaign', exact: true }).click();
  const form = page.getByRole('form', { name: 'Campaign builder' });
  await form.getByLabel('Campaign name', { exact: true }).fill('Retry campaign');
  await form.getByRole('checkbox', { name: /Rain crossing/ }).check();
  backend.failNext('POST', '/api/v1/campaigns', 503, 'Campaign service is unavailable.');
  await form.getByRole('button', { name: 'Save campaign', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('Campaign service is unavailable.');
  await expect(form.getByLabel('Campaign name', { exact: true })).toHaveValue('Retry campaign');
  await expect(form.getByRole('checkbox', { name: /Rain crossing/ })).toBeChecked();
  await expect(page.getByRole('status').filter({ hasText: 'Campaign saved to the backend.' })).toHaveCount(0);
  await form.getByRole('button', { name: 'Save campaign', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry campaign', exact: true })).toBeVisible();
});

test('start a campaign and inspect queued runs without an invented verdict', async ({ workspace: page }) => {
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Safety regression', exact: true }) });
  const start = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith(`/campaigns/${ids.campaign}/start`));
  await row.getByRole('button', { name: 'Start', exact: true }).click();
  await start;
  await expect(page.getByRole('heading', { name: 'Execution & evidence', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Scenario runs', exact: true })).toBeVisible();
  const run = page.getByRole('row').filter({ hasText: 'Rain crossing' }).filter({ hasText: 'Pending' });
  await expect(run).toContainText('Queued');
  await expect(page.getByText('Awaiting oracle', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Watch camera video', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download camera video', exact: true })).toBeDisabled();
  await expect(page.locator('.ops-evaluation')).toHaveCount(0);
});

test('rerun requires acknowledgement and cancellation sends no request', async ({ workspace: page, backend }) => {
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Completed campaign', exact: true }) });
  await expect(row.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await row.getByRole('button', { name: 'Rerun…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rerun campaign?' });
  const rerun = dialog.getByRole('button', { name: 'Queue a new attempt', exact: true });
  await expect(rerun).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(backend.requests.filter(request => request.url().endsWith('/rerun'))).toHaveLength(0);

  await row.getByRole('button', { name: 'Rerun…', exact: true }).click();
  await expect(rerun).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'I want to create another attempt and keep the existing evidence.' }).check();
  const request = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith(`/campaigns/${ids.completed}/rerun`));
  await rerun.click();
  await request;
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Execution & evidence', exact: true })).toBeVisible();
});
