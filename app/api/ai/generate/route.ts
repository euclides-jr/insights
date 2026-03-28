import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { APICallError, NoObjectGeneratedError } from "ai";
import {
  resolveQuestionDateRange,
  type DateRangeParseResult,
} from "@/lib/ai/date-range";
import { resolveQuestionDateRangeWithAI } from "@/lib/ai/date-range-server";
import {
  applyClarificationSelection,
  buildEventSchemaContext,
  buildClarificationOptions,
  generateQueryFromPrompt,
  type AIClarificationSelection,
  type EventSchemaContext,
} from "@/lib/services/ai-analytics";
import type { QueryDefinition } from "@/lib/validations/query-schemas";

const generateRequestSchema = z
  .object({
    question: z.string().min(1).max(500),
    applicationId: z.string().min(1),
    clarification: z
      .object({
        eventName: z.string().min(1),
        groupByProperty: z.string().min(1).optional(),
      })
      .optional(),
    startDate: z
      .string()
      .datetime({ message: "startDate must be ISO 8601" })
      .optional(),
    endDate: z
      .string()
      .datetime({ message: "endDate must be ISO 8601" })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const hasStartDate = Boolean(data.startDate);
    const hasEndDate = Boolean(data.endDate);

    if (hasStartDate !== hasEndDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate and endDate must be provided together",
        path: hasStartDate ? ["endDate"] : ["startDate"],
      });
      return;
    }

    if (
      data.startDate &&
      data.endDate &&
      new Date(data.endDate) <= new Date(data.startDate)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate must be after startDate",
        path: ["endDate"],
      });
    }
  });

function validateSchemaGrounding(
  query: QueryDefinition,
  schemaContext: EventSchemaContext,
): string | null {
  const eventNames = new Set(schemaContext.schemas.map((s) => s.eventName));

  if (query.eventName && !eventNames.has(query.eventName)) {
    return `Generated query references unknown event "${query.eventName}".`;
  }

  const matchingSchema = query.eventName
    ? schemaContext.schemas.find((s) => s.eventName === query.eventName)
    : null;

  if (matchingSchema) {
    const knownProps = new Set(Object.keys(matchingSchema.properties));

    if (
      query.groupBy?.kind === "property" &&
      !knownProps.has(query.groupBy.key)
    ) {
      return `Generated query groups by unknown property "${query.groupBy.key}".`;
    }

    if (query.aggregationField && !knownProps.has(query.aggregationField)) {
      return `Generated query references unknown aggregation field "${query.aggregationField}".`;
    }

    for (const filter of query.propertyFilters ?? []) {
      if (!knownProps.has(filter.key)) {
        return `Generated query filters on unknown property "${filter.key}".`;
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "validation_error", message: "Validation failed", details: [] },
      { status: 400 },
    );
  }

  let parsed: z.infer<typeof generateRequestSchema>;
  try {
    parsed = generateRequestSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Validation failed",
          details: error.errors.map((e) => ({
            path: e.path,
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }
    throw error;
  }

  try {
    const schemaContext = await buildEventSchemaContext(parsed.applicationId);

    if (schemaContext.schemas.length === 0) {
      return NextResponse.json(
        {
          error: "no_schemas",
          message:
            "No active event schemas found for this application. Add event schemas before using AI analytics.",
        },
        { status: 422 },
      );
    }

    let resolvedDateRange: DateRangeParseResult;
    if (parsed.startDate && parsed.endDate) {
      resolvedDateRange = {
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        source: "provided",
        confidence: "high",
        needsClarification: false,
      };
    } else {
      resolvedDateRange = await resolveQuestionDateRange(parsed.question, {
        now: new Date(),
        fallbackParser: resolveQuestionDateRangeWithAI,
      });
    }

    if (resolvedDateRange.needsClarification) {
      return NextResponse.json(
        {
          error: "clarification_required",
          message:
            "I couldn't confidently resolve the time range in that question. Try specifying the date window more explicitly.",
        },
        { status: 422 },
      );
    }

    const query = await generateQueryFromPrompt({
      question: parsed.question,
      applicationId: parsed.applicationId,
      startDate: resolvedDateRange.startDate,
      endDate: resolvedDateRange.endDate,
      schemaContext,
    });

    const clarifiedQuery = parsed.clarification
      ? applyClarificationSelection(
          query,
          schemaContext,
          parsed.clarification as AIClarificationSelection,
        )
      : query;

    if (!parsed.clarification) {
      const clarificationOptions = buildClarificationOptions(
        parsed.question,
        schemaContext,
        clarifiedQuery,
      );

      if (clarificationOptions.length > 0) {
        return NextResponse.json({
          clarification: {
            reason:
              "I found multiple events that could match this question. Pick the one you mean.",
            options: clarificationOptions,
          },
          resolvedDateRange,
        });
      }
    }

    const groundingError = validateSchemaGrounding(
      clarifiedQuery,
      schemaContext,
    );
    if (groundingError) {
      console.error("Schema grounding violation:", groundingError);
      return NextResponse.json(
        {
          error: "generation_failed",
          message:
            "I couldn't generate a valid query for that question. Try rephrasing or being more specific.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ query: clarifiedQuery, resolvedDateRange });
  } catch (error: unknown) {
    if (error instanceof NoObjectGeneratedError) {
      console.error("AI generation failed:", error);
      return NextResponse.json(
        {
          error: "generation_failed",
          message:
            "I couldn't generate a valid query for that question. Try rephrasing or being more specific.",
        },
        { status: 422 },
      );
    }

    if (error instanceof APICallError) {
      if (error.statusCode === 429) {
        console.warn("AI rate limited:", error);
        return NextResponse.json(
          {
            error: "rate_limited",
            message:
              "The AI service is busy right now. Please try again in a moment.",
          },
          { status: 429 },
        );
      }

      console.error("AI API call error:", error);
      return NextResponse.json(
        {
          error: "internal_error",
          message: "Something went wrong. Please try again.",
        },
        { status: 500 },
      );
    }

    console.error("Unexpected error in /api/ai/generate:", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Something went wrong. Please try again.",
      },
      { status: 500 },
    );
  }
}
