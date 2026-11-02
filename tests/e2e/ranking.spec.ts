import { test, expect, ids, rankPath, openSection } from './operations.fixtures';

test.use({ devRole: 'TEST_ENGINEER' });
test.beforeEach(async ({ workspace: page }) => {
  await openSection(page, 'Prioritization');
  await expect(page.getByRole('heading', { name: 'Rank the execution suite', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Campaign', exact: true })).toHaveValue(ids.campaign);
});

test('FE-UT-047: calculate backend ranking, show estimates and save the returned version order', async ({ workspace: page, operations }) => {
  await page.getByRole('button', { name: 'Calculate ranking', exact: true }).click();
  const ranking = page.locator('.ops-ranking');
  await expect(ranking).toBeVisible();
  expect(operations.matching('POST', rankPath)[0].postDataJSON()).toEqual({
    scenarioVersionIds: ['00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103'],
    strategy: 'proposed_failure_history', params: { seed: 42, riskWeight: 0.55, diversityWeight: 0.45, limit: 40 },
  });
  await expect(ranking.locator('tbody tr').first()).toContainText('Highway braking');
  await expect(ranking.locator('tbody tr').last()).toContainText('Rain crossing');
  await expect(ranking.locator('.ops-metrics')).toContainText('APFD (estimate)');
  await expect(ranking.locator('.ops-metrics')).toContainText('0.825');
  await expect(ranking.locator('.ops-metrics')).toContainText('0.750');
  await expect(ranking).toContainText('Content-based heuristic estimates only.');
  await ranking.getByText('Feature names and distance matrix', { exact: true }).click();
  await expect(ranking.locator('pre').first()).toContainText('risk');
  const update = page.waitForRequest(request => request.method() === 'PATCH' && new URL(request.url()).pathname === `/api/v1/campaigns/${ids.campaign}`);
  await page.getByRole('button', { name: 'Save order to campaign', exact: true }).click();
  expect((await update).postDataJSON()).toEqual({
    strategy: 'proposed_failure_history',
    scenarioVersionIds: ['00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000102'],
  });
  await expect(page.getByRole('status').filter({ hasText: 'Ranked execution order saved to the campaign.' })).toBeVisible();
  await expect(ranking).toHaveCount(0);
});

for (const change of [
  { name: 'strategy', label: 'Strategy', value: 'random', select: true },
  { name: 'seed', label: 'Random seed (32-bit integer)', value: '17' },
  { name: 'risk weight', label: 'Risk weight', value: '0.8' },
  { name: 'diversity weight', label: 'Diversity weight', value: '0.2' },
  { name: 'campaign', label: 'Campaign', value: ids.completed, select: true },
  { name: 'scenario source', label: 'Scenario source', value: 'ready', select: true },
]) {
  test(`FE-UT-048: changing ${change.name} discards the displayed ranking and its save action`, async ({ workspace: page }) => {
    await page.getByRole('button', { name: 'Calculate ranking', exact: true }).click();
    await expect(page.locator('.ops-ranking')).toBeVisible();
    const input = change.select
      ? page.getByRole('combobox', { name: change.label, exact: true })
      : page.getByLabel(change.label, { exact: false });
    if (change.select) await input.selectOption(change.value);
    else await input.fill(change.value);
    await expect(page.locator('.ops-ranking')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save order to campaign', exact: true })).toHaveCount(0);
  });
}

test('FE-UT-048: changing the READY limit invalidates the previous automatic ranking', async ({ workspace: page, operations }) => {
  await page.getByRole('combobox', { name: 'Scenario source', exact: true }).selectOption('ready');
  const limit = page.getByLabel('Maximum latest READY versions (1–100)', { exact: false });
  await limit.fill('2');
  await page.getByRole('button', { name: 'Calculate ranking', exact: true }).click();
  await expect(page.locator('.ops-ranking tbody tr')).toHaveCount(2);
  expect(operations.matching('POST', rankPath)[0].postDataJSON()).toMatchObject({ scenarioVersionIds: [], params: { limit: 2 } });
  await expect(page.getByRole('button', { name: 'Save order to campaign', exact: true })).toHaveCount(0);
  await limit.fill('3');
  await expect(page.locator('.ops-ranking')).toHaveCount(0);
});

test('FE-UT-048: refreshing changed campaign versions discards its old ranking', async ({ workspace: page, backend }) => {
  await page.getByRole('button', { name: 'Calculate ranking', exact: true }).click();
  await expect(page.locator('.ops-ranking')).toBeVisible();
  const campaign = backend.campaigns.get(ids.campaign)!;
  const versionId = campaign.scenarioVersionIds[0];
  backend.campaigns.set(ids.campaign, {
    ...campaign, scenarioVersionIds: [versionId], scenarios: campaign.scenarios.filter(item => item.scenarioVersionId === versionId),
  });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('.ops-ranking')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save order to campaign', exact: true })).toHaveCount(0);
});

test('FE-UT-048: changing explicit version IDs invalidates their ranking and duplicate IDs are removed', async ({ workspace: page, operations }) => {
  await page.getByRole('combobox', { name: 'Scenario source', exact: true }).selectOption('versions');
  const versions = page.getByLabel('Scenario version UUIDs (up to 100)', { exact: false });
  const rain = '00000000-0000-4000-8000-000000000102', highway = '00000000-0000-4000-8000-000000000103';
  await versions.fill(`${rain}, ${highway}\n${rain}`);
  await page.getByRole('button', { name: 'Calculate ranking', exact: true }).click();
  await expect(page.locator('.ops-ranking tbody tr')).toHaveCount(2);
  expect(operations.matching('POST', rankPath)[0].postDataJSON().scenarioVersionIds).toEqual([rain, highway]);
  await versions.fill(highway);
  await expect(page.locator('.ops-ranking')).toHaveCount(0);
});

test('FE-UT-048: a late ranking response for old inputs is not displayed or applied', async ({ workspace: page, operations }) => {
  const oldRanking = operations.holdNext('POST', rankPath);
  const calculate = page.getByRole('button', { name: 'Calculate ranking', exact: true });
  await calculate.click();
  await oldRanking.received;
  await expect(calculate).toBeDisabled();
  await page.getByLabel('Random seed (32-bit integer)', { exact: true }).fill('99');
  await oldRanking.release();
  await expect(calculate).toBeEnabled();
  await expect(page.locator('.ops-ranking')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save order to campaign', exact: true })).toHaveCount(0);
  await calculate.click();
  await expect(page.locator('.ops-ranking')).toBeVisible();
  expect(operations.matching('POST', rankPath)[1].postDataJSON().params.seed).toBe(99);
});

test('FE-UT-047: ranking and save API errors remain errors and can be retried', async ({ workspace: page, operations }) => {
  operations.failNext('POST', rankPath, 503, 'Ranking service is unavailable.');
  await page.getByRole('button', { name: 'Calculate ranking', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Ranking service is unavailable.');
  await expect(page.locator('.ops-ranking')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save order to campaign', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Calculate ranking', exact: true }).click();
  await expect(page.locator('.ops-ranking')).toBeVisible();
  operations.failNext('PATCH', `/api/v1/campaigns/${ids.campaign}`, 409, 'Campaign order is locked.');
  await page.getByRole('button', { name: 'Save order to campaign', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Campaign order is locked.');
  await expect(page.locator('.ops-ranking')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Ranked execution order saved to the campaign.' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save order to campaign', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ranked execution order saved to the campaign.' })).toBeVisible();
});

test('FE-UT-047: completed campaigns can be ranked but their execution order is locked', async ({ workspace: page }) => {
  await page.getByRole('combobox', { name: 'Campaign', exact: true }).selectOption(ids.completed);
  await page.getByRole('button', { name: 'Calculate ranking', exact: true }).click();
  await expect(page.locator('.ops-ranking')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save order to campaign', exact: true })).toBeDisabled();
});

test('FE-UT-047: invalid rank parameters and version UUIDs cannot reach the API', async ({ workspace: page, operations }) => {
  const calculate = page.getByRole('button', { name: 'Calculate ranking', exact: true });
  await page.getByLabel('Risk weight', { exact: true }).fill('1.5');
  await expect(calculate).toBeDisabled();
  await page.getByLabel('Risk weight', { exact: true }).fill('0.55');
  await page.getByLabel('Random seed (32-bit integer)', { exact: true }).fill('1.5');
  await expect(calculate).toBeDisabled();
  await page.getByLabel('Random seed (32-bit integer)', { exact: true }).fill('42');
  await page.getByRole('combobox', { name: 'Scenario source', exact: true }).selectOption('versions');
  await expect(calculate).toBeDisabled();
  await page.getByLabel('Scenario version UUIDs (up to 100)', { exact: false }).fill('invalid-version-id');
  await calculate.click();
  await expect(page.getByRole('alert')).toContainText('Enter up to 100 valid scenario version UUIDs');
  expect(operations.matching('POST', rankPath)).toHaveLength(0);
});
