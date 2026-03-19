import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth';

test.describe('Members settings page', () => {
  test.describe.configure({ mode: 'serial' });

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
    await inviteRow.getByRole('button', { name: 'Copy URL' }).click();
    await expect(inviteRow.getByRole('button', { name: 'Copied' })).toBeVisible();

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

  test('accepts an invitation from the invitation page', async ({
    page,
    browser,
  }) => {
    const inviteEmail = `accepted_${Date.now()}@example.com`;
    const invitePassword = 'changeme12345';

    await page.goto('/settings/members');
    await page.getByRole('button', { name: '+ Invite Member' }).click();
    await page.getByPlaceholder('viewer@example.com').fill(inviteEmail);
    await page.getByLabel('Role', { exact: true }).first().selectOption('VIEWER');

    const createResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/invitations') &&
      response.request().method() === 'POST' &&
      response.status() === 201,
    );

    await page.getByRole('button', { name: 'Create Invitation' }).click();
    await createResponse;

    const inviteUrlText = await page
      .locator('p')
      .filter({ hasText: '/accept-invitation?token=' })
      .last()
      .textContent();

    expect(inviteUrlText).toContain('/accept-invitation?token=');

    await auth.api.signUpEmail({
      body: {
        email: inviteEmail,
        password: invitePassword,
        name: 'Accepted Viewer',
      },
    });

    await prisma.user.updateMany({
      where: { email: inviteEmail },
      data: { emailVerified: true },
    });

    const invitedContext = await browser.newContext({
      baseURL: 'http://localhost:3000',
      storageState: { cookies: [], origins: [] },
    });
    const invitedPage = await invitedContext.newPage();

    await invitedPage.goto(inviteUrlText ?? '/accept-invitation');
    await expect(
      invitedPage.getByRole('heading', { name: 'Sign in to accept' }),
    ).toBeVisible();

    await invitedPage.getByRole('link', { name: 'Sign in to continue' }).click();
    await expect(invitedPage).toHaveURL(/\/sign-in\?redirectTo=/);

    await invitedPage.getByLabel('Email').fill(inviteEmail);
    await invitedPage.getByLabel('Password').fill(invitePassword);
    await invitedPage.getByRole('button', { name: 'Sign in' }).click();

    await expect(invitedPage).toHaveURL(/\/accept-invitation\?token=/);
    await expect(
      invitedPage.getByRole('heading', { name: 'Accept invitation' }),
    ).toBeVisible();

    const acceptResponse = invitedPage.waitForResponse((response) =>
      response.url().endsWith('/api/invitations/accept') &&
      response.request().method() === 'POST' &&
      response.status() === 200,
    );

    await invitedPage.getByRole('button', { name: 'Accept Invitation' }).click();
    await acceptResponse;

    await expect(
      invitedPage.getByRole('heading', { name: 'Invitation accepted' }),
    ).toBeVisible();

    const invitedUser = await prisma.user.findUniqueOrThrow({
      where: { email: inviteEmail },
      select: { id: true },
    });
    const membership = await prisma.workspaceMember.findUnique({
      where: { userId: invitedUser.id },
      select: { role: true },
    });

    expect(membership?.role).toBe('VIEWER');

    await invitedContext.close();
  });
});
