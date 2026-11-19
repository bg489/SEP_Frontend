import { readFile } from 'node:fs/promises';
import { test, expect, ids, content } from './fixtures';

test.beforeEach(async ({ workspace: page }) => {
  await page.locator('aside').getByRole('button', { name: 'Scenario library', exact: true }).click();
  await expect(page.locator('.team-scenario-cards')).toHaveAttribute('aria-busy', 'false');
});

for (const [format, filename, source] of [
  ['json', 'import.json', JSON.stringify(content)], ['yaml', 'import.yaml', 'schema_version: "1.0"'],
  ['openscenario', 'import.xosc', '<OpenSCENARIO><FileHeader description="CARLA:Town01" /></OpenSCENARIO>'],
]) {
  test(`FE-UI-014 ${format} import keeps the file on error and opens only an accepted draft`, async ({ workspace: page, backend }) => {
    let accepted = false;
    await page.route('**/api/v1/scenarios/import', async route => {
      if (!accepted) return route.fulfill({ status: 422, json: { title: 'Import validation failed', detail: 'Review the scenario metadata.' } });
      const scenario = backend.scenarios.get(ids.draft)!; scenario.name = 'Imported scenario';
      expect(route.request().headers()['content-type']).toContain('multipart/form-data');
      expect(route.request().postData()).toContain(filename);
      return route.fulfill({ status: 201, json: { importRecordId: 'import-1', format, originalFileName: filename, originalHash: 'source-hash',
        scenario, report: { mapped: ['map'], ignored: [], defaulted: [], warnings: [] } } });
    });
    await page.getByRole('button', { name: 'Import file', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Import scenario', exact: true });
    await form.getByRole('combobox', { name: 'Format', exact: true }).selectOption(format);
    await form.getByLabel('Scenario file', { exact: true }).setInputFiles({ name: filename, mimeType: 'application/octet-stream', buffer: Buffer.from(source) });
    await form.getByLabel('Optional scenario name').fill('Imported scenario');
    await form.getByRole('button', { name: 'Import draft', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Review the scenario metadata.');
    await expect(form.getByLabel('Optional scenario name')).toHaveValue('Imported scenario');
    expect(await form.getByLabel('Scenario file', { exact: true }).evaluate((input: HTMLInputElement) => input.files?.[0].name)).toBe(filename);
    accepted = true; await form.getByRole('button', { name: 'Import draft', exact: true }).click();
    await expect(form).toHaveCount(0); await expect(page.getByRole('heading', { name: 'Imported scenario', exact: true })).toBeVisible();
    await expect(page.getByLabel('Full canonical scenario JSON')).toBeEditable();
  });
}

test('FE-UI-016 version diff, tags and paginated history use the selected scenario', async ({ workspace: page, backend }) => {
  const original = backend.scenarios.get(ids.rain)!;
  const first = original.latestVersion!; const second = { ...first, id: first.id.replace(/.$/, '9'), versionNumber: 2, contentHash: 'hash-v2' };
  original.latestVersion = second;
  await page.route(`**/api/v1/scenarios/${ids.rain}/versions**`, route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/diff')) {
      expect(url.searchParams.get('from')).toBe('1'); expect(url.searchParams.get('to')).toBe('2');
      return route.fulfill({ json: { scenarioId: ids.rain, fromVersion: 1, toVersion: 2, executionChanged: true,
        changes: [{ path: '/ego_vehicle/target_speed_kmh', change: 'modified', before: 20, after: 30 }] } });
    }
    if (/\/versions\/\d+$/.test(url.pathname)) return route.fulfill({ json: { summary: url.pathname.endsWith('/1') ? first : second, content } });
    return route.fulfill({ json: [second, first] });
  });
  await page.route(`**/api/v1/scenarios/${ids.rain}/history**`, route => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page'));
    return route.fulfill({ json: { page: pageNumber, pageSize: 20, totalCount: 21, totalPages: 2, items: [{ id: pageNumber, at: '2026-11-19T00:00:00Z',
      action: pageNumber === 1 ? 'TAG_REPLACED' : 'SCENARIO_CREATED', entityType: 'Scenario', entityId: ids.rain,
      actor: { id: 'actor', displayName: 'Recorded reviewer', email: null }, versionNumber: null, relatedScenario: null, details: { tags: ['night'] } }] } });
  });
  await page.getByRole('button', { name: /SCN-00002.*Rain crossing/ }).click();
  await page.getByLabel('Repository tags', { exact: false }).fill('night, rain');
  await page.getByRole('button', { name: 'Save tags', exact: true }).click();
  await expect(page.locator('.team-success')).toHaveText('Repository tags saved.');
  expect(backend.scenarios.get(ids.rain)!.tags).toEqual(['night', 'rain']);
  await page.getByRole('button', { name: 'Versions and handoff', exact: true }).click();
  await page.getByRole('combobox', { name: 'Read a historical definition', exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'View original JSON', exact: true }).click();
  await expect(page.locator('.team-result').filter({ hasText: 'Immutable version definition' })).toContainText('v1');
  await page.getByRole('combobox', { name: 'From', exact: true }).selectOption('1'); await page.getByRole('combobox', { name: 'To', exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Compare versions', exact: true }).click();
  await expect(page.locator('.team-result').filter({ hasText: 'Version differences' })).toContainText('/ego_vehicle/target_speed_kmh');
  await page.getByRole('button', { name: 'Activity history', exact: true }).click();
  await expect(page.locator('.team-history-event')).toContainText('TAG_REPLACED');
  const history = page.locator('div[aria-busy]').filter({ has: page.getByLabel('History page size') });
  await history.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.team-history-event')).toContainText('SCENARIO_CREATED');
});

test('FE-UI-015 parameter batches reject oversized grids, retain provenance and download exact server JSON', async ({ workspace: page, backend }) => {
  const base = backend.scenarios.get(ids.rain)!;
  const batch = { id: 'batch-a', baseVersionId: base.latestVersion!.id, strategy: 'pairwise', parameterGrid: { speed: [20, 30] }, cartesianCount: 2,
    requestedCount: 2, generatedCount: 2, note: 'Pairwise evidence', createdBy: 'tester', createdAt: '2026-11-19T00:00:00Z' };
  const result = { batch, scenarios: [{ id: ids.draft, code: 'SCN-00001', name: 'Draft crossing', status: 'ACTIVE', hasDraft: true, latestVersionNumber: 0 }] };
  let generated = false;
  await page.route(`**/api/v1/scenarios/${ids.rain}/versions/1/variant-batches**`, async route => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON();
      if (input.parameterGrid.speed.length > 100) return route.fulfill({ status: 422, json: { title: 'Maximum 100 variants allowed.' } });
      expect(input.strategy).toBe('pairwise'); generated = true; return route.fulfill({ status: 201, json: result });
    }
    return route.fulfill({ json: route.request().url().endsWith('/batch-a') ? result : generated ? [batch] : [] });
  });
  await page.getByRole('button', { name: /SCN-00002.*Rain crossing/ }).click();
  await page.getByRole('button', { name: 'Parameter variants', exact: true }).click();
  await page.getByRole('combobox', { name: 'Generation strategy', exact: true }).selectOption('pairwise');
  const grid = page.getByLabel('Parameter grid JSON');
  await grid.fill(JSON.stringify({ speed: Array.from({ length: 101 }, (_, i) => i) }));
  await page.getByRole('button', { name: 'Generate variants', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Maximum 100');
  await grid.fill(JSON.stringify({ speed: [20, 30] }));
  await page.getByRole('button', { name: 'Generate variants', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Generated draft scenarios', exact: true })).toBeVisible();
  await expect(page.locator('.team-batch')).toContainText('2/2');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download variant batch JSON', exact: true }).click();
  const download = await downloadEvent; expect(JSON.parse(await readFile((await download.path())!, 'utf8'))).toEqual(result);
});
