# Tasks: AI Analytics Quality Improvements

**Input**: Design intent from `/specs/007-ai-analytics-quality/spec.md` and `/specs/007-ai-analytics-quality/plan.md`

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel
- **[Story]**: User story label (US1–US5)

---

## Phase 1: Rich Time Ranges

**Purpose**: Make prompt time interpretation accurate enough for common analytics phrasing.

- [x] T001 [US1] Extend [lib/ai/date-range.ts](/Users/e.dosreissilvajunior/Documents/insights/lib/ai/date-range.ts) with a deterministic NLP-backed parser and normalization layer for `last N weeks`, `last N months`, `between X and Y`, `since X`, `year to date`, and named-month/calendar phrases used in the product
- [x] T002 [US1] Add a bounded structured LLM date-range fallback interface in [lib/ai/date-range.ts](/Users/e.dosreissilvajunior/Documents/insights/lib/ai/date-range.ts) or a sibling module, returning resolved dates, parser source, confidence, and clarification state without free-form text
- [x] T003 [P] [US1] Add unit coverage in [tests/unit/ai-date-range.test.ts](/Users/e.dosreissilvajunior/Documents/insights/tests/unit/ai-date-range.test.ts) for deterministic parsing, fallback routing, and clarification outcomes across the supported prompt expressions
- [x] T004 [US1] Update [components/ai/ai-analytics-panel.tsx](/Users/e.dosreissilvajunior/Documents/insights/components/ai/ai-analytics-panel.tsx) and/or [components/ai/ai-query-inspector.tsx](/Users/e.dosreissilvajunior/Documents/insights/components/ai/ai-query-inspector.tsx) to explicitly show the interpreted date range and whether it came from direct parsing, fallback parsing, or clarification
- [x] T005 [P] [US1] Extend [tests/e2e/ai-analytics.spec.ts](/Users/e.dosreissilvajunior/Documents/insights/tests/e2e/ai-analytics.spec.ts) with prompts covering richer date expressions and verify the resolved range in the UI

**Checkpoint**: Prompt date handling is no longer limited to the current small phrase set.

---

## Phase 2: Clarification Instead of Guessing

**Purpose**: Prevent unsafe best-effort execution when multiple schema interpretations are plausible.

- [x] T006 [US2] Extend [lib/services/ai-analytics.ts](/Users/e.dosreissilvajunior/Documents/insights/lib/services/ai-analytics.ts) with explicit event/property confidence scoring output rather than only silent refinement
- [x] T007 [US2] Introduce a clarification response shape and route handling in [app/api/ai/generate/route.ts](/Users/e.dosreissilvajunior/Documents/insights/app/api/ai/generate/route.ts) for low-confidence prompt matches, including unresolved date-range clarification from the hybrid parser
- [x] T008 [US2] Update [components/ai/ai-analytics-panel.tsx](/Users/e.dosreissilvajunior/Documents/insights/components/ai/ai-analytics-panel.tsx) to render clarification choices and continue the AI flow after the user selects one
- [x] T009 [P] [US2] Add unit tests in [tests/unit/ai-analytics.test.ts](/Users/e.dosreissilvajunior/Documents/insights/tests/unit/ai-analytics.test.ts) for low-confidence ambiguous prompts and clarification-option generation
- [x] T010 [P] [US2] Add Playwright coverage in [tests/e2e/ai-analytics.spec.ts](/Users/e.dosreissilvajunior/Documents/insights/tests/e2e/ai-analytics.spec.ts) for an ambiguous prompt that must clarify before execution

**Checkpoint**: Ambiguous prompts ask, rather than guess.

---

## Phase 3: Transparency and Empty-Result Recovery

**Purpose**: Make the AI panel explain what it did and what to try next when data is empty.

- [x] T011 [US3] Add an execution-summary model in [lib/services/ai-analytics.ts](/Users/e.dosreissilvajunior/Documents/insights/lib/services/ai-analytics.ts) that captures chosen event, grouping, resolved time range, parser source, and any fallback assumptions
- [x] T012 [US3] Render the execution summary in [components/ai/ai-analytics-panel.tsx](/Users/e.dosreissilvajunior/Documents/insights/components/ai/ai-analytics-panel.tsx) and/or [components/ai/ai-query-inspector.tsx](/Users/e.dosreissilvajunior/Documents/insights/components/ai/ai-query-inspector.tsx)
- [x] T013 [US4] Improve empty-result explanation guidance in [lib/services/ai-analytics.ts](/Users/e.dosreissilvajunior/Documents/insights/lib/services/ai-analytics.ts) so it suggests concrete next actions based on the resolved time range and schema context
- [x] T014 [P] [US4] Extend [tests/unit/ai-analytics.test.ts](/Users/e.dosreissilvajunior/Documents/insights/tests/unit/ai-analytics.test.ts) to verify empty-result guidance includes schema/time-based recovery suggestions
- [x] T015 [P] [US3] Extend [tests/e2e/ai-analytics.spec.ts](/Users/e.dosreissilvajunior/Documents/insights/tests/e2e/ai-analytics.spec.ts) to verify execution-summary visibility and empty-result recovery messaging

**Checkpoint**: Users can see how the query was interpreted and what to do when no rows come back.

---

## Phase 4: Seeded Demo Coverage

**Purpose**: Ensure documented prompt examples produce useful results against fresh seeded data.

- [x] T016 [US5] Update [prisma/seed.ts](/Users/e.dosreissilvajunior/Documents/insights/prisma/seed.ts) so documented mobile/web/admin AI prompt examples have recent and representative seeded coverage
- [x] T017 [US5] Update [docs/AI_PROMPT_EXAMPLES.md](/Users/e.dosreissilvajunior/Documents/insights/docs/AI_PROMPT_EXAMPLES.md) so example prompts align with the refreshed seed windows and properties
- [x] T018 [P] [US5] Add or extend seeded-flow verification in [tests/e2e/ai-analytics.spec.ts](/Users/e.dosreissilvajunior/Documents/insights/tests/e2e/ai-analytics.spec.ts) for at least one documented prompt per seeded application

**Checkpoint**: Fresh seeds support credible AI analytics demos and QA runs.

---

## Phase 5: Final Validation

**Purpose**: Validate the full improvement loop end to end.

- [x] T019 Run focused unit coverage for AI date parsing and AI analytics service behavior
- [x] T020 Run focused Playwright coverage for AI analytics clarification, date-range interpretation, and recovery states
- [x] T021 Reseed locally and manually validate documented prompt examples against each seeded application
