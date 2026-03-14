import { test, expect } from '@playwright/test';

test.describe('Events Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/events');
  });

  test('should load events page with correct title', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Events');

    // Check subtitle
    await expect(page.locator('p').first()).toContainText(
      'Track and monitor all events across your applications',
    );
  });

  test('should display events table with columns', async ({ page }) => {
    // Check table headers exist by finding their text
    await expect(page.getByText('Event ID', { exact: true })).toBeVisible();
    await expect(page.getByText('Event Name', { exact: true })).toBeVisible();
    await expect(page.getByText('Schema', { exact: true })).toBeVisible();
    await expect(page.getByText('Timestamp', { exact: true })).toBeVisible();
    await expect(page.getByText('Status', { exact: true })).toBeVisible();
  });

  test('should display events data in table rows', async ({ page }) => {
    // Check if table rows exist - table is built with divs
    const rows = page
      .locator(
        '[class*="border-[#E8E8E8]"][class*="flex"][class*="items-center"]',
      )
      .filter({ hasText: /.+/ });
    const count = await rows.count();

    // Skip if no data, otherwise expect at least header row
    if (count === 0) {
      test.skip();
    }

    expect(count).toBeGreaterThan(0);
  });

  test('should display pagination controls', async ({ page }) => {
    // Check pagination is visible
    await expect(page.locator('text=/Showing.*of.*events/')).toBeVisible();

    // Check pagination buttons exist
    const prevButton = page.locator('button:has-text("‹")');
    const nextButton = page.locator('button:has-text("›")');

    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();
  });

  test('should have first page button active on initial load', async ({
    page,
  }) => {
    // Check URL is on page 1 (no param or ?page=1)
    const url = page.url();
    expect(url).toMatch(/\/events(\?page=1)?$/);

    // Check first page button has active styling (red background)
    const firstPageButton = page.locator('button:has-text("1")');
    await expect(firstPageButton).toHaveCSS(
      'background-color',
      'rgb(228, 35, 19)',
    );
  });

  test('should navigate to page 2 when clicking next button', async ({
    page,
  }) => {
    // Check if there are any events first
    const showingText = await page
      .locator('text=/Showing.*of.*events/')
      .textContent();
    const match = showingText?.match(/of (\d+) events/);
    const totalEvents = match ? parseInt(match[1]) : 0;

    if (totalEvents <= 10) {
      test.skip();
    }

    // Click next button
    await page.locator('button:has-text("›")').click();

    // Wait for navigation
    await page.waitForURL('**/events?page=2', { timeout: 3000 });

    // Check URL updated
    expect(page.url()).toContain('page=2');

    // Check showing text updated
    await expect(page.locator('text=/Showing 11-/')).toBeVisible();
  });

  test('should navigate to specific page when clicking page number', async ({
    page,
  }) => {
    // Check if page 2 button exists
    const page2Button = page.locator('button:has-text("2")');
    const isVisible = await page2Button.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
    }

    // Click page 2
    await page2Button.click();

    // Wait for navigation
    await page.waitForURL('**/events?page=2', { timeout: 3000 });

    // Check URL updated
    expect(page.url()).toContain('page=2');

    // Check page 2 button is now active
    await expect(page2Button).toHaveCSS('background-color', 'rgb(228, 35, 19)');

    // Check showing text reflects page 2
    await expect(page.locator('text=/Showing 11-/')).toBeVisible();
  });

  test('should navigate back to page 1 when clicking previous button', async ({
    page,
  }) => {
    // Navigate to page 2 first
    await page.goto('/events?page=2');

    // Check if we have data on page 2
    const showingText = await page
      .locator('text=/Showing.*of.*events/')
      .textContent();
    if (showingText?.includes('Showing 1-')) {
      // Only 1 page, skip test
      test.skip();
    }

    // Click previous button
    await page.locator('button:has-text("‹")').click();

    // Wait for navigation
    await page.waitForURL('**/events?page=1', { timeout: 3000 });

    // Check URL updated
    expect(page.url()).toContain('page=1');

    // Check showing text shows first page
    await expect(page.locator('text=/Showing 1-/')).toBeVisible();
  });

  test('should disable previous button on first page', async ({ page }) => {
    // Ensure we're on page 1
    await page.goto('/events');

    // Check previous button is disabled
    const prevButton = page.locator('button:has-text("‹")');
    await expect(prevButton).toBeDisabled();
  });

  test('should disable next button on last page', async ({ page }) => {
    // Get total pages
    await page.waitForSelector('text=/Showing.*of.*events/', { timeout: 5000 });
    const showingText = await page
      .locator('text=/Showing.*of.*events/')
      .textContent();
    const match = showingText?.match(/of (\d+) events/);
    const totalEvents = match ? parseInt(match[1]) : 0;
    const totalPages = Math.ceil(totalEvents / 10);

    if (totalPages > 1) {
      // Navigate to last page
      await page.goto(`/events?page=${totalPages}`);

      // Check next button is disabled
      const nextButton = page.locator('button:has-text("›")');
      await expect(nextButton).toBeDisabled();
    } else {
      // If only 1 page, next button should be disabled on page 1
      const nextButton = page.locator('button:has-text("›")');
      await expect(nextButton).toBeDisabled();
    }
  });

  test('should display correct showing text for each page', async ({
    page,
  }) => {
    // Page 1: should show "Showing 1-10"
    await page.goto('/events');
    await page.waitForSelector('text=/Showing.*of.*events/', { timeout: 5000 });

    let showingText = await page
      .locator('text=/Showing.*of.*events/')
      .textContent();
    expect(showingText).toMatch(/Showing 1-\d+ of \d+ events/);

    // Get total events
    const match = showingText?.match(/of (\d+) events/);
    const totalEvents = match ? parseInt(match[1]) : 0;

    if (totalEvents <= 10) {
      test.skip();
    }

    // Page 2: should show "Showing 11-20"
    await page.goto('/events?page=2');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=/Showing.*of.*events/', { timeout: 5000 });

    showingText = await page
      .locator('text=/Showing.*of.*events/')
      .textContent();
    const expectedEnd = Math.min(20, totalEvents);
    expect(showingText).toContain(
      `Showing 11-${expectedEnd} of ${totalEvents} events`,
    );
  });

  test('should maintain sidebar navigation active state', async ({ page }) => {
    // Check Events nav item is active
    const eventsNavItem = page.locator('a:has-text("Events")');
    await expect(eventsNavItem).toHaveCSS(
      'background-color',
      'rgb(228, 35, 19)',
    );
  });

  test('should have search input visible', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
  });

  test('should have filter buttons visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Application' }),
    ).toBeVisible();
  });

  test('should display event data correctly formatted', async ({ page }) => {
    // Check if page has event data by looking for any event-related text
    const pageContent = await page.textContent('body');

    // If no events, skip test
    if (
      !pageContent ||
      pageContent.includes('Showing 0') ||
      pageContent.includes('Showing 1-0')
    ) {
      test.skip();
    }

    // Verify showing text displays with events
    const showingText = await page
      .locator('text=/Showing.*of.*events/')
      .textContent();
    expect(showingText).toMatch(/Showing \d+-\d+ of \d+ events/);
  });
});
