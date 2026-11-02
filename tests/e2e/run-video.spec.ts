import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import {
  test, expect, ids, runIds, timestamp, mp4, videoPath,
  openSection, openQueue, resultPanel,
} from './operations.fixtures';

test.use({ devRole: 'TEST_ENGINEER' });

async function openCompletedResult(page: Page) {
  await openQueue(page);
  await page.getByRole('button', { name: 'Completed campaign', exact: true }).click();
  await expect(resultPanel(page)).toContainText(runIds.completed);
}

async function openUploader(page: Page) {
  await openSection(page, 'Worker API tools');
  await page.getByRole('combobox', { name: 'Campaign', exact: true }).selectOption(ids.completed);
  await page.getByRole('combobox', { name: 'Run in this campaign', exact: true }).selectOption(runIds.completed);
  await expect(page.locator('.worker-protocol-target')).toContainText(runIds.completed);
  await page.getByText('Advanced: mutate the worker queue and submit recordings', { exact: true }).click();
  await page.getByRole('checkbox', { name: /^I understand these are real backend mutations/ }).check();
  await page.getByRole('checkbox', { name: 'I have checked the target run, scenario version and backend state.', exact: true }).check();
}

type VideoUrls = { created: string[]; revoked: string[] };
type VideoWindow = Window & typeof globalThis & { testVideoUrls: VideoUrls };

async function trackVideoUrls(page: Page) {
  await page.evaluate(() => {
    const state: VideoUrls = { created: [], revoked: [] };
    (window as VideoWindow).testVideoUrls = state;
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = create(blob); state.created.push(url); return url; };
    URL.revokeObjectURL = url => { state.revoked.push(url); revoke(url); };
  });
}

test('FE-UT-054: display backend oracle violations and download the exact result JSON', async ({ workspace: page, operations }) => {
  operations.results.set(runIds.completed, {
    verdict: 'FAIL', evaluations: [{
      id: 'oracle-evaluation', oracleConfigId: 'oracle-config', oracleVersion: 3, verdict: 'FAIL',
      errorReason: null, evaluatedAt: timestamp,
      violations: [{ id: 'collision-evidence', check: 'Collision', severity: 'Critical', t: 4.25,
        durationS: null, details: { actorId: 17, impulse: 42 } }],
    }],
  });
  await openCompletedResult(page);
  const result = resultPanel(page);
  await expect(result.locator('.ops-verdict.large')).toHaveText('FAIL');
  await expect(result.locator('.ops-evaluation')).toContainText('Oracle v3');
  await expect(result.locator('.ops-evaluation')).toContainText('Collision');
  await expect(result.locator('.ops-evaluation')).toContainText('Critical');
  await expect(result.locator('.ops-evaluation')).toContainText('4.25 s');
  await expect(result.locator('.ops-evidence-json')).toContainText('"actorId": 17');
  const download = page.waitForEvent('download');
  await result.getByRole('button', { name: 'Download result JSON', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`oracle-${runIds.completed}.json`);
  expect(JSON.parse(await readFile((await file.path())!, 'utf8'))).toEqual(operations.result(runIds.completed));
});

test('FE-UT-054: absent video disables preview and download without making a video request', async ({ workspace: page, operations }) => {
  await openCompletedResult(page);
  await expect(page.getByRole('button', { name: 'Watch camera video', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download camera video', exact: true })).toBeDisabled();
  await expect(resultPanel(page)).toContainText('No video has been uploaded for this run.');
  expect(operations.matching('GET', videoPath(runIds.completed))).toHaveLength(0);
});

test('FE-UT-054: preview fetches authenticated MP4 as a Blob, reports codec errors and revokes it on close', async ({ workspace: page, operations }) => {
  operations.results.set(runIds.completed, { hasVideo: true });
  await openCompletedResult(page);
  await trackVideoUrls(page);
  await page.getByRole('button', { name: 'Watch camera video', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'CARLA camera evidence' });
  await expect(dialog).toContainText(runIds.completed);
  await expect(dialog.locator('video')).toHaveAttribute('src', /^blob:/);
  await expect(dialog.locator('video')).toHaveAttribute('controls', '');
  expect(operations.matching('GET', videoPath(runIds.completed))[0].headers()['x-asx-dev-role']).toBe('TEST_ENGINEER');
  await expect(dialog.getByRole('alert')).toContainText('The browser cannot play this camera recording.');
  const blob = await dialog.locator('video').getAttribute('src');
  await dialog.getByRole('button', { name: 'Close video', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as VideoWindow).testVideoUrls.revoked)).toContain(blob);
});

test('FE-UT-054: video API failure stays an error and preview can be retried', async ({ workspace: page, operations }) => {
  operations.results.set(runIds.completed, { hasVideo: true });
  await openCompletedResult(page);
  operations.failNext('GET', videoPath(runIds.completed), 503, 'Video storage is unavailable.');
  await page.getByRole('button', { name: 'Watch camera video', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'CARLA camera evidence' });
  await expect(dialog.getByRole('alert')).toContainText('Video storage is unavailable.');
  await expect(dialog.locator('video')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close video', exact: true }).click();
  await page.getByRole('button', { name: 'Watch camera video', exact: true }).click();
  await expect(dialog.locator('video')).toHaveAttribute('src', /^blob:/);
});

test('FE-UT-054: download failure produces no file; retry downloads the original MP4 bytes', async ({ workspace: page, operations }) => {
  operations.results.set(runIds.completed, { hasVideo: true });
  await openCompletedResult(page);
  const downloads: string[] = [];
  page.on('download', file => downloads.push(file.suggestedFilename()));
  operations.failNext('GET', videoPath(runIds.completed), 404, 'Recording was removed.');
  await page.getByRole('button', { name: 'Download camera video', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Recording was removed.');
  expect(downloads).toEqual([]);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download camera video', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`carla-${runIds.completed}.mp4`);
  expect(await readFile((await file.path())!)).toEqual(mp4);
});

test('FE-UT-054: changing run closes the player and revokes the previous run video', async ({ workspace: page, operations }) => {
  operations.queue();
  operations.results.set(runIds.rain, { hasVideo: true });
  await openQueue(page);
  await expect(resultPanel(page)).toContainText(runIds.rain);
  await trackVideoUrls(page);
  await page.getByRole('button', { name: 'Watch camera video', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'CARLA camera evidence' });
  await expect(dialog.locator('video')).toHaveAttribute('src', /^blob:/);
  const blob = await dialog.locator('video').getAttribute('src');
  // The modal backdrop intentionally intercepts clicks. A programmatic activation
  // exercises the run-change cleanup used by navigation and background updates.
  await page.getByRole('row').filter({ hasText: 'Highway braking' }).getByRole('button', { name: 'Inspect', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await expect(resultPanel(page)).toContainText(runIds.highway);
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as VideoWindow).testVideoUrls.revoked)).toContain(blob);
});

test('FE-UT-054: late video response after changing runs cannot reopen the old player or create a Blob', async ({ workspace: page, operations }) => {
  operations.queue();
  operations.results.set(runIds.rain, { hasVideo: true });
  await openQueue(page);
  await expect(resultPanel(page)).toContainText(runIds.rain);
  await trackVideoUrls(page);
  const oldVideo = operations.holdNext('GET', videoPath(runIds.rain));
  await page.getByRole('button', { name: 'Watch camera video', exact: true }).click();
  await oldVideo.received;
  await page.getByRole('row').filter({ hasText: 'Highway braking' }).getByRole('button', { name: 'Inspect', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await expect(resultPanel(page)).toContainText(runIds.highway);
  await expect(page.getByRole('dialog', { name: 'CARLA camera evidence' })).toHaveCount(0);
  await oldVideo.release();
  await expect(resultPanel(page)).toContainText(runIds.highway);
  await expect(page.getByRole('dialog', { name: 'CARLA camera evidence' })).toHaveCount(0);
  expect(await page.evaluate(() => (window as VideoWindow).testVideoUrls.created)).toEqual([]);
});

test('FE-UT-054: closing a loading preview prevents its late response from creating an orphan Blob', async ({ workspace: page, operations }) => {
  operations.results.set(runIds.completed, { hasVideo: true });
  await openCompletedResult(page);
  await trackVideoUrls(page);
  const oldVideo = operations.holdNext('GET', videoPath(runIds.completed));
  await page.getByRole('button', { name: 'Watch camera video', exact: true }).click();
  await oldVideo.received;
  await page.getByRole('button', { name: 'Close video', exact: true }).click();
  await oldVideo.release();
  await expect(page.getByRole('dialog', { name: 'CARLA camera evidence' })).toHaveCount(0);
  expect(await page.evaluate(() => (window as VideoWindow).testVideoUrls.created)).toEqual([]);
});

test('FE-UT-054: empty files and invalid MP4 headers are blocked before upload', async ({ workspace: page, operations }) => {
  await openUploader(page);
  const input = page.getByLabel('Original MP4 (default limit: 200 MiB)', { exact: true });
  const upload = page.getByRole('button', { name: 'Upload raw MP4', exact: true });
  await input.setInputFiles({ name: 'empty.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(0) });
  await expect(page.getByRole('alert')).toContainText('Select a non-empty MP4 recording up to 200 MiB.');
  await expect(upload).toBeDisabled();
  await input.setInputFiles({ name: 'invalid.mp4', mimeType: 'video/mp4', buffer: Buffer.from('invalid recording') });
  await expect(page.getByRole('alert')).toContainText('The selected file does not have an MP4 ftyp header.');
  await expect(upload).toBeDisabled();
  expect(operations.matching('PUT', videoPath(runIds.completed))).toHaveLength(0);
});

for (const failure of ['API', 'network'] as const) {
  test(`FE-UT-054: ${failure} upload failure preserves the file and only backend acceptance reports success`, async ({ workspace: page, operations }) => {
    await openUploader(page);
    await page.getByLabel('Original MP4 (default limit: 200 MiB)', { exact: true }).setInputFiles({ name: 'camera.mp4', mimeType: 'video/mp4', buffer: mp4 });
    await page.getByRole('checkbox', { name: `I confirm this MP4 records ${runIds.completed}.`, exact: true }).check();
    const path = videoPath(runIds.completed);
    if (failure === 'API') operations.failNext('PUT', path, 413, 'Video exceeds the storage limit.');
    else operations.abortNext('PUT', path);
    const upload = page.getByRole('button', { name: 'Upload raw MP4', exact: true });
    await upload.click();
    await expect(page.getByRole('alert')).toContainText(failure === 'API' ? 'Video exceeds the storage limit.' : 'Cannot connect to the team backend.');
    await expect(page.getByRole('status').filter({ hasText: 'MP4 stored by the backend.' })).toHaveCount(0);
    await expect(page.locator('.worker-protocol-file').filter({ hasText: 'camera.mp4' })).toBeVisible();
    expect(operations.result(runIds.completed).hasVideo).toBe(false);
    await expect(upload).toBeEnabled();

    const pending = operations.holdNext('PUT', path);
    await upload.click();
    const request = await pending.received;
    expect(request.headers()['content-type']).toBe('video/mp4');
    expect(request.headers()['x-asx-dev-role']).toBe('TEST_ENGINEER');
    expect(request.postDataBuffer()).toEqual(mp4);
    await expect(page.getByRole('button', { name: 'Uploading MP4…', exact: true })).toBeDisabled();
    await expect(page.getByRole('status').filter({ hasText: 'MP4 stored by the backend.' })).toHaveCount(0);
    expect(operations.result(runIds.completed).hasVideo).toBe(false);
    await pending.release();
    await expect(page.getByRole('status').filter({ hasText: 'MP4 stored by the backend.' })).toBeVisible();
    await expect(page.locator('.worker-protocol-target')).toContainText('MP4: available');
    expect(operations.result(runIds.completed).hasVideo).toBe(true);
  });
}
