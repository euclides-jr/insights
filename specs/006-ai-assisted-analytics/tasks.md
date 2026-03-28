# Tasks: AI-Assisted Analytics

**Input**: Design documents from `/specs/006-ai-assisted-analytics/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ai-generate.md ✅, contracts/ai-explain.md ✅, quickstart.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency conflicts)
- **[Story]**: User story label (US1–US4) — setup/foundational/polish phases have no story label
- Exact file paths included in every task description

---

## Phase 1: Setup

**Purpose**: Install new AI SDK dependencies and configure required environment variables before any service or UI code is written.

- [ ] T001 Install `ai@^6.0.0` and `@ai-sdk/openai@^3.0.0` via `bun add ai@^6.0.0 @ai-sdk/openai@^3.0.0` and verify both packages appear in `package.json` dependencies
- [ ] T002 [P] Add `OPENAI_API_KEY` (required) and `AI_MODEL` (optional, default `gpt-4o-mini`) entries to `.env.example` with inline comments explaining each variable's purpose; use `specs/006-ai-assisted-analytics/quickstart.md` as the source of truth for comment wording

**Checkpoint**: `ai` and `@ai-sdk/openai` are installed; `.env.example` documents the two new variables.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the core service module and both API routes before any UI work begins. All user story phases depend on this phase.

**⚠️ CRITICAL**: No user story UI work can begin until this phase is complete.

- [ ] T003 Create `lib/services/ai-analytics.ts` — define and export all TypeScript interfaces: `EventPropertyDefinition`, `EventSchemaEntry`, `EventSchemaContext`, `GenerateQueryParams`, `ExplainResultsParams`, and `AIAnalyticsHistoryEntry` exactly as specified in `specs/006-ai-assisted-analytics/data-model.md`; export function stubs for `buildEventSchemaContext`, `generateQueryFromPrompt`, and `explainQueryResults`
- [ ] T004 Implement `buildEventSchemaContext(applicationId: string): Promise<EventSchemaContext>` in `lib/services/ai-analytics.ts` — call `prisma.eventSchema.findMany({ where: { applicationId, isActive: true } })`, map rows to `EventSchemaEntry[]`, and return `{ applicationId, schemas }`; return an empty schemas array (not an error) when no records exist; allow Prisma errors (connection timeout, query failure) to propagate unmodified so the calling API route can catch them as `internal_error` — do NOT swallow DB exceptions as an empty context
- [ ] T005 Implement `generateQueryFromPrompt(params: GenerateQueryParams): Promise<QueryDefinition>` in `lib/services/ai-analytics.ts` — call `generateObject` from `ai` using the `openai` provider (model from `process.env.AI_MODEL ?? 'gpt-4o-mini'`), pass `queryDefinitionSchema` from `lib/validations/query-schemas.ts` as the schema, build the system prompt from `params.schemaContext` following the structure in `specs/006-ai-assisted-analytics/contracts/ai-generate.md`, and return the Zod-validated `QueryDefinition`
- [ ] T006 Implement `explainQueryResults(params: ExplainResultsParams): Promise<string>` in `lib/services/ai-analytics.ts` — call `generateText` from `ai` using the `openai` provider, build the explanation prompt per `specs/006-ai-assisted-analytics/contracts/ai-explain.md` (include question, query summary, totalCount, truncated results up to 20 rows), set `maxTokens: 300`, and return the text
- [ ] T007 [P] Create `app/api/ai/generate/route.ts` — implement `POST /api/ai/generate` per `specs/006-ai-assisted-analytics/contracts/ai-generate.md`:
  - Validate request body with Zod: `question` (string, 1–500 chars), `applicationId` (string, min 1), `startDate` / `endDate` (ISO 8601 datetime); return 400 `validation_error` on failure
  - Call `buildEventSchemaContext`; return 422 `no_schemas` if `schemas.length === 0` (skip AI call)
  - Call `generateQueryFromPrompt`; return `{ query: QueryDefinition }` HTTP 200 on success
  - Error mapping: `NoObjectGeneratedError` → 422 `generation_failed`; `APICallError` status 429 → 429 `rate_limited`; `APICallError` any other status (401, 403, 5xx) → 500 `internal_error`; Prisma errors and all other exceptions → 500 `internal_error`
  - Log all server errors with `console.error`; never expose raw error messages or stack traces to the client (FR-010)
- [ ] T008 [P] Create `app/api/ai/explain/route.ts` — implement `POST /api/ai/explain` per `specs/006-ai-assisted-analytics/contracts/ai-explain.md`:
  - Validate request body with Zod: `question` (string, 1–500 chars), `query` (via `queryDefinitionSchema`), `results` (array of records), `totalCount` (integer ≥ 0); return 400 `validation_error` on failure
  - Call `explainQueryResults`; return `{ explanation: string }` HTTP 200 on success
  - Error mapping: `APICallError` status 429 → 429 `rate_limited`; `APICallError` any other status (401, 403, 5xx) or any other error → 500 `internal_error` with message `"Something went wrong generating the explanation. Your results are still shown above."`
  - Log all server errors with `console.error`; never expose raw error details to the client

**Checkpoint**: `lib/services/ai-analytics.ts` exports all three functions; both API routes are reachable and return correct shapes for valid requests; the no-schemas 422 path is handled.

---

## Phase 3: User Story 1 — Natural-Language Query Generation (Priority: P1) 🎯 MVP

**Goal**: A user selects an application, types a plain-language analytics question, submits it, and receives query results in the standard results panel — no knowledge of event names or properties required.

**Independent Test**: Submit `"How many signups happened last week, broken down by plan?"` with an application that has at least one active event schema, verify the panel transitions through GENERATING → EXECUTING → DONE states with results visible; submit with no application selected and verify the submit button remains disabled; submit for an application with no schemas and verify the no-schemas message appears.

### Tests for User Story 1

- [ ] T009 [P] [US1] Create `tests/unit/ai-analytics.test.ts` — write unit tests for `buildEventSchemaContext` (mock Prisma: returns schemas, returns empty array when no rows) and `generateQueryFromPrompt` (mock `generateObject`: returns valid QueryDefinition, throws `NoObjectGeneratedError`); assert correct return types and error propagation
- [ ] T010 [P] [US1] Create `tests/api/ai.test.ts` — write API integration tests for `POST /api/ai/generate`: (a) valid body with seeded app and schemas returns `{ query: QueryDefinition }` HTTP 200; (b) missing `question` field returns 400 `validation_error`; (c) `question` exceeding 500 chars returns 400; (d) application with no schemas returns 422 `no_schemas`; (e) AI generation failure returns 422 `generation_failed`

### Implementation for User Story 1

- [ ] T011 [US1] Create `components/ai/ai-analytics-panel.tsx` — `'use client'` component accepting `applications: { id: string; name: string }[]` and `onLoadQueryIntoForm: (q: QueryDefinition) => void` props; implement the full `PanelState` type (`idle | generating | executing | explaining | done | error`) from `data-model.md`; render: application `<select>` (required), `<textarea>` with `maxLength={500}` and character counter, submit `<button>` disabled when no application selected or state is not `idle`; show loading label per state ("Generating query…" / "Running query…" / "Explaining results…"); on submit, call `POST /api/ai/generate` → `POST /api/query` → `POST /api/ai/explain` in sequence, transitioning state at each step; show `error.message` on failure with a dismiss/retry affordance
- [ ] T012 [US1] Modify `app/query/page.tsx` — import `AIAnalyticsPanel` from `components/ai/ai-analytics-panel.tsx`; render `<AIAnalyticsPanel applications={applications} onLoadQueryIntoForm={...} />` above the `<QueryForm>` block inside the existing `<DashboardLayout>` wrapper; pass a no-op `onLoadQueryIntoForm` callback for now (wired properly in T021)
- [ ] T013 [P] [US1] Create `tests/e2e/ai-analytics.spec.ts` — Playwright tests: (a) navigate to `/query`, verify AI analytics panel is present; (b) verify submit button disabled until application selected; (c) with mocked `POST /api/ai/generate` and `POST /api/query` responses, submit a question and verify results panel receives data; (d) with mocked no-schemas 422, verify the user-facing "no schemas" message is shown

**Checkpoint**: A user can ask a plain-language question in the UI and receive query results. User Story 1 is independently testable and functional.

---

## Phase 4: User Story 2 — Results Explanation (Priority: P1)

**Goal**: After a query runs, a concise plain-language explanation of the results is shown beneath the data, including a helpful message when zero results are returned.

**Independent Test**: After a successful AI query run, verify a non-empty explanation paragraph appears below the results table. Run a query that returns zero rows and verify the explanation mentions no matching events were found. Simulate an explanation API failure and verify results remain visible (explanation section is absent or shows a soft fallback, not a hard error).

### Tests for User Story 2

- [ ] T014 [P] [US2] Extend `tests/unit/ai-analytics.test.ts` — add unit tests for `explainQueryResults`: (a) non-empty results produces explanation text; (b) empty results array produces text referencing "no events found"; (c) mock `generateText` throwing → error propagates correctly
- [ ] T015 [P] [US2] Extend `tests/api/ai.test.ts` — add API integration tests for `POST /api/ai/explain`: (a) valid body with results returns `{ explanation: string }` HTTP 200; (b) empty `results` array returns 200 with explanation that addresses zero results; (c) invalid `totalCount` (negative) returns 400; (d) rate-limit mock returns 429 `rate_limited`

### Implementation for User Story 2

- [ ] T016 [P] [US2] Create `components/ai/ai-explanation.tsx` — `'use client'` component accepting `explanation: string | null` prop; renders explanation text in a styled prose paragraph when non-null; renders nothing (not an error state) when `null` so that explanation failures never hide query results (per contract `ai-explain.md` note on 500 behaviour)
- [ ] T017 [US2] Integrate `AIExplanation` into `components/ai/ai-analytics-panel.tsx` — import and render `<AIExplanation explanation={...} />` in the `done` state below the results display; if the `POST /api/ai/explain` call fails, set `explanation` to `null` and transition to `done` (not `error`) so results remain visible
- [ ] T018 [P] [US2] Extend `tests/e2e/ai-analytics.spec.ts` — add tests: (a) verify explanation paragraph is visible after full flow with mocked AI responses; (b) verify zero-results explanation message contains appropriate language; (c) verify that a mocked explain-API failure leaves results visible with no explanation block

**Checkpoint**: Every successful query run shows an explanation. Explanation failures degrade gracefully without hiding results. User Story 2 is independently testable alongside User Story 1.

---

## Phase 5: User Story 3 — Inspect and Refine the Generated Query (Priority: P2)

**Goal**: Technical users can expand a collapsible panel to see the exact query the AI produced (event name, date range, aggregation, filters), and can load it into the manual Query Explorer form for further editing with one click.

**Independent Test**: After submitting a question and receiving results, expand the "Generated Query" inspector and verify the event name, date range, and aggregation are displayed. Click "Open in Query Explorer" and verify the manual `<QueryForm>` is populated with the corresponding values.

### Tests for User Story 3

- [ ] T019 [P] [US3] Create `components/ai/ai-query-inspector.tsx` — `'use client'` component accepting `query: QueryDefinition` and `onOpenInExplorer: (q: QueryDefinition) => void` props; renders a collapsible `<details>` / accordion section labelled "Generated Query"; inside, display event name, date range, aggregation mode, aggregation field (if set), groupBy (if set), and any property filters in a human-readable structured format; render an "Open in Query Explorer" `<button>` that calls `onOpenInExplorer(query)`

- [ ] T020 [US3] Wire `AIQueryInspector` into `components/ai/ai-analytics-panel.tsx` — import and render `<AIQueryInspector query={state.query} onOpenInExplorer={onLoadQueryIntoForm} />` in the `done` state; the `onLoadQueryIntoForm` prop is already threaded through from the parent page
- [ ] T021 [US3] Implement `onLoadQueryIntoForm` callback in `app/query/page.tsx` — when `AIAnalyticsPanel` calls `onLoadQueryIntoForm(query)`, serialize the `QueryDefinition` to URL search params using the existing `lib/query/hydration.ts` serializer and either update `router.push` / `router.replace` so `<QueryForm>` hydrates from `searchParams`, or pass the query as `initialState` directly to `<QueryForm>` (follow the existing hydration pattern used by saved reports in 005)
- [ ] T022 [P] [US3] Extend `tests/e2e/ai-analytics.spec.ts` — add tests: (a) generated query inspector section is present and collapsed by default after a query runs; (b) expanding it shows the correct event name and aggregation from the mocked query; (c) clicking "Open in Query Explorer" populates the `<QueryForm>` with the expected field values

**Checkpoint**: Power users can inspect and trust the AI's query and load it into the manual form. User Story 3 is independently testable.

---

## Phase 6: User Story 4 — Question History Within Session (Priority: P3)

**Goal**: Within the same browser session, users can see a list of all questions asked, click any previous entry, and have its question text, generated query, results, and explanation fully restored.

**Independent Test**: Submit three distinct questions in sequence; verify all three appear in a reverse-chronological history panel; click the second entry and confirm the question text, results panel, explanation, and query inspector all restore to that entry's original values. Submit a fourth question and verify it appears at the top of the history list.

### Tests for User Story 4

- [ ] T023 [P] [US4] Extend `tests/e2e/ai-analytics.spec.ts` — add tests: (a) after three mocked question submissions, verify the history panel lists all three entries in reverse-chronological order; (b) clicking an earlier history entry restores its question text and results; (c) submitting a new question adds it at the top of the history list

### Implementation for User Story 4

- [ ] T024 [US4] Add session history state and panel to `components/ai/ai-analytics-panel.tsx`:
  - Import `AIAnalyticsHistoryEntry` type; add `useState<AIAnalyticsHistoryEntry[]>([])`
  - On each transition to `done`, build a new entry (with `crypto.randomUUID()` id and current timestamp) and update state via `setHistory(prev => [newEntry, ...prev].slice(0, 20))` — prepend newest, cap at 20
  - Render a history section listing entries in reverse-chronological order (newest first) showing question text and timestamp
  - Clicking a history entry restores that entry's `question`, `query`, `results`, `totalCount`, and `explanation` into component state without re-running any API calls

**Checkpoint**: Session history is functional. Users can navigate prior results without re-running queries. User Story 4 is independently testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify edge-case handling, input bounds, and error isolation that span all user stories; validate the feature end-to-end.

- [ ] T025 [P] Audit `components/ai/ai-analytics-panel.tsx` for FR-010 and FR-011 compliance — confirm the `<textarea>` has `maxLength={500}` rendered in the DOM; confirm each API error code (`no_schemas`, `generation_failed`, `rate_limited`, `validation_error`, `internal_error`) maps to a distinct user-friendly message string with no raw stack trace or internal field names exposed; add error-message constants to a `lib/ai-error-messages.ts` helper if inline strings are duplicated
- [ ] T026 [P] Review `app/api/ai/generate/route.ts` and `app/api/ai/explain/route.ts` for complete error branch coverage — confirm `console.error` / `console.warn` calls are present for server-side logging, that `APICallError` 429 is distinguished from 5xx errors, and that Zod validation errors in request bodies return `details` arrays per the contract spec
- [ ] T027 Validate `specs/006-ai-assisted-analytics/quickstart.md` end-to-end against the local seeded environment — run `bun run dev`, follow the quickstart steps (select app, submit question, inspect query, load into explorer), confirm results, explanation, inspector, and load-into-form all work as described

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1; **blocks all user story phases**
- **Phase 3 (US1)**: Depends on Phase 2; first deliverable MVP
- **Phase 4 (US2)**: Depends on Phase 2; can start in parallel with Phase 3 (different files: `ai-explanation.tsx`, explain tests)
- **Phase 5 (US3)**: Depends on Phase 3 (needs panel state machine and `onLoadQueryIntoForm` prop)
- **Phase 6 (US4)**: Depends on Phase 3 (modifies `ai-analytics-panel.tsx`); can run after Phase 3 regardless of Phases 4–5 status
- **Phase 7 (Polish)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational — delivers first independently testable increment
- **US2 (P1)**: Depends on Foundational; integrates into AI panel from US1 but `ai-explanation.tsx` can be built in parallel
- **US3 (P2)**: Depends on US1 (`onLoadQueryIntoForm` prop and panel state); `ai-query-inspector.tsx` can be built in parallel
- **US4 (P3)**: Depends on US1 (history is added to `ai-analytics-panel.tsx`); independent of US2 and US3

### Within Each Phase

- Service functions (T004–T006) built sequentially in `lib/services/ai-analytics.ts`
- API routes (T007, T008) are parallel — different files, no shared mutable state
- Test files (T009, T010) are parallel — `tests/unit/` vs `tests/api/`
- Component creation tasks marked [P] operate on separate new files
- Integration and wiring tasks (T012, T017, T020, T021, T024) are sequential — all modify existing files

---

## Parallel Example: User Story 1

```bash
# These can run in parallel (different files, no conflicts):
Task T009: "Create tests/unit/ai-analytics.test.ts — unit tests for buildEventSchemaContext and generateQueryFromPrompt"
Task T010: "Create tests/api/ai.test.ts — API integration tests for POST /api/ai/generate"

# Then sequentially:
Task T011: "Create components/ai/ai-analytics-panel.tsx"
Task T012: "Modify app/query/page.tsx to render AIAnalyticsPanel"
Task T013: "Extend tests/e2e/ai-analytics.spec.ts with question submission E2E tests"
```

## Parallel Example: User Story 2

```bash
# These can run in parallel (different files):
Task T014: "Extend tests/unit/ai-analytics.test.ts — explainQueryResults unit tests"
Task T015: "Extend tests/api/ai.test.ts — POST /api/ai/explain integration tests"
Task T016: "Create components/ai/ai-explanation.tsx"

# Then sequentially:
Task T017: "Integrate AIExplanation into components/ai/ai-analytics-panel.tsx"
Task T018: "Extend tests/e2e/ai-analytics.spec.ts with explanation tests"
```

---

## Implementation Strategy

### MVP First (User Stories 1 and 2 Only)

1. Complete **Phase 1** (Setup — 2 tasks)
2. Complete **Phase 2** (Foundational — 6 tasks; unblocks all stories)
3. Complete **Phase 3** (US1 — 5 tasks; panel + query generation working)
4. Complete **Phase 4** (US2 — 5 tasks; explanation layer working)
5. **STOP and VALIDATE**: Full question → results → explanation flow works end-to-end
6. Ship or demo — this covers both P1 stories and all FR-001 through FR-013

### Incremental Delivery

1. Phase 1 + Phase 2 → foundation stable
2. Phase 3 → US1 MVP: question submission + results (validate independently)
3. Phase 4 → US2: explanation layer (validate independently — results still shown on explain failure)
4. Phase 5 → US3: query inspector + load-into-form (validate independently)
5. Phase 6 → US4: session history (validate independently)
6. Phase 7 → polish and sign-off

### Parallel Team Strategy

With two developers after Phase 2 completes:

- **Developer A**: Phase 3 (US1 panel + query page integration)
- **Developer B**: `ai-explanation.tsx` component (T016) and explanation tests (T014, T015) in parallel — integrates into panel after T011 merges

---

## Summary

| Phase | Story | Tasks | Parallelizable |
|-------|-------|-------|---------------|
| 1 — Setup | — | T001–T002 | T002 |
| 2 — Foundational | — | T003–T008 | T007, T008 |
| 3 — Query Generation | US1 (P1) 🎯 | T009–T013 | T009, T010, T013 |
| 4 — Results Explanation | US2 (P1) | T014–T018 | T014, T015, T016, T018 |
| 5 — Inspect & Refine | US3 (P2) | T019–T022 | T019, T022 |
| 6 — Session History | US4 (P3) | T023–T024 | T023 |
| 7 — Polish | — | T025–T027 | T025, T026 |

**Total**: 27 tasks across 7 phases  
**MVP scope**: Phases 1–4 (18 tasks) — delivers both P1 user stories  
**Parallel opportunities**: 14 tasks marked [P]  
**New files**: `lib/services/ai-analytics.ts`, `app/api/ai/generate/route.ts`, `app/api/ai/explain/route.ts`, `components/ai/ai-analytics-panel.tsx`, `components/ai/ai-query-inspector.tsx`, `components/ai/ai-explanation.tsx`, `tests/unit/ai-analytics.test.ts`, `tests/api/ai.test.ts`, `tests/e2e/ai-analytics.spec.ts`  
**Modified files**: `app/query/page.tsx`, `.env.example`, `package.json`
