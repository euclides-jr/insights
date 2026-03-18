import { test, expect, type Page } from '@playwright/test';
import { prisma } from '@/lib/db/prisma';

const TEST_API_KEY = 'demo_app_key_123';

// Helpers ─────────────────────────────────────────────────────────────────────

async function getApplicationId(): Promise<string> {
  const application = await prisma.application.findUnique({
    where: { apiKey: TEST_API_KEY },
    select: { id: true },
  });

  if (!application) {
    throw new Error(`Application not found for API key ${TEST_API_KEY}`);
  }

  return application.id;
}

async function createWebhookViaAPI(
  applicationId: string,
  name: string,
  url = 'https://webhook.site/e2e-test',
) {
  const webhook = await prisma.webhookAlert.create({
    data: {
      applicationId,
      name,
      url,
      minLevel: 'error',
      isActive: true,
    },
    select: { id: true },
  });
  return webhook.id;
}

async function deleteWebhookViaAPI(id: string) {
  await prisma.webhookAlert.delete({
    where: { id },
  });
}

/**
 * Return a locator scoped to the webhook table row that contains `name`.
 * The Table component renders <div> rows (not <tr>), so we use an XPath
 * ancestor query to walk from the name text up to the nearest div that
 * also contains the action buttons.
 */
function getWebhookRow(page: Page, name: string) {
  return page
    .getByText(name, { exact: true })
    .locator('xpath=ancestor::div[.//button[text()="Edit"]][1]');
}

/** Open the Add Webhook dialog – always use .first() to avoid strict-mode error */
async function openAddDialog(page: Page) {
  await page
    .getByRole('button', { name: /add webhook/i })
    .first()
    .click();
}

/** Fill the webhook form inputs (dialog must be open) */
async function fillWebhookForm(page: Page, name: string, url: string) {
  await page.getByPlaceholder(/slack|data-alerts/i).fill(name);
  await page.getByPlaceholder(/hooks.example.com/i).fill(url);
}

// ── Static content ─────────────────────────────────────────────────────────

test.describe('Webhooks page – static content', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/webhooks');
  });

  test('shows the Webhooks heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Webhooks' })).toBeVisible();
  });

  test('shows the page description', async ({ page }) => {
    await expect(
      page.getByText(
        'Get notified at a URL when data quality thresholds are breached',
      ),
    ).toBeVisible();
  });

  test('shows the "How it works" section', async ({ page }) => {
    await expect(page.getByText('How it works')).toBeVisible();
  });

  test('shows an Add Webhook button', async ({ page }) => {
    // There may be two (header + empty state) – presence of at least one is fine
    await expect(
      page.getByRole('button', { name: /add webhook/i }).first(),
    ).toBeVisible();
  });

  test('Webhooks nav link is highlighted as active', async ({ page }) => {
    const navLink = page.getByRole('link', { name: 'Webhooks' }).first();
    await expect(navLink).toHaveCSS('background-color', 'rgb(228, 35, 19)');
  });

  test('shows empty state or table rows', async ({ page }) => {
    // The custom Table component uses <div> rows – check for either state
    const hasEmpty = await page.getByText(/no webhooks/i).isVisible();
    const hasHeaders = await page.getByText('Last delivery').isVisible();
    expect(hasEmpty || hasHeaders).toBe(true);
  });
});

// ── Table column headers (need at least one webhook to render the table) ─────

test.describe('Webhooks page – table headers', () => {
  let applicationId: string;
  let webhookId: string;

  test.beforeAll(async () => {
    applicationId = await getApplicationId();
    webhookId = await createWebhookViaAPI(
      applicationId,
      `Header Test ${Date.now()}`,
    );
  });

  test.afterAll(async () => {
    await deleteWebhookViaAPI(webhookId);
  });

  test('renders all expected column headers', async ({ page }) => {
    await page.goto('/webhooks');
    // Use exact column header strings from the page
    await expect(page.getByText('Name').first()).toBeVisible();
    await expect(page.getByText('Application').first()).toBeVisible();
    await expect(page.getByText('Endpoint URL')).toBeVisible();
    await expect(page.getByText('Trigger level')).toBeVisible();
    await expect(page.getByText('Last delivery')).toBeVisible();
    await expect(page.getByText('Actions')).toBeVisible();
  });
});

// ── Add webhook dialog ────────────────────────────────────────────────────────

test.describe('Webhooks page – dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/webhooks');
  });

  test('opens when button is clicked', async ({ page }) => {
    await openAddDialog(page);
    await expect(
      page.getByRole('heading', { name: /add webhook/i }),
    ).toBeVisible();
  });

  test('contains name, URL, application and trigger level fields', async ({
    page,
  }) => {
    await openAddDialog(page);
    // Name input (placeholder: "e.g. Slack #data-alerts")
    await expect(page.getByPlaceholder(/slack|data-alerts/i)).toBeVisible();
    // Endpoint URL input
    await expect(page.getByPlaceholder(/hooks.example.com/i)).toBeVisible();
    // Application select
    await expect(page.getByRole('combobox')).toBeVisible();
    // Trigger level buttons
    await expect(
      page.getByRole('button', { name: 'Warning or Error' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Error only' }),
    ).toBeVisible();
  });

  test('shows validation errors for empty submit', async ({ page }) => {
    await openAddDialog(page);
    await page.getByRole('button', { name: /create webhook/i }).click();
    await expect(page.getByText(/required/i).first()).toBeVisible();
  });

  test('successfully creates a webhook and it appears in the table', async ({
    page,
  }) => {
    const webhookName = `E2E Dialog Hook ${Date.now()}`;
    await openAddDialog(page);
    await fillWebhookForm(page, webhookName, 'https://webhook.site/e2e-dialog');
    await page.getByRole('button', { name: /create webhook/i }).click();

    await expect(page.getByText(webhookName)).toBeVisible({ timeout: 8000 });

    // Cleanup — accept the confirm dialog that appears
    const row = getWebhookRow(page, webhookName);
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /delete/i }).click();
    await expect(page.getByText(webhookName)).not.toBeVisible({
      timeout: 8000,
    });
  });
});

// ── CRUD flow ─────────────────────────────────────────────────────────────────

test.describe('Webhook CRUD flow', () => {
  test('creates, edits and deletes a webhook end-to-end', async ({ page }) => {
    const webhookName = `CRUD Hook ${Date.now()}`;
    const updatedName = `CRUD Hook Updated ${Date.now()}`;

    await page.goto('/webhooks');

    // ── CREATE ──────────────────────────────────────────────────────────
    await openAddDialog(page);
    await fillWebhookForm(page, webhookName, 'https://webhook.site/crud-test');
    await page.getByRole('button', { name: /create webhook/i }).click();
    await expect(page.getByText(webhookName)).toBeVisible({ timeout: 8000 });

    // ── EDIT ────────────────────────────────────────────────────────────
    const row = getWebhookRow(page, webhookName);
    await row.getByRole('button', { name: /edit/i }).click();

    // Pre-filled name should be visible in the input
    const nameInput = page.getByPlaceholder(/slack|data-alerts/i);
    await expect(nameInput).toHaveValue(webhookName);

    await nameInput.fill(updatedName);
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 8000 });

    // ── DELETE ───────────────────────────────────────────────────────────
    const updatedRow = getWebhookRow(page, updatedName);
    page.once('dialog', (d) => d.accept());
    await updatedRow.getByRole('button', { name: /delete/i }).click();
    await expect(page.getByText(updatedName)).not.toBeVisible({
      timeout: 8000,
    });
  });
});

// ── Test delivery button ──────────────────────────────────────────────────────

test.describe('Webhook test delivery', () => {
  test('test button shows a delivery status after firing', async ({ page }) => {
    const testName = `Test Delivery ${Date.now()}`;

    await page.goto('/webhooks');
    await openAddDialog(page);
    await fillWebhookForm(page, testName, 'https://webhook.site/delivery-e2e');
    await page.getByRole('button', { name: /create webhook/i }).click();
    await expect(page.getByText(testName)).toBeVisible({ timeout: 8000 });

    // Click the Test button on that row
    const row = getWebhookRow(page, testName);
    await row.getByRole('button', { name: 'Test' }).click();

    // A status code or result text should appear in the row
    await expect(
      row.getByText(/\d{3}|network error|error/i).first(),
    ).toBeVisible({ timeout: 20000 });

    // Cleanup
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /delete/i }).click();
    await expect(page.getByText(testName)).not.toBeVisible({ timeout: 8000 });
  });
});
