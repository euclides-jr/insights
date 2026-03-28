# Implementation Plan: AI-Assisted Analytics

**Branch**: `006-ai-assisted-analytics` | **Date**: 2026-03-28 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/006-ai-assisted-analytics/spec.md`

---

## Summary

Add an AI-assisted analytics panel to the existing Query Explorer that translates plain-language questions into executable `QueryDefinition` objects, runs them through the existing query engine, and returns a plain-language explanation of the results. The AI layer is powered by the **Vercel AI SDK** (`ai@^6.0.0` + `@ai-sdk/openai@^3.0.0`), using `generateObject` with the existing `queryDefinitionSchema` (Zod) for structured query generation and `generateText` for result explanation. The feature adds two new API routes, a service module, and a UI panel component that slots into the existing Query Explorer page without replacing it.

## Current Status

Implemented in the application and covered by automated tests.

Notable delivered behavior beyond the original draft:

- prompt-derived date ranges in the client request flow
- schema-description-aware query refinement
- schema-grounded correction of misgenerated event names and groupings
- repeat-submit handling in the AI panel
- Playwright coverage for session history, repeat generation, and prompt time-range parsing

---

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js (Bun runtime)  
**Primary Dependencies**: Next.js 16.x App Router, React 19, Vercel AI SDK (`ai@^6.0.0`, `@ai-sdk/openai@^3.0.0`), Zod 3.x, Prisma 7.x  
**Storage**: PostgreSQL via Prisma — no new tables; reads `EventSchema` model  
**Testing**: Vitest (unit + API integration), Playwright (E2E)  
**Target Platform**: Next.js server (API Routes) + React client component  
**Project Type**: Web application (full-stack Next.js)  
**Performance Goals**: End-to-end from question submission to results displayed ≤ 30 s (SC-001); visible progress feedback throughout (NFR-001)  
**Constraints**: No new auth requirements; bounded prompt input ≤ 500 chars (FR-011); generated query must pass `queryDefinitionSchema` validation before execution (NFR-002); no persistent storage of AI conversation state  
**Scale/Scope**: Single-application queries; session-only history; no cross-workspace access

---

## Constitution Check

*No `constitution.md` found — no project-level gates to evaluate. Standard engineering best practices apply.*

| Gate | Status | Notes |
|------|--------|-------|
| No new auth mechanism | ✅ PASS | Uses existing `proxy.ts` dashboard auth; API routes are behind same session guard |
| Minimal new dependencies | ✅ PASS | Two packages (`ai`, `@ai-sdk/openai`); no vulnerabilities found in advisory DB |
| No new database tables | ✅ PASS | Session history is React state only; reads existing `EventSchema` |
| Generated query validated before execution | ✅ PASS | `generateObject` enforces `queryDefinitionSchema` via Zod; invalid AI output is an error |
| Error isolation | ✅ PASS | AI errors caught in API route, returned as user-friendly messages; no raw stack traces |

---

## Project Structure

### Documentation (this feature)

```text
specs/006-ai-assisted-analytics/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── ai-generate.md   ← Phase 1 output — POST /api/ai/generate
│   └── ai-explain.md    ← Phase 1 output — POST /api/ai/explain
└── tasks.md             ← Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code Changes

```text
app/
├── api/
│   └── ai/
│       ├── generate/
│       │   └── route.ts          # NEW — POST /api/ai/generate
│       └── explain/
│           └── route.ts          # NEW — POST /api/ai/explain
└── query/
    └── page.tsx                  # MODIFIED — adds <AIAnalyticsPanel>

components/
└── ai/
    ├── ai-analytics-panel.tsx    # NEW — prompt input, state machine, orchestration
    ├── ai-query-inspector.tsx    # NEW — collapsible generated query view (US3)
    └── ai-explanation.tsx        # NEW — result explanation display

lib/
├── ai/
│   └── date-range.ts            # NEW — prompt-derived date range inference
└── services/
    └── ai-analytics.ts           # NEW — generateQueryFromPrompt(), explainQueryResults()

tests/
├── unit/
│   ├── ai-date-range.test.ts    # NEW — prompt date-range inference coverage
│   └── ai-analytics.test.ts      # NEW — unit tests for ai-analytics service
└── api/
    └── ai.test.ts                # NEW — integration tests for /api/ai/* routes

tests/e2e/
└── ai-analytics.spec.ts          # NEW — Playwright E2E: full question→results flow
```

**Structure Decision**: Single Next.js project layout (Option 1 / Option 2 hybrid already in use). New code follows the existing pattern of `app/api/*/route.ts` for routes, `lib/services/*.ts` for business logic, and `components/*/` for UI modules. No new top-level directories.

---

## Complexity Tracking

> No constitution violations — section not required.

---

## Phase 0: Research

→ See [research.md](./research.md) for full findings. Summary below.

| Decision | Rationale |
|----------|-----------|
| Vercel AI SDK `generateObject` for query generation | Accepts a Zod schema directly; the existing `queryDefinitionSchema` is reused verbatim, guaranteeing structural validity without a parsing layer |
| `@ai-sdk/openai` provider, model `gpt-4o-mini` default | Cost-effective for structured output; configurable via `AI_MODEL` env var so teams can upgrade to `gpt-4o` without a code change |
| `generateText` (not `streamText`) for explanation | Explanation is short (~100–150 words); non-streaming simplifies the client state machine; latency is acceptable within the 30 s SLA |
| Two separate API routes (`/api/ai/generate`, `/api/ai/explain`) | Decouples generation from explanation; allows the UI to execute the manual query between steps; easier to test each phase independently |
| Session history in React state only | Spec explicitly excludes persistent history (Out of Scope); `useState` with a capped array is sufficient and zero-schema-impact |
| Prompt bounded to 500 characters | FR-011; prevents excessive token usage; validated in both client and server |
| Event schema context injected into system prompt | AI must reference only event names and property keys from the application's schemas (FR-004); schemas fetched server-side per request so context is always fresh |

---

## Phase 1: Design & Contracts

→ See [data-model.md](./data-model.md), [contracts/ai-generate.md](./contracts/ai-generate.md), [contracts/ai-explain.md](./contracts/ai-explain.md), and [quickstart.md](./quickstart.md) for full detail.

### Entities

| Entity | Where Defined | Notes |
|--------|--------------|-------|
| `AIAnalyticsRequest` | Request body to `POST /api/ai/generate` | `{ question: string, applicationId: string, startDate: string, endDate: string }` |
| `GeneratedQuery` | Response body of `POST /api/ai/generate` | `{ query: QueryDefinition }` — Zod-validated by `generateObject` |
| `AIResultExplanation` | Response body of `POST /api/ai/explain` | `{ explanation: string }` |
| `EventSchemaContext` | Built server-side in `ai-analytics.ts` | Aggregated from `prisma.eventSchema.findMany` for the application; passed as system-prompt context |

### Data Flow

```
User question
      │
      ▼
POST /api/ai/generate
  ├─ Fetch EventSchema[] for applicationId
  ├─ Build system prompt with schema context
  ├─ generateObject(model, queryDefinitionSchema, prompt)   ← Vercel AI SDK
  ├─ Zod parse (enforced by generateObject)
  └─ Return { query: QueryDefinition }
      │
      ▼
Client calls POST /api/query (existing)
  └─ Returns { results, totalCount, executionTimeMs }
      │
      ▼
POST /api/ai/explain
  ├─ Receives { question, query, results }
  ├─ generateText(model, prompt with results context)       ← Vercel AI SDK
  └─ Return { explanation: string }
      │
      ▼
UI renders: results table + explanation + query inspector
```

### UI State Machine (`AIAnalyticsPanel`)

```
IDLE ──[submit]──► GENERATING ──[success]──► EXECUTING ──[success]──► EXPLAINING ──[success]──► DONE
                        │                        │                         │
                    [error]                  [error]                   [error]
                        └────────────────────────┴─────────────────────────┴──► ERROR
```

- `IDLE`: prompt input enabled, submit disabled when no app selected
- `GENERATING`: spinner shown; "Generating query…" label
- `EXECUTING`: reuses existing query execution; "Running query…" label
- `EXPLAINING`: "Explaining results…" label
- `DONE`: results panel + explanation + query inspector visible
- `ERROR`: user-friendly message; no raw error exposed

### Key Implementation Notes

1. **`lib/services/ai-analytics.ts`** exports:
   - `generateQueryFromPrompt(params: GenerateQueryParams): Promise<QueryDefinition>`  
     Uses `generateObject` from `ai`, `openai` from `@ai-sdk/openai`, and `queryDefinitionSchema` from `lib/validations/query-schemas`.
   - `explainQueryResults(params: ExplainResultsParams): Promise<string>`  
     Uses `generateText`. Instruction prompt references question + result shape + top values.
   - `buildEventSchemaContext(applicationId: string): Promise<EventSchemaContext>`  
     Reads `prisma.eventSchema.findMany({ where: { applicationId, isActive: true } })`. Returns empty context (not error) when no schemas exist.

2. **`POST /api/ai/generate`** (`app/api/ai/generate/route.ts`):
   - Validates body with Zod: `{ question: z.string().min(1).max(500), applicationId: z.string().min(1), startDate: z.string().datetime(), endDate: z.string().datetime() }`
   - Calls `buildEventSchemaContext` → if empty, returns `{ error: 'no_schemas', message: 'No event schemas found for this application.' }` (HTTP 422)
   - Calls `generateQueryFromPrompt`
   - Returns `{ query: QueryDefinition }` (HTTP 200) or `{ error, message }` (HTTP 4xx/5xx)
   - Catches `APICallError` / `NoObjectGeneratedError` from Vercel AI SDK; logs internally, returns generic message to client (FR-010)

3. **`POST /api/ai/explain`** (`app/api/ai/explain/route.ts`):
   - Validates body with Zod: `{ question: string, query: QueryDefinition, results: object[] }`
   - Calls `explainQueryResults`
   - Returns `{ explanation: string }` (HTTP 200) or `{ error, message }` (HTTP 4xx/5xx)

4. **`AIAnalyticsPanel`** (`components/ai/ai-analytics-panel.tsx`):
   - Client component (`'use client'`)
   - Props: `applications: Application[]`; `onLoadQueryIntoForm: (q: QueryDefinition) => void` (for FR-009)
   - Maintains `sessionHistory: HistoryEntry[]` in `useState` (US4); capped at 20 entries
   - Renders: app selector → question textarea (maxLength=500) → submit → progress states → results → explanation → query inspector

5. **`app/query/page.tsx`** (modification):
   - Import `AIAnalyticsPanel` and render it above `<QueryForm>` in a tabbed or sectioned layout
   - Wire `onLoadQueryIntoForm` callback to populate `<QueryForm>` `initialState` (FR-009)

6. **Environment variables** (new, add to `.env.example`):
   - `OPENAI_API_KEY` — required; used by `@ai-sdk/openai`
   - `AI_MODEL` — optional; defaults to `gpt-4o-mini`

### Testing Strategy

| Layer | File | Coverage |
|-------|------|---------|
| Unit | `tests/unit/ai-analytics.test.ts` | `generateQueryFromPrompt` with mocked `generateObject`; `explainQueryResults` with mocked `generateText`; `buildEventSchemaContext` with mock Prisma client |
| API Integration | `tests/api/ai.test.ts` | `POST /api/ai/generate` with valid/invalid bodies; `POST /api/ai/explain`; no-schemas 422 path; error propagation |
| E2E | `tests/e2e/ai-analytics.spec.ts` | Full flow: select app → type question → verify query inspector → verify explanation visible; load-into-form action; session history |

---

## Appendix: Dependency Versions

| Package | Version | Purpose |
|---------|---------|---------|
| `ai` | `^6.0.0` | Vercel AI SDK core (`generateObject`, `generateText`) |
| `@ai-sdk/openai` | `^3.0.0` | OpenAI provider for Vercel AI SDK |

Both packages were checked against the GitHub Advisory Database on 2026-03-28 — **no vulnerabilities found**.
