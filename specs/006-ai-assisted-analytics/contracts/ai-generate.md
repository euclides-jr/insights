# Contract: POST /api/ai/generate

**Feature**: `006-ai-assisted-analytics`  
**Route**: `POST /api/ai/generate`  
**Auth**: Dashboard session (same guard as existing API routes via `proxy.ts`)  
**Version**: 1.0

---

## Purpose

Translates a plain-language analytics question into a validated `QueryDefinition` using the Vercel AI SDK's `generateObject` function, grounded on the active event schemas for the specified application.

---

## Request

### Headers

| Header | Required | Value |
|--------|----------|-------|
| `Content-Type` | ✅ | `application/json` |

### Body Schema

```json
{
  "question":      "How many signups happened last week by plan?",
  "applicationId": "app_01HXYZ",
  "startDate":     "2026-03-21T00:00:00.000Z",
  "endDate":       "2026-03-28T23:59:59.000Z"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `question` | string | ✅ | 1–500 characters (FR-011) |
| `applicationId` | string | ✅ | Must be non-empty; application must exist in DB |
| `startDate` | string | ✅ | ISO 8601 datetime |
| `endDate` | string | ✅ | ISO 8601 datetime; must be after `startDate` |

---

## Responses

### 200 OK — Query Generated

```json
{
  "query": {
    "applicationId": "app_01HXYZ",
    "eventName": "signup",
    "startDate": "2026-03-21T00:00:00.000Z",
    "endDate": "2026-03-28T23:59:59.000Z",
    "aggregation": "count",
    "groupBy": {
      "kind": "property",
      "key": "plan"
    },
    "sort": {
      "field": "value",
      "direction": "desc"
    }
  }
}
```

The `query` object is a valid `QueryDefinition` as defined in `lib/validations/query-schemas.ts`. It is enforced by `generateObject` against `queryDefinitionSchema` — the response is structurally guaranteed to be executable by `POST /api/query`.

---

### 400 Bad Request — Validation Error

```json
{
  "error": "validation_error",
  "message": "Validation failed",
  "details": [
    { "path": ["question"], "message": "String must contain at most 500 character(s)" }
  ]
}
```

Returned when the request body fails Zod validation. `details` contains Zod error array.

---

### 422 Unprocessable Entity — No Schemas Available

```json
{
  "error": "no_schemas",
  "message": "No active event schemas found for this application. Add event schemas before using AI analytics."
}
```

Returned when the application exists but has no active `EventSchema` records. No AI call is made (FR-003, acceptance scenario 3).

---

### 422 Unprocessable Entity — Generation Failed

```json
{
  "error": "generation_failed",
  "message": "I couldn't generate a valid query for that question. Try rephrasing or being more specific."
}
```

Returned when the AI model returns a response that cannot be parsed into a valid `QueryDefinition` (`NoObjectGeneratedError` from Vercel AI SDK).

---

### 429 Too Many Requests — Rate Limited

```json
{
  "error": "rate_limited",
  "message": "The AI service is busy right now. Please try again in a moment."
}
```

---

### 500 Internal Server Error

```json
{
  "error": "internal_error",
  "message": "Something went wrong. Please try again."
}
```

Internal errors are logged server-side but not exposed to the client (FR-010).

---

## Implementation Notes

### System Prompt Structure

The system prompt injected into `generateObject` follows this structure:

```
You are an analytics query assistant. Your job is to translate a user's plain-language 
analytics question into a structured query definition.

IMPORTANT CONSTRAINTS:
- You MUST only use event names listed in the schema context below.
- You MUST only reference property keys that exist for the chosen event.
- The applicationId MUST be exactly: {applicationId}
- startDate MUST be: {startDate}
- endDate MUST be: {endDate}
- Do NOT invent event names or property keys.

Available event schemas:
{formatted schema context}

If the question cannot be answered with the available schemas, still produce a best-effort 
query using the most relevant event. Set eventName to the most relevant event and omit 
propertyFilters if the required property does not exist.
```

### Vercel AI SDK Call

```typescript
import { generateObject } from 'ai';
import { openai }         from '@ai-sdk/openai';
import { queryDefinitionSchema } from '@/lib/validations/query-schemas';

const { object: query } = await generateObject({
  model:  openai(process.env.AI_MODEL ?? 'gpt-4o-mini'),
  schema: queryDefinitionSchema,
  prompt: buildSystemPrompt(params) + '\n\nUser question: ' + params.question,
});
// query is typed as QueryDefinition
```

---

## Error Handling

| SDK Exception | HTTP Response | Log |
|---------------|--------------|-----|
| `NoObjectGeneratedError` | 422 `generation_failed` | `console.error` with SDK error |
| `APICallError` (429) | 429 `rate_limited` | `console.warn` |
| `APICallError` (5xx) | 500 `internal_error` | `console.error` |
| `ZodError` (request body) | 400 `validation_error` | none (client error) |
| Any other `Error` | 500 `internal_error` | `console.error` |
