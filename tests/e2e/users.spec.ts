import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db/prisma';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_API_KEY = process.env.TEST_API_KEY ?? 'demo_app_key_123';

async function getDemoApplication() {
  const application = await prisma.application.findUnique({
    where: { apiKey: TEST_API_KEY },
    select: { id: true },
  });

  if (!application) {
    throw new Error(`Application not found for API key ${TEST_API_KEY}`);
  }

  return application;
}

async function identifyUser(
  userId: string,
  attributes: Record<string, unknown>,
) {
  const application = await getDemoApplication();
  const existing = await prisma.userProfile.findUnique({
    where: {
      applicationId_userId: {
        applicationId: application.id,
        userId,
      },
    },
    select: {
      attributes: true,
      firstSeen: true,
      eventCount: true,
      lastEventName: true,
      createdAt: true,
    },
  });

  const currentAttributes = (existing?.attributes ?? {}) as Record<
    string,
    unknown
  >;
  const nextAttributes = {
    ...currentAttributes,
    ...attributes,
  };

  await prisma.userProfile.upsert({
    where: {
      applicationId_userId: {
        applicationId: application.id,
        userId,
      },
    },
    update: {
      attributes: nextAttributes,
      lastSeen: new Date(),
    },
    create: {
      applicationId: application.id,
      userId,
      firstSeen: existing?.firstSeen ?? new Date(),
      lastSeen: new Date(),
      eventCount: existing?.eventCount ?? 0,
      lastEventName: existing?.lastEventName ?? 'identify',
      attributes: nextAttributes,
      createdAt: existing?.createdAt ?? new Date(),
    },
  });

  for (const [attributeKey, newValue] of Object.entries(attributes)) {
    await prisma.userAttributeHistory.create({
      data: {
        applicationId: application.id,
        userId,
        attributeKey,
        oldValue:
          currentAttributes[attributeKey] === undefined
            ? null
            : currentAttributes[attributeKey],
        newValue,
      },
    });
  }
}

async function createEventForUser(
  userId: string,
  eventName: string,
  timestamp: Date,
) {
  const application = await getDemoApplication();

  await prisma.event.create({
    data: {
      eventId: `e2e_${eventName}_${userId}_${timestamp.getTime()}`,
      applicationId: application.id,
      eventName,
      userId,
      sessionId: `sess_${userId}`,
      timestamp,
      properties: {},
    },
  });
}

// ─── Users list page ─────────────────────────────────────────────────────────

test.describe('Users list page (/users)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/users');
  });

  test('shows the Users heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  });

  test('shows subtitle text', async ({ page }) => {
    await expect(
      page.getByText('Browse, filter, and query user attribute profiles'),
    ).toBeVisible();
  });

  test('renders the attribute filter form', async ({ page }) => {
    await expect(page.getByPlaceholder('plan_type')).toBeVisible();
  });

  test('shows a table with seeded users', async ({ page }) => {
    await page
      .locator('select')
      .first()
      .selectOption({ label: 'Demo Web App' });
    await page.getByRole('button', { name: 'Find users' }).click();
    await expect(page.getByText('User ID')).toBeVisible();
    await expect(page.getByText('Last seen')).toBeVisible();
    // Use nth(1) since the sidebar nav also contains an "Events" link
    await expect(page.getByText('Events').nth(1)).toBeVisible();
    await expect(page.getByText('Last event')).toBeVisible();
  });

  test('shows seeded pro-plan users in the table', async ({ page }) => {
    // Filter by plan=pro so seeded pro users appear on page 1 (unfiltered they'd be on page 3)
    await page
      .locator('select')
      .first()
      .selectOption({ label: 'Demo Web App' });
    await page.getByPlaceholder('plan_type').fill('plan');
    await page.getByPlaceholder('pro').fill('pro');
    await page.getByRole('button', { name: 'Find users' }).click();
    // web_user_4 is seeded with plan=pro; use exact:true to avoid matching web_user_40 etc.
    await expect(page.getByText('web_user_4', { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('Users nav link is active when on /users', async ({ page }) => {
    const link = page.getByRole('link', { name: 'Users' });
    await expect(link).toBeVisible();
    // active link has bg-[#E42313] which means text is white
    await expect(link).toHaveClass(/bg-\[#E42313\]/);
  });

  test('attribute filter form has operator select', async ({ page }) => {
    const operatorSelect = page.locator('select').first();
    await expect(operatorSelect).toBeVisible();
  });

  test('filter by plan = pro shows pro users', async ({ page }) => {
    // Select the right application first
    await page
      .locator('select')
      .first()
      .selectOption({ label: 'Demo Web App' });
    // Fill in the attribute filter
    await page.getByPlaceholder('plan_type').fill('plan');
    // The operator select defaults to "="
    await page.getByPlaceholder('pro').fill('pro');
    // Register response listener BEFORE clicking to avoid race condition
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/users') && resp.status() === 200,
    );
    await page.getByRole('button', { name: 'Find users' }).click();
    await responsePromise;

    // Enterprise users should NOT be in the pro-filtered results (exact match to avoid
    // matching web_user_10, web_user_11 etc. which may also be pro-plan)
    await expect(
      page.getByText('web_user_1', { exact: true }),
    ).not.toBeVisible();
    // A seeded pro user should be visible
    await expect(page.getByText('web_user_4', { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('Add Filter button adds a new filter row', async ({ page }) => {
    const initialInputs = await page.getByPlaceholder('plan_type').count();
    await page.getByText('+ Add filter').click();
    const updatedInputs = await page.getByPlaceholder('plan_type').count();
    expect(updatedInputs).toBe(initialInputs + 1);
  });

  test('clicking a user userId navigates to user detail page', async ({
    page,
  }) => {
    await page
      .locator('select')
      .first()
      .selectOption({ label: 'Demo Web App' });
    await page.getByRole('button', { name: 'Find users' }).click();
    // Wait for the table to render and grab the first user ID link
    const firstUserLink = page.locator('a[href^="/users/"]').first();
    await expect(firstUserLink).toBeVisible({ timeout: 10_000 });
    const userId = await firstUserLink.textContent();
    await firstUserLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/users/${encodeURIComponent(userId?.trim() ?? '')}$`),
    );
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      userId?.trim() ?? '',
    );
  });

  test('combined query uses historical attributes active at event time (FR-019)', async ({
    page,
  }) => {
    const userId = `e2e_hist_${Date.now()}`;
    const eventName = `historical_checkout_${Date.now()}`;
    const initialAttrAt = new Date(Date.now() - 5_000);
    const eventTime = new Date(Date.now() - 3_000);
    const finalAttrAt = new Date(Date.now() - 1_000);
    const application = await getDemoApplication();

    await prisma.userProfile.upsert({
      where: {
        applicationId_userId: {
          applicationId: application.id,
          userId,
        },
      },
      update: {
        attributes: { historical_plan: 'enterprise' },
        eventCount: 1,
        lastEventName: eventName,
        firstSeen: initialAttrAt,
        lastSeen: finalAttrAt,
      },
      create: {
        applicationId: application.id,
        userId,
        attributes: { historical_plan: 'enterprise' },
        eventCount: 1,
        lastEventName: eventName,
        firstSeen: initialAttrAt,
        lastSeen: finalAttrAt,
        createdAt: initialAttrAt,
      },
    });

    await prisma.userAttributeHistory.createMany({
      data: [
        {
          applicationId: application.id,
          userId,
          attributeKey: 'historical_plan',
          oldValue: null,
          newValue: 'pro',
          changedAt: initialAttrAt,
        },
        {
          applicationId: application.id,
          userId,
          attributeKey: 'historical_plan',
          oldValue: 'pro',
          newValue: 'enterprise',
          changedAt: finalAttrAt,
        },
      ],
    });

    await prisma.event.create({
      data: {
        eventId: `e2e_${eventName}_${userId}_${eventTime.getTime()}`,
        applicationId: application.id,
        eventName,
        userId,
        sessionId: `sess_${userId}`,
        timestamp: eventTime,
        properties: {},
      },
    });

    await page
      .locator('select')
      .first()
      .selectOption({ label: 'Demo Web App' });
    const attrRow = page.getByPlaceholder('plan_type').locator('xpath=ancestor::div[1]');
    const attrInputs = attrRow.locator('input');
    await attrInputs.nth(0).fill('historical_plan');
    await attrInputs.nth(1).fill('pro');
    await expect(attrInputs.nth(1)).toHaveValue('pro');

    await page.getByRole('button', { name: 'Expand' }).click();
    await page.getByRole('button', { name: '+ Add event filter' }).click();
    const eventNameInput = page.getByPlaceholder('event_name');
    const eventRow = eventNameInput.locator('xpath=ancestor::div[1]');
    await eventRow.locator('select').first().selectOption('performed');
    await eventNameInput.fill(eventName);
    await page.getByPlaceholder('days').fill('1');

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/users/query') && resp.status() === 200,
    );
    await page.getByRole('button', { name: 'Find users' }).click();
    const response = await responsePromise;
    const data = (await response.json()) as { users?: Array<{ userId: string }> };

    expect(data.users?.some((user) => user.userId === userId)).toBe(true);

    await expect(page.getByText(userId, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });
});

// ─── Users detail page (/users/:userId) ──────────────────────────────────────

test.describe('User detail page (/users/:userId)', () => {
  const TEST_USER_ID = 'e2e_detail_user_1';

  test.beforeAll(async () => {
    await identifyUser(TEST_USER_ID, {
      plan: 'pro',
      country: 'US',
      role: 'admin',
    });
    // Update once to create a history entry
    await identifyUser(TEST_USER_ID, { plan: 'enterprise' });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/users/${TEST_USER_ID}`);
  });

  test('shows the user ID as heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      TEST_USER_ID,
    );
  });

  test('shows breadcrumb with Users link', async ({ page }) => {
    // Target the breadcrumb nav specifically (it contains a "/" span, sidebar does not)
    const breadcrumbNav = page
      .locator('nav')
      .filter({ has: page.locator('span', { hasText: '/' }) });
    const breadcrumbLink = breadcrumbNav.getByRole('link', { name: 'Users' });
    await expect(breadcrumbLink).toBeVisible();
    await breadcrumbLink.click();
    await expect(page).toHaveURL('/users');
  });

  test('shows event count stat', async ({ page }) => {
    await expect(page.getByText('Total events')).toBeVisible();
  });

  test('shows attributes table with plan key', async ({ page }) => {
    // Use first() to avoid strict mode violation from multiple "plan"/"enterprise" text nodes
    await expect(page.getByText('plan').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('enterprise').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('shows attribute history section', async ({ page }) => {
    await expect(page.getByText('Attribute history')).toBeVisible();
  });

  test('attribute history contains plan change', async ({ page }) => {
    await expect(page.getByText('Attribute history')).toBeVisible();
    // Should show the "plan" key in history
    const historySection = page.locator('text=Attribute history').locator('..');
    // Check that the history table has at least one row for "plan"
    await expect(page.getByText('pro').first()).toBeVisible();
  });

  test('shows update attributes form', async ({ page }) => {
    await expect(page.getByText('Update attributes')).toBeVisible();
  });

  test('returns 404 page for unknown userId', async ({ page }) => {
    await page.goto('/users/completely_unknown_user_xyz_404');
    // Custom not-found.tsx renders a "User not found" heading
    await expect(
      page.getByRole('heading', { name: /user not found/i }),
    ).toBeVisible();
  });
});

// ─── User detail page — attribute update ─────────────────────────────────────

test.describe('User attribute update form', () => {
  const TEST_USER_ID = 'e2e_update_user_1';

  test.beforeAll(async () => {
    await identifyUser(TEST_USER_ID, { plan: 'starter', country: 'FR' });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/users/${TEST_USER_ID}`);
  });

  test('pre-fills attribute key inputs with existing values', async ({
    page,
  }) => {
    // The form should render with at least one key/value row pre-filled
    const keyInputs = page.getByPlaceholder('plan_type');
    await expect(keyInputs.first()).toBeVisible({ timeout: 10_000 });
    const count = await keyInputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('adds a new attribute row and saves successfully', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add attribute' }).click();

    // Fill in the new row that was added (last key/value pair)
    const keyInputs = page.getByPlaceholder('plan_type');
    const valueInputs = page.getByPlaceholder('pro');
    const count = await keyInputs.count();

    await keyInputs.nth(count - 1).fill('e2e_new_key');
    await valueInputs.nth(count - 1).fill('e2e_value_123');

    await page.getByRole('button', { name: /save attributes/i }).click();

    await expect(page.getByText('Attributes saved successfully.')).toBeVisible({
      timeout: 10_000,
    });
  });
});

// ─── Users list — pagination ─────────────────────────────────────────────────
//
// These tests create a controlled set of users with a unique tag attribute so
// we can deterministically exercise multi-page behaviour without depending on
// whatever test_user_* rows were left in the DB by prior runs.

test.describe('Users list — pagination', () => {
  // Unique per test-run so parallel / re-runs don't interfere
  const GROUP_TAG = `paginationtag${Date.now()}`;
  const PAGE_SIZE = 50;
  const TOTAL_USERS = 55; // deliberately > one page

  // Create 55 tagged users before any test in this suite runs.
  // identifyUser is limited to 100 per batch but we can fan-out in parallel.
  test.beforeAll(async () => {
    await Promise.all(
      Array.from({ length: TOTAL_USERS }, (_, i) =>
        identifyUser(`e2e_pg_${GROUP_TAG}_${String(i + 1).padStart(3, '0')}`, {
          pagination_group: GROUP_TAG,
        }),
      ),
    );
  });

  // Helper: select Demo Web App, apply the unique group filter, click Find users,
  // wait until the API response arrives.
  async function applyFilter(page: import('@playwright/test').Page) {
    await page
      .locator('select')
      .first()
      .selectOption({ label: 'Demo Web App' });
    await page.getByPlaceholder('plan_type').fill('pagination_group');
    await page.getByPlaceholder('pro').fill(GROUP_TAG);
    const apiResponse = page.waitForResponse(
      (r) => r.url().includes('/api/users') && r.status() === 200,
    );
    await page.getByRole('button', { name: 'Find users' }).click();
    await apiResponse;
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/users');
  });

  // ── Showing text ────────────────────────────────────────────────────────────

  test('showing text is "Showing 1–50 of 55" on page 1', async ({ page }) => {
    await applyFilter(page);
    // BUG REGRESSION: pagination.totalCount (API) was not mapped to
    // pagination.total (client) so the banner read "Showing 1–NaN of undefined".
    await expect(
      page.getByText(`Showing 1–${PAGE_SIZE} of ${TOTAL_USERS}`),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── Prev / Next button states ───────────────────────────────────────────────

  test('"← Prev" is disabled on page 1', async ({ page }) => {
    await applyFilter(page);
    await expect(page.getByRole('button', { name: '← Prev' })).toBeDisabled({
      timeout: 10_000,
    });
  });

  test('"Next →" is enabled on page 1 when there is a second page', async ({
    page,
  }) => {
    await applyFilter(page);
    await expect(page.getByRole('button', { name: 'Next →' })).toBeEnabled({
      timeout: 10_000,
    });
  });

  // ── Forward navigation ──────────────────────────────────────────────────────

  test('clicking "Next →" loads page 2 and shows remaining users', async ({
    page,
  }) => {
    await applyFilter(page);
    const nextResponse = page.waitForResponse(
      (r) => r.url().includes('/api/users') && r.status() === 200,
    );
    await page.getByRole('button', { name: 'Next →' }).click();
    await nextResponse;

    const remaining = TOTAL_USERS - PAGE_SIZE; // 5
    await expect(
      page.getByText(
        `Showing ${PAGE_SIZE + 1}–${TOTAL_USERS} of ${TOTAL_USERS}`,
      ),
    ).toBeVisible({ timeout: 10_000 });
    // Exactly `remaining` user links on this page
    await expect(
      page.locator(`a[href^="/users/e2e_pg_${GROUP_TAG}_"]`),
    ).toHaveCount(remaining, { timeout: 10_000 });
  });

  test('"← Prev" is enabled on page 2', async ({ page }) => {
    await applyFilter(page);
    await page.getByRole('button', { name: 'Next →' }).click();
    await page.waitForResponse(
      (r) => r.url().includes('/api/users') && r.status() === 200,
    );
    await expect(page.getByRole('button', { name: '← Prev' })).toBeEnabled({
      timeout: 10_000,
    });
  });

  test('"Next →" is disabled on the last page', async ({ page }) => {
    await applyFilter(page);
    const nextPageResponse = page.waitForResponse(
      (r) => r.url().includes('/api/users') && r.status() === 200,
    );
    await page.getByRole('button', { name: 'Next →' }).click();
    await nextPageResponse;
    await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled({
      timeout: 10_000,
    });
  });

  // ── Back navigation ─────────────────────────────────────────────────────────

  test('clicking "← Prev" on page 2 returns to page 1', async ({ page }) => {
    await applyFilter(page);
    // Go forward
    await page.getByRole('button', { name: 'Next →' }).click();
    await page.waitForResponse(
      (r) => r.url().includes('/api/users') && r.status() === 200,
    );
    // Go back
    const prevResponse = page.waitForResponse(
      (r) => r.url().includes('/api/users') && r.status() === 200,
    );
    await page.getByRole('button', { name: '← Prev' }).click();
    await prevResponse;

    await expect(
      page.getByText(`Showing 1–${PAGE_SIZE} of ${TOTAL_USERS}`),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── Non-overlapping pages ───────────────────────────────────────────────────

  test('page 1 and page 2 contain no duplicate user IDs', async ({ page }) => {
    await applyFilter(page);
    const page1Links = page.locator(`a[href^="/users/e2e_pg_${GROUP_TAG}_"]`);
    const page1Ids = await page1Links.allTextContents();
    expect(page1Ids.length).toBe(PAGE_SIZE);

    await page.getByRole('button', { name: 'Next →' }).click();
    await page.waitForResponse(
      (r) => r.url().includes('/api/users') && r.status() === 200,
    );
    const page2Links = page.locator(`a[href^="/users/e2e_pg_${GROUP_TAG}_"]`);
    const page2Ids = await page2Links.allTextContents();

    const duplicates = page1Ids.filter((id) => page2Ids.includes(id));
    expect(duplicates).toHaveLength(0);
  });

  // ── Single-page result set ──────────────────────────────────────────────────

  test('no pagination controls when result fits in a single page', async ({
    page,
  }) => {
    // Create a small isolated group (3 users) and filter to it
    const smallTag = `smallgroup${Date.now()}`;
    await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        identifyUser(`e2e_small_${smallTag}_${i + 1}`, {
          pagination_group: smallTag,
        }),
      ),
    );

    await page
      .locator('select')
      .first()
      .selectOption({ label: 'Demo Web App' });
    await page.getByPlaceholder('plan_type').fill('pagination_group');
    await page.getByPlaceholder('pro').fill(smallTag);
    await page.getByRole('button', { name: 'Find users' }).click();
    await page.waitForResponse(
      (r) => r.url().includes('/api/users') && r.status() === 200,
    );
    await page.waitForSelector(`a[href^="/users/e2e_small_${smallTag}_"]`, {
      timeout: 10_000,
    });

    // Neither Prev nor Next should be rendered (totalPages === 1)
    await expect(page.getByRole('button', { name: '← Prev' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Next →' })).toHaveCount(0);
  });

  // ── Regression: URL-based Pagination component dead-nav bug ────────────────
  // The UsersTable previously rendered a <Pagination> component that used
  // router.push(?page=N) on button click.  UsersPageClient is a client
  // component that does NOT read `page` from the URL, so those button clicks
  // changed the URL address bar but left the displayed results unchanged.
  // After the fix, only the "← Prev" / "Next →" buttons in UsersPageClient
  // drive navigation; the dead URL-based controls are no longer rendered.

  test('no stale-page regression: page 2 rows are fetched via state, not URL', async ({
    page,
  }) => {
    await applyFilter(page);
    const nextResponse = page.waitForResponse(
      (r) => r.url().includes('/api/users') && r.status() === 200,
    );
    await page.getByRole('button', { name: 'Next →' }).click();
    const res = await nextResponse;

    // The actual API request must include page=2 in the query string
    expect(new URL(res.url()).searchParams.get('page')).toBe('2');

    // And the data shown belongs to page 2 (5 rows, not 50)
    await expect(
      page.locator(`a[href^="/users/e2e_pg_${GROUP_TAG}_"]`),
    ).toHaveCount(TOTAL_USERS - PAGE_SIZE, { timeout: 10_000 });
  });
});

// ─── Sidebar navigation ───────────────────────────────────────────────────────

test.describe('Sidebar Users link', () => {
  test('is present in the sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
  });

  test('navigates to /users when clicked', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL('/users');
  });
});
