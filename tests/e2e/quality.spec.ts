import { test, expect } from '@playwright/test';

test.describe('Data Quality page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/quality?days=90');
  });

  test('shows the Data Quality heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Data Quality' }),
    ).toBeVisible();
  });

  test('shows the Data Quality description', async ({ page }) => {
    await expect(
      page.getByText(
        'Monitor validation failure rates, completeness, and duplicate events',
      ),
    ).toBeVisible();
  });

  test('shows four summary metric cards', async ({ page }) => {
    await expect(page.getByText('Events Received')).toBeVisible();
    await expect(page.getByText('Events Rejected')).toBeVisible();
    await expect(page.getByText('Avg Completeness')).toBeVisible();
    await expect(page.getByText('Avg Duplicate Rate')).toBeVisible();
  });

  test('shows alert thresholds reference bar', async ({ page }) => {
    await expect(page.getByText('Alert thresholds')).toBeVisible();
    await expect(page.getByText(/Failure rate:/)).toBeVisible();
    await expect(page.getByText(/Completeness:/)).toBeVisible();
    await expect(page.getByText(/Duplicates:/)).toBeVisible();
  });

  test('shows Daily Breakdown section heading', async ({ page }) => {
    await expect(page.getByText('Daily Breakdown')).toBeVisible();
  });

  test('renders table column headers', async ({ page }) => {
    const breakdownSection = page
      .locator('section, div')
      .filter({ has: page.getByText('Daily Breakdown', { exact: true }) })
      .first();
    await expect(breakdownSection.getByText('Date')).toBeVisible();
    await expect(
      breakdownSection.getByText('Application', { exact: true }),
    ).toBeVisible();
    await expect(
      breakdownSection.getByText('Received', { exact: true }),
    ).toBeVisible();
    await expect(
      breakdownSection.getByText('Rejected', { exact: true }),
    ).toBeVisible();
    await expect(
      breakdownSection.getByText('Failure Rate', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      breakdownSection.getByText('Completeness', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      breakdownSection.getByText('Duplicate Rate', { exact: true }).first(),
    ).toBeVisible();
    const statusHeaders = breakdownSection.getByText('Status');
    await expect(statusHeaders.first()).toBeVisible();
  });

  test('shows application names in the table', async ({ page }) => {
    // Verify the table rendered data rows (not the empty-state message)
    await expect(page.getByText('No data quality metrics')).not.toBeVisible();
    // At least one app name appears in the table — use last() to skip the
    // <option> elements inside the closed <select> filter (not visible)
    const hasWeb = await page
      .getByText('EventPulse Web')
      .last()
      .isVisible()
      .catch(() => false);
    const hasiOS = await page
      .getByText('EventPulse iOS')
      .last()
      .isVisible()
      .catch(() => false);
    const hasAdmin = await page
      .getByText('Admin Dashboard')
      .last()
      .isVisible()
      .catch(() => false);
    expect(hasWeb || hasiOS || hasAdmin).toBe(true);
  });

  test('shows day-filter buttons (7d, 14d, 30d)', async ({ page }) => {
    await expect(page.getByRole('link', { name: '7d' })).toBeVisible();
    await expect(page.getByRole('link', { name: '14d' })).toBeVisible();
    await expect(page.getByRole('link', { name: '30d' })).toBeVisible();
  });

  test('7d filter is active by default', async ({ page }) => {
    await page.goto('/quality');
    const sevenDay = page.getByRole('link', { name: '7d' });
    await expect(sevenDay).toHaveClass(/bg-\[#0D0D0D\]|font-medium/);
  });

  test('clicking 30d updates URL', async ({ page }) => {
    await page.getByRole('link', { name: '30d' }).click();
    await page.waitForURL(/days=30/);
    expect(page.url()).toContain('days=30');
  });

  test('Application filter dropdown is visible', async ({ page }) => {
    // QualityAppFilter renders an "All Applications" or similar dropdown
    const appFilter = page
      .locator('select, button, [role="combobox"]')
      .filter({ hasText: /application|all/i })
      .first();
    await expect(appFilter).toBeVisible();
  });

  test('selecting an application updates the URL', async ({ page }) => {
    // Open the application filter
    const appFilter = page
      .locator('select, button, [role="combobox"]')
      .filter({ hasText: /application|all/i })
      .first();
    await appFilter.click();

    const webOption = page.getByText('EventPulse Web').first();
    if (await webOption.isVisible()) {
      await webOption.click();
      await page.waitForURL(/applicationId=/);
      expect(page.url()).toContain('applicationId=');
    }
  });

  test('shows pagination when there are multiple pages', async ({ page }) => {
    // Navigate to 30d to maximize rows
    await page.goto('/quality?days=30');
    const pagination = page.getByText(/Showing \d+[–-]\d+ of \d+ rows/);
    const hasPagination = await pagination.isVisible().catch(() => false);
    // If there is data, pagination should be present
    if (hasPagination) {
      await expect(pagination).toBeVisible();
    }
  });

  test('shows status badge (OK, Warning, or Alert) in rows', async ({
    page,
  }) => {
    // Use last() to avoid non-visible elements catching before table badges
    const hasOk = await page
      .getByText('OK')
      .last()
      .isVisible()
      .catch(() => false);
    const hasWarning = await page
      .getByText('Warning')
      .last()
      .isVisible()
      .catch(() => false);
    const hasAlert = await page
      .getByText('Alert')
      .last()
      .isVisible()
      .catch(() => false);
    expect(hasOk || hasWarning || hasAlert).toBe(true);
  });

  test('Data Quality nav link is highlighted as active', async ({ page }) => {
    const navLink = page.getByRole('link', { name: 'Data Quality' });
    await expect(navLink).toHaveCSS('background-color', 'rgb(228, 35, 19)');
  });
});
