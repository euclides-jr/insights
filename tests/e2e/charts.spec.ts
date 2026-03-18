import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// US1: Event Volume Trend on Dashboard
// ---------------------------------------------------------------------------

test.describe('Charts – US1: Event Volume Trend', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the Event Volume chart section on the dashboard', async ({
    page,
  }) => {
    // Heading inside the chart card
    await expect(page.getByText('Event Volume')).toBeVisible();
  });

  test('renders the chart SVG element', async ({ page }) => {
    // recharts renders as SVG; verify at least one SVG is present in the event
    // volume chart card
    const chartCard = page
      .locator('div')
      .filter({ hasText: 'Event Volume' })
      .first();
    await expect(chartCard.locator('svg').first()).toBeVisible();
  });

  test('renders the time range selector with 7d / 30d / 90d options', async ({
    page,
  }) => {
    await expect(page.getByRole('button', { name: '7d' })).toBeVisible();
    await expect(page.getByRole('button', { name: '30d' })).toBeVisible();
    await expect(page.getByRole('button', { name: '90d' })).toBeVisible();
  });

  test('switching to 30-day range updates the chart (button becomes active)', async ({
    page,
  }) => {
    const btn30 = page.getByRole('button', { name: '30d' }).first();
    await btn30.click();
    // After click, 30d button should show as pressed/selected
    await expect(btn30).toHaveAttribute('aria-pressed', 'true');
  });
});

// ---------------------------------------------------------------------------
// US2: Quality Trends Chart on Quality Page
// ---------------------------------------------------------------------------

test.describe('Charts – US2: Quality Trends', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/quality?days=30');
  });

  test('renders the Quality Trends chart section heading', async ({ page }) => {
    await expect(page.getByText('Quality Trends')).toBeVisible();
  });

  test('renders the metrics chart SVG', async ({ page }) => {
    const trendsCard = page
      .locator('div')
      .filter({ hasText: 'Quality Trends' })
      .first();
    await expect(trendsCard.locator('svg').first()).toBeVisible();
  });

  test('renders the chart legend labels', async ({ page }) => {
    const trendsCard = page
      .locator('div')
      .filter({ has: page.getByText('Quality Trends', { exact: true }) })
      .first();
    await expect(
      trendsCard
        .locator('span, div')
        .filter({ hasText: /^Failure Rate$/ })
        .first(),
    ).toBeVisible();
    await expect(
      trendsCard
        .locator('span, div')
        .filter({ hasText: /^Completeness$/ })
        .first(),
    ).toBeVisible();
    await expect(
      trendsCard
        .locator('span, div')
        .filter({ hasText: /^Duplicate Rate$/ })
        .first(),
    ).toBeVisible();
  });

  test('shows time range selector on the quality trends card', async ({
    page,
  }) => {
    // Multiple TimeRangeSelectors may be on the page; just verify at least one set exists
    await expect(
      page.getByRole('group', { name: 'Time range' }).first(),
    ).toBeVisible();
  });

  test('switching time range updates the active button', async ({ page }) => {
    // Find the first time range selector (quality trends card)
    const selector = page.getByRole('group', { name: 'Time range' }).first();
    const btn90 = selector.getByRole('button', { name: '90d' });
    await btn90.click();
    await expect(btn90).toHaveAttribute('aria-pressed', 'true');
  });
});

// ---------------------------------------------------------------------------
// US3: Query Result Chart Toggle
// ---------------------------------------------------------------------------

test.describe('Charts – US3: Query Result Chart Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/query');
  });

  test('runs an aggregation query and shows chart toggle buttons', async ({
    page,
  }) => {
    // Fill minimal form and submit
    await page
      .locator('select')
      .first()
      .selectOption({ index: 0 });

    // Submit query
    await page.getByRole('button', { name: /Run Query/i }).click();

    // Wait for results to appear
    await page.waitForSelector('text=Results', { timeout: 10000 });

    // Toggle buttons should now be visible
    await expect(page.getByRole('button', { name: 'Table' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chart' })).toBeVisible();
  });

  test('chart toggle is initially disabled before a query is run', async ({
    page,
  }) => {
    // No results yet — chart toggle should not be visible
    await expect(page.getByRole('button', { name: 'Chart' })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// US4: Events by Application Bar Chart on Dashboard
// ---------------------------------------------------------------------------

test.describe('Charts – US4: Events by Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the Events by Application chart section heading', async ({
    page,
  }) => {
    await expect(page.getByText('Events by Application')).toBeVisible();
  });

  test('renders the bar chart SVG element', async ({ page }) => {
    const barChartCard = page
      .locator('div')
      .filter({ hasText: 'Events by Application' })
      .first();
    await expect(barChartCard.locator('svg').first()).toBeVisible();
  });

  test('clicking a bar navigates to /events filtered by appId', async ({
    page,
  }) => {
    // Find the bar chart SVG; click the first bar (rect element)
    const barChartCard = page
      .locator('div')
      .filter({ hasText: 'Events by Application' })
      .first();
    const firstBar = barChartCard
      .locator('svg rect.recharts-bar-rectangle')
      .first();

    // Skip if no bar data (seeding may differ in CI)
    const barCount = await firstBar.count();
    if (barCount === 0) {
      test.skip();
      return;
    }

    await firstBar.click({ force: true });
    // After click, URL should change to /events with appId param
    await expect(page).toHaveURL(/\/events\?appId=/, { timeout: 5000 });
  });
});
