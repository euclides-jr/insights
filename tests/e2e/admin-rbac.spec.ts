import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth';
import { createHash } from 'crypto';

function hashInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function getAdminUserId() {
  const adminEmail = process.env.AUTH_ADMIN_EMAIL ?? 'admin@eventpulse.local';
  const adminUser = await prisma.user.findUniqueOrThrow({
    where: { email: adminEmail },
    select: { id: true },
  });

  return adminUser.id;
}

async function createInvitationFixture(input: {
  email: string;
  role?: 'VIEWER' | 'EDITOR' | 'ADMIN';
  expiresAt?: Date;
  acceptedAt?: Date | null;
  acceptedByUserId?: string | null;
}) {
  const token = `fixture-invite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const adminUserId = await getAdminUserId();

  const invitation = await prisma.invitation.create({
    data: {
      email: input.email,
      role: input.role ?? 'VIEWER',
      token,
      tokenHash: hashInvitationToken(token),
      invitedByUserId: adminUserId,
      expiresAt: input.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      acceptedAt: input.acceptedAt ?? null,
      acceptedByUserId: input.acceptedByUserId ?? null,
    },
  });

  return {
    ...invitation,
    url: `/accept-invitation?token=${token}`,
  };
}

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
    browser,
  }) => {
    test.setTimeout(60_000);

    const inviteEmail = `accepted_${Date.now()}@example.com`;
    const invitePassword = 'changeme12345';
    const invitation = await createInvitationFixture({
      email: inviteEmail,
      role: 'VIEWER',
    });

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

    await invitedPage.goto(invitation.url);
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
    await expect(
      invitedPage.getByRole('button', { name: 'Accept Invitation' }),
    ).toBeVisible();

    const acceptResult = await invitedPage.evaluate(async (token) => {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }, invitation.token);

    expect(acceptResult.status).toBe(200);

    await invitedPage.goto(invitation.url);
    await expect(
      invitedPage.getByRole('heading', { name: 'Invitation already accepted' }),
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

  test('shows missing-token state on the accept invitation page', async ({
    page,
  }) => {
    await page.goto('/accept-invitation');

    await expect(
      page.getByRole('heading', { name: 'Invitation missing' }),
    ).toBeVisible();
    await expect(
      page.getByText('The invitation link is missing its token.'),
    ).toBeVisible();
  });

  test('shows not-found state for an invalid invitation token', async ({
    page,
  }) => {
    await page.goto('/accept-invitation?token=invalid-token-for-e2e');

    await expect(
      page.getByRole('heading', { name: 'Invitation not found' }),
    ).toBeVisible();
  });

  test('shows already-accepted state for accepted invitations', async ({
    page,
  }) => {
    const acceptedFixture = await createInvitationFixture({
      email: `accepted-state-${Date.now()}@example.com`,
      acceptedAt: new Date(),
    });

    await page.goto(acceptedFixture.url);

    await expect(
      page.getByRole('heading', { name: 'Invitation already accepted' }),
    ).toBeVisible();
  });

  test('shows wrong-account state when signed-in email does not match the invitation', async ({
    page,
  }) => {
    const wrongAccountFixture = await createInvitationFixture({
      email: `wrong-account-${Date.now()}@example.com`,
    });

    await page.goto(wrongAccountFixture.url);

    await expect(
      page.getByRole('heading', { name: 'Wrong account' }),
    ).toBeVisible();
    await expect(
      page.getByText('but you are signed in as'),
    ).toBeVisible();
  });

  test('shows an error when the invited user tries to accept an expired invitation', async ({
    browser,
  }) => {
    test.setTimeout(60_000);

    const inviteEmail = `expired-${Date.now()}@example.com`;
    const invitePassword = 'changeme12345';
    const expiredFixture = await createInvitationFixture({
      email: inviteEmail,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await auth.api.signUpEmail({
      body: {
        email: inviteEmail,
        password: invitePassword,
        name: 'Expired Invite User',
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

    await invitedPage.goto(expiredFixture.url);
    await invitedPage.getByRole('link', { name: 'Sign in to continue' }).click();
    await invitedPage.getByLabel('Email').fill(inviteEmail);
    await invitedPage.getByLabel('Password').fill(invitePassword);
    await invitedPage.getByRole('button', { name: 'Sign in' }).click();

    await expect(invitedPage).toHaveURL(/\/accept-invitation\?token=/);
    await expect(
      invitedPage.getByRole('heading', { name: 'Accept invitation' }),
    ).toBeVisible();

    const acceptResult = await invitedPage.evaluate(async (token) => {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }, expiredFixture.token);

    expect(acceptResult.status).toBe(409);
    expect(acceptResult.body.error).toBe('Invitation has expired');

    await invitedPage.reload();
    await expect(
      invitedPage.getByRole('heading', { name: 'Accept invitation' }),
    ).toBeVisible();

    await invitedPage.getByRole('button', { name: 'Accept Invitation' }).click();
    await expect(
      invitedPage.getByText('Invitation has expired'),
    ).toBeVisible();

    await invitedContext.close();
  });
});
