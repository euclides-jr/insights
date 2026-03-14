# Research: User Attributes and Combined Querying

**Phase**: 0 — Research  
**Branch**: `002-user-attributes`  
**Date**: March 14, 2026

## Overview

This document resolves all open design questions prior to data model and contract definition. Five topics were researched: attribute storage, system attribute automation, combined query execution, attribute type handling, and reserved name enforcement.

---

## Decision 1: Attribute Storage Pattern

**Decision**: Hybrid — dedicated typed columns for system attributes + JSONB for user-defined attributes on a `user_profiles` row, with a separate `attribute_history` EAV table for history.

The `user_profiles` table carries:

- `userId` + `applicationId` (composite primary key)
- `firstSeen TIMESTAMPTZ`, `lastSeen TIMESTAMPTZ`, `eventCount INT` — dedicated typed columns for the three system-managed attributes
- `attributes JSONB` — all user-defined key/value pairs only

A separate `attribute_history` table (EAV: userId, applicationId, attributeKey, oldValue JSONB, newValue JSONB, changedAt) captures every change.

**Rationale**: Pure JSONB on a single row eliminates complex self-joins for range queries (e.g., `(attributes->>'age')::numeric > 25 AND attributes->>'plan' = 'pro'`). A GIN index on `attributes` handles containment; expression indexes on hot keys support range predicates. Pure EAV requires N self-joins for N attribute filter conditions — at 1M users with 5+ criteria, the query plan degrades to nested loops, breaching the 5-second target. Dedicated columns for system attributes structurally prevents reserved-name collisions (see Decision 5) and enables direct numeric indexing without JSONB casting.

**Alternatives considered**:

- _Pure EAV table_: Range queries like `age > 25 AND plan = 'premium'` require pivot CTEs or N self-joins. Unacceptable at scale.
- _Pure JSONB (flat)_: No attribute history; storing `first_seen`/`last_seen` in JSONB requires casting overhead and creates reserved-name conflict.

---

## Decision 2: System Attribute Automation

**Decision**: Application-level batch upsert using `prisma.$executeRaw` inside the existing event ingestion route (`app/api/events/route.ts`), immediately after event `createMany`.

After storing events, extract per-user `min(timestamp)`, `max(timestamp)`, and `count` in-memory from the batch (the data is already available), then fire a single PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` with array unnesting:

```sql
INSERT INTO user_profiles (application_id, user_id, first_seen, last_seen, event_count)
SELECT $1, unnest($2::text[]), min_ts, max_ts, cnt
FROM (VALUES ...) AS t(user_id, min_ts, max_ts, cnt)
ON CONFLICT (application_id, user_id) DO UPDATE SET
  last_seen   = GREATEST(excluded.last_seen, user_profiles.last_seen),
  first_seen  = LEAST(excluded.first_seen, user_profiles.first_seen),
  event_count = user_profiles.event_count + excluded.event_count
```

This is O(1) DB round trips regardless of batch size.

**Rationale**: DB triggers fire per-row during `createMany` (N upserts instead of one batch). Prisma extensions/middleware would intercept before/after each operation but cannot express `GREATEST`/`LEAST`/increment logic as a single atomic SQL statement efficiently. The application-level batch approach is fully testable, co-located with ingestion logic, and adds only one DB round trip to the hot path.

**Alternatives considered**:

- _DB trigger_: N-row fire for batches; harder to test; logic changes require migrations.
- _Prisma extension_: Cannot batch the aggregate math; still multiple round trips.

---

## Decision 3: Combined Query Pattern

**Decision**: Single SQL query with CTEs, implemented as an extension to the existing `executeQuery` function in `lib/services/query-builder.ts`.

An optional `userAttributeFilters` field is added to `QueryRequest`. When present, `executeQuery` prepends a CTE that materializes the user subset before joining to events:

```sql
WITH _users AS (
  SELECT user_id
  FROM user_profiles
  WHERE application_id = $1
    AND (attributes->>'plan') = 'premium'
    AND (attributes->>'age')::numeric > 25
)
SELECT COUNT(DISTINCT e."userId")
FROM events e
JOIN _users u ON e."userId" = u.user_id
WHERE e."applicationId" = $1
  AND e."eventName" = 'checkout'
  AND e."timestamp" >= $2
```

The `Segment.criteria` JSON structure also gains an `attributeFilters` field that routes through this same query path.

**Rationale**: The two-step approach (fetch userId list in Node → `WHERE userId IN (...)`) breaks at scale: piping 500k UUIDs in an `IN` clause saturates the query planner and network. A single CTE JOIN keeps everything in one plan and allows the optimizer to use hash joins between the (typically small) `_users` result and the events index range scan. In PostgreSQL 12+, CTEs without `MATERIALIZED` are inlined, giving the planner full cross-table statistics.

**Alternatives considered**:

- _Two-step in Node_: Segment engine already demonstrates this approach for event behavior; adding attribute joins makes the intermediate result set potentially millions of rows.
- _Entirely new service_: Duplication of sanitization, parameterization, and BigInt serialization logic already in query-builder.

---

## Decision 4: Attribute Data Type Handling

**Decision**: Native JSONB storage for all user-defined attribute values, with a companion `user_attribute_schemas` table recording the declared type per key, driving SQL cast emission in the query builder.

JSONB preserves `string`, `number` (numeric), `boolean`, and `null` natively. Dates are stored as ISO 8601 strings and cast to `::timestamptz` at query time. The `user_attribute_schemas` table maps `(applicationId, attributeKey) → type`. The query builder uses this map:

| Declared type | Query expression                    |
| ------------- | ----------------------------------- |
| `string`      | `attributes->>'key'`                |
| `number`      | `(attributes->>'key')::numeric`     |
| `boolean`     | `(attributes->>'key')::boolean`     |
| `date`        | `(attributes->>'key')::timestamptz` |

Expression indexes are created automatically when attributes are registered, for any key that will participate in range queries.

**Rationale**: Separate typed columns are impossible for dynamic user-defined keys. String-encoding types (e.g., `"n:42"`) destroys native JSONB operators and requires application-level parsing in every query. JSONB with declared-type metadata is the standard PostgreSQL pattern: it defers schema commitment to registration time, allows GIN indexes for containment, and enables expression indexes for range performance.

**Alternatives considered**:

- _Typed columns per attribute_: Requires DDL per new attribute; non-starter.
- _Typed string encoding_: Prevents `<`, `>`, `BETWEEN` operators; requires full table scans.

---

## Decision 5: Reserved Attribute Name Enforcement

**Decision**: Structural separation (system attributes in dedicated columns, not in JSONB) plus a Zod `.refine()` check at the API boundary as defense-in-depth.

Because `first_seen`, `last_seen`, and `event_count` live in typed columns on `user_profiles` — never in `attributes JSONB` — there is no structural path by which client writes to `attributes` can corrupt them. At the API layer, the Zod schema for attribute upsert payloads adds:

```ts
const RESERVED_KEYS = new Set([
  'first_seen',
  'last_seen',
  'user_id',
  'event_count',
  'last_event_name',
]);

z.record(z.unknown()).refine(
  (attrs) => !Object.keys(attrs).some((k) => RESERVED_KEYS.has(k)),
  { message: `Attribute keys [${[...RESERVED_KEYS].join(', ')}] are reserved` },
);
```

The service layer (`upsertUserAttributes`) repeats the same check as a typed guard so internal callers (tests, scripts) also fail explicitly.

**Rationale**: A DB CHECK constraint on JSONB key presence produces opaque errors and is hard to surface as structured API responses. Pure service-layer enforcement is bypassable via direct Prisma calls. Zod at the HTTP boundary provides self-documenting structured errors following the same pattern as existing `eventSchema` validation. The structural separation is the real guarantee; Zod is the user-facing signal.

**Alternatives considered**:

- _DB CHECK constraint only_: Cryptic error message; hard to extend.
- _Service layer only_: No HTTP-boundary enforcement; confusing error location.
- _Zod only (no structural separation)_: Relies on every write path being correctly guarded.

---

## Summary: All NEEDS CLARIFICATION Resolved

| Topic                       | Resolution                                               |
| --------------------------- | -------------------------------------------------------- |
| Attribute storage           | Hybrid: JSONB for user-defined, typed columns for system |
| System attribute automation | App-level batch upsert in event ingestion route          |
| Combined query execution    | CTE-based extension to existing query-builder            |
| Attribute type handling     | JSONB + declared-type metadata table + cast emission     |
| Reserved name enforcement   | Structural separation + Zod refine at API boundary       |

No unresolved questions remain. Proceed to Phase 1 data model and contracts design.
