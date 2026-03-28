import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "jest-mock-extended";

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  NoObjectGeneratedError: class NoObjectGeneratedError extends Error {
    constructor(params: { message?: string } | string = {}) {
      const message =
        typeof params === "string"
          ? params
          : (params.message ?? "No object generated");
      super(message);
      this.name = "NoObjectGeneratedError";
    }
  },
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mock-model"),
}));

import { generateObject, generateText } from "ai";
import { prisma } from "@/lib/db/prisma";
import {
  applyClarificationSelection,
  buildEventSchemaContext,
  buildClarificationOptions,
  generateQueryFromPrompt,
  explainQueryResults,
  NoObjectGeneratedError,
} from "@/lib/services/ai-analytics";
import type { QueryDefinition } from "@/lib/validations/query-schemas";
import type { DeepMockProxy } from "jest-mock-extended";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const generateObjectMock = generateObject as ReturnType<typeof vi.fn>;
const generateTextMock = generateText as ReturnType<typeof vi.fn>;

const mockQuery: QueryDefinition = {
  applicationId: "app-1",
  eventName: "signup",
  startDate: "2026-03-21T00:00:00.000Z",
  endDate: "2026-03-28T23:59:59.000Z",
  aggregation: "count",
};

beforeEach(() => {
  mockReset(prismaMock);
  vi.clearAllMocks();
});

describe("buildEventSchemaContext", () => {
  it("returns schemas when active event schemas exist", async () => {
    prismaMock.eventSchema.findMany.mockResolvedValue([
      {
        id: "schema-1",
        applicationId: "app-1",
        eventName: "signup",
        version: 1,
        schemaDefinition: {
          properties: {
            plan: { type: "string", required: true, description: "Plan tier" },
            userId: { type: "string" },
          },
        },
        isActive: true,
        createdAt: new Date(),
      },
    ] as never);

    const ctx = await buildEventSchemaContext("app-1");

    expect(ctx.applicationId).toBe("app-1");
    expect(ctx.schemas).toHaveLength(1);
    expect(ctx.schemas[0].eventName).toBe("signup");
    expect(ctx.schemas[0].properties.plan.type).toBe("string");
    expect(ctx.schemas[0].properties.plan.required).toBe(true);
  });

  it("returns an empty schemas array when no rows exist", async () => {
    prismaMock.eventSchema.findMany.mockResolvedValue([] as never);

    const ctx = await buildEventSchemaContext("app-2");

    expect(ctx.applicationId).toBe("app-2");
    expect(ctx.schemas).toHaveLength(0);
  });

  it("propagates Prisma errors unmodified", async () => {
    const dbError = new Error("connection timeout");
    prismaMock.eventSchema.findMany.mockRejectedValue(dbError);

    await expect(buildEventSchemaContext("app-1")).rejects.toThrow(
      "connection timeout",
    );
  });
});

describe("generateQueryFromPrompt", () => {
  it("returns a valid QueryDefinition on success", async () => {
    generateObjectMock.mockResolvedValue({ object: mockQuery });

    const result = await generateQueryFromPrompt({
      question: "How many signups last week?",
      applicationId: "app-1",
      startDate: "2026-03-21T00:00:00.000Z",
      endDate: "2026-03-28T23:59:59.000Z",
      schemaContext: {
        applicationId: "app-1",
        schemas: [{ eventName: "signup", properties: {} }],
      },
    });

    expect(result).toEqual(mockQuery);
    expect(generateObjectMock).toHaveBeenCalledOnce();
  });

  it("uses the available event schemas to correct the event and group-by property", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        applicationId: "app-1",
        eventName: "page_view",
        startDate: "2026-03-21T00:00:00.000Z",
        endDate: "2026-03-28T23:59:59.000Z",
        propertyFilters: null,
        aggregation: "count",
        aggregationField: null,
        groupBy: null,
        sort: null,
        page: null,
        pageSize: null,
        limit: null,
      },
    });

    const result = await generateQueryFromPrompt({
      question:
        "How many signups have happened since last week, broken down by plan",
      applicationId: "app-1",
      startDate: "2026-03-21T00:00:00.000Z",
      endDate: "2026-03-28T23:59:59.000Z",
      schemaContext: {
        applicationId: "app-1",
        schemas: [
          {
            eventName: "page_view",
            properties: {
              path: { type: "string", description: "The page path" },
              referrer: { type: "string" },
            },
          },
          {
            eventName: "signup",
            properties: {
              plan: { type: "string", description: "The subscription plan" },
              source: { type: "string", description: "Signup source" },
            },
          },
        ],
      },
    });

    expect(result).toEqual({
      applicationId: "app-1",
      eventName: "signup",
      startDate: "2026-03-21T00:00:00.000Z",
      endDate: "2026-03-28T23:59:59.000Z",
      aggregation: "count",
      groupBy: { kind: "property", key: "plan" },
    });
  });

  it("uses event property descriptions when inferring a grouped property", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        applicationId: "app-1",
        eventName: "onboarding_step_completed",
        startDate: "2026-03-21T00:00:00.000Z",
        endDate: "2026-03-28T23:59:59.000Z",
        propertyFilters: null,
        aggregation: "count",
        aggregationField: null,
        groupBy: null,
        sort: null,
        page: null,
        pageSize: null,
        limit: null,
      },
    });

    const result = await generateQueryFromPrompt({
      question:
        "How many onboarding steps were completed last week, grouped by acquisition channel?",
      applicationId: "app-1",
      startDate: "2026-03-21T00:00:00.000Z",
      endDate: "2026-03-28T23:59:59.000Z",
      schemaContext: {
        applicationId: "app-1",
        schemas: [
          {
            eventName: "onboarding_step_completed",
            properties: {
              channel: {
                type: "string",
                description:
                  "Acquisition or onboarding channel associated with the completion",
              },
              stepKey: {
                type: "string",
                description: "Unique identifier for the onboarding step",
              },
            },
          },
        ],
      },
    });

    expect(result.groupBy).toEqual({ kind: "property", key: "channel" });
  });

  it("propagates NoObjectGeneratedError", async () => {
    const error = new NoObjectGeneratedError({
      message: "AI failed to produce object",
    });
    generateObjectMock.mockRejectedValue(error);

    await expect(
      generateQueryFromPrompt({
        question: "gibberish question",
        applicationId: "app-1",
        startDate: "2026-03-21T00:00:00.000Z",
        endDate: "2026-03-28T23:59:59.000Z",
        schemaContext: {
          applicationId: "app-1",
          schemas: [{ eventName: "signup", properties: {} }],
        },
      }),
    ).rejects.toThrow("AI failed to produce object");
  });
});

describe("buildClarificationOptions", () => {
  it("returns clarification choices when multiple schema matches are similarly plausible", () => {
    const options = buildClarificationOptions(
      "Show conversions by source",
      {
        applicationId: "app-1",
        schemas: [
          {
            eventName: "signup_completed",
            properties: {
              source: {
                type: "string",
                description: "Signup acquisition source",
              },
              campaign: { type: "string" },
            },
          },
          {
            eventName: "purchase_completed",
            properties: {
              source: {
                type: "string",
                description: "Purchase acquisition source",
              },
              amount: { type: "number" },
            },
          },
        ],
      },
      {
        applicationId: "app-1",
        eventName: "signup_completed",
        startDate: "2026-03-21T00:00:00.000Z",
        endDate: "2026-03-28T23:59:59.000Z",
        aggregation: "count",
      },
    );

    expect(options).toHaveLength(2);
    expect(options[0]?.eventName).toBe("signup_completed");
    expect(options[1]?.eventName).toBe("purchase_completed");
  });
});

describe("applyClarificationSelection", () => {
  it("overrides the selected event and preserves a valid grouped property", () => {
    const clarified = applyClarificationSelection(
      {
        applicationId: "app-1",
        eventName: "page_view",
        startDate: "2026-03-21T00:00:00.000Z",
        endDate: "2026-03-28T23:59:59.000Z",
        aggregation: "count",
      },
      {
        applicationId: "app-1",
        schemas: [
          {
            eventName: "signup_completed",
            properties: {
              source: { type: "string" },
              plan: { type: "string" },
            },
          },
        ],
      },
      {
        eventName: "signup_completed",
        groupByProperty: "source",
      },
    );

    expect(clarified.eventName).toBe("signup_completed");
    expect(clarified.groupBy).toEqual({ kind: "property", key: "source" });
  });
});

describe("explainQueryResults", () => {
  it("returns explanation text for non-empty results", async () => {
    generateTextMock.mockResolvedValue({
      text: "There were 142 signups last week, mostly from the Pro plan.",
    });

    const explanation = await explainQueryResults({
      question: "How many signups last week by plan?",
      query: mockQuery,
      results: [
        { group: "pro", value: 142 },
        { group: "free", value: 89 },
      ],
      totalCount: 2,
    });

    expect(explanation).toBe(
      "There were 142 signups last week, mostly from the Pro plan.",
    );
    expect(generateTextMock).toHaveBeenCalledOnce();
  });

  it("produces text referencing no events found for empty results", async () => {
    generateTextMock.mockResolvedValue({
      text: "No signup events were found for the selected date range.",
    });

    const explanation = await explainQueryResults({
      question: "How many signups last week?",
      query: mockQuery,
      results: [],
      totalCount: 0,
    });

    expect(explanation).toContain("No");
  });

  it("propagates errors from generateText", async () => {
    generateTextMock.mockRejectedValue(new Error("AI service unavailable"));

    await expect(
      explainQueryResults({
        question: "test",
        query: mockQuery,
        results: [],
        totalCount: 0,
      }),
    ).rejects.toThrow("AI service unavailable");
  });
});
