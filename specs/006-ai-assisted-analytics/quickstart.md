# Quickstart: AI-Assisted Analytics

**Feature**: `006-ai-assisted-analytics`  
**Audience**: Developers implementing or testing this feature  
**Date**: 2026-03-28

---

## Prerequisites

- Node.js / Bun runtime
- PostgreSQL running with the database seeded (`bun prisma db seed`)
- An OpenAI API key

---

## Environment Setup

Add the following to your `.env.local` (copy from `.env.example`):

```bash
# Required: OpenAI API key for Vercel AI SDK
OPENAI_API_KEY=sk-...your-key...

# Optional: override the default model (defaults to gpt-4o-mini)
AI_MODEL=gpt-4o-mini
```

> ⚠️ Never commit `OPENAI_API_KEY` to source control. It is already in `.gitignore` via `.env.local`.

---

## Install New Dependencies

```bash
bun add ai @ai-sdk/openai
```

**Packages added**:

| Package | Version | Purpose |
|---------|---------|---------|
| `ai` | `^6.0.0` | Vercel AI SDK core — `generateObject`, `generateText` |
| `@ai-sdk/openai` | `^3.0.0` | OpenAI provider for Vercel AI SDK |

---

## Run the Development Server

```bash
bun run dev
```

Navigate to [http://localhost:3000/query](http://localhost:3000/query). You will see the **Query Explorer** page with a new **"AI Analytics"** panel above the manual form.

---

## Use the AI Analytics Panel

1. **Select an application** from the dropdown (required — submit is disabled otherwise).
2. **Type a plain-language question** in the text area, e.g.:  
   `"How many page_view events happened last week, broken down by path?"`
3. Click **"Generate Query"**.
4. Watch the three-step progress indicator:
   - *Generating query…* — AI SDK `generateObject` call
   - *Running query…* — existing `POST /api/query`
   - *Explaining results…* — AI SDK `generateText` call
5. Results appear in the standard results panel.
6. An explanation paragraph appears below the results.
7. Expand **"Generated Query"** to inspect the `QueryDefinition` produced by the AI.
8. Click **"Open in Query Explorer"** to load the generated query into the manual form for refinement.

---

## API Usage (Direct)

### Generate a Query from a Question

```bash
curl -X POST http://localhost:3000/api/ai/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{
    "question": "How many signups happened last week by plan?",
    "applicationId": "<your-app-id>",
    "startDate": "2026-03-21T00:00:00.000Z",
    "endDate": "2026-03-28T23:59:59.000Z"
  }'
```

**Expected response**:
```json
{
  "query": {
    "applicationId": "<your-app-id>",
    "eventName": "signup",
    "startDate": "2026-03-21T00:00:00.000Z",
    "endDate": "2026-03-28T23:59:59.000Z",
    "aggregation": "count",
    "groupBy": { "kind": "property", "key": "plan" },
    "sort": { "field": "value", "direction": "desc" }
  }
}
```

### Execute the Generated Query

Pass the `query` object directly to the existing query endpoint:

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '<paste query object from above>'
```

### Explain the Results

```bash
curl -X POST http://localhost:3000/api/ai/explain \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{
    "question": "How many signups happened last week by plan?",
    "query": { ... },
    "results": [
      { "group": "pro", "value": 142 },
      { "group": "free", "value": 89 }
    ],
    "totalCount": 2
  }'
```

**Expected response**:
```json
{
  "explanation": "Last week, 231 signups were recorded. The Pro plan led with 142 signups (61%), followed by Free with 89 (39%). This indicates strong mid-tier adoption."
}
```

---

## Running Tests

### Unit Tests

```bash
bun test tests/unit/ai-analytics.test.ts
```

These tests mock `generateObject` and `generateText` from the `ai` package and verify the service layer in isolation.

### API Integration Tests

```bash
bun test tests/api/ai.test.ts
```

Requires a running dev server and seeded database. Uses `sessionFetch` from the existing test helper.

### E2E Tests

```bash
bun run test:e2e -- --grep "AI Analytics"
```

Requires a running dev server with a real `OPENAI_API_KEY` (or use a mock server — see below).

---

## Mocking the AI for Tests

For unit and API tests that should not hit the real OpenAI API, mock the Vercel AI SDK modules:

```typescript
// tests/unit/ai-analytics.test.ts
import { vi } from 'vitest';

vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      applicationId: 'app_test',
      eventName: 'signup',
      startDate: '2026-03-21T00:00:00.000Z',
      endDate: '2026-03-28T23:59:59.000Z',
      aggregation: 'count',
    },
  }),
  generateText: vi.fn().mockResolvedValue({
    text: 'There were 42 signup events last week.',
  }),
}));
```

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `APICallError: 401 Unauthorized` | Missing or invalid `OPENAI_API_KEY` | Set `OPENAI_API_KEY` in `.env.local` |
| `{ "error": "no_schemas" }` | Application has no active event schemas | Seed or create event schemas for the test application |
| `{ "error": "generation_failed" }` | AI returned unparseable output | Try rephrasing the question; check that schema context is non-empty |
| `{ "error": "validation_error" }` | Request body failed Zod validation | Check `question` ≤ 500 chars; dates are ISO 8601 |
| AI generates wrong event name | Model hallucinated beyond schema context | Review system prompt; ensure schema context is complete |
