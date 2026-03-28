import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { APICallError, NoObjectGeneratedError } from 'ai';
import {
  buildEventSchemaContext,
  generateQueryFromPrompt,
} from '@/lib/services/ai-analytics';

const generateRequestSchema = z.object({
  question: z.string().min(1).max(500),
  applicationId: z.string().min(1),
  startDate: z.string().datetime({ message: 'startDate must be ISO 8601' }),
  endDate: z.string().datetime({ message: 'endDate must be ISO 8601' }),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'validation_error', message: 'Validation failed', details: [] },
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
          error: 'validation_error',
          message: 'Validation failed',
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
          error: 'no_schemas',
          message:
            'No active event schemas found for this application. Add event schemas before using AI analytics.',
        },
        { status: 422 },
      );
    }

    const query = await generateQueryFromPrompt({
      question: parsed.question,
      applicationId: parsed.applicationId,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      schemaContext,
    });

    return NextResponse.json({ query });
  } catch (error: unknown) {
    if (error instanceof NoObjectGeneratedError) {
      console.error('AI generation failed:', error);
      return NextResponse.json(
        {
          error: 'generation_failed',
          message:
            "I couldn't generate a valid query for that question. Try rephrasing or being more specific.",
        },
        { status: 422 },
      );
    }

    if (error instanceof APICallError) {
      if (error.statusCode === 429) {
        console.warn('AI rate limited:', error);
        return NextResponse.json(
          {
            error: 'rate_limited',
            message:
              'The AI service is busy right now. Please try again in a moment.',
          },
          { status: 429 },
        );
      }

      console.error('AI API call error:', error);
      return NextResponse.json(
        {
          error: 'internal_error',
          message: 'Something went wrong. Please try again.',
        },
        { status: 500 },
      );
    }

    console.error('Unexpected error in /api/ai/generate:', error);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'Something went wrong. Please try again.',
      },
      { status: 500 },
    );
  }
}
