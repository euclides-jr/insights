# Contract: POST /api/ai/explain

**Feature**: `006-ai-assisted-analytics`  
**Route**: `POST /api/ai/explain`  
**Auth**: Dashboard session (same guard as existing API routes via `proxy.ts`)  
**Version**: 1.0

---

## Purpose

Generates a plain-language explanation of query results using the Vercel AI SDK's `generateText` function. Called after the query has been executed via `POST /api/query`. The explanation is contextually tied to the original question, the query that was run, and the result set returned.

---

## Request

### Headers

| Header | Required | Value |
|--------|----------|-------|
| `Content-Type` | ✅ | `application/json` |

### Body Schema

```json
{
  "question": "How many signups happened last week by plan?",
  "query": {
    "applicationId": "app_01HXYZ",
    "eventName": "signup",
    "startDate": "2026-03-21T00:00:00.000Z",
    "endDate": "2026-03-28T23:59:59.000Z",
    "aggregation": "count",
    "groupBy": { "kind": "property", "key": "plan" }
  },
  "results": [
    { "group": "pro", "value": 142 },
    { "group": "free", "value": 89 },
    { "group": "enterprise", "value": 17 }
  ],
  "totalCount": 3
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `question` | string | ✅ | 1–500 characters |
| `query` | QueryDefinition | ✅ | Validated via `queryDefinitionSchema` |
| `results` | `Record<string, unknown>[]` | ✅ | May be empty array (zero-results case) |
| `totalCount` | number | ✅ | Integer ≥ 0 |

---

## Responses

### 200 OK — Explanation Generated

```json
{
  "explanation": "Last week, your application recorded 248 signup events in total. The majority came from the Pro plan with 142 signups (57%), followed by Free with 89 (36%) and Enterprise with 17 (7%). Pro plan adoption was highest, suggesting strong conversion from your mid-tier offering."
}
```

**Explanation characteristics**:
- Plain prose, 50–200 words
- Directly references the user's original question
- Describes the result shape (top value, distribution, or trend if time-bucketed)
- Explicitly notes when results are empty and suggests possible reasons (FR-007)
- Does NOT suggest the user re-run queries or change schemas

### Zero-results example

```json
{
  "explanation": "No signup events were found for the selected date range (March 21–28, 2026). This could mean no signups occurred during this period, or the event may not have been tracked yet. You might check a broader date range or verify that signup events are being sent to this application."
}
```

---

### 400 Bad Request — Validation Error

```json
{
  "error": "validation_error",
  "message": "Validation failed",
  "details": [
    { "path": ["query", "startDate"], "message": "startDate must be ISO 8601" }
  ]
}
```

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
  "message": "Something went wrong generating the explanation. Your results are still shown above."
}
```

Note: The 500 message explicitly tells the user their results are available — this is intentional because query execution already succeeded before the explain step. The UI MUST show results even when explanation fails.

---

## Implementation Notes

### Prompt Structure

```
You are an analytics results interpreter. Given a user's analytics question, the query 
that was run to answer it, and the results, write a short plain-language explanation.

Rules:
- Be concise: 2–4 sentences for small result sets; up to 6 for time-series data.
- Address the user's question directly — did the results answer it?
- If results is empty, explain why no data was found and offer 1–2 possible reasons.
- If results include time-bucketed data, describe any notable trend.
- Do not mention technical details like SQL, database, API, or internal system names.
- Do not suggest schema changes or event tracking setup unless results are empty.

User question: {question}
Query executed: {query summary}
Result count: {totalCount}
Results: {top N results as JSON, truncated to 20 rows}
```

### Vercel AI SDK Call

```typescript
import { generateText } from 'ai';
import { openai }       from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai(process.env.AI_MODEL ?? 'gpt-4o-mini'),
  messages: [
    { role: 'system', content: EXPLANATION_SYSTEM_PROMPT },
    { role: 'user',   content: buildExplainUserMessage(params) },
  ],
  maxTokens: 300,
});
```

Results passed to the model are truncated to the first 20 rows to prevent excessive token usage with large result sets.

---

## Error Handling

| SDK Exception | HTTP Response | Note |
|---------------|--------------|------|
| `APICallError` (429) | 429 `rate_limited` | `console.warn` |
| `APICallError` (5xx) | 500 `internal_error` | `console.error` |
| `ZodError` (request body) | 400 `validation_error` | Client error |
| Any other `Error` | 500 `internal_error` | `console.error` |

**Important**: A failure of `/api/ai/explain` MUST NOT prevent the UI from displaying query results. The `AIAnalyticsPanel` component transitions to `done` state with a null/empty explanation rather than surfacing an error that obscures the results (US2 requirement).
