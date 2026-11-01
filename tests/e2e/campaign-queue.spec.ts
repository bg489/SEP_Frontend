import {
  test, expect, ids, runIds, timestamp, queuedNotice, resultPath,
  openSection, openQueue, campaignRow, resultPanel,
} from './operations.fixtures';

test.use({ devRole: 'TEST_ENGINEER' });

test('FE-UT-046: campaign API failure is visible and Refresh recovers the library', async ({ workspace: page, operations }) => {
  await openSection(page, 'Campaigns');
  await expect(campaignRow(page)).toBeVisible();
  operations.failNext('GET', '/api/v1/campaigns', 503, 'Campaign library is unavailable.');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Campaign library is unavailable.');
  await expect(campaignRow(page)).toBeVisible();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(campaignRow(page)).toContainText('Draft');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('FE-UT-046: failed campaign update preserves the edited form and does not announce success', async ({ workspace: page, operations }) => {
  await openSection(page, 'Campaigns');
  await campaignRow(page).getByRole('button', { name: 'Edit', exact: true }).click();
  const form = page.getByRole('form', { name: 'Campaign builder' });
  await form.getByLabel('Campaign name', { exact: true }).fill('Retry edited campaign');
  operations.failNext('PATCH', `/api/v1/campaigns/${ids.campaign}`, 409, 'Campaign changed on the server.');
  await form.getByRole('button', { name: 'Save campaign', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('Campaign changed on the server.');
  await expect(form.getByLabel('Campaign name', { exact: true })).toHaveValue('Retry edited campaign');
  await expect(form.locator('.ops-selection-row')).toHaveCount(2);
  await expect(page.getByRole('status').filter({ hasText: 'Campaign saved to the backend.' })).toHaveCount(0);
  await form.getByRole('button', { name: 'Save campaign', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(campaignRow(page, 'Retry edited campaign')).toBeVisible();
});

test('FE-UT-052: failed rerun keeps its confirmation open and reports no queued-run success', async ({ workspace: page, operations }) => {
  await openSection(page, 'Campaigns');
  await campaignRow(page, 'Completed campaign').getByRole('button', { name: 'Rerun…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rerun campaign?' });
  await dialog.getByRole('checkbox', { name: 'I understand that the existing run history will be deleted.', exact: true }).check();
  operations.failNext('POST', `/api/v1/campaigns/${ids.completed}/rerun`, 503, 'Rerun service is unavailable.');
  await dialog.getByRole('button', { name: 'Delete old runs & rerun', exact: true }).click();
  await expect(dialog).toContainText('Rerun service is unavailable.');
  await expect(page.getByRole('status').filter({ hasText: queuedNotice })).toHaveCount(0);
  await expect(page.locator('.toast').filter({ hasText: queuedNotice })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Scenario runs', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Delete old runs & rerun', exact: true })).toBeEnabled();
});

test('FE-UT-052: Start stays pending until the backend creates the queued runs', async ({ workspace: page, backend, operations }) => {
  await openSection(page, 'Campaigns');
  const path = `/api/v1/campaigns/${ids.campaign}/start`;
  const held = operations.holdNext('POST', path);
  const start = campaignRow(page).getByRole('button', { name: 'Start', exact: true });
  await start.click();
  await held.received;
  await expect(start).toBeDisabled();
  expect(backend.campaigns.get(ids.campaign)!.runCount).toBe(0);
  await expect(page.getByRole('status').filter({ hasText: queuedNotice })).toHaveCount(0);
  await expect(page.locator('.toast').filter({ hasText: queuedNotice })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Scenario runs', exact: true })).toHaveCount(0);
  expect(operations.matching('POST', path)).toHaveLength(1);

  await held.release();
  await expect(page.getByRole('heading', { name: 'Scenario runs', exact: true })).toBeVisible();
  expect(backend.campaigns.get(ids.campaign)!.runCount).toBe(2);
  await expect(page.locator('.toast')).toContainText(queuedNotice);
  await expect(page.getByRole('row').filter({ hasText: 'Rain crossing' }).filter({ hasText: 'Pending' })).toContainText('Queued');
  await expect(page.getByRole('row').filter({ hasText: 'Highway braking' }).filter({ hasText: 'Pending' })).toContainText('Queued');
  await expect(resultPanel(page)).toContainText('Awaiting oracle');
  await expect(page.locator('.ops-evaluation')).toHaveCount(0);
});

for (const failure of ['API', 'network'] as const) {
  test(`FE-UT-052: ${failure} failure cannot report Start success and the user can retry`, async ({ workspace: page, backend, operations }) => {
    await openSection(page, 'Campaigns');
    const path = `/api/v1/campaigns/${ids.campaign}/start`;
    if (failure === 'API') operations.failNext('POST', path, 503, 'Queue service is unavailable.');
    else operations.abortNext('POST', path);
    await campaignRow(page).getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(failure === 'API' ? 'Queue service is unavailable.' : 'Cannot connect to the team backend.');
    expect(backend.campaigns.get(ids.campaign)!.runCount).toBe(0);
    await expect(page.getByRole('status').filter({ hasText: queuedNotice })).toHaveCount(0);
    await expect(page.locator('.toast').filter({ hasText: queuedNotice })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Scenario runs', exact: true })).toHaveCount(0);
    await expect(campaignRow(page).getByRole('button', { name: 'Start', exact: true })).toBeEnabled();
    await campaignRow(page).getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Scenario runs', exact: true })).toBeVisible();
    expect(backend.campaigns.get(ids.campaign)!.runCount).toBe(2);
    expect(operations.matching('POST', path)).toHaveLength(2);
  });
}

test('FE-UT-053: polling displays backend queue progress and only the returned oracle verdict', async ({ workspace: page, operations }) => {
  operations.queue();
  await page.clock.install();
  await openQueue(page);
  const rain = () => page.getByRole('row').filter({ hasText: 'Rain crossing' }).filter({ has: page.getByRole('button', { name: 'Inspect', exact: true }) });
  await expect(rain()).toContainText('Queued');
  await expect(resultPanel(page)).toContainText('Awaiting oracle');
  const runs = operations.runs(ids.campaign);
  operations.runLists.set(ids.campaign, [{ ...runs[0], status: 'Running', startedAt: timestamp }, runs[1]]);
  await page.clock.fastForward(5000);
  await expect(rain()).toContainText('Running');
  await expect(rain()).toContainText('Pending');
  await expect(resultPanel(page)).toContainText('Awaiting oracle');

  operations.runLists.set(ids.campaign, [{ ...runs[0], status: 'Completed', verdict: 'FAIL', finishedAt: timestamp }, runs[1]]);
  await page.clock.fastForward(5000);
  await expect(rain()).toContainText('Completed');
  await expect(rain()).toContainText('FAIL');
  await expect(resultPanel(page).locator('.ops-verdict.large')).toHaveText('FAIL');
  await expect(resultPanel(page).locator('.ops-verdict.large')).not.toHaveText('PASS');
});

test('FE-UT-053: a slow result for the previous run cannot overwrite the inspected run', async ({ workspace: page, operations }) => {
  operations.queue();
  const oldResult = operations.holdNext('GET', resultPath(runIds.rain));
  await openQueue(page);
  await oldResult.received;
  await page.getByRole('row').filter({ hasText: 'Highway braking' }).getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(resultPanel(page)).toContainText(runIds.highway);
  await expect(resultPanel(page).getByRole('heading', { name: 'Highway braking · v1', exact: true })).toBeVisible();
  await oldResult.release();
  await expect(resultPanel(page)).toContainText(runIds.highway);
  await expect(resultPanel(page)).not.toContainText(runIds.rain);
});

test('FE-UT-053: a slow run list from the previous campaign cannot replace the current queue', async ({ workspace: page, operations }) => {
  operations.queue();
  const oldRuns = operations.holdNext('GET', `/api/v1/campaigns/${ids.campaign}/runs`);
  await openQueue(page);
  await oldRuns.received;
  await page.getByRole('button', { name: 'Completed campaign', exact: true }).click();
  await expect(resultPanel(page)).toContainText(runIds.completed);
  await oldRuns.release();
  await expect(resultPanel(page)).toContainText(runIds.completed);
  await expect(page.getByRole('button', { name: 'Inspect', exact: true })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: 'Highway braking' })).toHaveCount(0);
});

test('FE-UT-053: a result API error clears the previous evidence and polling can recover', async ({ workspace: page, operations }) => {
  operations.queue();
  await page.clock.install();
  await openQueue(page);
  await expect(resultPanel(page)).toContainText(runIds.rain);
  operations.failNext('GET', resultPath(runIds.highway), 500, 'Oracle result is unavailable.');
  await page.getByRole('row').filter({ hasText: 'Highway braking' }).getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Oracle result is unavailable.');
  await expect(resultPanel(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Watch camera video', exact: true })).toHaveCount(0);
  await page.clock.fastForward(5000);
  await expect(resultPanel(page)).toContainText(runIds.highway);
  await expect(resultPanel(page)).not.toContainText(runIds.rain);
});
