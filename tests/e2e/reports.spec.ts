import { test, expect } from '@playwright/test';

test.describe('Reports page', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/reports');
  });

  test('shows the Reports heading and seeded report', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await expect(
      page.getByText('Save reusable analytics views and reopen them without rebuilding filters'),
    ).toBeVisible();
    const seededRow = page
      .locator('div.border-t')
      .filter({ hasText: 'Signup Funnel (30d)' })
      .first();
    await expect(seededRow).toBeVisible();
    await expect(
      seededRow.getByText('Signup Funnel (30d)', { exact: true }),
    ).toBeVisible();
    await expect(seededRow.getByText('FUNNEL', { exact: true })).toBeVisible();
  });

  test('opens the seeded report detail page', async ({ page }) => {
    await page.getByRole('link', { name: 'Signup Funnel (30d)' }).click();
    await expect(page).toHaveURL(/\/reports\/seed_signup_funnel_report$/);
    await expect(
      page.getByRole('heading', { name: 'Signup Funnel (30d)' }),
    ).toBeVisible();
    await expect(page.getByText('Saved report configuration and latest preview')).toBeVisible();
  });

  test('renders the seeded retention report detail and source link', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'Web Retention (8w)' }).click();

    await expect(
      page.getByRole('heading', { name: 'Web Retention (8w)' }),
    ).toBeVisible();
    await expect(page.getByTestId('retention-grid')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Open Source Page' }),
    ).toHaveAttribute('href', '/retention');
  });

  test('renders the seeded query report detail and source link', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'Revenue by Event' }).click();

    await expect(
      page.getByRole('heading', { name: 'Revenue by Event' }),
    ).toBeVisible();
    await expect(page.getByText('"groupBy": "eventName"')).toBeVisible();
    await expect(page.getByText('Created by')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Open Source Page' }),
    ).toHaveAttribute('href', '/query');
  });

  test('returns 404 for an unknown report id', async ({ page }) => {
    const response = await page.goto('/reports/nonexistent-report-id-404');

    expect(response?.status()).toBe(404);
  });

  test('Reports nav link is highlighted as active', async ({ page }) => {
    const navLink = page.getByRole('link', { name: 'Reports' }).first();
    await expect(navLink).toHaveCSS('background-color', 'rgb(228, 35, 19)');
  });

  test('creates, edits, and deletes a saved report', async ({ page }) => {
    const originalName = `Saved Report ${Date.now()}`;
    const updatedName = `${originalName} Updated`;

    await page.getByRole('button', { name: '+ Save Report' }).click();
    await page.getByPlaceholder('Signup Funnel (30d)').fill(originalName);
    await page.getByLabel('Report Type').selectOption('RETENTION');
    await page.getByLabel('Config JSON').fill(
      JSON.stringify(
        {
          interval: 'weekly',
          cohortWindow: { value: 4, unit: 'weeks' },
        },
        null,
        2,
      ),
    );
    await page.getByRole('button', { name: 'Create Report' }).click();

    const createdRow = page
      .locator('div.border-t')
      .filter({ hasText: originalName })
      .first();
    await expect(createdRow).toBeVisible({ timeout: 10000 });

    await createdRow.getByRole('button', { name: 'Edit' }).click();
    await page.getByPlaceholder('Signup Funnel (30d)').fill(updatedName);
    await page.getByRole('button', { name: 'Save Changes' }).click();

    const updatedRow = page
      .locator('div.border-t')
      .filter({ hasText: updatedName })
      .first();
    await expect(updatedRow).toBeVisible({ timeout: 10000 });

    await updatedRow.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete Report' }).click();
    await expect(page.getByText(updatedName, { exact: true })).toHaveCount(0, {
      timeout: 10000,
    });
  });

  test('saves the current funnel view into reports', async ({ page }) => {
    const reportName = `Saved From Funnel ${Date.now()}`;

    await page.goto('/funnels');
    await page.getByRole('button', { name: 'Save Current View' }).click();

    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith('/api/reports') &&
      response.request().method() === 'POST' &&
      response.status() === 201,
    );

    await page.getByPlaceholder('Signup Funnel (30d)').fill(reportName);
    await page.getByRole('button', { name: 'Create Report' }).click();
    await responsePromise;

    await page.goto('/reports');
    await expect(
      page.locator('div.border-t').filter({ hasText: reportName }).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
