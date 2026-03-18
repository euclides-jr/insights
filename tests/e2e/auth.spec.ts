import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('redirects anonymous users to sign-in', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    await page.goto('/quality');

    await expect(page).toHaveURL(/\/sign-in\?redirectTo=%2Fquality/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await context.close();
  });

  test('shows the authenticated dashboard shell', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.getByText('Sign out')).toBeVisible();
  });

  test('signs the user out and returns to sign-in', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Sign out')).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in\?redirectTo=%2F$/);
  });
});
