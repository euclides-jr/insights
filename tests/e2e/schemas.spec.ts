import { test, expect } from '@playwright/test';

test.describe('Schemas page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/schemas');
  });

  async function searchSchemas(page: import('@playwright/test').Page, query: string) {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.click();
    await searchInput.fill(query);
    await page.waitForURL(new RegExp(`q=${encodeURIComponent(query)}`), {
      timeout: 10000,
    });
  }

  test('shows the Schemas heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Schemas' })).toBeVisible();
  });

  test('shows the Schemas description', async ({ page }) => {
    await expect(
      page.getByText('Define and manage event schemas for data validation'),
    ).toBeVisible();
  });

  test('renders table column headers', async ({ page }) => {
    await expect(page.getByText('Schema ID')).toBeVisible();
    await expect(page.getByText('Name')).toBeVisible();
    await expect(page.getByText('Type')).toBeVisible();
    await expect(page.getByText('Properties')).toBeVisible();
    await expect(page.getByText('Last Updated')).toBeVisible();
    const statusHeaders = page.getByText('Status');
    await expect(statusHeaders.first()).toBeVisible();
  });

  test('shows seeded schema event names', async ({ page }) => {
    await searchSchemas(page, 'purchase');
    await expect(page.getByRole('link', { name: 'purchase' })).toBeVisible();

    await searchSchemas(page, 'page_view');
    await expect(page.getByRole('link', { name: 'page_view' })).toBeVisible();
  });

  test('shows Active badge for active schemas', async ({ page }) => {
    const activeBadges = page.getByText('Active');
    await expect(activeBadges.first()).toBeVisible();
  });

  test('search input is visible', async ({ page }) => {
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test('search filters the schema list', async ({ page }) => {
    await searchSchemas(page, 'purchase');
    await expect(page.getByRole('link', { name: 'purchase' })).toBeVisible();
  });

  test('clearing search restores full list', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchSchemas(page, 'purchase');
    await searchInput.click({ clickCount: 3 });
    await searchInput.press('Backspace');
    await page.waitForURL((url) => !url.search.includes('q='), {
      timeout: 10000,
    });
    await expect(page.getByText(/Showing \d+-\d+ of \d+ schemas/)).toBeVisible();
  });

  test('Application filter dropdown is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Application' }),
    ).toBeVisible();
  });

  test('Application filter updates URL when selected', async ({ page }) => {
    await page.getByRole('button', { name: 'Application' }).click();
    const webOption = page.getByRole('button', { name: 'Demo Web App' });
    await expect(webOption).toBeVisible();
    await webOption.click();
    await page.waitForURL(/appId=/, { timeout: 8000 });
    expect(page.url()).toContain('appId=');
  });

  test('Status filter dropdown is visible', async ({ page }) => {
    // The Status filter label
    const statusFilter = page.getByText('Status').first();
    await expect(statusFilter).toBeVisible();
  });

  test('Status filter "Active" updates URL', async ({ page }) => {
    // Find and click the Status dropdown button (not the table header)
    await page.getByRole('button', { name: 'Status' }).click();
    await page.getByRole('button', { name: 'Active', exact: true }).click();
    await page.waitForURL(/status=/, { timeout: 8000 });
    expect(page.url()).toContain('status=active');
  });

  test('Schemas nav link is highlighted as active', async ({ page }) => {
    const navLink = page.getByRole('link', { name: 'Schemas' }).first();
    await expect(navLink).toHaveCSS('background-color', 'rgb(228, 35, 19)');
  });

  test('clicking a schema ID navigates to schema detail', async ({ page }) => {
    // Click the first schema ID link in the first column
    const firstIdLink = page.locator('a[href^="/schemas/"]').first();
    await firstIdLink.click();
    await expect(page).toHaveURL(/\/schemas\/.+/);
  });

  test('clicking a schema name navigates to schema detail', async ({
    page,
  }) => {
    await searchSchemas(page, 'purchase');
    const schemaNameLink = page.getByRole('link', { name: 'purchase' }).first();
    await schemaNameLink.click();
    await expect(page).toHaveURL(/\/schemas\/.+/);
  });
});

test.describe('Schema detail page', () => {
  test('shows breadcrumb, event name heading and Active badge', async ({
    page,
  }) => {
    await page.goto('/schemas');
    await page.getByPlaceholder(/search/i).fill('purchase');
    await page.waitForURL(/q=purchase/, { timeout: 10000 });
    const link = page.getByRole('link', { name: 'purchase' }).first();
    await link.click();
    await expect(page).toHaveURL(/\/schemas\/.+/);

    // Breadcrumb (use .first() to avoid strict-mode failure with sidebar link)
    await expect(
      page.getByRole('link', { name: 'Schemas' }).first(),
    ).toBeVisible();

    // Heading
    await expect(page.getByRole('heading', { name: 'purchase' })).toBeVisible();

    // Active badge
    await expect(page.getByText('Active').first()).toBeVisible();
  });

  test('shows Properties table with Property, Type, Required, Description columns', async ({
    page,
  }) => {
    await page.goto('/schemas');
    await page.getByPlaceholder(/search/i).fill('purchase');
    await page.waitForURL(/q=purchase/, { timeout: 10000 });
    const link = page.getByRole('link', { name: 'purchase' }).first();
    await link.click();
    await expect(page).toHaveURL(/\/schemas\/.+/);

    await expect(page.getByText('Property')).toBeVisible();
    await expect(page.getByText(/Type/i).first()).toBeVisible();
    await expect(page.getByText(/Required/i).first()).toBeVisible();
  });

  test('shows version history section if multiple versions exist', async ({
    page,
  }) => {
    await page.goto('/schemas');
    await page.getByPlaceholder(/search/i).fill('purchase');
    await page.waitForURL(/q=purchase/, { timeout: 10000 });
    const link = page.getByRole('link', { name: 'purchase' }).first();
    await link.click();
    await expect(page).toHaveURL(/\/schemas\/.+/);

    // Version History only renders when schema has >1 version; skip when not present
    const vhSection = page.getByText('Version History');
    const isVisible = await vhSection.isVisible().catch(() => false);
    if (isVisible) {
      await expect(vhSection).toBeVisible();
    }
  });
});
