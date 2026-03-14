import { test, expect } from '@playwright/test';

test.describe('Setup Verification', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });
});
