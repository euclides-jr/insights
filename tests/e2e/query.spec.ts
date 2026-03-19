import { test, expect } from '@playwright/test';

test.describe('Query Explorer Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/query');
  });

  // -------------------------------------------------------------------------
  // Page structure
  // -------------------------------------------------------------------------

  test('should load with correct heading and description', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Query Explorer');
    await expect(
      page.getByText('Filter and aggregate event data across your applications'),
    ).toBeVisible();
  });

  test('should show the query form with all key fields', async ({ page }) => {
    await expect(page.locator('select').first()).toBeVisible(); // application picker
    await expect(
      page.locator('input[type="datetime-local"]').first(),
    ).toBeVisible(); // start date
    await expect(
      page.locator('input[type="datetime-local"]').nth(1),
    ).toBeVisible(); // end date
    await expect(page.getByText('Aggregation', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Property Filters' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
  });

  test('should show aggregation options in the dropdown', async ({ page }) => {
    const aggSelect = page.locator('select').nth(1); // second select is aggregation
    await expect(
      aggSelect.locator('option', { hasText: 'Count events' }),
    ).toHaveCount(1);
    await expect(
      aggSelect.locator('option', { hasText: 'Count unique users' }),
    ).toHaveCount(1);
    await expect(
      aggSelect.locator('option', { hasText: 'Average' }),
    ).toHaveCount(1);
    await expect(aggSelect.locator('option', { hasText: 'Sum' })).toHaveCount(
      1,
    );
  });

  test('should show sidebar link for Query Explorer as active', async ({
    page,
  }) => {
    const activeLink = page.locator('a[href="/query"]');
    await expect(activeLink).toBeVisible();
    // Active nav item has red background
    await expect(activeLink).toHaveCSS('background-color', 'rgb(228, 35, 19)');
  });

  // -------------------------------------------------------------------------
  // Aggregation field visibility
  // -------------------------------------------------------------------------

  test('should disable aggregation field when aggregation is count', async ({
    page,
  }) => {
    const aggSelect = page.locator('select').nth(1);
    await aggSelect.selectOption('count');
    const aggField = page.locator('input[placeholder="e.g. amount"]');
    await expect(aggField).toBeDisabled();
  });

  test('should enable aggregation field when aggregation is avg', async ({
    page,
  }) => {
    const aggSelect = page.locator('select').nth(1);
    await aggSelect.selectOption('avg');
    const aggField = page.locator('input[placeholder="e.g. amount"]');
    await expect(aggField).toBeEnabled();
  });

  test('should enable aggregation field when aggregation is sum', async ({
    page,
  }) => {
    const aggSelect = page.locator('select').nth(1);
    await aggSelect.selectOption('sum');
    const aggField = page.locator('input[placeholder="e.g. amount"]');
    await expect(aggField).toBeEnabled();
  });

  // -------------------------------------------------------------------------
  // Running a query
  // -------------------------------------------------------------------------

  test('should show results table after running a count query', async ({
    page,
  }) => {
    // Set a wide date range to ensure results
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2020-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2030-12-31T23:59');

    await page.getByRole('button', { name: 'Run Query' }).click();

    // Wait for results section to appear
    await expect(page.locator('text=/Results \\(/')).toBeVisible({
      timeout: 10000,
    });

    // Results table should have at least a header row
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('th')).toBeVisible();
  });

  test('should show execution time in results', async ({ page }) => {
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2020-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2030-12-31T23:59');

    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=/\\d+ ms/')).toBeVisible({
      timeout: 10000,
    });
  });

  test('should show row count in results heading', async ({ page }) => {
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2020-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2030-12-31T23:59');

    await page.getByRole('button', { name: 'Run Query' }).click();
    // Heading like "Results (1 row)" or "Results (5 rows)"
    await expect(page.locator('text=/Results \\(\\d+ rows?\\)/')).toBeVisible({
      timeout: 10000,
    });
  });

  test('should show "No results" for an empty date range', async ({ page }) => {
    // Far-future range with no events
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2099-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2099-12-31T23:59');

    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=/No results for this query/')).toBeVisible({
      timeout: 10000,
    });
  });

  test('should filter by event name', async ({ page }) => {
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2020-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2030-12-31T23:59');
    await page.locator('input[placeholder="e.g. purchase"]').fill('purchase');

    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=/Results \\(/')).toBeVisible({
      timeout: 10000,
    });
  });

  test('should run a unique_users aggregation', async ({ page }) => {
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2020-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2030-12-31T23:59');

    const aggSelect = page.locator('select').nth(1);
    await aggSelect.selectOption('unique_users');

    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=/Results \\(/')).toBeVisible({
      timeout: 10000,
    });

    // Should have a "value" column in results
    await expect(page.locator('th', { hasText: 'value' })).toBeVisible();
  });

  test('should run a grouped count query', async ({ page }) => {
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2020-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2030-12-31T23:59');

    await page.locator('input[placeholder="e.g. currency"]').fill('currency');

    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=/Results \\(/')).toBeVisible({
      timeout: 10000,
    });

    // Grouped results should have "group" and "value" columns
    await expect(page.locator('th', { hasText: 'group' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'value' })).toBeVisible();
  });

  test('should run a time-bucketed query and allow chart view', async ({
    page,
  }) => {
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2020-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2030-12-31T23:59');

    await page.getByLabel('Grouping mode').selectOption('time');
    await page.getByLabel('Time bucket').selectOption('day');

    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=/Results \\(/')).toBeVisible({
      timeout: 10000,
    });

    await expect(page.locator('th', { hasText: 'group' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'value' })).toBeVisible();

    const chartButton = page.getByRole('button', { name: 'Chart' });
    await expect(chartButton).toBeEnabled();
    await chartButton.click();
    await expect(chartButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.recharts-responsive-container')).toBeVisible();
  });

  test('should show schema-derived field suggestions for purchase queries', async ({
    page,
  }) => {
    await page.locator('select').first().selectOption({ label: 'Demo Web App' });
    await page.locator('input[placeholder="e.g. purchase"]').fill('purchase');

    const suggestions = page
      .locator('p')
      .filter({ hasText: 'Suggested fields:' })
      .last();
    await expect(suggestions).toContainText('amount');
    await expect(suggestions).toContainText('currency');
  });

  test('should add and remove property filter rows', async ({ page }) => {
    await expect(page.getByText('No property filters yet.')).toBeVisible();

    await page.getByRole('button', { name: '+ Add Filter' }).click();
    await expect(page.getByLabel('Property key 1')).toBeVisible();

    await page.getByRole('button', { name: 'Remove property filter 1' }).click();
    await expect(page.getByText('No property filters yet.')).toBeVisible();
  });

  test('should run a query with string property filters', async ({ page }) => {
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2020-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2030-12-31T23:59');
    await page.locator('input[placeholder="e.g. purchase"]').fill('purchase');

    await page.getByRole('button', { name: '+ Add Filter' }).click();
    await page.getByLabel('Property key 1').fill('currency');
    await page.getByLabel('Value 1').fill('USD');

    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=/Results \\(/')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('th', { hasText: 'value' })).toBeVisible();
  });

  test('should run a query with numeric property filters', async ({ page }) => {
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2020-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2030-12-31T23:59');
    await page.locator('input[placeholder="e.g. purchase"]').fill('purchase');

    await page.getByRole('button', { name: '+ Add Filter' }).click();
    await page.getByLabel('Property key 1').fill('amount');
    await page.getByLabel('Property type 1').selectOption('number');
    await page.getByLabel('Operator 1').selectOption('gt');
    await page.getByLabel('Value 1').fill('100');

    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=/Results \\(/')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('th', { hasText: 'value' })).toBeVisible();
  });

  test('should respect grouped row limits', async ({ page }) => {
    await page.locator('select').first().selectOption({ label: 'Demo Web App' });
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2020-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2030-12-31T23:59');

    await page.getByLabel('Grouping mode').selectOption('time');
    await page.getByLabel('Time bucket').selectOption('day');
    await page.getByLabel('Row limit').selectOption('10');

    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=/Results \\(/')).toBeVisible({
      timeout: 10000,
    });

    await expect(page.locator('tbody tr')).toHaveCount(10);
  });

  test('should allow grouped pagination navigation', async ({ page }) => {
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2020-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2030-12-31T23:59');

    await page.getByLabel('Grouping mode').selectOption('time');
    await page.getByLabel('Time bucket').selectOption('day');
    await page.getByLabel('Row limit').selectOption('10');

    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.getByText(/Showing page 1 of/)).toBeVisible({
      timeout: 10000,
    });

    const firstPageFirstRow = await page.locator('tbody tr').first().textContent();
    await page.getByRole('button', { name: 'Next results page' }).click();
    await expect(page.getByText(/Showing page 2 of/)).toBeVisible({
      timeout: 10000,
    });
    const secondPageFirstRow = await page.locator('tbody tr').first().textContent();

    expect(secondPageFirstRow).not.toBe(firstPageFirstRow);
  });

  test('should sort grouped results by group ascending', async ({ page }) => {
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2020-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2030-12-31T23:59');

    await page.getByLabel('Group by field').fill('currency');
    await page.getByLabel('Sort field').selectOption('group');
    await page.getByLabel('Sort direction').selectOption('asc');
    await page.getByLabel('Row limit').selectOption('10');

    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=/Results \\(/')).toBeVisible({
      timeout: 10000,
    });

    const groups = await page.locator('tbody tr td:first-child').allTextContents();
    const sorted = [...groups].sort((a, b) => a.localeCompare(b));
    expect(groups).toEqual(sorted);
  });

  test('should show a validation error for an invalid between filter', async ({
    page,
  }) => {
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2020-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2030-12-31T23:59');

    await page.getByRole('button', { name: '+ Add Filter' }).click();
    await page.getByLabel('Property key 1').fill('amount');
    await page.getByLabel('Property type 1').selectOption('number');
    await page.getByLabel('Operator 1').selectOption('between');
    await page.getByLabel('Value 1').fill('10');

    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.getByText('Validation failed')).toBeVisible({
      timeout: 10000,
    });
  });

  // -------------------------------------------------------------------------
  // Clear button
  // -------------------------------------------------------------------------

  test('should clear results when clicking Clear', async ({ page }) => {
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill('2020-01-01T00:00');
    await page
      .locator('input[type="datetime-local"]')
      .nth(1)
      .fill('2030-12-31T23:59');

    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=/Results \\(/')).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.locator('text=/Results \\(/')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Sidebar navigation
// ---------------------------------------------------------------------------

test.describe('Query Explorer — Sidebar navigation', () => {
  test('should navigate to Query Explorer from sidebar', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/query"]').click();
    await expect(page).toHaveURL(/\/query$/);
    await expect(page.locator('h1')).toContainText('Query Explorer');
  });
});
