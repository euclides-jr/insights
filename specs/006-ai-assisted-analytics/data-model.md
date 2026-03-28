# Data Model: AI-Assisted Analytics

**Feature**: `006-ai-assisted-analytics`  
**Phase**: 1 — Design  
**Date**: 2026-03-28

---

## Overview

This feature introduces **no new database tables**. All AI state is ephemeral (per-request on the server, per-session in React state on the client). The feature reads from the existing `EventSchema` Prisma model and reuses the existing `QueryDefinition` Zod type.

---

## Existing Models Read (No Changes)

### `EventSchema` (Prisma)

```prisma
model EventSchema {
  id               String   @id @default(uuid())
  applicationId    String
  eventName        String
  version          Int      @default(1)
  schemaDefinition Json     // { properties: Record<string, { type, required?, description? }> }
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())

  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([applicationId, eventName, version])
  @@index([applicationId, eventName])
}
```

**Access pattern**: `prisma.eventSchema.findMany({ where: { applicationId, isActive: true } })` — one read per `/api/ai/generate` call.

---

## New TypeScript Types (Runtime Only)

These types live in `lib/services/ai-analytics.ts` and are not persisted.

### `EventSchemaContext`

The structured representation of an application's event schemas, built server-side and injected into the AI system prompt.

```typescript
export interface EventPropertyDefinition {
  type: 'string' | 'number' | 'boolean' | 'unknown';
  required?: boolean;
  description?: string;
}

export interface EventSchemaEntry {
  eventName: string;
  properties: Record<string, EventPropertyDefinition>;
}

export interface EventSchemaContext {
  applicationId: string;
  schemas: EventSchemaEntry[];  // empty array = no active schemas
}
```

**Validation rule**: If `schemas.length === 0`, the generate API route MUST return HTTP 422 with `{ error: 'no_schemas' }` and skip AI generation (FR-003, acceptance scenario 3).

---

### `GenerateQueryParams`

Input to `generateQueryFromPrompt()` service function.

```typescript
export interface GenerateQueryParams {
  question: string;          // 1–500 chars (FR-011)
  applicationId: string;     // must exist in DB
  startDate: string;         // ISO 8601
  endDate: string;           // ISO 8601
  schemaContext: EventSchemaContext;
}
```

**Validation rules**:
- `question`: min 1, max 500 characters
- `startDate` / `endDate`: valid ISO 8601 datetime strings; `endDate > startDate`
- `schemaContext.schemas`: non-empty (enforced by caller before invocation)

---

### `ExplainResultsParams`

Input to `explainQueryResults()` service function.

```typescript
export interface ExplainResultsParams {
  question: string;                          // original user question
  query: QueryDefinition;                    // the generated (and executed) query
  results: Record<string, unknown>[];        // from QueryResult.results
  totalCount: number;                        // from QueryResult.totalCount
}
```

**Validation rule**: `results` may be empty (zero rows); the explanation MUST then address why no events were found (FR-007, acceptance scenario 2).

---

### `AIAnalyticsHistoryEntry`

Client-only; held in React `useState`. Not serialised or persisted.

```typescript
export interface AIAnalyticsHistoryEntry {
  id: string;                                // crypto.randomUUID()
  timestamp: Date;
  question: string;
  query: QueryDefinition;
  results: Record<string, unknown>[];
  totalCount: number;
  explanation: string;
}
```

**Validation rule**: History array is capped at 20 entries (oldest evicted first). When a history entry is restored the UI MUST display the original question, query inspector, results, and explanation exactly as first produced (US4 acceptance scenario 2).

---

## Request / Response Shapes (API Layer)

### `POST /api/ai/generate` — Request Body

```typescript
interface GenerateRequestBody {
  question:      string;   // z.string().min(1).max(500)
  applicationId: string;   // z.string().min(1)
  startDate:     string;   // z.string().datetime()
  endDate:       string;   // z.string().datetime()
}
```

### `POST /api/ai/generate` — Success Response (HTTP 200)

```typescript
interface GenerateSuccessResponse {
  query: QueryDefinition;  // Zod-validated by generateObject
}
```

### `POST /api/ai/generate` — Error Responses

| HTTP Status | `error` field | Meaning |
|-------------|--------------|---------|
| 400 | `'validation_error'` | Zod validation failed on request body |
| 422 | `'no_schemas'` | Application has no active event schemas |
| 422 | `'generation_failed'` | AI returned unparseable output (`NoObjectGeneratedError`) |
| 429 | `'rate_limited'` | OpenAI rate limit hit |
| 500 | `'internal_error'` | Unexpected error |

All error responses: `{ error: string, message: string }` — `message` is user-safe text.

---

### `POST /api/ai/explain` — Request Body

```typescript
interface ExplainRequestBody {
  question:   string;                        // z.string().min(1).max(500)
  query:      QueryDefinition;               // validated via queryDefinitionSchema
  results:    Record<string, unknown>[];     // z.array(z.record(z.unknown()))
  totalCount: number;                        // z.number().int().min(0)
}
```

### `POST /api/ai/explain` — Success Response (HTTP 200)

```typescript
interface ExplainSuccessResponse {
  explanation: string;   // 50–300 words; plain prose
}
```

---

## State Transitions

### `AIAnalyticsPanel` Component State

```typescript
type PanelState =
  | { status: 'idle' }
  | { status: 'generating' }
  | { status: 'executing';  query: QueryDefinition }
  | { status: 'explaining'; query: QueryDefinition; results: QueryResult }
  | { status: 'done';       query: QueryDefinition; results: QueryResult; explanation: string }
  | { status: 'error';      message: string };
```

**Transitions**:
- `idle` → `generating`: user submits question
- `generating` → `executing`: `/api/ai/generate` returns `query`
- `executing` → `explaining`: `/api/query` returns `results`
- `explaining` → `done`: `/api/ai/explain` returns `explanation`
- Any → `error`: any API call returns non-2xx
- `error` → `idle`: user dismisses error or edits question
- `done` → `idle`: user submits a new question (previous entry saved to history)

---

## No Migration Required

No `prisma migrate` changes. The `EventSchema` model is read-only from this feature's perspective. History is in-memory only.
