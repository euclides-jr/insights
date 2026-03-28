import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { randomBytes, randomUUID } from "crypto";
import { fireQualityWebhooksIfNeeded } from "@/lib/services/webhook-service";

// --- Schema enforcement ---

type PropertyDef = {
  type: "string" | "number" | "boolean" | "object" | "array";
  required?: boolean;
  description?: string;
};

type SchemaDefinition = {
  properties?: Record<string, PropertyDef>;
};

type SchemaViolation = { property: string; message: string };

function validatePropertiesAgainstSchema(
  properties: Record<string, unknown>,
  schemaDefinition: SchemaDefinition,
): SchemaViolation[] {
  const violations: SchemaViolation[] = [];
  const defs = schemaDefinition.properties || {};

  for (const [key, def] of Object.entries(defs)) {
    const value = properties[key];

    // Check required fields
    if (def.required && (value === undefined || value === null)) {
      violations.push({
        property: key,
        message: `Required property "${key}" is missing`,
      });
      continue;
    }

    // Check type if value is present
    if (value !== undefined && value !== null && def.type) {
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (actualType !== def.type) {
        violations.push({
          property: key,
          message: `Property "${key}" must be of type ${def.type}, got ${actualType}`,
        });
      }
    }
  }

  return violations;
}

async function updateDataQualityMetric(
  applicationId: string,
  received: number,
  rejected: number,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.dataQualityMetric.upsert({
    where: { applicationId_date: { applicationId, date: today } },
    create: {
      applicationId,
      date: today,
      eventsReceived: received,
      eventsRejected: rejected,
      validationFailureRate: received > 0 ? rejected / received : 0,
      duplicateRate: 0,
      completenessRate: received > 0 ? (received - rejected) / received : 1,
    },
    update: {
      eventsReceived: { increment: received },
      eventsRejected: { increment: rejected },
      validationFailureRate:
        rejected > 0 ? { set: rejected / received } : undefined,
      completenessRate: { set: (received - rejected) / received },
    },
  });
}

// --- Zod shapes for incoming events ---

// Validation schema for incoming events
const eventSchema = z.object({
  eventId: z.string().optional(), // Optional, will be generated if not provided
  eventName: z.string().min(1, "Event name is required"),
  userId: z.string().min(1, "User ID is required"),
  sessionId: z.string().min(1, "Session ID is required"),
  timestamp: z.coerce.date().optional(), // Optional, defaults to now
  properties: z.record(z.any()).optional().default({}),
});

const batchEventSchema = z.array(eventSchema).min(1).max(100); // Support batch up to 100 events

type EventInput = z.infer<typeof eventSchema>;

/**
 * POST /api/events
 *
 * Accepts events from web/mobile SDKs
 *
 * Authentication: X-API-Key header
 * Body: Single event object or array of events
 *
 * @example Single Event
 * ```json
 * {
 *   "eventName": "page_view",
 *   "userId": "user_123",
 *   "sessionId": "session_456",
 *   "properties": {
 *     "page": "/dashboard",
 *     "referrer": "https://google.com"
 *   }
 * }
 * ```
 *
 * @example Batch Events
 * ```json
 * [
 *   {
 *     "eventName": "page_view",
 *     "userId": "user_123",
 *     "sessionId": "session_456"
 *   },
 *   {
 *     "eventName": "button_click",
 *     "userId": "user_123",
 *     "sessionId": "session_456"
 *   }
 * ]
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate via API key
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing X-API-Key header" },
        { status: 401 },
      );
    }

    // Find application by API key
    const application = await prisma.application.findUnique({
      where: { apiKey },
      select: { id: true, name: true },
    });

    if (!application) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();

    // Determine if it's a single event or batch
    const isBatch = Array.isArray(body);

    // 3. Validate events
    let validatedEvents: EventInput[];

    if (isBatch) {
      const validation = batchEventSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            error: "Validation failed",
            details: validation.error.errors,
          },
          { status: 400 },
        );
      }
      validatedEvents = validation.data;
    } else {
      const validation = eventSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            error: "Validation failed",
            details: validation.error.errors,
          },
          { status: 400 },
        );
      }
      validatedEvents = [validation.data];
    }

    // 4. Fetch active schemas for all unique event names in this batch
    const uniqueEventNames = [
      ...new Set(validatedEvents.map((e) => e.eventName)),
    ];

    const activeSchemas = await prisma.eventSchema.findMany({
      where: {
        applicationId: application.id,
        eventName: { in: uniqueEventNames },
        isActive: true,
      },
      select: { eventName: true, schemaDefinition: true },
    });

    // Build a lookup map: eventName → schemaDefinition
    const schemaMap = new Map(
      activeSchemas.map((s) => [
        s.eventName,
        s.schemaDefinition as SchemaDefinition,
      ]),
    );

    // 5. Enforce schemas — split events into accepted and rejected
    const acceptedEvents: EventInput[] = [];
    const rejectedEvents: {
      event: EventInput;
      violations: SchemaViolation[];
    }[] = [];

    for (const event of validatedEvents) {
      const schema = schemaMap.get(event.eventName);
      if (schema) {
        const violations = validatePropertiesAgainstSchema(
          (event.properties as Record<string, unknown>) || {},
          schema,
        );
        if (violations.length > 0) {
          rejectedEvents.push({ event, violations });
          continue;
        }
      }
      acceptedEvents.push(event);
    }

    // If every event in the batch failed schema validation, return 422
    if (acceptedEvents.length === 0 && rejectedEvents.length > 0) {
      await updateDataQualityMetric(
        application.id,
        validatedEvents.length,
        rejectedEvents.length,
      );
      void fireQualityWebhooksIfNeeded(application.id, application.name);
      return NextResponse.json(
        {
          error: "Schema validation failed",
          received: validatedEvents.length,
          rejected: rejectedEvents.length,
          violations: rejectedEvents.map((r) => ({
            eventName: r.event.eventName,
            violations: r.violations,
          })),
        },
        { status: 422 },
      );
    }

    // 6. Generate unique eventIds for events that don't have them
    const eventsToCreate = acceptedEvents.map((event: EventInput) => ({
      eventId: event.eventId || `evt_${randomBytes(16).toString("hex")}`,
      applicationId: application.id,
      eventName: event.eventName,
      userId: event.userId,
      sessionId: event.sessionId,
      timestamp: event.timestamp || new Date(),
      properties: event.properties || {},
    }));

    // 7. Store accepted events in database (use createMany for batch insert)
    try {
      const result = await prisma.event.createMany({
        data: eventsToCreate,
        skipDuplicates: true, // Skip events with duplicate eventId (idempotency)
      });

      // Update data quality metrics if any events were rejected
      if (rejectedEvents.length > 0) {
        await updateDataQualityMetric(
          application.id,
          validatedEvents.length,
          rejectedEvents.length,
        );
        // Fire quality webhooks for breached thresholds (non-blocking)
        void fireQualityWebhooksIfNeeded(application.id, application.name);
      }

      // ── T023: Auto-update system user attributes from event data ──────────
      // Compute per-userId aggregates from the events we just stored
      const userAggregates = new Map<
        string,
        { minTs: Date; maxTs: Date; count: number; lastEventName: string }
      >();
      for (const ev of eventsToCreate) {
        const ts = ev.timestamp;
        const existing = userAggregates.get(ev.userId);
        if (!existing) {
          userAggregates.set(ev.userId, {
            minTs: ts,
            maxTs: ts,
            count: 1,
            lastEventName: ev.eventName,
          });
        } else {
          userAggregates.set(ev.userId, {
            minTs: ts < existing.minTs ? ts : existing.minTs,
            maxTs: ts > existing.maxTs ? ts : existing.maxTs,
            count: existing.count + 1,
            lastEventName:
              ts > existing.maxTs ? ev.eventName : existing.lastEventName,
          });
        }
      }

      if (userAggregates.size > 0) {
        const valueRows: string[] = [];
        const upsertParams: unknown[] = [];
        let pi = 1;

        for (const [userId, agg] of userAggregates) {
          valueRows.push(
            `($${pi++}::text, $${pi++}::text, $${pi++}::text, $${pi++}::timestamptz, $${pi++}::timestamptz, $${pi++}::int, $${pi++}::text, '{}'::jsonb, now(), now())`,
          );
          upsertParams.push(
            randomUUID(), // id
            application.id, // application_id
            userId, // user_id
            agg.minTs, // first_seen
            agg.maxTs, // last_seen
            agg.count, // event_count
            agg.lastEventName, // last_event_name
          );
        }

        await prisma.$executeRawUnsafe(
          `INSERT INTO user_profiles
            (id, "applicationId", "userId", "firstSeen", "lastSeen", "eventCount", "lastEventName", attributes, "createdAt", "updatedAt")
           VALUES ${valueRows.join(", ")}
           ON CONFLICT ("applicationId", "userId") DO UPDATE SET
             "lastSeen"      = GREATEST(user_profiles."lastSeen", excluded."lastSeen"),
             "firstSeen"     = LEAST(user_profiles."firstSeen", excluded."firstSeen"),
             "eventCount"    = user_profiles."eventCount" + excluded."eventCount",
             "lastEventName" = excluded."lastEventName",
             "updatedAt"     = now()`,
          ...upsertParams,
        );
      }
      // ── End T023 ──────────────────────────────────────────────────────────

      const response: Record<string, unknown> = {
        success: true,
        received: validatedEvents.length,
        created: result.count,
        applicationId: application.id,
        applicationName: application.name,
      };

      // Include rejection details if some events failed schema validation
      if (rejectedEvents.length > 0) {
        response.rejected = rejectedEvents.length;
        response.violations = rejectedEvents.map((r) => ({
          eventName: r.event.eventName,
          violations: r.violations,
        }));
      }

      return NextResponse.json(response, { status: 201 });
    } catch (dbError: unknown) {
      // Handle duplicate eventId errors
      if (
        dbError &&
        typeof dbError === "object" &&
        "code" in dbError &&
        dbError.code === "P2002"
      ) {
        return NextResponse.json(
          {
            error: "Duplicate event ID detected",
            message:
              "One or more events with the provided eventId already exist",
          },
          { status: 409 },
        );
      }
      throw dbError;
    }
  } catch (error: unknown) {
    console.error("Error processing events:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to process events";

    return NextResponse.json(
      {
        error: "Internal server error",
        message: errorMessage,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/events
 *
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    service: "Event Ingestion API",
    version: "1.0.0",
    status: "operational",
    endpoints: {
      POST: {
        description: "Submit events from web/mobile SDKs",
        authentication: "X-API-Key header",
        contentType: "application/json",
        body: "Single event object or array of events",
      },
    },
  });
}
