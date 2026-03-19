import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db/prisma';

function atUtcDayOffset(daysAgo: number, hour = 10) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

async function seedRetentionApplication() {
  const suffix = Date.now();
  const application = await prisma.application.create({
    data: {
      name: `Retention App ${suffix}`,
      apiKey: `retention_key_${suffix}`,
    },
  });

  const userA = `retention_user_a_${suffix}`;
  const userB = `retention_user_b_${suffix}`;

  await prisma.event.createMany({
    data: [
      {
        eventId: `ret_${suffix}_1`,
        applicationId: application.id,
        eventName: 'page_view',
        userId: userA,
        sessionId: `sess_${userA}`,
        timestamp: atUtcDayOffset(6, 9),
        properties: {},
      },
      {
        eventId: `ret_${suffix}_2`,
        applicationId: application.id,
        eventName: 'page_view',
        userId: userB,
        sessionId: `sess_${userB}`,
        timestamp: atUtcDayOffset(6, 12),
        properties: {},
      },
      {
        eventId: `ret_${suffix}_3`,
        applicationId: application.id,
        eventName: 'purchase',
        userId: userA,
        sessionId: `sess_${userA}`,
        timestamp: atUtcDayOffset(5, 9),
        properties: {},
      },
      {
        eventId: `ret_${suffix}_4`,
        applicationId: application.id,
        eventName: 'purchase',
        userId: userB,
        sessionId: `sess_${userB}`,
        timestamp: atUtcDayOffset(4, 9),
        properties: {},
      },
    ],
  });

  return application;
}

async function seedEmptyRetentionApplication() {
  const suffix = Date.now();
  return prisma.application.create({
    data: {
      name: `Empty Retention App ${suffix}`,
      apiKey: `retention_empty_key_${suffix}`,
    },
  });
}

test.describe('Retention page', () => {
  test('shows the Retention heading and sidebar state', async ({ page }) => {
    await page.goto('/retention');

    await expect(
      page.getByRole('heading', { name: 'Retention', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Measure how often users return after their first observed activity'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Retention' })).toHaveCSS(
      'background-color',
      'rgb(228, 35, 19)',
    );
  });

  test('runs retention for a seeded application and renders the grid', async ({
    page,
  }) => {
    const application = await seedRetentionApplication();

    await page.goto('/retention');
    await page.getByLabel('Application').selectOption({ label: application.name });
    await page.getByLabel('Interval').selectOption('daily');
    await page.getByLabel('Window Size').selectOption('7');
    await page.getByLabel('Window Unit').selectOption('days');
    await page.getByLabel('Return Event').fill('purchase');

    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith('/api/retention/run') &&
      response.request().method() === 'POST',
    );

    await page.getByRole('button', { name: 'Run Retention' }).click();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    const payload = await response.json();
    expect(payload.applicationId).toBe(application.id);
    expect(payload.interval).toBe('daily');
    expect(payload.buckets).toContain('D1');
    expect(payload.cohorts.length).toBeGreaterThan(0);

    const grid = page.getByTestId('retention-grid');
    await expect(grid).toBeVisible();
    await expect(grid.getByText('D0')).toBeVisible();
    await expect(grid.getByText('D1')).toBeVisible();
  });

  test('switching to weekly retention updates the bucket labels', async ({
    page,
  }) => {
    const application = await seedRetentionApplication();

    await page.goto('/retention');
    await page.getByLabel('Application').selectOption({ label: application.name });
    await page.getByLabel('Interval').selectOption('weekly');
    await page.getByLabel('Window Size').selectOption('4');
    await page.getByLabel('Window Unit').selectOption('weeks');

    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith('/api/retention/run') &&
      response.request().method() === 'POST',
    );

    await page.getByRole('button', { name: 'Run Retention' }).click();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    const payload = await response.json();
    expect(payload.interval).toBe('weekly');
    expect(payload.buckets).toContain('W1');

    const grid = page.getByTestId('retention-grid');
    await expect(grid).toBeVisible();
    await expect(grid.getByText('W0')).toBeVisible();
    await expect(grid.getByText('W1')).toBeVisible();
  });

  test('shows an empty-state grid when no cohorts exist for the selected app', async ({
    page,
  }) => {
    const application = await seedEmptyRetentionApplication();

    await page.goto('/retention');
    await page.getByLabel('Application').selectOption({ label: application.name });
    await page.getByLabel('Interval').selectOption('daily');
    await page.getByLabel('Window Size').selectOption('7');
    await page.getByLabel('Window Unit').selectOption('days');
    await page.getByLabel('Return Event').fill('purchase');

    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith('/api/retention/run') &&
      response.request().method() === 'POST',
    );

    await page.getByRole('button', { name: 'Run Retention' }).click();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    const payload = await response.json();
    expect(payload.cohorts).toHaveLength(0);

    const grid = page.getByTestId('retention-grid');
    await expect(grid).toBeVisible();
    await expect(
      grid.getByText('No cohorts found for the selected filters.'),
    ).toBeVisible();
  });
});
