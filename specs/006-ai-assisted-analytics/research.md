# Research: AI-Assisted Analytics

**Feature**: `006-ai-assisted-analytics`  
**Phase**: 0 — Outline & Research  
**Date**: 2026-03-28

---

## 1. Vercel AI SDK — Structured Output with `generateObject`

**Decision**: Use `generateObject` from `ai@^6.0.0` with `queryDefinitionSchema` (existing Zod schema) for AI query generation.

**Rationale**:  
`generateObject` accepts a Zod schema and enforces it at the type level — if the model response does not parse against the schema, the SDK throws `NoObjectGeneratedError` rather than returning a partial object. The existing `queryDefinitionSchema` (exported from `lib/validations/query-schemas.ts`) already captures the full `QueryDefinition` type including aggregation modes, property filters, groupBy, and sort. There is **zero parsing overhead** — no custom JSON extraction or secondary validation step is needed.

```typescript
import { generateObject } from 'ai';
import { openai }         from '@ai-sdk/openai';
import { queryDefinitionSchema } from '@/lib/validations/query-schemas';

const { object } = await generateObject({
  model: openai(process.env.AI_MODEL ?? 'gpt-4o-mini'),
  schema: queryDefinitionSchema,
  prompt: systemPrompt + '\n\nUser question: ' + question,
});
// `object` is typed as QueryDefinition — no cast needed
```

**Alternatives Considered**:

| Alternative | Rejected Because |
|-------------|-----------------|
| Raw `fetch` to OpenAI API + manual JSON parse | Duplicates SDK plumbing; no type safety on output; retry logic, streaming, and error handling need reimplementation |
| `streamObject` (streaming variant) | Overkill for structured output; client would need to reassemble partial JSON; increases component complexity without clear latency benefit for a ~200-token output |
| LangChain.js structured output | Much heavier dependency; introduces its own abstractions on top of OpenAI; Vercel AI SDK is already the ecosystem-native choice for Next.js |
| Anthropic Claude via `@ai-sdk/anthropic` | No specific requirement for Anthropic; OpenAI is the widely deployed default; provider swap is trivial with AI SDK's unified API |

---

## 2. Text Generation for Result Explanation

**Decision**: Use `generateText` (non-streaming) for the explanation step.

**Rationale**:  
Explanations are expected to be 80–150 words — short enough that the full round-trip latency is well within the 30 s SLA and streaming adds visible UI complexity for minimal perceived benefit. Non-streaming also simplifies the `EXPLAINING` state in the UI state machine (no partial render logic needed).

```typescript
import { generateText } from 'ai';
import { openai }       from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai(process.env.AI_MODEL ?? 'gpt-4o-mini'),
  messages: [
    { role: 'system', content: EXPLANATION_SYSTEM_PROMPT },
    { role: 'user',   content: buildExplainPrompt(question, query, results) },
  ],
});
```

**Alternatives Considered**:

| Alternative | Rejected Because |
|-------------|-----------------|
| `streamText` + Server-Sent Events | Extra SSE handling in both route and component; client needs `useCompletion` hook or manual reader; adds 60–80 lines for a marginal UX improvement on a short output |
| Client-side generation (direct OpenAI call from browser) | Exposes `OPENAI_API_KEY` in the browser; violates secret hygiene |

---

## 3. Two-Route vs. Single-Route Architecture

**Decision**: Two separate API routes — `POST /api/ai/generate` and `POST /api/ai/explain`.

**Rationale**:  
The query execution step between generation and explanation uses the **existing** `POST /api/query` route, which the client already calls. Splitting the AI routes cleanly mirrors this and allows:

1. The client to call `/api/ai/generate` → get `QueryDefinition` → call `/api/query` → get `results` → call `/api/ai/explain`
2. Each AI route to be independently testable and independently retried
3. `POST /api/ai/explain` to be reusable from other future entry points (e.g., saved reports)

**Alternatives Considered**:

| Alternative | Rejected Because |
|-------------|-----------------|
| Single `/api/ai/analytics` that does everything | Must wait for query execution before responding; cannot return partial results; harder to show per-step progress in UI |
| Server Action instead of API routes | Server Actions are designed for form mutations; streaming + long-running AI calls are better suited to API routes with standard `Response` semantics |

---

## 4. Event Schema Context Injection

**Decision**: Build schema context server-side per request using `prisma.eventSchema.findMany` and inject it as a structured system prompt.

**Rationale**:  
FR-004 requires the generated query to reference **only** event names and property keys present in the application's schemas. The safest way to enforce this is to:

1. Fetch active schemas at request time (not cached, so always fresh)
2. Serialize them into a human-readable format in the system prompt
3. Instruct the model to choose `eventName` and `propertyFilters[].key` exclusively from the provided list

Example system prompt section:

```
Available event schemas for this application:
- Event: "signup"
  Properties:
    • plan (string, required) — subscription plan chosen
    • referral_source (string) — how the user found the product

- Event: "page_view"
  Properties:
    • path (string, required) — URL path viewed
    • duration_ms (number) — time on page in milliseconds
```

**Alternatives Considered**:

| Alternative | Rejected Because |
|-------------|-----------------|
| Use `listQueryFieldMetadata()` (existing function) | Returns flat field list without grouping by event name; less useful for prompt construction than raw schema definitions |
| Cache schemas in-memory | Schemas can change; stale context could produce invalid queries; per-request fetch is fast enough (~5 ms) |
| Include all schemas from all applications | Violates application isolation; could leak event names across tenants |

---

## 5. Session History Storage

**Decision**: Store session history in React `useState` only, capped at 20 entries.

**Rationale**:  
The spec explicitly excludes "persistent AI conversation history across browser sessions" from scope. `useState` with a `HistoryEntry[]` typed as `{ id, question, query, results, explanation, timestamp }` satisfies US4 (session history) with zero backend changes. A cap of 20 entries prevents unbounded memory growth.

**Alternatives Considered**:

| Alternative | Rejected Because |
|-------------|-----------------|
| `localStorage` / `sessionStorage` | Out of scope; adds serialization overhead; out-of-scope persistence risk |
| Server-side session storage | Explicitly out of scope in spec |

---

## 6. Input Bounding (FR-011)

**Decision**: Maximum question length of 500 characters, validated on both client and server.

**Rationale**:  
500 characters is long enough for a specific analytics question ("How many premium users signed up in the last 30 days, broken down by referral source?") while guarding against prompt injection via pasted data or very long inputs. At ~1 token per 4 characters, 500 chars ≈ 125 tokens — negligible vs. the schema context.

Validation:
- **Client**: `<textarea maxLength={500}>` + character counter
- **Server**: `z.string().min(1).max(500)` in the generate route's request schema

---

## 7. Error Handling Strategy

**Decision**: Catch Vercel AI SDK errors (`APICallError`, `NoObjectGeneratedError`) and translate to user-friendly, non-leaking messages.

**Known SDK error types** (from `ai@6.x` docs):

| SDK Error Class | Cause | Client Message |
|-----------------|-------|----------------|
| `NoObjectGeneratedError` | Model returned unparseable JSON | "I couldn't generate a valid query for that question. Try rephrasing." |
| `APICallError` (status 429) | Rate limit | "The AI service is busy. Please try again in a moment." |
| `APICallError` (status 5xx) | OpenAI outage | "The AI service is temporarily unavailable." |
| Generic `Error` | Network issue, timeout | "Something went wrong. Please try again." |

All errors are logged server-side (`console.error`) but only safe messages are returned to the client (FR-010).

---

## 8. Model Selection & Cost

**Decision**: Default to `gpt-4o-mini`; allow override via `AI_MODEL` env var.

| Model | Input Cost | Output Cost | Suitability |
|-------|-----------|------------|-------------|
| `gpt-4o-mini` | ~$0.15/1M tokens | ~$0.60/1M tokens | ✅ Default — fast, cheap, capable for structured output |
| `gpt-4o` | ~$2.50/1M tokens | ~$10.00/1M tokens | Override for higher accuracy needs |

At ~500 tokens per generate request (context + prompt + output), `gpt-4o-mini` costs ~$0.0004/request. The explanation step adds ~300 tokens ≈ $0.00018/request. Total per AI-assisted analytics session: < $0.001.
