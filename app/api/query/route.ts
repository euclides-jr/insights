import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/services/query-builder';
import { normalizeQueryDefinition } from '@/lib/validations/query-schemas';
import { ZodError } from 'zod';

// ---------------------------------------------------------------------------
// POST /api/query
// ---------------------------------------------------------------------------

/**
 * POST /api/query
 *
 * Run a filtered / aggregated query over events for an application.
 * Requires an authenticated dashboard session.
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
    // 1. Parse & validate body
    const body = await request.json();
    const req = normalizeQueryDefinition(body);

    // 2. Validate date range
    if (new Date(req.endDate) < new Date(req.startDate)) {
      return NextResponse.json(
        { error: 'endDate must be after startDate' },
        { status: 400 },
      );
    }

    // 3. Run query
    const result = await executeQuery(req);

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 },
      );
    }

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
    supportedTimeBuckets: ['hour', 'day', 'week', 'month'],
    example: {
      applicationId: '<your-app-id>',
      eventName: 'page_view',
      startDate: '2026-03-01T00:00:00Z',
      endDate: '2026-03-14T23:59:59Z',
      aggregation: 'count',
    },
  });
}
