# Implementation Plan: Analytics Chart Visualizations

**Branch**: `003-analytics-charts` | **Date**: 2026-03-15 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/003-analytics-charts/spec.md`  
**Status**: ✅ COMPLETE — all 21 tasks delivered, 24/24 unit tests passing, 0 TypeScript errors in new files

## Summary

Add interactive charts across the platform to turn static numeric tiles and tables into readable visual analytics. Four chart surfaces are delivered in priority order: (1) daily event volume trend on the dashboard, (2) multi-metric quality trends on the quality page, (3) chart-view toggle in the Query Explorer, and (4) per-application event breakdown bar chart on the dashboard.

**Technical approach**: Install `recharts` (React 19–compatible SVG chart library). Add three dedicated `GET /api/charts/*` routes backed by PostgreSQL `generate_series` queries (gap-fill at SQL level). Render initial data server-side; update on client-side filter changes via `fetch` + `AbortController`.

No database schema changes are required.

## Technical Context

**Language/Version**: TypeScript 5 / Node.js 20 / React 19.2.3  
**Primary Dependencies**: Next.js 16.1.6, Prisma 7.5, recharts v3 (new), react-is@^19.0.0 (new), date-fns 3, Tailwind CSS 4, Zod 3  
**Storage**: PostgreSQL (via Prisma + `pg` driver); no migrations needed for this feature  
**Testing**: Vitest (unit), Playwright (E2E)  
**Target Platform**: Web application (server-rendered Next.js App Router + client components)  
**Project Type**: Web service / analytics dashboard  
**Performance Goals**: Chart data API responses ≤ 2 s on 90-day window (SC-002); chart renders within 2 s of filter change  
**Constraints**: Charts render client-side only (`"use client"` boundary); no SSR of recharts SVG; responsive (ResponsiveContainer); no new stored data  
**Scale/Scope**: Up to 90 days × ~10 applications; chart data queries return ≤ 90 rows per series

## Constitution Check

_No constitution file is defined for this project (only the template exists at `.specify/templates/constitution-template.md`). No gates to check._

**Post-design re-check**: Not applicable.

## Project Structure

### Documentation (this feature)

```text
specs/003-analytics-charts/
├── plan.md          ← this file
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── api/
│   └── charts/
│       ├── events-over-time/
│       │   └── route.ts        ← GET /api/charts/events-over-time
│       ├── events-by-application/
│       │   └── route.ts        ← GET /api/charts/events-by-application
│       └── quality-trends/
│           └── route.ts        ← GET /api/charts/quality-trends
├── page.tsx                    ← dashboard (add EventVolumeChart + EventsByApplicationChart)
└── quality/
    └── page.tsx                ← quality page (add QualityTrendsChart)

components/
├── charts/
│   ├── EventVolumeChart.tsx        ← "use client"; line chart; time range selector
│   ├── EventsByApplicationChart.tsx ← "use client"; bar chart; click → navigate
│   ├── QualityTrendsChart.tsx      ← "use client"; multi-line; app filter aware
│   └── QueryResultChart.tsx        ← "use client"; bar/line; eligibility detection
└── ui/
    └── time-range-selector.tsx     ← shared 7/30/90 day picker

tests/
├── unit/
│   └── charts.test.ts          ← pure logic: gap-fill, eligibility detection, axis formatting
└── e2e/
    └── charts.spec.ts          ← Playwright: chart renders on each page

lib/
└── charts/
    ├── types.ts                    ← shared TS interfaces + WCAG colour constants
    └── quality-thresholds.ts       ← alert thresholds + helpers (safe for client bundles)
```

**Structure Decision**: Single Next.js project (existing layout). New code is additive — new `app/api/charts/` routes and new `components/charts/` components. Existing pages (`app/page.tsx`, `app/quality/page.tsx`, `components/query-form.tsx`) receive minimal modifications to mount the new chart components.

## Implementation Notes

Two runtime issues were found and fixed during development:

### 1. PostgreSQL camelCase column names

Prisma generated the migration with camelCase column names (`"applicationId"`, `"validationFailureRate"`, `"completenessRate"`, `"duplicateRate"`) rather than snake_case. All `$queryRaw` SQL in the following files must double-quote these identifiers:

- `app/page.tsx`
- `app/api/charts/events-over-time/route.ts`
- `app/api/charts/events-by-application/route.ts`
- `app/api/charts/quality-trends/route.ts`
- `app/quality/page.tsx`

**Rule for future raw SQL in this codebase**: every column name is camelCase — always wrap in double quotes: `"applicationId"`, `"validationFailureRate"`, `"completenessRate"`, `"duplicateRate"`, `"eventsReceived"`, `"eventsRejected"`, `"eventName"`, `"userId"`, `"createdAt"`, `"updatedAt"`.

### 2. Node.js `dns` module leak into browser bundle

`QualityTrendsChart.tsx` (`"use client"`) imported threshold helpers directly from `app/api/quality/route.ts`. That route imports Prisma → `pg` → `dns` (a Node.js built-in), which the browser bundler can't resolve.

**Fix**: Extracted `THRESHOLDS`, `AlertLevel`, and all alert helper functions into `lib/charts/quality-thresholds.ts` (no Node.js imports). The route re-exports from that file; the chart component imports from it directly.

## Complexity Tracking

No constitution violations to justify.
