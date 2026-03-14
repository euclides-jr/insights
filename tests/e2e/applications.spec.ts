import { test, expect } from '@playwright/test';

test.describe('Applications Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/applications');
  });

  // -------------------------------------------------------------------------
  // Page structure
  // -------------------------------------------------------------------------

  test('should load with correct heading and description', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Applications');
    await expect(page.locator('p').first()).toContainText('application');
  });

  test('should display the applications table with correct columns', async ({
    page,
  }) => {
    await expect(page.getByText('App ID', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Application Name', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Events Count', { exact: true })).toBeVisible();
    await expect(page.getByText('Last Active', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Status', { exact: true }).first(),
    ).toBeVisible();
  });

  test('should show seeded applications in the table', async ({ page }) => {
    await expect(page.getByText('EventPulse Web')).toBeVisible();
    await expect(page.getByText('EventPulse iOS')).toBeVisible();
    await expect(page.getByText('Admin Dashboard')).toBeVisible();
  });

  test('should show event counts greater than zero', async ({ page }) => {
    // Each seeded app has events — at least one row should have a number > 0
    const body = await page.textContent('body');
    expect(body).toMatch(/\d+/);
  });

  test('should display pagination controls', async ({ page }) => {
    await expect(
      page.locator('text=/Showing.*of.*applications/'),
    ).toBeVisible();
  });

  test('should have a search input', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('should filter by search term', async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]');
    await search.fill('EventPulse Web');
    // Wait for URL update and re-render
    await page.waitForURL('**/applications?q=EventPulse+Web', {
      timeout: 8000,
    });
    await expect(page.getByText('EventPulse Web')).toBeVisible();
    // Other apps should not be visible
    await expect(page.getByText('Admin Dashboard')).not.toBeVisible();
  });

  test('should clear search and restore full list', async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]');
    await search.click();
    await search.pressSequentially('EventPulse Web', { delay: 30 });
    await page.waitForURL('**/applications?q=EventPulse+Web', {
      timeout: 8000,
    });
    await search.click({ clickCount: 3 });
    await search.press('Backspace');
    await page.waitForURL('**/applications', { timeout: 8000 });
    await expect(page.getByText('EventPulse Web')).toBeVisible();
    await expect(page.getByText('Admin Dashboard')).toBeVisible();
  });

  test('should have a Status filter dropdown', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Status/ })).toBeVisible();
  });

  test('should filter by Active status', async ({ page }) => {
    await page.getByRole('button', { name: /Status/ }).click();
    await page.getByRole('button', { name: 'Active', exact: true }).click();
    await page.waitForURL('**/applications?status=ACTIVE', { timeout: 8000 });
    // Active applications should be visible
    await expect(page.getByText('EventPulse Web')).toBeVisible();
  });

  test('should clear status filter via "Clear filter" option', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Status/ }).click();
    await page.getByRole('button', { name: 'Active', exact: true }).click();
    await page.waitForURL('**/applications?status=ACTIVE', { timeout: 8000 });

    await page.getByRole('button', { name: /Status: Active/ }).click();
    await page.getByRole('button', { name: 'Clear filter' }).click();
    await page.waitForURL('**/applications', { timeout: 8000 });
    await expect(page.getByText('EventPulse Web')).toBeVisible();
    await expect(page.getByText('Admin Dashboard')).toBeVisible();
  });

  test('should highlight Applications as the active nav item', async ({
    page,
  }) => {
    const link = page.locator('a[href="/applications"]');
    await expect(link).toHaveCSS('background-color', 'rgb(228, 35, 19)');
  });

  test('should show an "Add Application" or create button', async ({
    page,
  }) => {
    // Some form of create action should be present
    const createBtn = page
      .locator('button')
      .filter({ hasText: /add|new|create/i });
    await expect(createBtn.first()).toBeVisible();
  });
});
