# Tasks: Analytics Chart Visualizations

**Input**: Design documents from `/specs/003-analytics-charts/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency conflicts)
- **[Story]**: User story label (US1–US4) — setup/foundational/polish phases have no story label

---

## Phase 1: Setup

**Purpose**: Add the chart library dependency and shared type definitions that all subsequent phases depend on.

- [x] T001 Install recharts and react-is@^19.0.0 via `bun add recharts react-is@^19.0.0`
- [x] T002 Create shared chart TypeScript types in `lib/charts/types.ts` (`TimeSeriesPoint`, `ApplicationEventCount`, `QualityTrendPoint`, `TimeRangeOption`, `ChartViewMode`, `ChartEligibility` — as defined in data-model.md)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared UI primitives and utilities consumed by all four user stories. All user story phases are blocked until these are complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Create `components/ui/time-range-selector.tsx` — `"use client"` pill/tab component accepting `value: TimeRangeOption` + `onChange` callback; renders 7 / 30 / 90 day options; used by US1 and US2
- [x] T004 [P] Create `lib/utils/chart-format.ts` — `formatAxisLabel(n: number): string` that abbreviates large values (K / M / B) per FR-011; pure function, no external deps
- [x] T005 [P] Create `components/charts/ChartEmptyState.tsx` — reusable empty-state block rendered inside a `ResponsiveContainer`-sized box when a chart series is empty per FR-008; accepts an optional `message` prop
- [x] T005b [P] Create `components/charts/ChartLoadingSkeleton.tsx` — animated skeleton block matching the `ResponsiveContainer` height; displayed during async data fetches per FR-013 and SC-003; used by `EventVolumeChart` and `QualityTrendsChart`

**Checkpoint**: Shared primitives ready — all user story phases can now proceed independently.

---

## Phase 3: User Story 1 — Event Volume Trend on Dashboard (Priority: P1) 🎯 MVP

**Goal**: Display a time-series line chart of daily event counts on the dashboard with a client-side time range switcher (7 / 30 / 90 days).

**Independent Test**: Load the dashboard with at least 7 days of event data; a line chart renders with correctly grouped daily counts; hovering shows a tooltip; switching from 7 to 30 days updates the chart without a page reload; empty state message shown when no data.

- [x] T006 [P] [US1] Create `app/api/charts/events-over-time/route.ts` — `GET` handler; accepts `applicationId?` and `days` (1–90, default 7); runs `$queryRaw` with `generate_series` + `LEFT JOIN` on `events` to return `EventsOverTimeResponse`; validates params with Zod; returns 400 on invalid input (per contracts/api.md)
- [x] T007 [P] [US1] Create `components/charts/EventVolumeChart.tsx` — `"use client"` component; accepts `initialData: TimeSeriesPoint[]` + `applicationId?: string`; renders recharts `LineChart` inside `ResponsiveContainer`; integrates `TimeRangeSelector` and updates chart via `fetch` + `AbortController` on `days` change (FR-012); shows `ChartLoadingSkeleton` while fetching (FR-013); shows `ChartEmptyState` when series is empty; uses `formatAxisLabel` on Y-axis; custom `Tooltip` showing date + count
- [x] T008 [US1] Wire `EventVolumeChart` into `app/page.tsx` — fetch initial 7-day series server-side via `prisma.$queryRaw` (reuse same SQL as the API route, or call the route internally) and pass as `initialData` prop; mount component below the metrics grid

**Checkpoint**: US1 complete — dashboard shows a live, interactive event volume trend chart.

---

## Phase 4: User Story 2 — Data Quality Trends on Quality Page (Priority: P2)

**Goal**: Display a multi-line chart of failure rate, completeness rate, and duplicate rate over time on the quality page, respecting the existing application filter.

**Independent Test**: Load `/quality` with 14+ days of quality metric data; a three-line chart renders; filtering by application updates the chart series; hovering a data point shows a tooltip; alert-threshold crossings are visually distinguished.

- [x] T009 [P] [US2] Create `app/api/charts/quality-trends/route.ts` — `GET` handler; accepts `applicationId?` and `days` (1–90, default 7); queries `data_quality_metrics` grouped by date with a `generate_series` gap-fill (use `null` for days with no metric row — not `0.0` — per FR-010; prevents false alert-threshold triggers on gap days); returns `QualityTrendsResponse`; validates params with Zod (per contracts/api.md)
- [x] T010 [P] [US2] Create `components/charts/QualityTrendsChart.tsx` — `"use client"` component; accepts `initialData: QualityTrendPoint[]`, `applicationId?: string`, `days: number`; renders recharts `LineChart` with three `<Line>` series (failure rate, completeness, duplicate rate) each with a distinct color; set `connectNulls={false}` on each `<Line>` to render gap days as broken segments (not false-zero spikes); custom `Dot` renderer that changes fill color when a non-null value crosses the `THRESHOLDS` imported from `app/api/quality/route.ts` (FR-002); integrates `TimeRangeSelector` for client-side days change using `fetch` + `AbortController`; shows `ChartLoadingSkeleton` while fetching (FR-013); shows `ChartEmptyState` when empty; custom `Tooltip` showing date + all three values
- [x] T011 [US2] Wire `QualityTrendsChart` into `app/quality/page.tsx` — read `applicationId` and `days` from `searchParams`; fetch initial series server-side; mount chart above the existing table, passing `applicationId` so filter changes also update the chart

**Checkpoint**: US2 complete — quality page shows multi-metric trend visualization alongside the existing table.

---

## Phase 5: User Story 3 — Query Result Visualization (Priority: P3)

**Goal**: Add a "View as Chart" / "View as Table" toggle to the Query Explorer that renders a bar or line chart of the current aggregated result set.

**Independent Test**: Run any query with `aggregation = count` and a `groupBy` value; "View as Chart" button is enabled and renders a bar chart matching the table values; "View as Table" returns to the table; toggle is disabled with a tooltip when the result set has no numeric column.

- [x] T012 [P] [US3] Create `components/charts/QueryResultChart.tsx` — `"use client"` component; accepts `results: Record<string, unknown>[]`, `labelKey: string`, `valueKey: string`; auto-selects chart type (line chart when `labelKey` looks like a date string, bar chart otherwise); renders recharts `BarChart` or `LineChart` inside `ResponsiveContainer`; uses `formatAxisLabel` on Y-axis; custom tooltip showing label + value; shows `ChartEmptyState` when results empty
- [x] T013 [US3] Update `components/query-form.tsx` — add `chartView: ChartViewMode` and `chartEligibility: ChartEligibility` state; compute eligibility from `result.results` (eligible when at least one numeric column and one non-numeric column exist); add "View as Chart" / "View as Table" toggle buttons above the results panel (disabled + tooltip when not eligible per FR-005); render `QueryResultChart` with auto-detected `labelKey` / `valueKey` when chart mode is active

**Checkpoint**: US3 complete — Query Explorer supports chart visualization of aggregation results.

---

## Phase 6: User Story 4 — Event Breakdown by Application (Priority: P4)

**Goal**: Add a bar chart to the dashboard comparing total event counts across all applications, with bars clickable to navigate to the filtered events page.

**Independent Test**: Load the dashboard with events from at least 2 applications; a bar chart shows one bar per application with correct counts; clicking a bar navigates to `/events?appId=<id>`; single-application case renders without error.

- [x] T014 [P] [US4] Create `app/api/charts/events-by-application/route.ts` — `GET` handler; accepts `days` (1–90, default 7); queries `events` grouped by `applicationId`, joined to `applications` for the display name; returns `EventsByApplicationResponse` ordered by count descending; validates params with Zod (per contracts/api.md)
- [x] T015 [P] [US4] Create `components/charts/EventsByApplicationChart.tsx` — `"use client"` component; accepts `data: ApplicationEventCount[]`; renders recharts `BarChart` inside `ResponsiveContainer`; each bar is clickable — `onClick` uses `useRouter` to navigate to `/events?appId=<applicationId>`; uses `formatAxisLabel` on Y-axis; custom tooltip showing app name + count; shows `ChartEmptyState` when data is empty
- [x] T016 [US4] Wire `EventsByApplicationChart` into `app/page.tsx` — fetch application event counts server-side (call `/api/charts/events-by-application` or inline the same Prisma query); mount chart below the `EventVolumeChart` section on the dashboard

**Checkpoint**: US4 complete — dashboard shows both a trend line and a per-application comparison bar chart.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Tests, edge case hardening, and quickstart validation across all stories.

- [x] T017 [P] Add unit tests in `tests/unit/charts.test.ts` — test `formatAxisLabel` boundary values (0, 999, 1000, 1500000), `ChartEligibility` detection logic (pure functions extracted from `query-form.tsx` for testability), and any date-gap utility helpers
- [x] T018 [P] Add Playwright E2E tests in `tests/e2e/charts.spec.ts` — one test per user story: (a) dashboard line chart renders and time range switcher works, (b) quality page multi-line chart renders, (c) query result chart toggle enables after running an aggregation query, (d) dashboard bar chart renders and clicking a bar navigates correctly
- [x] T019 Validate all steps in `specs/003-analytics-charts/quickstart.md` against the completed implementation; fix any discrepancies
- [x] T020 [P] Verify chart color palette meets WCAG 2.1 AA contrast requirements (≥ 3:1 for graphical elements against background, ≥ 4.5:1 for embedded text labels per SC-006); document the final approved hex values as constants in `lib/charts/types.ts`

---

## Post-Implementation Bug Fixes

Two runtime issues were discovered and resolved after initial task completion.

- [x] BF-001 Fix `PrismaClientKnownRequestError` (code 42703) — `column e.application_id does not exist`. Root cause: Prisma migration generated camelCase column names. Fixed all `$queryRaw` SQL in `app/page.tsx`, `app/api/charts/events-over-time/route.ts`, `app/api/charts/events-by-application/route.ts`, `app/api/charts/quality-trends/route.ts`, and `app/quality/page.tsx` to use double-quoted identifiers (`"applicationId"`, `"validationFailureRate"`, `"completenessRate"`, `"duplicateRate"`).

- [x] BF-002 Fix `Module not found: Can't resolve 'dns'` build error. Root cause: `QualityTrendsChart.tsx` (`"use client"`) imported threshold helpers from `app/api/quality/route.ts`, which pulls in Prisma → `pg` → `dns`. Fix: extracted shared threshold constants and alert helpers into `lib/charts/quality-thresholds.ts` (no Node.js deps); both the route and the chart component now import from that file.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **blocks all user story phases**
- **Phase 3–6 (User Stories)**: All depend on Phase 2 completion; stories are independent of each other and can run in parallel
- **Phase 7 (Polish)**: Depends on all four user story phases

### User Story Dependencies

- **US1 (P1)**: Independent — no dependency on US2, US3, or US4
- **US2 (P2)**: Independent — no dependency on US1, US3, or US4
- **US3 (P3)**: Independent — builds on existing `QueryForm` but adds no dependency on US1/US2 components
- **US4 (P4)**: Independent — adds a second chart to the dashboard but does not depend on the US1 `EventVolumeChart`

### Within Each User Story

- API route task (T006 / T009 / T014) and component task (T007 / T010 / T015) are **parallel** — different files with no inter-dependency
- Wiring task (T008 / T011 / T016) depends on both the API route and component being complete
- For US3: `QueryResultChart` (T012) and `query-form.tsx` update (T013) — T012 must precede T013

### Parallel Opportunities

- T003, T004, T005 (Phase 2) can run in parallel with each other
- T006 and T007 (US1) can run in parallel
- T009 and T010 (US2) can run in parallel
- T012 precedes T013 but both are US3-only and independent of all US1/US2/US4 work
- T014 and T015 (US4) can run in parallel
- Entire Phase 3, Phase 4, Phase 5, and Phase 6 can be worked in parallel across four developers
- T017, T018, and T020 (Phase 7) can run in parallel

---

## Parallel Example: User Story 1

```bash
# After Phase 2 is complete, launch US1 parallel tasks together:
Task T006: "Create app/api/charts/events-over-time/route.ts"
Task T007: "Create components/charts/EventVolumeChart.tsx"

# When both T006 and T007 are done:
Task T008: "Wire EventVolumeChart into app/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T005) — **cannot skip**
3. Complete Phase 3: US1 (T006–T008)
4. **STOP and VALIDATE**: Open `/`, verify line chart renders with tooltip and time range switch
5. Deploy/demo if ready — all other stories are additive

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 → Dashboard trend chart (MVP)
3. Phase 4 → Quality trends chart
4. Phase 5 → Query result chart toggle
5. Phase 6 → Application breakdown bar chart
6. Phase 7 → Tests + polish

### Parallel Team Strategy (4 developers)

1. All: complete Phase 1 + 2 together (≤ 1 hour)
2. Dev A: Phase 3 (US1 — dashboard trend)
3. Dev B: Phase 4 (US2 — quality trends)
4. Dev C: Phase 5 (US3 — query chart toggle)
5. Dev D: Phase 6 (US4 — events by application)
6. All: Phase 7 (tests + polish)
