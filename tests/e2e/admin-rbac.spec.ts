import { test, expect } from '@playwright/test';

test.describe('Members settings page', () => {
  test('navigates to the members page from the sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Members' }).click();

    await expect(page).toHaveURL(/\/settings\/members$/);
    await expect(
      page.getByRole('heading', { name: 'Members', exact: true }).first(),
    ).toBeVisible();
  });

  test('shows the members admin page and allows creating/revoking an invite', async ({
    page,
  }) => {
    const inviteEmail = `invite_${Date.now()}@example.com`;

    await page.goto('/settings/members');

    await expect(
      page.getByRole('heading', { name: 'Members', exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText('Invite teammates and manage workspace roles'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Members' })).toHaveCSS(
      'background-color',
      'rgb(228, 35, 19)',
    );

    await page.getByRole('button', { name: '+ Invite Member' }).click();
    await expect(
      page.getByRole('heading', { name: 'Invite Member' }),
    ).toBeVisible();
    await page.getByPlaceholder('viewer@example.com').fill(inviteEmail);
    await page.getByLabel('Role', { exact: true }).first().selectOption('VIEWER');

    const createResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/invitations') &&
      response.request().method() === 'POST' &&
      response.status() === 201,
    );

    await page.getByRole('button', { name: 'Create Invitation' }).click();
    await createResponse;

    await page.reload();
    const inviteRow = page.locator('div.border-t').filter({ hasText: inviteEmail }).first();
    await expect(inviteRow).toBeVisible({ timeout: 10000 });

    const revokeResponse = page.waitForResponse((response) =>
      response.url().includes('/api/invitations/') &&
      response.url().endsWith('/revoke') &&
      response.request().method() === 'POST' &&
      response.status() === 200,
    );

    await inviteRow.getByRole('button', { name: 'Revoke' }).click();
    await revokeResponse;

    await expect(
      page.locator('div.border-t').filter({ hasText: inviteEmail }),
    ).toHaveCount(0, { timeout: 10000 });
  });

  test('requires confirmation before role changes and member removal', async ({
    page,
  }) => {
    await page.goto('/settings/members');

    await page
      .getByLabel('Role for editor@eventpulse.local')
      .selectOption('VIEWER');

    await expect(
      page.getByRole('heading', { name: 'Confirm Role Change' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(
      page.getByRole('heading', { name: 'Confirm Role Change' }),
    ).toHaveCount(0);

    const editorRow = page
      .locator('div.border-t')
      .filter({ hasText: 'editor@eventpulse.local' })
      .first();
    await editorRow.getByRole('button', { name: 'Remove' }).click();

    await expect(
      page.getByRole('heading', { name: 'Confirm Member Removal' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(
      page.getByRole('heading', { name: 'Confirm Member Removal' }),
    ).toHaveCount(0);
  });
});
