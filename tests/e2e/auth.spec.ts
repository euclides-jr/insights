import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  const adminEmail = process.env.AUTH_ADMIN_EMAIL ?? 'admin@eventpulse.local';
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? 'changeme12345';

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

  test('shows an error for invalid credentials', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Password').fill('definitely-wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(
      page.getByText(/invalid|unable to sign in/i),
    ).toBeVisible();

    await context.close();
  });

  test('honors redirectTo after successful sign-in', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    await page.goto('/sign-in?redirectTo=%2Fretention');
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Password').fill(adminPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/retention');

    await context.close();
  });

  test('shows the authenticated dashboard shell', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.getByText('Sign out')).toBeVisible();
  });

  test('signs the user out and returns to sign-in', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Password').fill(adminPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByText('Sign out')).toBeVisible();
    const signOutStatus = await page.evaluate(async () => {
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      return response.status;
    });
    expect(signOutStatus).toBe(200);

    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in\?redirectTo=%2F$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await context.close();
  });

  test('redirects authenticated users away from /sign-in', async ({ page }) => {
    await page.goto('/sign-in?redirectTo=%2Freports');

    await expect(page).toHaveURL('/reports');
  });
});
