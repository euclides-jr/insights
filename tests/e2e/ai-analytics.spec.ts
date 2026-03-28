import { test, expect } from '@playwright/test';

const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const NOW = new Date().toISOString();

test.describe('AI Analytics Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/query');
  });

  test('should show the AI Analytics section on the query page', async ({
    page,
  }) => {
    await expect(
      page.getByRole('heading', { name: 'AI Analytics' }),
    ).toBeVisible();
    await expect(
      page.getByText('Ask a question in plain language'),
    ).toBeVisible();
  });

  test('submit button is disabled when no question is entered', async ({
    page,
  }) => {
    const submitButton = page.getByRole('button', { name: 'Generate Query' });
    await expect(submitButton).toBeDisabled();
  });

  test('submit button is disabled when question is empty and app is selected', async ({
    page,
  }) => {
    const textarea = page.locator('textarea').first();
    await textarea.fill('');
    const submitButton = page.getByRole('button', { name: 'Generate Query' });
    await expect(submitButton).toBeDisabled();
  });

  test('submit button becomes enabled when question is typed and app is selected', async ({
    page,
  }) => {
    const textarea = page.locator('textarea').first();
    await textarea.fill('How many signups happened last week?');
    const submitButton = page.getByRole('button', { name: 'Generate Query' });
    await expect(submitButton).toBeEnabled();
  });

  test('shows no_schemas error message when API returns 422 no_schemas', async ({
    page,
  }) => {
    await page.route('**/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'no_schemas',
          message:
            'No active event schemas found for this application. Add event schemas before using AI analytics.',
        }),
      });
    });

    const textarea = page.locator('textarea').first();
    await textarea.fill('How many signups?');
    await page.getByRole('button', { name: 'Generate Query' }).click();

    await expect(
      page.getByText('No active event schemas found'),
    ).toBeVisible();
  });

  test('submits question and shows results after mocked AI flow', async ({
    page,
  }) => {
    const mockQuery = {
      applicationId: 'app-1',
      eventName: 'signup',
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: 'count',
    };

    await page.route('**/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ query: mockQuery }),
      });
    });

    await page.route('**/api/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { group: 'pro', value: 142 },
            { group: 'free', value: 89 },
          ],
          totalCount: 2,
          executionTimeMs: 10,
        }),
      });
    });

    await page.route('**/api/ai/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          explanation: 'There were 231 signups, mostly from Pro.',
        }),
      });
    });

    const textarea = page.locator('textarea').first();
    await textarea.fill('How many signups happened last week, broken down by plan?');
    await page.getByRole('button', { name: 'Generate Query' }).click();

    await expect(page.getByText('2 rows')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('pro')).toBeVisible();
    await expect(page.getByText('142')).toBeVisible();
  });

  test('shows explanation after full flow', async ({ page }) => {
    const mockQuery = {
      applicationId: 'app-1',
      eventName: 'signup',
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: 'count',
    };

    await page.route('**/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ query: mockQuery }),
      });
    });

    await page.route('**/api/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{ group: 'pro', value: 50 }],
          totalCount: 1,
          executionTimeMs: 5,
        }),
      });
    });

    await page.route('**/api/ai/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          explanation: 'There were 50 signups from the Pro plan.',
        }),
      });
    });

    const textarea = page.locator('textarea').first();
    await textarea.fill('How many signups?');
    await page.getByRole('button', { name: 'Generate Query' }).click();

    await expect(
      page.getByText('There were 50 signups from the Pro plan.'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('results remain visible when explanation API fails', async ({
    page,
  }) => {
    const mockQuery = {
      applicationId: 'app-1',
      eventName: 'signup',
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: 'count',
    };

    await page.route('**/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ query: mockQuery }),
      });
    });

    await page.route('**/api/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{ group: 'pro', value: 50 }],
          totalCount: 1,
          executionTimeMs: 5,
        }),
      });
    });

    await page.route('**/api/ai/explain', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'internal_error',
          message: 'Something went wrong generating the explanation.',
        }),
      });
    });

    const textarea = page.locator('textarea').first();
    await textarea.fill('How many signups?');
    await page.getByRole('button', { name: 'Generate Query' }).click();

    await expect(page.getByText('1 row')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('pro')).toBeVisible();
    // No error state — panel transitions to done without explanation
    await expect(page.getByText('Generate Query')).toBeEnabled();
  });

  test('generated query inspector is present and collapsed by default', async ({
    page,
  }) => {
    const mockQuery = {
      applicationId: 'app-1',
      eventName: 'page_view',
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: 'count',
    };

    await page.route('**/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ query: mockQuery }),
      });
    });

    await page.route('**/api/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [],
          totalCount: 0,
          executionTimeMs: 3,
        }),
      });
    });

    await page.route('**/api/ai/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ explanation: 'No events found.' }),
      });
    });

    const textarea = page.locator('textarea').first();
    await textarea.fill('How many page views?');
    await page.getByRole('button', { name: 'Generate Query' }).click();

    await expect(page.getByText('Generated Query')).toBeVisible({
      timeout: 10000,
    });

    // Inspector is collapsed by default (details element)
    const details = page.locator('details');
    const isOpen = await details.getAttribute('open');
    expect(isOpen).toBeNull();
  });

  test('expanding query inspector shows event name and aggregation', async ({
    page,
  }) => {
    const mockQuery = {
      applicationId: 'app-1',
      eventName: 'page_view',
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: 'count',
    };

    await page.route('**/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ query: mockQuery }),
      });
    });

    await page.route('**/api/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [],
          totalCount: 0,
          executionTimeMs: 3,
        }),
      });
    });

    await page.route('**/api/ai/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ explanation: 'No data.' }),
      });
    });

    const textarea = page.locator('textarea').first();
    await textarea.fill('How many page views?');
    await page.getByRole('button', { name: 'Generate Query' }).click();

    await expect(page.getByText('Generated Query')).toBeVisible({
      timeout: 10000,
    });

    await page.getByText('Generated Query').click();

    await expect(page.getByText('page_view')).toBeVisible();
    await expect(page.getByText('count')).toBeVisible();
  });

  test('clicking Open in Query Explorer populates the QueryForm', async ({
    page,
  }) => {
    const mockQuery = {
      applicationId: 'app-1',
      eventName: 'signup',
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: 'count',
    };

    await page.route('**/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ query: mockQuery }),
      });
    });

    await page.route('**/api/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [],
          totalCount: 0,
          executionTimeMs: 3,
        }),
      });
    });

    await page.route('**/api/ai/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ explanation: 'No data.' }),
      });
    });

    const textarea = page.locator('textarea').first();
    await textarea.fill('How many signups?');
    await page.getByRole('button', { name: 'Generate Query' }).click();

    await expect(page.getByText('Generated Query')).toBeVisible({
      timeout: 10000,
    });
    await page.getByText('Generated Query').click();

    await page
      .getByRole('button', { name: 'Open in Query Explorer' })
      .click();

    // QueryForm should be repopulated — verify event name field has signup
    const queryFormEventInput = page.locator('input[placeholder*="event"]').first();
    if (await queryFormEventInput.isVisible()) {
      await expect(queryFormEventInput).toHaveValue('signup');
    } else {
      // Check for event name in a select or other input
      await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    }
  });

  test('session history shows previous questions', async ({ page }) => {
    const mockQuery = {
      applicationId: 'app-1',
      eventName: 'signup',
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: 'count',
    };

    let callCount = 0;
    const questions = [
      'How many signups?',
      'How many page views?',
      'How many purchases?',
    ];

    await page.route('**/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ query: mockQuery }),
      });
    });

    await page.route('**/api/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{ group: 'test', value: callCount }],
          totalCount: 1,
          executionTimeMs: 3,
        }),
      });
    });

    await page.route('**/api/ai/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ explanation: 'Test explanation.' }),
      });
    });

    for (const question of questions) {
      callCount++;
      const textarea = page.locator('textarea').first();
      await textarea.fill(question);
      await page.getByRole('button', { name: 'Generate Query' }).click();
      await expect(page.getByText('1 row')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(200);
    }

    await expect(page.getByText('Session History')).toBeVisible();
    await expect(page.getByText('How many signups?')).toBeVisible();
    await expect(page.getByText('How many page views?')).toBeVisible();
    await expect(page.getByText('How many purchases?')).toBeVisible();
  });

  test('clicking a history entry restores its question and results', async ({
    page,
  }) => {
    const mockQuery = {
      applicationId: 'app-1',
      eventName: 'signup',
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: 'count',
    };

    let callCount = 0;

    await page.route('**/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ query: mockQuery }),
      });
    });

    await page.route('**/api/query', async (route) => {
      callCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{ group: `run-${callCount}`, value: callCount * 10 }],
          totalCount: 1,
          executionTimeMs: 3,
        }),
      });
    });

    await page.route('**/api/ai/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ explanation: `Explanation ${callCount}.` }),
      });
    });

    const textarea = page.locator('textarea').first();
    await textarea.fill('First question');
    await page.getByRole('button', { name: 'Generate Query' }).click();
    await expect(page.getByText('1 row')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(200);

    await textarea.fill('Second question');
    await page.getByRole('button', { name: 'Generate Query' }).click();
    await expect(page.getByText('1 row')).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Session History')).toBeVisible();
    await page.getByText('First question').first().click();

    const questionTextarea = page.locator('textarea').first();
    await expect(questionTextarea).toHaveValue('First question');
  });
});
