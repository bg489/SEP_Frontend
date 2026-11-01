import type { Locator, Page } from '@playwright/test';
import { test, expect, openSection } from './operations.fixtures';

const languages = {
  en: {
    newScenario: 'New scenario', scenarioTitle: 'Create scenario draft', scenarioName: 'Name',
    create: 'Create draft', newCampaign: 'Build campaign', campaignTitle: 'Build a campaign',
    campaignName: 'Campaign name', save: 'Save campaign', close: 'Close', cancel: 'Cancel',
    search: 'Search', repositorySearch: 'Search name or code', map: 'Map', category: 'Category',
    readyCategory: 'Category', loadingRepository: 'Loading repository…', loadingReady: 'Finding READY versions…',
    emptyRepository: 'No scenarios match these filters.',
    emptyReady: 'No READY version matches. Publish a valid scenario version or adjust the filters.',
    previous: 'Previous page', next: 'Next page',
  },
  vi: {
    newScenario: 'Tạo kịch bản', scenarioTitle: 'Tạo bản nháp kịch bản', scenarioName: 'Tên',
    create: 'Tạo bản nháp', newCampaign: 'Tạo campaign', campaignTitle: 'Tạo campaign',
    campaignName: 'Tên campaign', save: 'Lưu campaign', close: 'Đóng', cancel: 'Hủy',
    search: 'Tìm kiếm', repositorySearch: 'Tìm tên hoặc mã', map: 'Bản đồ', category: 'Phân loại',
    readyCategory: 'Loại scenario', loadingRepository: 'Đang tải kho kịch bản…', loadingReady: 'Đang tìm phiên bản READY…',
    emptyRepository: 'Không có kịch bản phù hợp bộ lọc.',
    emptyReady: 'Không có phiên bản READY phù hợp. Hãy xuất bản phiên bản scenario hợp lệ hoặc đổi bộ lọc.',
    previous: 'Trang trước', next: 'Trang sau',
  },
};

async function expectPageFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
}

async function expectModalFits(form: Locator) {
  const sizes = await form.evaluate(element => ({ content: element.scrollWidth, available: element.clientWidth }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.available + 1);
}

async function expectKeyboardModal(page: Page, form: Locator, close: Locator, last: Locator) {
  await last.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await expectModalFits(form);
}

for (const [locale, words] of Object.entries(languages)) {
  for (const width of [1280, 390, 320]) {
    test.describe(`${locale} ${width}px`, () => {
      test.use({ viewport: { width, height: 800 } });

      test.describe('scenario', () => {
        test.use({ devRole: 'SCENARIO_ENGINEER' });
        test('keyboard, filters, loading, long API errors and retry', async ({ workspace: page, operations }, testInfo) => {
          await openSection(page, 'Scenario library');
          const repository = page.locator('.team-repository');
          await expect(page.locator('.team-scenario-cards')).toHaveAttribute('aria-busy', 'false');
          if (locale === 'vi') await page.getByRole('button', { name: 'Switch to Vietnamese', exact: true }).click();
          await expectPageFits(page);

          const heldList = operations.holdNext('GET', '/api/v1/scenarios');
          await repository.getByLabel(words.repositorySearch, { exact: true }).fill('Rain');
          await heldList.received;
          await expect(repository.getByRole('status')).toHaveText(words.loadingRepository);
          await heldList.release();
          await repository.getByRole('combobox', { name: words.map, exact: true }).selectOption('Town01');
          await repository.getByRole('combobox', { name: words.category, exact: true }).selectOption('free_driving');
          await expect(page.locator('.team-scenario-card')).toHaveCount(1);
          await expect(page.locator('.team-scenario-card')).toContainText('Rain crossing');
          await repository.getByLabel(words.repositorySearch, { exact: true }).fill('no matching scenario');
          await expect(repository.getByText(words.emptyRepository, { exact: true })).toBeVisible();

          const trigger = page.getByRole('button', { name: words.newScenario, exact: true });
          await trigger.click();
          const dialog = page.getByRole('dialog', { name: words.scenarioTitle, exact: true });
          const form = dialog.locator('form');
          const name = form.getByLabel(words.scenarioName, { exact: true });
          const close = form.getByRole('button', { name: words.close, exact: true });
          const submit = form.getByRole('button', { name: words.create, exact: true });
          await expect(name).toBeFocused();
          await expectKeyboardModal(page, form, close, submit);
          await page.keyboard.press('Escape');
          await expect(dialog).toHaveCount(0);
          await expect(trigger).toBeFocused();
          expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
          await trigger.press('Enter');
          await expect(name).toBeFocused();
          const template = form.getByRole('radio', { name: /Lead vehicle braking/ });
          await template.focus();
          await template.press('Space');
          await expect(template).toBeChecked();
          await expect(form.getByRole('combobox', { name: words.category, exact: true })).toHaveValue('following');
          await name.fill('Reviewed draft');

          const longError = `${locale === 'vi' ? 'Không thể tạo kịch bản.' : 'Unable to create scenario.'} ${'request-id-'.repeat(90)}`;
          operations.failNext('POST', '/api/v1/scenarios', 503, longError);
          await submit.click();
          await expect(form.getByRole('alert')).toContainText(longError);
          await expect(page.locator('[role="alert"]')).toHaveCount(1);
          await expect(name).toHaveValue('Reviewed draft');
          await form.getByRole('alert').scrollIntoViewIfNeeded();
          await expectModalFits(form);
          await page.screenshot({ path: testInfo.outputPath('scenario-error.png') });

          const saved = operations.holdNext('POST', '/api/v1/scenarios');
          await submit.click();
          await saved.received;
          await expect(form).toHaveAttribute('aria-busy', 'true');
          await expect(form.locator('input:enabled, select:enabled, textarea:enabled')).toHaveCount(0);
          await expect(submit).toBeDisabled();
          await expect(close).toBeDisabled();
          await page.keyboard.press('Escape');
          await expect(dialog).toBeVisible();
          expect(operations.matching('POST', '/api/v1/scenarios')).toHaveLength(2);
          await saved.release();
          await expect(dialog).toHaveCount(0);
          await expect(page.getByRole('heading', { name: 'Reviewed draft', exact: true })).toBeVisible();
          await expectPageFits(page);
        });
      });

      test.describe('campaign', () => {
        test.use({ devRole: 'TEST_ENGINEER' });
        test('keyboard, selection across filters, loading, long API errors and retry', async ({ workspace: page, operations }, testInfo) => {
          await openSection(page, 'Campaigns');
          await expect(page.getByRole('button', { name: 'Safety regression', exact: true })).toBeVisible();
          if (locale === 'vi') await page.getByRole('button', { name: 'Switch to Vietnamese', exact: true }).click();
          await expectPageFits(page);
          await page.locator('.ops-search input').fill('Safety');
          await expect(page.getByRole('button', { name: 'Completed campaign', exact: true })).toHaveCount(0);
          await page.locator('.ops-search input').fill('');

          const trigger = page.getByRole('button', { name: words.newCampaign, exact: true });
          await trigger.click();
          const dialog = page.getByRole('dialog', { name: words.campaignTitle, exact: true });
          const form = dialog.locator('form');
          const name = form.getByLabel(words.campaignName, { exact: true });
          const close = form.getByRole('button', { name: words.close, exact: true });
          const cancel = form.getByRole('button', { name: words.cancel, exact: true });
          const submit = form.getByRole('button', { name: words.save, exact: true });
          await expect(name).toBeFocused();
          await expect(submit).toBeDisabled();
          await expectKeyboardModal(page, form, close, cancel);
          await page.keyboard.press('Escape');
          await expect(dialog).toHaveCount(0);
          await expect(trigger).toBeFocused();
          await trigger.press('Enter');
          await expect(name).toBeFocused();
          await name.fill('Reviewed campaign');
          await expect(form.getByRole('checkbox', { name: /Rain crossing/ })).toBeVisible();
          const heldList = operations.holdNext('GET', '/api/v1/campaigns/available-scenarios');
          await form.getByLabel(words.search, { exact: true }).fill('Rain');
          await heldList.received;
          await expect(form.getByRole('status')).toHaveText(words.loadingReady);
          await heldList.release();
          const rain = form.getByRole('checkbox', { name: /Rain crossing/ });
          await rain.focus();
          await rain.press('Space');
          await expect(rain).toBeChecked();
          await form.getByLabel(words.search, { exact: true }).fill('Highway');
          const highway = form.getByRole('checkbox', { name: /Highway braking/ });
          await highway.focus();
          await highway.press('Space');
          await form.getByRole('combobox', { name: words.map, exact: true }).selectOption('Town02');
          await form.getByRole('combobox', { name: words.readyCategory, exact: true }).selectOption('following');
          await expect(form.locator('.ops-ready-card')).toHaveCount(1);
          await expect(form.locator('.ops-selection-row')).toHaveCount(2);
          await form.getByLabel(words.search, { exact: true }).fill('no matching scenario');
          await expect(form.getByText(words.emptyReady, { exact: true })).toBeVisible();
          await expect(form.locator('.ops-selection-row')).toHaveCount(2);
          await expect(form.getByRole('button', { name: words.previous, exact: true })).toBeDisabled();
          await expect(form.getByRole('button', { name: words.next, exact: true })).toBeDisabled();

          const longError = `${locale === 'vi' ? 'Không thể tạo campaign.' : 'Unable to create campaign.'} ${'request-id-'.repeat(90)}`;
          operations.failNext('POST', '/api/v1/campaigns', 503, longError);
          await submit.click();
          await expect(form.getByRole('alert')).toContainText(longError);
          await expect(page.locator('[role="alert"]')).toHaveCount(1);
          await expect(name).toHaveValue('Reviewed campaign');
          await expect(form.locator('.ops-selection-row')).toHaveCount(2);
          await form.getByRole('alert').scrollIntoViewIfNeeded();
          await expectModalFits(form);
          await page.screenshot({ path: testInfo.outputPath('campaign-error.png') });

          const saved = operations.holdNext('POST', '/api/v1/campaigns');
          await submit.click();
          await saved.received;
          await expect(form).toHaveAttribute('aria-busy', 'true');
          await expect(form.locator('input:enabled, select:enabled, textarea:enabled')).toHaveCount(0);
          await expect(form.getByRole('button', { name: /Remove scenario|Bỏ scenario/ }).first()).toBeDisabled();
          await expect(form.getByRole('button', { name: /Remove scenario|Bỏ scenario/ }).last()).toBeDisabled();
          await expect(submit).toBeDisabled();
          await expect(close).toBeDisabled();
          await page.keyboard.press('Escape');
          await expect(dialog).toBeVisible();
          expect(operations.matching('POST', '/api/v1/campaigns')).toHaveLength(2);
          await saved.release();
          await expect(dialog).toHaveCount(0);
          await expect(page.getByRole('button', { name: 'Reviewed campaign', exact: true })).toBeVisible();
          await expectPageFits(page);
        });
      });
    });
  }
}

test.describe('long template labels on a small screen', () => {
  test.use({ devRole: 'SCENARIO_ENGINEER', viewport: { width: 320, height: 800 } });
  test('template names and descriptions wrap inside the scenario picker', async ({ workspace: page }) => {
    await page.route('**/api/v1/reference/scenario-templates', route => route.fulfill({ json: [{
      key: 'lead_vehicle_brake', title: 'S'.repeat(120), summary: 'D'.repeat(2000), category: 'following',
      mapName: 'Town01', eventTypes: ['lead_vehicle_brake'], reference: null,
    }] }));
    await openSection(page, 'Scenario library');
    await page.getByRole('button', { name: 'New scenario', exact: true }).click();
    const form = page.locator('.team-create-modal');
    await expect(form.getByRole('radio', { name: /^S{120}/ })).toBeVisible();
    await expectModalFits(form);
    const picker = form.locator('.team-template-picker');
    const sizes = await picker.evaluate(element => ({ content: element.scrollWidth, available: element.clientWidth }));
    expect(sizes.content).toBeLessThanOrEqual(sizes.available + 1);
  });
});
