import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { APICallError } from "ai";
import { queryDefinitionSchema } from "@/lib/validations/query-schemas";
import { explainQueryResults } from "@/lib/services/ai-analytics";

const explainRequestSchema = z.object({
  question: z.string().min(1).max(500),
  query: queryDefinitionSchema,
  results: z.array(z.record(z.unknown())),
  totalCount: z.number().int().min(0),
});

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

  let parsed: z.infer<typeof explainRequestSchema>;
  try {
    parsed = explainRequestSchema.parse(body);
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
    const explanationResult = await explainQueryResults({
      question: parsed.question,
      query: parsed.query,
      results: parsed.results,
      totalCount: parsed.totalCount,
    });

    return NextResponse.json(explanationResult);
  } catch (error: unknown) {
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

      console.error("AI API call error in /api/ai/explain:", error);
      return NextResponse.json(
        {
          error: "internal_error",
          message:
            "Something went wrong generating the explanation. Your results are still shown above.",
        },
        { status: 500 },
      );
    }

    console.error("Unexpected error in /api/ai/explain:", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message:
          "Something went wrong generating the explanation. Your results are still shown above.",
      },
      { status: 500 },
    );
  }
}
