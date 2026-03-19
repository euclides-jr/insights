# Tasks: Query Explorer Completion

**Input**: Design documents from `/specs/005-query-explorer-completion/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/query-explorer.md ✅, quickstart.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths included in every task description

---

## Phase 1: Foundation

**Purpose**: Establish shared query state and validation before feature work begins.

- [x] T001 Create `lib/validations/query-schemas.ts` — shared Zod schemas for `QueryDefinition`, `PropertyFilter`, `GroupByDefinition`, `QuerySort`, and backwards-compatible request normalization from the current `/api/query` body
- [x] T002 [P] Create `lib/query/hydration.ts` — serialize/deserialize Query Explorer state to and from URL parameters
- [x] T003 [P] Create `lib/query/export.ts` — CSV/JSON serialization helpers for query result sets
- [x] T004 [P] Create `lib/query/field-metadata.ts` — load schema-derived property suggestions from `event_schemas` for selected application/event combinations

**Checkpoint**: Shared state, validation, hydration, export, and field-metadata helpers exist.

---

## Phase 2: Query Engine Expansion (Blocking)

**Purpose**: Extend the backend contract before exposing new controls in the dashboard.

**⚠️ CRITICAL**: No Query Explorer UI expansion should begin until this phase is complete.

- [x] T005 Expand `lib/services/query-builder.ts` — add typed property-filter SQL generation with validated operator support for string/number/boolean values
- [x] T006 Expand `lib/services/query-builder.ts` — add time-bucket grouping with `hour` / `day` / `week` / `month`
- [x] T007 Expand `lib/services/query-builder.ts` — add grouped-result sorting, row limits, and pagination response metadata
- [x] T008 Update `app/api/query/route.ts` — validate the expanded request body using `lib/validations/query-schemas.ts` and preserve backwards compatibility with current request shapes
- [x] T009 [P] Add or extend unit/API coverage in `tests/unit/query-builder.test.ts` and `tests/api/query.test.ts` for operator validation, time buckets, sorting, limits, and pagination

**Checkpoint**: The expanded `/api/query` contract is implemented and covered.

---

## Phase 3: User Story 1 — Property Filters and Typed Operators (Priority: P1) 🎯 MVP

**Goal**: Users can build real event-property queries from the dashboard UI.

**Independent Test**: Configure multi-filter purchase queries with numeric and string operators and verify correct result rows.

- [x] T010 [P] [US1] Create `components/query/property-filter-builder.tsx` — add/remove/reorder filter rows, typed operator controls, and value inputs
- [x] T011 [US1] Update `components/query-form.tsx` — replace the implicit no-filter state with the property filter builder and submit normalized `propertyFilters`
- [x] T012 [P] [US1] Extend `tests/e2e/query.spec.ts` — cover string, numeric, boolean, and invalid-filter flows from the dashboard

**Checkpoint**: Query Explorer supports typed property filters end to end.

---

## Phase 4: User Story 2 — Time Bucketing and Trend Queries (Priority: P1)

**Goal**: Users can run real time-series queries from the Query Explorer.

**Independent Test**: Run count-by-day and count-by-week queries and verify chronological grouped results and chart rendering.

- [x] T013 [P] [US2] Create `components/query/query-result-controls.tsx` or extend `components/query-form.tsx` — add time-bucket grouping controls integrated with existing aggregation/grouping UI
- [x] T014 [US2] Update `components/charts/QueryResultChart.tsx` and `components/query-form.tsx` — treat time-bucketed results as a first-class chartable shape
- [x] T015 [P] [US2] Extend `tests/api/query.test.ts` and `tests/e2e/query.spec.ts` — cover day/week buckets and chart behavior

**Checkpoint**: Time-series query workflows are usable from the dashboard.

---

## Phase 5: User Story 3 — Form Intelligence and Result Controls (Priority: P2)

**Goal**: Users get schema-aware field selection and control over grouped-result output.

**Independent Test**: Choose schema-derived fields from the form, set sorting and row limit, and verify the API and UI respect them.

- [x] T016 [P] [US3] Create `components/query/query-field-picker.tsx` — schema-aware field suggestions with manual fallback
- [x] T017 [US3] Update `components/query-form.tsx` — use field pickers for `aggregationField`, `groupBy`, and property-filter keys
- [x] T018 [US3] Update `components/query-form.tsx` — add sort controls, row-limit controls, and grouped-result pagination UI
- [x] T019 [P] [US3] Extend `tests/e2e/query.spec.ts` and `tests/api/query.test.ts` — cover field pickers, sorting, limit, and grouped pagination

**Checkpoint**: Query Explorer is easier to use and supports controlled grouped-result browsing.

---

## Phase 6: User Story 4 — Saved Query Hydration and Shareable State (Priority: P3)

**Goal**: Query Explorer state can be reopened and shared directly.

**Independent Test**: Save a query report, reopen it in the Query Explorer, and verify full form hydration.

- [x] T020 [P] [US4] Update `components/query-form.tsx` and `app/query/page.tsx` — hydrate initial form state from URL params via `lib/query/hydration.ts`
- [x] T021 [US4] Update `app/reports/[id]/page.tsx`, `components/reports/report-actions.tsx`, or related report flows — add `Open in Query Explorer` for query reports
- [x] T022 [US4] Normalize query report configs in `lib/services/report-service.ts` or a dedicated helper so saved query reports map directly to `QueryDefinition`
- [x] T023 [P] [US4] Extend `tests/e2e/reports.spec.ts`, `tests/e2e/query.spec.ts`, and add `tests/unit/query-hydration.test.ts` — cover report hydration and URL round-tripping

**Checkpoint**: Saved query reports and URL state reopen the Query Explorer cleanly.

---

## Phase 7: User Story 5 — Export (Priority: P4)

**Goal**: Users can export current query results without manual copying.

**Independent Test**: Run a query, export CSV and JSON, and verify exported content matches the current result set.

- [x] T024 [P] [US5] Create `components/query/query-export-actions.tsx` — disabled until results exist; wire CSV/JSON download actions
- [x] T025 [US5] Update `components/query-form.tsx` — mount export actions inside the results panel
- [x] T026 [P] [US5] Add `tests/unit/query-export.test.ts` and extend `tests/e2e/query.spec.ts` — verify exported shapes and enabled/disabled states

**Checkpoint**: Query results can be exported in the dashboard.

---

## Phase 8: Polish & Documentation

**Purpose**: Tighten compatibility, performance, and docs.

- [x] T027 [P] Re-run and update existing `tests/api/query.test.ts` and `tests/e2e/charts.spec.ts` expectations so old simple query flows remain green with the expanded contract
- [x] T028 [P] Performance-check the expanded SQL in `lib/services/query-builder.ts` against seeded grouped/time-bucketed queries and add comments or helper refactors where the SQL becomes hard to maintain
- [x] T029 Update [README.md](/Users/e.dosreissilvajunior/Documents/insights/README.md) and [docs/API.md](/Users/e.dosreissilvajunior/Documents/insights/docs/API.md) to document the richer Query Explorer and expanded `/api/query` contract
- [x] T030 Validate `specs/005-query-explorer-completion/quickstart.md` end to end against the local seeded environment

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1: no dependencies
- Phase 2: depends on Phase 1 and blocks all stories
- Phase 3: depends on Phase 2
- Phase 4: depends on Phase 2 and can follow immediately after Phase 3
- Phase 5: depends on Phases 3–4
- Phase 6: depends on Phase 5 for practical saved-report alignment
- Phase 7: depends on completed result rendering
- Phase 8: after desired stories

### Recommended Delivery Order

1. Phase 1 foundation
2. Phase 2 query engine expansion
3. Phase 3 property filters
4. Phase 4 time bucketing
5. Phase 5 form intelligence and result controls
6. Phase 6 query hydration
7. Phase 7 export
8. Phase 8 polish

---

## Summary

| Phase | Story | Tasks | Parallelizable |
| --- | --- | --- | --- |
| 1 — Foundation | — | T001–T004 | T002, T003, T004 |
| 2 — Query Engine | — | T005–T009 | T009 |
| 3 — Property Filters | US1 (P1) | T010–T012 | T010, T012 |
| 4 — Time Bucketing | US2 (P1) | T013–T015 | T013, T015 |
| 5 — Form Intelligence | US3 (P2) | T016–T019 | T016, T019 |
| 6 — Hydration | US4 (P3) | T020–T023 | T020, T023 |
| 7 — Export | US5 (P4) | T024–T026 | T024, T026 |
| 8 — Polish | — | T027–T030 | T027, T028 |

**Total**: 30 tasks across 8 phases  
**Current status**: T001–T030 completed  
**Next active scope**: none; feature 005 implementation is complete
