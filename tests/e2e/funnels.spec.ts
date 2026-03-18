import { test, expect } from '@playwright/test';

test.describe('Funnels page', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/funnels');
  });

  test('shows the Funnels heading and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Funnels' })).toBeVisible();
    await expect(
      page.getByText('Analyze ordered conversion flows across your event stream'),
    ).toBeVisible();
  });

  test('shows the seeded funnel in the table', async ({ page }) => {
    const seededRow = page
      .locator('div.border-t')
      .filter({ hasText: 'Signup Activation' })
      .filter({ hasText: 'Demo Web App' })
      .first();

    await expect(seededRow).toBeVisible();
    await expect(seededRow.getByText('Signup Activation', { exact: true })).toBeVisible();
    await expect(seededRow.getByText('Demo Web App')).toBeVisible();
    await expect(seededRow.getByText('Runnable')).toBeVisible();
  });

  test('shows the 30-day preview results', async ({ page }) => {
    const previewResults = page.getByTestId('funnel-preview-results');

    await expect(
      previewResults.getByRole('heading', { name: '30-day Preview' }),
    ).toBeVisible();
    await expect(previewResults.getByText(/Latest results for/)).toBeVisible();
    await expect(previewResults.getByText('#1')).toBeVisible();
    await expect(previewResults.getByText('Event')).toBeVisible();
  });

  test('runs a saved funnel with a custom time window', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Funnel Results' }),
    ).toBeVisible();

    await page.getByLabel('Time Window').selectOption('7');

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/funnels/') &&
      response.url().endsWith('/run') &&
      response.request().method() === 'POST',
    );

    await page.getByRole('button', { name: 'Run Funnel' }).click();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    await expect(page.getByText(/over the last 7 days/)).toBeVisible();
  });

  test('search filters the funnel list', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search funnels/i);
    await searchInput.click();
    await searchInput.pressSequentially('Signup Activation', { delay: 30 });
    await page.waitForURL(/\/funnels\?q=Signup(\+|%20)Activation/, {
      timeout: 10000,
    });
    const filteredRow = page
      .locator('div.border-t')
      .filter({ hasText: 'Signup Activation' })
      .first();
    await expect(filteredRow).toBeVisible();
  });

  test('Funnels nav link is highlighted as active', async ({ page }) => {
    const navLink = page.getByRole('link', { name: 'Funnels' }).first();
    await expect(navLink).toHaveCSS('background-color', 'rgb(228, 35, 19)');
  });

  test('creates a new funnel from the dialog', async ({ page }) => {
    const funnelName = `Signup Funnel ${Date.now()}`;

    await page.getByRole('button', { name: '+ Add Funnel' }).click();
    await expect(
      page.getByRole('heading', { name: 'Create Funnel' }),
    ).toBeVisible();

    await page.getByPlaceholder('Signup Activation').fill(funnelName);
    await page
      .getByPlaceholder('Track conversion from signup to purchase')
      .fill('E2E-created funnel');

    await page.getByRole('textbox', { name: 'signup', exact: true }).fill('signup');
    await page
      .getByRole('textbox', { name: 'button_click', exact: true })
      .fill('purchase');

    await page.getByRole('button', { name: 'Create Funnel' }).click();

    const createdRow = page
      .locator('div.border-t')
      .filter({ hasText: funnelName })
      .first();
    await expect(createdRow).toBeVisible({ timeout: 10000 });
  });

  test('edits an existing funnel from the dialog', async ({ page }) => {
    const originalName = `Editable Funnel ${Date.now()}`;
    const updatedName = `${originalName} Updated`;

    await page.getByRole('button', { name: '+ Add Funnel' }).click();
    await page.getByPlaceholder('Signup Activation').fill(originalName);
    await page
      .getByPlaceholder('Track conversion from signup to purchase')
      .fill('Initial description');
    await page.getByRole('textbox', { name: 'signup', exact: true }).fill('signup');
    await page
      .getByRole('textbox', { name: 'button_click', exact: true })
      .fill('purchase');
    await page.getByRole('button', { name: 'Create Funnel' }).click();

    const row = page.locator('text=' + originalName).locator('xpath=ancestor::div[contains(@class, "border-t")]').first();
    await row.getByRole('button', { name: 'Edit' }).click();

    await page.getByPlaceholder('Signup Activation').fill(updatedName);
    await page
      .getByPlaceholder('Track conversion from signup to purchase')
      .fill('Updated description');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    const updatedRow = page
      .locator('div.border-t')
      .filter({ hasText: updatedName })
      .first();
    await expect(updatedRow).toBeVisible({ timeout: 10000 });
  });

  test('deletes a funnel from the page', async ({ page }) => {
    const funnelName = `Deletable Funnel ${Date.now()}`;

    await page.getByRole('button', { name: '+ Add Funnel' }).click();
    await page.getByPlaceholder('Signup Activation').fill(funnelName);
    await page.getByRole('textbox', { name: 'signup', exact: true }).fill('signup');
    await page
      .getByRole('textbox', { name: 'button_click', exact: true })
      .fill('purchase');
    await page.getByRole('button', { name: 'Create Funnel' }).click();

    const row = page.locator('text=' + funnelName).locator('xpath=ancestor::div[contains(@class, "border-t")]').first();
    await row.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete Funnel' }).click();

    await expect(
      page.getByRole('heading', { name: 'Delete Funnel' }),
    ).not.toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(funnelName, { exact: true })).toHaveCount(0, {
      timeout: 10000,
    });
  });
});
