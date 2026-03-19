import { z } from 'zod';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * System-managed attribute keys that cannot be set by client applications.
 * These are maintained automatically via event ingestion (FR-009, FR-010).
 */
export const RESERVED_KEYS = new Set([
  'first_seen',
  'last_seen',
  'user_id',
  'event_count',
  'last_event_name',
]);

/** Attribute name format: lowercase alphanumeric + underscore, 1-128 chars */
export const ATTRIBUTE_KEY_REGEX = /^[a-z0-9_]{1,128}$/;

/** Maximum serialized size per attribute value (bytes) */
export const ATTRIBUTE_VALUE_MAX_BYTES = 10 * 1024; // 10 KB

// ─── Attribute value types ────────────────────────────────────────────────────

/**
 * Scalar attribute value. Date values are ISO 8601 strings validated with
 * z.string().datetime(); coerced to ::timestamptz at SQL cast time.
 */
export const attributeValueSchema = z.union([
  z.string().max(10240, 'Attribute string value exceeds 10 KB limit'),
  z.number(),
  z.boolean(),
  z.null(),
  z.string().datetime({ message: 'Date attribute must be an ISO 8601 string' }),
]);

export type AttributeValue = z.infer<typeof attributeValueSchema>;

/** Validated map of user-defined attributes */
export const attributeMapSchema = z
  .record(z.string(), attributeValueSchema)
  .superRefine((map, ctx) => {
    for (const key of Object.keys(map)) {
      const normalizedKey = key.toLowerCase();

      if (RESERVED_KEYS.has(normalizedKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `"${key}" is a reserved system attribute and cannot be set`,
        });
      }

      if (!ATTRIBUTE_KEY_REGEX.test(normalizedKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `Attribute key "${key}" must match /^[a-z0-9_]{1,128}$/ (letters, digits, underscores only; max 128 chars)`,
        });
      }

      // Check per-value size limit
      const serialized = JSON.stringify(map[key]);
      if (serialized && serialized.length > ATTRIBUTE_VALUE_MAX_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `Attribute value for "${key}" exceeds 10 KB limit`,
        });
      }
    }
  });

// ─── Identify ─────────────────────────────────────────────────────────────────

/**
 * POST /api/users/identify
 * Creates or updates a user profile with optional attributes.
 */
export const identifyRequestSchema = z.object({
  userId: z
    .string()
    .min(1, 'userId is required')
    .max(512, 'userId must be ≤ 512 characters'),
  attributes: attributeMapSchema.optional(),
});

export type IdentifyRequest = z.infer<typeof identifyRequestSchema>;

// ─── Batch identify ───────────────────────────────────────────────────────────

/**
 * POST /api/users/identify/batch
 * Up to 100 identify requests in a single call (FR-015).
 */
export const batchIdentifySchema = z
  .array(identifyRequestSchema)
  .min(1, 'Batch must contain at least one item')
  .max(100, 'Batch cannot exceed 100 items');

export type BatchIdentifyRequest = z.infer<typeof batchIdentifySchema>;

// ─── Attribute filter ─────────────────────────────────────────────────────────

/**
 * Single attribute condition in a user query.
 * `logic: "or"` groups this filter into an OR clause; default is AND.
 */
export const attributeFilterSchema = z.object({
  key: z.string().min(1, 'filter key is required'),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains'], {
    errorMap: () => ({
      message: 'operator must be one of eq, neq, gt, gte, lt, lte, contains',
    }),
  }),
  value: attributeValueSchema,
  logic: z.enum(['and', 'or']).default('and'),
});

export type AttributeFilter = z.infer<typeof attributeFilterSchema>;

// ─── Event filter ─────────────────────────────────────────────────────────────

/**
 * Event behavior condition in a combined query (FR-016, FR-017, FR-018).
 * `operator: "performed"` requires the event to exist (EXISTS).
 * `operator: "not_performed"` requires the event to NOT exist (NOT EXISTS).
 */
export const eventFilterSchema = z.object({
  eventName: z.string().min(1, 'eventName is required'),
  operator: z.enum(['performed', 'not_performed']),
  count: z
    .object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    })
    .optional(),
  timeWindow: z
    .object({
      value: z.number().int().min(1),
      unit: z.enum(['days', 'hours']),
    })
    .optional(),
  /** Event property conditions: each value must match the event's JSONB properties */
  properties: z.record(z.unknown()).optional(),
});

export type EventFilter = z.infer<typeof eventFilterSchema>;

// ─── Combined query ───────────────────────────────────────────────────────────

/**
 * POST /api/users/query
 * Distinct from identifyRequestSchema — combines attribute filters and event
 * behavior filters for cohort-style user lookups (FR-007).
 */
export const combinedQuerySchema = z.object({
  applicationId: z.string().uuid('applicationId must be a valid UUID'),
  filters: z.array(attributeFilterSchema).optional().default([]),
  eventFilters: z.array(eventFilterSchema).optional().default([]),
  sortBy: z.enum(['lastSeen', 'firstSeen', 'eventCount', 'userId']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export type CombinedQuery = z.infer<typeof combinedQuerySchema>;

// ─── Attribute schema registration ───────────────────────────────────────────

/**
 * POST /api/users/attributes/schema
 * Registers a declared type for an attribute key, enabling typed SQL casts
 * and optional expression indexes (FR-003, US5 type registry).
 */
export const attributeSchemaRequestSchema = z.object({
  applicationId: z.string().uuid('applicationId must be a valid UUID'),
  attributeKey: z
    .string()
    .min(1)
    .max(128)
    .refine(
      (k) => ATTRIBUTE_KEY_REGEX.test(k.toLowerCase()),
      'attributeKey must match /^[a-z0-9_]{1,128}$/',
    )
    .refine(
      (k) => !RESERVED_KEYS.has(k.toLowerCase()),
      'Cannot register a type for a reserved system attribute key',
    ),
  valueType: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'DATE']),
  description: z.string().max(500).optional(),
  isIndexed: z.boolean().default(false),
});

export type AttributeSchemaRequest = z.infer<
  typeof attributeSchemaRequestSchema
>;
