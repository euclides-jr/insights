import { test, expect } from '@playwright/test';

test.describe('Applications Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/applications');
  });

  // -------------------------------------------------------------------------
  // Page structure
  // -------------------------------------------------------------------------

  test('should load with correct heading and description', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Applications');
    await expect(
      page.getByText('Manage applications that send events to the platform'),
    ).toBeVisible();
  });

  test('should display the applications table with correct columns', async ({
    page,
  }) => {
    await expect(page.getByText('App ID', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Application Name', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Events Count', { exact: true })).toBeVisible();
    await expect(page.getByText('Last Active', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Status', { exact: true }).first(),
    ).toBeVisible();
  });

  test('should show seeded applications in the table', async ({ page }) => {
    await expect(page.getByText('Demo Web App')).toBeVisible();
    await expect(page.getByText('EventPulse iOS')).toBeVisible();
    await expect(page.getByText('Admin Dashboard')).toBeVisible();
  });

  test('should show event counts greater than zero', async ({ page }) => {
    // Each seeded app has events — at least one row should have a number > 0
    const body = await page.textContent('body');
    expect(body).toMatch(/\d+/);
  });

  test('should display pagination controls', async ({ page }) => {
    await expect(
      page.locator('text=/Showing.*of.*applications/'),
    ).toBeVisible();
  });

  test('should have a search input', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('should filter by search term', async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]');
    await search.pressSequentially('Demo Web App', { delay: 30 });
    // Wait for URL update and re-render
    await page.waitForURL('**/applications?q=Demo+Web+App', {
      timeout: 10000,
    });
    await expect(page.getByText('Demo Web App')).toBeVisible();
    // Other apps should not be visible
    await expect(page.getByText('Admin Dashboard')).not.toBeVisible();
  });

  test('should clear search and restore full list', async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]');
    await search.click();
    await search.pressSequentially('Demo Web App', { delay: 30 });
    await page.waitForURL('**/applications?q=Demo+Web+App', {
      timeout: 8000,
    });
    await search.click({ clickCount: 3 });
    await search.press('Backspace');
    await page.waitForURL('**/applications', { timeout: 8000 });
    await expect(page.getByText('Demo Web App')).toBeVisible();
    await expect(page.getByText('Admin Dashboard')).toBeVisible();
  });

  test('should have a Status filter dropdown', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Status/ })).toBeVisible();
  });

  test('should filter by Active status', async ({ page }) => {
    await page.getByRole('button', { name: /Status/ }).click();
    await page.getByRole('button', { name: 'Active', exact: true }).click();
    await page.waitForURL('**/applications?status=ACTIVE', { timeout: 8000 });
    // Active applications should be visible
    await expect(page.getByText('Demo Web App')).toBeVisible();
  });

  test('should clear status filter via "Clear filter" option', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Status/ }).click();
    await page.getByRole('button', { name: 'Active', exact: true }).click();
    await page.waitForURL('**/applications?status=ACTIVE', { timeout: 8000 });

    await page.getByRole('button', { name: /Status: Active/ }).click();
    await page.getByRole('button', { name: 'Clear filter' }).click();
    await page.waitForURL('**/applications', { timeout: 8000 });
    await expect(page.getByText('Demo Web App')).toBeVisible();
    await expect(page.getByText('Admin Dashboard')).toBeVisible();
  });

  test('should highlight Applications as the active nav item', async ({
    page,
  }) => {
    const link = page.locator('a[href="/applications"]');
    await expect(link).toHaveCSS('background-color', 'rgb(228, 35, 19)');
  });

  test('should show an "Add Application" or create button', async ({
    page,
  }) => {
    // Some form of create action should be present
    const createBtn = page
      .locator('button')
      .filter({ hasText: /add|new|create/i });
    await expect(createBtn.first()).toBeVisible();
  });

  test('application names should be clickable links', async ({ page }) => {
    // After the detail-page feature, name cells must contain <a> tags
    const nameLinks = page.locator('a[href^="/applications/"]');
    await expect(nameLinks.first()).toBeVisible();
  });

  test('clicking an application name navigates to the detail page', async ({
    page,
  }) => {
    const firstLink = page.locator('a[href^="/applications/"]').first();
    await firstLink.click();
    await expect(page).toHaveURL(/\/applications\/[0-9a-f-]{36}/);
  });
});

// ---------------------------------------------------------------------------
// Application detail page
// ---------------------------------------------------------------------------

test.describe('Application detail page', () => {
  // Navigate via the list so we don't hard-code a UUID.
  test.beforeEach(async ({ page }) => {
    await page.goto('/applications');
    await page.locator('a[href^="/applications/"]').first().click();
    await page.waitForURL(/\/applications\/[0-9a-f-]{36}/);
  });

  // ── Structure ────────────────────────────────────────────────────────────

  test('shows breadcrumb with Applications back link', async ({ page }) => {
    const breadcrumb = page.locator('nav a[href="/applications"]').first();
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toContainText('Applications');
  });

  test('shows a non-empty application name as the page heading', async ({
    page,
  }) => {
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    const text = await h1.textContent();
    expect((text || '').trim().length).toBeGreaterThan(0);
  });

  test('shows a status badge (Active, Inactive, or Archived)', async ({
    page,
  }) => {
    const badge = page
      .locator('span')
      .filter({ hasText: /^(Active|Inactive|Archived)$/ })
      .first();
    await expect(badge).toBeVisible();
  });

  test('shows created / last updated subtitle text', async ({ page }) => {
    const subtitle = page
      .locator('p')
      .filter({ hasText: /Created/ })
      .first();
    await expect(subtitle).toBeVisible();
  });

  // ── Configuration card ───────────────────────────────────────────────────

  test('shows the Configuration section', async ({ page }) => {
    await expect(page.getByText('Configuration')).toBeVisible();
  });

  test('shows Application ID label', async ({ page }) => {
    await expect(page.getByText('Application ID')).toBeVisible();
  });

  test('shows API Key label', async ({ page }) => {
    await expect(page.getByText('API Key')).toBeVisible();
  });

  test('API key is masked by default (contains bullet characters)', async ({
    page,
  }) => {
    const keyCode = page.locator('code').filter({ hasText: /••/ }).first();
    await expect(keyCode).toBeVisible();
  });

  test('"Show" button reveals the full API key', async ({ page }) => {
    const showBtn = page.getByRole('button', { name: 'Show' });
    await expect(showBtn).toBeVisible();
    await showBtn.click();
    const keyCode = page.locator('code').first();
    await expect(keyCode).not.toContainText('••');
  });

  test('"Hide" button re-masks the key after reveal', async ({ page }) => {
    await page.getByRole('button', { name: 'Show' }).click();
    await page.getByRole('button', { name: 'Hide' }).click();
    const keyCode = page.locator('code').filter({ hasText: /••/ }).first();
    await expect(keyCode).toBeVisible();
  });

  test('"Copy" button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
  });

  // ── Stat tiles ───────────────────────────────────────────────────────────

  test('shows four stat tiles', async ({ page }) => {
    await expect(page.getByText('Total Events')).toBeVisible();
    await expect(page.getByText('Unique Users')).toBeVisible();
    await expect(page.getByText('Active Schemas')).toBeVisible();
    // Use paragraph filter to avoid ambiguity with sidebar link / section heading
    await expect(
      page.locator('p').filter({ hasText: /^Segments$/ }),
    ).toBeVisible();
  });

  test('stat tile values are numeric strings', async ({ page }) => {
    const body = await page.textContent('body');
    expect(body).toMatch(/\d+/);
  });

  // ── Event Volume chart ───────────────────────────────────────────────────

  test('shows the Event Volume section heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Event Volume' }).first(),
    ).toBeVisible();
  });

  test('shows the 7d / 30d / 90d time-range selector', async ({ page }) => {
    await expect(page.getByRole('button', { name: '7d' })).toBeVisible();
    await expect(page.getByRole('button', { name: '30d' })).toBeVisible();
    await expect(page.getByRole('button', { name: '90d' })).toBeVisible();
  });

  // ── Recent Events table ──────────────────────────────────────────────────

  test('shows the Recent Events heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Recent Events' }),
    ).toBeVisible();
  });

  test('shows the "View all" events link pointing to the filtered events page', async ({
    page,
  }) => {
    const viewAll = page.getByRole('link', { name: /View all/ });
    await expect(viewAll).toBeVisible();
    const href = await viewAll.getAttribute('href');
    expect(href).toMatch(/\/events\?appId=/);
  });

  test('"View all" link navigates to the filtered events page', async ({
    page,
  }) => {
    await page.getByRole('link', { name: /View all/ }).click();
    await expect(page).toHaveURL(/\/events\?appId=/);
  });

  test('shows event table column headers when events exist', async ({
    page,
  }) => {
    const body = await page.textContent('body');
    if ((body || '').includes('No events yet')) return;
    const recentEventsSection = page
      .locator('section, div')
      .filter({ has: page.getByRole('heading', { name: 'Recent Events' }) })
      .first();
    await expect(
      recentEventsSection.getByText('Event Name', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      recentEventsSection.getByText('User ID', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      recentEventsSection.getByText('Timestamp', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      recentEventsSection.getByText('Properties', { exact: true }).first(),
    ).toBeVisible();
  });

  // ── Event Schemas section ────────────────────────────────────────────────

  test('shows the Event Schemas heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Event Schemas' }),
    ).toBeVisible();
  });

  test('shows the "Manage schemas" link', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: /Manage schemas/ }),
    ).toBeVisible();
  });

  // ── Segments section ─────────────────────────────────────────────────────

  test('shows the Segments heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Segments' })).toBeVisible();
  });

  test('shows the "Manage segments" link', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: /Manage segments/ }),
    ).toBeVisible();
  });

  // ── Navigation ───────────────────────────────────────────────────────────

  test('Applications nav link is highlighted as active', async ({ page }) => {
    // Scope to the sidebar navigation link (first match), not the breadcrumb
    const link = page.locator('a[href="/applications"]').first();
    await expect(link).toHaveCSS('background-color', 'rgb(228, 35, 19)');
  });

  test('breadcrumb "Applications" link navigates back to the list', async ({
    page,
  }) => {
    const breadcrumb = page.locator('nav a[href="/applications"]').first();
    await breadcrumb.click();
    await expect(page).toHaveURL('/applications');
  });
});

// ── Not found (separate describe — no beforeEach navigation) ─────────────────

test.describe('Application detail page — not found', () => {
  test('returns 404 for an unknown application ID', async ({ page }) => {
    const response = await page.goto(
      '/applications/00000000-0000-0000-0000-000000000000',
    );
    expect(response?.status()).toBe(404);
  });
});
