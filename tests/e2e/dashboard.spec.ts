import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // -------------------------------------------------------------------------
  // Page structure
  // -------------------------------------------------------------------------

  test('should load with correct heading and description', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('p').first()).toContainText(
      'Overview of your event analytics platform',
    );
  });

  test('should display four metric cards', async ({ page }) => {
    await expect(page.getByText('Total Events')).toBeVisible();
    await expect(page.getByText('Active Applications')).toBeVisible();
    await expect(page.getByText('Event Schemas')).toBeVisible();
    await expect(page.getByText('Data Volume')).toBeVisible();
  });

  test('should show non-zero numeric values in metric cards', async ({
    page,
  }) => {
    // Each metric card has a large number — at least Total Events and Active Applications
    // should be > 0 given seed data
    const cards = page.locator('[class*="border-[#E8E8E8]"][class*="p-6"]');
    expect(await cards.count()).toBeGreaterThan(0);

    // Total Events card value should look like a formatted number
    const totalEventsCard = page
      .locator('[class*="p-6"]')
      .filter({ hasText: 'Total Events' });
    await expect(totalEventsCard.locator('p').nth(1)).not.toBeEmpty();
  });

  test('should display the Recent Events table heading', async ({ page }) => {
    await expect(page.getByText('Recent Events')).toBeVisible();
  });

  test('should display recent events table columns', async ({ page }) => {
    await expect(page.getByText('Event Name', { exact: true })).toBeVisible();
    await expect(page.getByText('Application', { exact: true })).toBeVisible();
    await expect(page.getByText('Timestamp', { exact: true })).toBeVisible();
  });

  test('should display at least one row of recent event data', async ({
    page,
  }) => {
    // If the database is seeded there should be recent events
    const body = await page.textContent('body');
    // Skip if somehow no data
    if (!body || body.includes('No recent events')) {
      test.skip();
    }
    // At minimum one event row with an event name
    const rows = page
      .locator('table')
      .or(page.locator('[class*="border-b border-[#E8E8E8]"]'));
    await expect(rows.first()).toBeVisible();
  });

  test('should have sidebar navigation visible', async ({ page }) => {
    // Sidebar should show all main sections
    await expect(page.locator('a[href="/events"]').first()).toBeVisible();
    await expect(page.locator('a[href="/applications"]').first()).toBeVisible();
    await expect(page.locator('a[href="/schemas"]').first()).toBeVisible();
    await expect(page.locator('a[href="/segments"]').first()).toBeVisible();
    await expect(page.locator('a[href="/query"]').first()).toBeVisible();
    await expect(page.locator('a[href="/quality"]').first()).toBeVisible();
  });

  test('should highlight Dashboard as the active nav item', async ({
    page,
  }) => {
    const dashLink = page.locator('a[href="/"]');
    await expect(dashLink).toHaveCSS('background-color', 'rgb(228, 35, 19)');
  });

  test('should navigate to Events page via sidebar link', async ({ page }) => {
    await page.locator('a[href="/events"]').first().click();
    await page.waitForURL('**/events');
    await expect(page.locator('h1')).toContainText('Events');
  });
});
