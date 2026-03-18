import { test, expect } from '@playwright/test';

test.describe('Segments page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/segments');
  });

  test('shows the Segments heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Segments' })).toBeVisible();
  });

  test('shows the Segments description', async ({ page }) => {
    await expect(
      page.getByText('Create and manage user segments'),
    ).toBeVisible();
  });

  test('renders table column headers', async ({ page }) => {
    await expect(page.getByText('Segment ID')).toBeVisible();
    await expect(page.getByText('Name')).toBeVisible();
    await expect(page.getByText('Conditions')).toBeVisible();
    await expect(page.getByText('Users', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('Last Updated')).toBeVisible();
    const statusHeaders = page.getByText('Status');
    await expect(statusHeaders.first()).toBeVisible();
  });

  test('shows seeded segment names', async ({ page }) => {
    await expect(page.getByText('High-value buyers')).toBeVisible();
    await expect(page.getByText('Recent sign-ups')).toBeVisible();
    await expect(page.getByText('Active readers')).toBeVisible();
  });

  test('shows pagination text', async ({ page }) => {
    await expect(
      page.getByText(/Showing \d+-\d+ of \d+ segments/),
    ).toBeVisible();
  });

  test('search input is visible', async ({ page }) => {
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test('search filters the segment list', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.click();
    await searchInput.pressSequentially('High-value', { delay: 30 });
    await page.waitForURL(/q=High-value/, { timeout: 10000 });
    await expect(page.getByText('High-value buyers')).toBeVisible();
  });

  test('clearing search restores full list', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.click();
    await searchInput.pressSequentially('High-value', { delay: 30 });
    await page.waitForURL(/q=High-value/, { timeout: 10000 });
    await searchInput.click({ clickCount: 3 });
    await searchInput.press('Backspace');
    await page.waitForURL((url) => !url.search.includes('q='), {
      timeout: 10000,
    });
    await expect(page.getByText('Active readers')).toBeVisible();
  });

  test('Add Segment button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /add segment/i }),
    ).toBeVisible();
  });

  test('Segments nav link is highlighted as active', async ({ page }) => {
    const navLink = page.getByRole('link', { name: 'Segments' }).first();
    await expect(navLink).toHaveCSS('background-color', 'rgb(228, 35, 19)');
  });

  test('clicking a segment ID navigates to segment detail', async ({
    page,
  }) => {
    const firstIdLink = page.locator('a[href^="/segments/"]').first();
    await firstIdLink.click();
    await expect(page).toHaveURL(/\/segments\/.+/);
  });

  test('clicking a segment name navigates to segment detail', async ({
    page,
  }) => {
    const nameLink = page.getByRole('link', { name: 'High-value buyers' });
    await nameLink.click();
    await expect(page).toHaveURL(/\/segments\/.+/);
  });
});

test.describe('Segment detail page', () => {
  test('shows breadcrumb, name heading and status badge', async ({ page }) => {
    await page.goto('/segments');
    const link = page.getByRole('link', { name: 'High-value buyers' });
    await link.click();
    await expect(page).toHaveURL(/\/segments\/.+/);

    // Breadcrumb back link (use .first() to avoid strict-mode failure with sidebar link)
    await expect(
      page.getByRole('link', { name: 'Segments' }).first(),
    ).toBeVisible();

    // Heading
    await expect(
      page.getByRole('heading', { name: 'High-value buyers' }),
    ).toBeVisible();

    // Status badge (Active or Empty)
    const badge = page
      .locator('span, div')
      .filter({ hasText: /^(Active|Empty)$/ })
      .first();
    await expect(badge).toBeVisible();
  });

  test('shows member count stat', async ({ page }) => {
    await page.goto('/segments');
    const link = page.getByRole('link', { name: 'High-value buyers' });
    await link.click();
    await expect(page).toHaveURL(/\/segments\/.+/);

    // Member count label
    await expect(page.getByText(/Members|member/i).first()).toBeVisible();
  });

  test('shows event filters / criteria section', async ({ page }) => {
    await page.goto('/segments');
    const link = page.getByRole('link', { name: 'High-value buyers' });
    await link.click();
    await expect(page).toHaveURL(/\/segments\/.+/);

    await expect(
      page.getByText(/Event Filters|Criteria|filters/i).first(),
    ).toBeVisible();
  });

  test('shows Refresh button', async ({ page }) => {
    await page.goto('/segments');
    const link = page.getByRole('link', { name: 'High-value buyers' });
    await link.click();
    await expect(page).toHaveURL(/\/segments\/.+/);

    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
  });
});
