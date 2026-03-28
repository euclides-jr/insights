import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { DateRangeFallbackResult } from "@/lib/ai/date-range";

const aiDateRangeSchema = z.object({
  resolved: z.boolean(),
  startDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  needsClarification: z.boolean(),
  matchedText: z.string().min(1).max(120).nullable(),
});

export async function resolveQuestionDateRangeWithAI(params: {
  question: string;
  now: Date;
}): Promise<DateRangeFallbackResult | null> {
  const { object } = await generateObject({
    model: openai(process.env.AI_MODEL ?? "gpt-4o-mini"),
    schema: aiDateRangeSchema,
    prompt: [
      "Extract only the analytics date range from the user's question.",
      "Return resolved UTC ISO 8601 dates when the question contains a time range.",
      "If no time range is present, set resolved=false and needsClarification=false.",
      "If the wording is ambiguous enough that the range cannot be trusted, set needsClarification=true.",
      "Do not invent an event name, property, metric, or explanation.",
      `Reference time: ${params.now.toISOString()}`,
      `Question: ${params.question}`,
    ].join("\n"),
  });

  if (object.needsClarification) {
    return {
      confidence: object.confidence,
      needsClarification: true,
      matchedText: object.matchedText ?? undefined,
    };
  }

  if (!object.resolved || !object.startDate || !object.endDate) {
    return null;
  }

  return {
    startDate: object.startDate,
    endDate: object.endDate,
    confidence: object.confidence,
    needsClarification: false,
    matchedText: object.matchedText ?? undefined,
  };
}
