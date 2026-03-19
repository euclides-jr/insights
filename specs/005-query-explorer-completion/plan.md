# Implementation Plan: Query Explorer Completion

**Branch**: `005-query-explorer-completion` | **Date**: 2026-03-19 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/005-query-explorer-completion/spec.md`

## Summary

Extend the current Query Explorer from a basic aggregation form into a fuller analytics workbench. The implementation will be delivered in four layers:

1. Query-engine expansion for typed property filters and time bucketing
2. Dashboard form and result-control improvements
3. Query-state hydration and saved-report alignment
4. Result export and final polish

This sequencing keeps the highest-value backend and UI gaps aligned: the dashboard should only expose controls the query engine can actually honor.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16.x (App Router)  
**Primary Dependencies**: Next.js 16, Prisma 7.x, React 19, PostgreSQL 15+, Better Auth, Zod 3.x  
**Storage**: PostgreSQL `events` and `event_schemas` tables; no required new tables  
**Testing**: Vitest for unit/API tests, Playwright for E2E tests  
**Target Platform**: Internal dashboard Query Explorer plus existing `/api/query` JSON API  
**Project Type**: Full-stack enhancement to the current Next.js application  
**Performance Goals**: grouped/time-bucketed queries ≤ 5s over 30-day windows; export ≤ 3s for 10,000 rows; hydration ≤ 1s  
**Constraints**: Preserve the existing public API-key contract for `/api/query`; do not introduce raw SQL editing; keep dashboard auth centralized in `proxy.ts`; remain maintainable by a small team  
**Scale/Scope**: Up to 10 applications, tens of millions of events, dashboard users in the low double digits

## Constitution Check

No repository-specific constitution is defined beyond the existing project conventions.

Implementation must continue to respect:

- Single Next.js application
- Direct Prisma access from server code
- Better Auth session gate at the dashboard layer
- `proxy.ts` as the centralized page gate
- Existing API-key authentication for programmatic query execution unless a future spec supersedes it

## Current Baseline

The current Query Explorer at `/query` already provides:

1. application selection
2. optional event-name filter
3. date range
4. `count`, `unique_users`, `avg`, `sum`
5. optional `groupBy`
6. results table/chart toggle
7. saved-report creation

The main gaps relative to the spec are:

1. no property filter builder in the UI
2. property filtering limited to equality in the backend
3. no timestamp bucketing
4. no form hydration from saved query reports
5. no limit/sort/pagination controls for grouped results
6. no export

## Project Structure

### Documentation (this feature)

```text
specs/005-query-explorer-completion/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── query-explorer.md
└── tasks.md
```

### Source Code (planned)

```text
app/
├── query/
│   └── page.tsx
└── api/
    └── query/
        └── route.ts

components/
├── query-form.tsx
├── query/
│   ├── property-filter-builder.tsx
│   ├── query-field-picker.tsx
│   ├── query-result-controls.tsx
│   └── query-export-actions.tsx
└── charts/
    └── QueryResultChart.tsx

lib/
├── services/
│   └── query-builder.ts
├── validations/
│   └── query-schemas.ts
└── query/
    ├── hydration.ts
    ├── export.ts
    └── field-metadata.ts

tests/
├── api/
│   └── query.test.ts
├── e2e/
│   └── query.spec.ts
└── unit/
    ├── query-builder.test.ts
    ├── query-hydration.test.ts
    └── query-export.test.ts
```

## Design Decisions

### Query State Model

Use a single `QueryDefinition` model shared by:

1. dashboard form state
2. `/api/query` request validation
3. saved query report config
4. URL hydration/serialization

This removes drift between the form, the API, and saved reports.

### Property Filter Execution

Extend the query builder to emit parameterized SQL predicates for typed operators instead of only `properties->>'key' = $n`.

Rules:

- string filters compare text
- numeric filters cast to `numeric`
- boolean filters cast to `boolean`
- `exists` / `not_exists` inspect JSON key presence rather than string value equality

### Time Bucketing

Implement timestamp grouping through PostgreSQL `date_trunc(...)` on `"timestamp"`, not by fabricating time properties in application code.

### Pagination Model

Add pagination only for grouped/multi-row result sets. Scalar aggregations continue to return a single-row result with no extra paging UI.

### Query Hydration

Use URL query parameters for shareable state and report hydration. Saved query reports should map into the same state model and open the Query Explorer with equivalent URL state or server-provided initial props.

### Export

Exports are dashboard-only client actions operating on the already-returned result set for the first version. No background export jobs or persisted export artifacts are needed.

## Implementation Phases

## Phase 0 — Research

Resolve:

1. operator matrix for string/number/boolean filters
2. query-state serialization format for URL hydration
3. schema-aware field selection strategy from `event_schemas`
4. grouped-result pagination strategy and response shape
5. export behavior and file naming conventions

## Phase 1 — Design

Produce:

1. `research.md`
2. `data-model.md`
3. `contracts/query-explorer.md`
4. `quickstart.md`

Then re-check whether the current `/api/query` contract can be evolved in place or whether a versioned endpoint is required. The preferred path is to evolve the current contract without breaking existing valid clients.

## Phase 2 — Query Engine Foundation

Blocking backend prerequisites:

1. introduce shared query validation schemas
2. expand query-builder types and SQL generation
3. add operator validation
4. add timestamp bucketing, sorting, limits, and grouped-result pagination
5. keep backwards compatibility for current request bodies

## Phase 3 — User Story 1: Property Filters and Typed Operators (P1)

Deliver the filter builder and backend operator support end to end.

## Phase 4 — User Story 2: Time Bucketing and Trend Queries (P1)

Deliver timestamp grouping in the API and Query Explorer UI, plus chart compatibility for time-series results.

## Phase 5 — User Story 3: Form Intelligence and Result Controls (P2)

Deliver schema-aware field pickers, sort controls, row-limit controls, and grouped-result pagination.

## Phase 6 — User Story 4: Saved Query Hydration and Shareable State (P3)

Deliver URL-backed form hydration and alignment with saved query reports.

## Phase 7 — User Story 5: Export (P4)

Deliver CSV/JSON export from completed query results.

## Phase 8 — Polish

Cross-cutting cleanup:

1. tighten validation and error messages
2. update documentation
3. performance-check complex grouped queries
4. ensure report/detail flows and Query Explorer hydration remain aligned

## Delivery Risks

1. **Operator complexity drift**: too many operators too early will increase validation and UI complexity. Start with a constrained matrix.
2. **Schema ambiguity**: free-form event properties can diverge from registered schemas; the UI should prefer schema hints, not treat them as an absolute guarantee.
3. **API compatibility**: `/api/query` already exists; request-shape changes must remain backward-compatible for current tests and any seeded usage.
4. **Pagination semantics**: grouped-result paging changes response shape and UI behavior; the scalar case should remain simple.

## Success Checks Before Completion

1. A saved query report can reopen directly in the Query Explorer with no manual re-entry.
2. A count-by-day query can be configured entirely through the UI and shown as a chart.
3. A purchase query with numeric property filters and CSV export is covered by unit, API, and E2E tests.
4. Existing basic `/api/query` tests remain green with the expanded contract.
