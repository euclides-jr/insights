import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const authFile = path.join(process.cwd(), 'tests/e2e/.auth/user.json');
const adminEmail = process.env.AUTH_ADMIN_EMAIL ?? 'admin@eventpulse.local';
const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? 'changeme12345';

test('authenticate dashboard user', async ({ page }) => {
  await fs.mkdir(path.dirname(authFile), { recursive: true });

  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.waitForURL('**/');
  await expect(page.locator('h1')).toContainText('Dashboard');

  await page.context().storageState({ path: authFile });
});
