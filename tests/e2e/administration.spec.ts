import { test, expect } from './fixtures';

for (const role of ['SCENARIO_ENGINEER', 'TEST_ENGINEER', 'TEST_REVIEWER', 'ADMIN'] as const) {
  test.describe(`FE-UI-003 ${role}`, () => {
    test.use({ devRole: role });
    test('role navigation exposes administration only to Admin and signs out', async ({ workspace: page }) => {
      const accounts = page.locator('aside').getByRole('button', { name: 'User management', exact: true });
      if (role === 'ADMIN') await expect(accounts).toBeVisible(); else await expect(accounts).toHaveCount(0);
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Open development workspace', exact: true })).toBeVisible();
      await expect(page.locator('aside')).toHaveCount(0);
    });
  });
}

test.describe('FE-UI-029 persistent account administration', () => {
  test.use({ devRole: 'ADMIN' });
  test('Admin changes a role and blocks an account, then reloads server data', async ({ workspace: page }) => {
    const account = { id: '00000000-0000-4000-8000-000000000999', displayName: 'Browser account', email: 'browser@example.invalid', role: 'SCENARIO_ENGINEER', isActive: true };
    const mutations: unknown[] = [];
    await page.route('**/api/v1/admin/users**', async route => {
      if (route.request().method() === 'PATCH') { const patch = route.request().postDataJSON(); mutations.push(patch); Object.assign(account, patch); return route.fulfill({ json: account }); }
      return route.fulfill({ json: { items: [account], page: 1, pageSize: 25, totalCount: 1, totalPages: 1 } });
    });
    await page.locator('aside').getByRole('button', { name: 'User management', exact: true }).click();
    const selector = page.getByRole('combobox', { name: 'Role for browser@example.invalid' }); await selector.selectOption('TEST_REVIEWER');
    await expect(page.getByRole('status').filter({ hasText: 'Role saved.' })).toBeVisible();
    await page.getByRole('button', { name: 'Block account', exact: true }).click();
    await expect(page.getByText('Blocked', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await expect(selector).toHaveValue('TEST_REVIEWER');
    await expect(page.getByRole('button', { name: 'Unblock account', exact: true })).toBeVisible();
    expect(mutations).toEqual([{ role: 'TEST_REVIEWER' }, { isActive: false }]);
  });
  test('a failed Admin API shows its error without fake accounts', async ({ workspace: page }) => {
    await page.route('**/api/v1/admin/users**', route => route.fulfill({ status: 503, json: { title: 'Account service unavailable' } }));
    await page.locator('aside').getByRole('button', { name: 'User management', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Account service unavailable');
    await expect(page.getByRole('button', { name: 'Block account', exact: true })).toHaveCount(0);
  });
});
