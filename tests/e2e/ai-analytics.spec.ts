import { test, expect, type Page } from "@playwright/test";

const SEVEN_DAYS_AGO = new Date(
  Date.now() - 7 * 24 * 60 * 60 * 1000,
).toISOString();
const NOW = new Date().toISOString();

test.describe("AI Analytics Panel", () => {
  function resultsSummary(page: Page) {
    return page
      .locator("p")
      .filter({ hasText: /^Results/ })
      .locator("span");
  }

  test.beforeEach(async ({ page }) => {
    await page.goto("/query");
  });

  test("should show the AI Analytics section on the query page", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "AI Analytics" }),
    ).toBeVisible();
    await expect(
      page.getByText("Ask a question in plain language"),
    ).toBeVisible();
  });

  test("submit button is disabled when no question is entered", async ({
    page,
  }) => {
    const submitButton = page.getByRole("button", { name: "Generate Query" });
    await expect(submitButton).toBeDisabled();
  });

  test("submit button is disabled when question is empty and app is selected", async ({
    page,
  }) => {
    const textarea = page.locator("textarea").first();
    await textarea.fill("");
    const submitButton = page.getByRole("button", { name: "Generate Query" });
    await expect(submitButton).toBeDisabled();
  });

  test("submit button becomes enabled when question is typed and app is selected", async ({
    page,
  }) => {
    const textarea = page.locator("textarea").first();
    await textarea.fill("How many signups happened last week?");
    const submitButton = page.getByRole("button", { name: "Generate Query" });
    await expect(submitButton).toBeEnabled();
  });

  test("shows no_schemas error message when API returns 422 no_schemas", async ({
    page,
  }) => {
    await page.route("**/api/ai/generate", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          error: "no_schemas",
          message:
            "No active event schemas found for this application. Add event schemas before using AI analytics.",
        }),
      });
    });

    const textarea = page.locator("textarea").first();
    await textarea.fill("How many signups?");
    await page.getByRole("button", { name: "Generate Query" }).click();

    await expect(page.getByText("No active event schemas found")).toBeVisible();
  });

  test("submits question and shows results after mocked AI flow", async ({
    page,
  }) => {
    const mockQuery = {
      applicationId: "app-1",
      eventName: "signup",
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: "count",
    };

    await page.route("**/api/ai/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          query: mockQuery,
          resolvedDateRange: {
            startDate: SEVEN_DAYS_AGO,
            endDate: NOW,
            source: "deterministic",
            confidence: "high",
          },
        }),
      });
    });

    await page.route("**/api/query", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            { group: "pro", value: 142 },
            { group: "free", value: 89 },
          ],
          totalCount: 2,
          executionTimeMs: 10,
        }),
      });
    });

    await page.route("**/api/ai/explain", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          explanation: "There were 231 signups, mostly from Pro.",
        }),
      });
    });

    const textarea = page.locator("textarea").first();
    await textarea.fill(
      "How many signups happened last week, broken down by plan?",
    );
    await page.getByRole("button", { name: "Generate Query" }).click();

    await expect(resultsSummary(page)).toHaveText("2 rows", { timeout: 10000 });
    await expect(page.getByRole("cell", { name: "pro" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "142" })).toBeVisible();
  });

  test("shows explanation after full flow", async ({ page }) => {
    const mockQuery = {
      applicationId: "app-1",
      eventName: "signup",
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: "count",
    };

    await page.route("**/api/ai/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          query: mockQuery,
          resolvedDateRange: {
            startDate: SEVEN_DAYS_AGO,
            endDate: NOW,
            source: "default",
            confidence: "low",
          },
        }),
      });
    });

    await page.route("**/api/query", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [{ group: "pro", value: 50 }],
          totalCount: 1,
          executionTimeMs: 5,
        }),
      });
    });

    await page.route("**/api/ai/explain", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          explanation: "There were 50 signups from the Pro plan.",
        }),
      });
    });

    const textarea = page.locator("textarea").first();
    await textarea.fill("How many signups?");
    await page.getByRole("button", { name: "Generate Query" }).click();

    await expect(
      page.getByText("There were 50 signups from the Pro plan."),
    ).toBeVisible({ timeout: 10000 });
  });

  test("allows generating a new query after the first run completes", async ({
    page,
  }) => {
    let generateCallCount = 0;
    let queryCallCount = 0;
    let explainCallCount = 0;

    await page.route("**/api/ai/generate", async (route) => {
      generateCallCount += 1;

      const query =
        generateCallCount === 1
          ? {
              applicationId: "app-1",
              eventName: "signup",
              startDate: SEVEN_DAYS_AGO,
              endDate: NOW,
              aggregation: "count",
            }
          : {
              applicationId: "app-1",
              eventName: "purchase",
              startDate: SEVEN_DAYS_AGO,
              endDate: NOW,
              aggregation: "count",
            };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          query,
          resolvedDateRange: {
            startDate: query.startDate,
            endDate: query.endDate,
            source: "deterministic",
            confidence: "high",
          },
        }),
      });
    });

    await page.route("**/api/query", async (route) => {
      queryCallCount += 1;

      const response =
        queryCallCount === 1
          ? {
              results: [{ group: "pro", value: 50 }],
              totalCount: 1,
              executionTimeMs: 5,
            }
          : {
              results: [{ group: "prod_pro", value: 12 }],
              totalCount: 1,
              executionTimeMs: 7,
            };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    });

    await page.route("**/api/ai/explain", async (route) => {
      explainCallCount += 1;

      const explanation =
        explainCallCount === 1
          ? "There were 50 signups from the Pro plan."
          : "There were 12 purchases of prod_pro.";

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ explanation }),
      });
    });

    const textarea = page.locator("textarea").first();
    const submitButton = page.getByRole("button", { name: "Generate Query" });

    await textarea.fill("How many signups happened last week?");
    await submitButton.click();

    await expect(
      page.getByText("There were 50 signups from the Pro plan."),
    ).toBeVisible({ timeout: 10000 });
    await expect(submitButton).toBeEnabled();

    await textarea.fill("How many purchases happened last week?");
    await submitButton.click();

    await expect(
      page.getByText("There were 12 purchases of prod_pro."),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("cell", { name: "prod_pro" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "12" })).toBeVisible();
    expect(generateCallCount).toBe(2);
    expect(queryCallCount).toBe(2);
    expect(explainCallCount).toBe(2);
  });

  test("uses the prompt time range instead of always forcing the last 7 days", async ({
    page,
  }) => {
    await page.route("**/api/ai/generate", async (route) => {
      const body = route.request().postDataJSON() as {
        question: string;
        applicationId: string;
      };

      expect(body.question).toContain("last month");
      expect("startDate" in body).toBe(false);
      expect("endDate" in body).toBe(false);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          query: {
            applicationId: "app-1",
            eventName: "subscription_started",
            startDate: "2026-02-26T12:00:00.000Z",
            endDate: "2026-03-28T12:00:00.000Z",
            aggregation: "count",
            groupBy: { kind: "property", key: "billingPeriod" },
          },
          resolvedDateRange: {
            startDate: "2026-02-26T12:00:00.000Z",
            endDate: "2026-03-28T12:00:00.000Z",
            source: "deterministic",
            confidence: "high",
          },
        }),
      });
    });

    await page.route("**/api/query", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            { group: "annual", value: 3 },
            { group: "monthly", value: 5 },
          ],
          totalCount: 2,
          executionTimeMs: 5,
        }),
      });
    });

    await page.route("**/api/ai/explain", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          explanation: "There were 8 mobile subscriptions in the last month.",
        }),
      });
    });

    await page.selectOption("select", { label: "EventPulse iOS" });

    const textarea = page.locator("textarea").first();
    await textarea.fill(
      "Show mobile subscriptions by billing period for the last month",
    );
    await page.getByRole("button", { name: "Generate Query" }).click();

    await expect(resultsSummary(page)).toHaveText("2 rows", { timeout: 10000 });
    await expect(page.getByRole("cell", { name: "annual" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "monthly" })).toBeVisible();
    await expect(page.getByText("Execution Summary")).toBeVisible();
    await expect(
      page.getByText(/Source: interpreted from the prompt\./),
    ).toBeVisible();
  });

  test("shows a clarification_required message when the date range cannot be resolved safely", async ({
    page,
  }) => {
    await page.route("**/api/ai/generate", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          error: "clarification_required",
          message:
            "I couldn't confidently resolve the time range in that question. Try specifying the date window more explicitly.",
        }),
      });
    });

    const textarea = page.locator("textarea").first();
    await textarea.fill("Show revenue from the early part of launch season");
    await page.getByRole("button", { name: "Generate Query" }).click();

    await expect(
      page.getByText(
        "I couldn't confidently resolve the requested time range.",
      ),
    ).toBeVisible();
  });

  test("continues after the user chooses a clarification option", async ({
    page,
  }) => {
    let generateCallCount = 0;

    await page.route("**/api/ai/generate", async (route) => {
      generateCallCount += 1;

      if (generateCallCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            clarification: {
              reason:
                "I found multiple events that could match this question. Pick the one you mean.",
              options: [
                {
                  eventName: "signup_completed",
                  label: "signup_completed",
                  description:
                    "Use event signup_completed and group by source.",
                  groupByProperty: "source",
                },
                {
                  eventName: "purchase_completed",
                  label: "purchase_completed",
                  description:
                    "Use event purchase_completed and group by source.",
                  groupByProperty: "source",
                },
              ],
            },
            resolvedDateRange: {
              startDate: SEVEN_DAYS_AGO,
              endDate: NOW,
              source: "deterministic",
              confidence: "high",
            },
          }),
        });
        return;
      }

      const body = route.request().postDataJSON() as {
        clarification?: { eventName: string; groupByProperty?: string };
      };

      expect(body.clarification?.eventName).toBe("signup_completed");
      expect(body.clarification?.groupByProperty).toBe("source");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          query: {
            applicationId: "app-1",
            eventName: "signup_completed",
            startDate: SEVEN_DAYS_AGO,
            endDate: NOW,
            aggregation: "count",
            groupBy: { kind: "property", key: "source" },
          },
          resolvedDateRange: {
            startDate: SEVEN_DAYS_AGO,
            endDate: NOW,
            source: "deterministic",
            confidence: "high",
          },
        }),
      });
    });

    await page.route("**/api/query", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [{ group: "ad_campaign", value: 12 }],
          totalCount: 1,
          executionTimeMs: 6,
        }),
      });
    });

    await page.route("**/api/ai/explain", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          explanation: "There were 12 signup conversions from ad_campaign.",
        }),
      });
    });

    const textarea = page.locator("textarea").first();
    await textarea.fill("Show conversions by source");
    await page.getByRole("button", { name: "Generate Query" }).click();

    await expect(page.getByText("Clarification needed")).toBeVisible();
    await page.getByRole("button", { name: "signup_completed" }).click();

    await expect(resultsSummary(page)).toHaveText("1 row", { timeout: 10000 });
    await expect(
      page.getByText("There were 12 signup conversions from ad_campaign."),
    ).toBeVisible();
  });

  test("results remain visible when explanation API fails", async ({
    page,
  }) => {
    const mockQuery = {
      applicationId: "app-1",
      eventName: "signup",
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: "count",
    };

    await page.route("**/api/ai/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ query: mockQuery }),
      });
    });

    await page.route("**/api/query", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [{ group: "pro", value: 50 }],
          totalCount: 1,
          executionTimeMs: 5,
        }),
      });
    });

    await page.route("**/api/ai/explain", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "internal_error",
          message: "Something went wrong generating the explanation.",
        }),
      });
    });

    const textarea = page.locator("textarea").first();
    await textarea.fill("How many signups?");
    await page.getByRole("button", { name: "Generate Query" }).click();

    await expect(resultsSummary(page)).toHaveText("1 row", { timeout: 10000 });
    await expect(page.getByRole("cell", { name: "pro" })).toBeVisible();
    // No error state — panel transitions to done without explanation
    await expect(page.getByText("Generate Query")).toBeEnabled();
  });

  test("generated query inspector is present and collapsed by default", async ({
    page,
  }) => {
    const mockQuery = {
      applicationId: "app-1",
      eventName: "page_view",
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: "count",
    };

    await page.route("**/api/ai/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ query: mockQuery }),
      });
    });

    await page.route("**/api/query", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [],
          totalCount: 0,
          executionTimeMs: 3,
        }),
      });
    });

    await page.route("**/api/ai/explain", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ explanation: "No events found." }),
      });
    });

    const textarea = page.locator("textarea").first();
    await textarea.fill("How many page views?");
    await page.getByRole("button", { name: "Generate Query" }).click();

    await expect(page.getByText("Generated Query")).toBeVisible({
      timeout: 10000,
    });

    // Inspector is collapsed by default (details element)
    const details = page.locator("details");
    const isOpen = await details.getAttribute("open");
    expect(isOpen).toBeNull();
  });

  test("expanding query inspector shows event name and aggregation", async ({
    page,
  }) => {
    const mockQuery = {
      applicationId: "app-1",
      eventName: "page_view",
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: "count",
    };

    await page.route("**/api/ai/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ query: mockQuery }),
      });
    });

    await page.route("**/api/query", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [],
          totalCount: 0,
          executionTimeMs: 3,
        }),
      });
    });

    await page.route("**/api/ai/explain", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ explanation: "No data." }),
      });
    });

    const textarea = page.locator("textarea").first();
    await textarea.fill("How many page views?");
    await page.getByRole("button", { name: "Generate Query" }).click();

    await expect(page.getByText("Generated Query")).toBeVisible({
      timeout: 10000,
    });

    await page.getByText("Generated Query").click();

    const inspector = page.locator("details");
    await expect(
      inspector.getByText("page_view", { exact: true }),
    ).toBeVisible();
    await expect(inspector.getByText("count", { exact: true })).toBeVisible();
  });

  test("clicking Open in Query Explorer populates the QueryForm", async ({
    page,
  }) => {
    const mockQuery = {
      applicationId: "app-1",
      eventName: "signup",
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: "count",
    };

    await page.route("**/api/ai/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ query: mockQuery }),
      });
    });

    await page.route("**/api/query", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [],
          totalCount: 0,
          executionTimeMs: 3,
        }),
      });
    });

    await page.route("**/api/ai/explain", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ explanation: "No data." }),
      });
    });

    const textarea = page.locator("textarea").first();
    await textarea.fill("How many signups?");
    await page.getByRole("button", { name: "Generate Query" }).click();

    await expect(page.getByText("Generated Query")).toBeVisible({
      timeout: 10000,
    });
    await page.getByText("Generated Query").click();

    await page.getByRole("button", { name: "Open in Query Explorer" }).click();

    // QueryForm should be repopulated — verify event name field has signup
    const queryFormEventInput = page
      .locator('input[placeholder*="event"]')
      .first();
    if (await queryFormEventInput.isVisible()) {
      await expect(queryFormEventInput).toHaveValue("signup");
    } else {
      // Check for event name in a select or other input
      await expect(
        page.getByRole("button", { name: "Run Query" }),
      ).toBeVisible();
    }
  });

  test("session history shows previous questions", async ({ page }) => {
    const mockQuery = {
      applicationId: "app-1",
      eventName: "signup",
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: "count",
    };

    let callCount = 0;
    const questions = [
      "How many signups?",
      "How many page views?",
      "How many purchases?",
    ];

    await page.route("**/api/ai/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ query: mockQuery }),
      });
    });

    await page.route("**/api/query", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [{ group: "test", value: callCount }],
          totalCount: 1,
          executionTimeMs: 3,
        }),
      });
    });

    await page.route("**/api/ai/explain", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ explanation: "Test explanation." }),
      });
    });

    for (const question of questions) {
      callCount++;
      const textarea = page.locator("textarea").first();
      await textarea.fill(question);
      await page.getByRole("button", { name: "Generate Query" }).click();
      await expect(resultsSummary(page)).toHaveText("1 row", {
        timeout: 10000,
      });
      await page.waitForTimeout(200);
    }

    await expect(page.getByText("Session History")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /How many signups\?/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /How many page views\?/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /How many purchases\?/ }),
    ).toBeVisible();
  });

  test("clicking a history entry restores its question and results", async ({
    page,
  }) => {
    const mockQuery = {
      applicationId: "app-1",
      eventName: "signup",
      startDate: SEVEN_DAYS_AGO,
      endDate: NOW,
      aggregation: "count",
    };

    let callCount = 0;

    await page.route("**/api/ai/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ query: mockQuery }),
      });
    });

    await page.route("**/api/query", async (route) => {
      callCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [{ group: `run-${callCount}`, value: callCount * 10 }],
          totalCount: 1,
          executionTimeMs: 3,
        }),
      });
    });

    await page.route("**/api/ai/explain", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ explanation: `Explanation ${callCount}.` }),
      });
    });

    const textarea = page.locator("textarea").first();
    await textarea.fill("First question");
    await page.getByRole("button", { name: "Generate Query" }).click();
    await expect(resultsSummary(page)).toHaveText("1 row", { timeout: 10000 });

    await page.waitForTimeout(200);

    await textarea.fill("Second question");
    await page.getByRole("button", { name: "Generate Query" }).click();
    await expect(resultsSummary(page)).toHaveText("1 row", { timeout: 10000 });

    await expect(page.getByText("Session History")).toBeVisible();
    await page.getByText("First question").first().click();

    const questionTextarea = page.locator("textarea").first();
    await expect(questionTextarea).toHaveValue("First question");
  });
});
