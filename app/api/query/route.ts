import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { executeQuery } from '@/lib/services/query-builder';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const queryRequestSchema = z.object({
  applicationId: z.string().min(1, 'applicationId is required'),
  eventName: z.string().optional(),
  startDate: z.string().datetime({ message: 'startDate must be ISO 8601' }),
  endDate: z.string().datetime({ message: 'endDate must be ISO 8601' }),
  filters: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  aggregation: z.enum(['count', 'unique_users', 'avg', 'sum']).optional(),
  aggregationField: z.string().optional(),
  groupBy: z.string().optional(),
  limit: z.number().int().min(1).max(10000).optional(),
});

// ---------------------------------------------------------------------------
// POST /api/query
// ---------------------------------------------------------------------------

/**
 * POST /api/query
 *
 * Run a filtered / aggregated query over events for an application.
 * Requires X-API-Key authentication.
 *
 * @example Count page_view events in date range
 * ```json
 * {
 *   "applicationId": "<id>",
 *   "eventName": "page_view",
 *   "startDate": "2026-03-01T00:00:00Z",
 *   "endDate": "2026-03-14T23:59:59Z",
 *   "aggregation": "count"
 * }
 * ```
 *
 * @example Group purchase events by currency, sum amounts
 * ```json
 * {
 *   "applicationId": "<id>",
 *   "eventName": "purchase",
 *   "startDate": "2026-03-01T00:00:00Z",
 *   "endDate": "2026-03-14T23:59:59Z",
 *   "aggregation": "sum",
 *   "aggregationField": "amount",
 *   "groupBy": "currency"
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing X-API-Key header' },
        { status: 401 },
      );
    }

    const application = await prisma.application.findUnique({
      where: { apiKey },
      select: { id: true },
    });

    if (!application) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // 2. Parse & validate body
    const body = await request.json();
    const validation = queryRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 },
      );
    }

    const req = validation.data;

    // 3. Authorise — requester may only query their own application
    if (req.applicationId !== application.id) {
      return NextResponse.json(
        { error: 'Access denied: applicationId does not match API key' },
        { status: 403 },
      );
    }

    // 4. Validate date range
    if (new Date(req.endDate) < new Date(req.startDate)) {
      return NextResponse.json(
        { error: 'endDate must be after startDate' },
        { status: 400 },
      );
    }

    // 5. Run query
    const result = await executeQuery(req);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';

    // Surface property-key validation errors as 400
    if (message.startsWith('Invalid property key')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('Query error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/query — health / info
// ---------------------------------------------------------------------------

export async function GET() {
  return NextResponse.json({
    service: 'Event Query API',
    version: '1.0.0',
    description: 'POST to this endpoint to query and aggregate event data',
    supportedAggregations: ['count', 'unique_users', 'avg', 'sum'],
    example: {
      applicationId: '<your-app-id>',
      eventName: 'page_view',
      startDate: '2026-03-01T00:00:00Z',
      endDate: '2026-03-14T23:59:59Z',
      aggregation: 'count',
    },
  });
}
