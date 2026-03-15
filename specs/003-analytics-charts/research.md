# Research: Analytics Chart Visualizations

**Feature**: 003-analytics-charts  
**Date**: 2026-03-15  
**Status**: Complete — all NEEDS CLARIFICATION items resolved

---

## R-001: Chart Library Selection

**Unknown from spec**: "A chart library will be selected that fits the project's existing build tooling; no specific library is mandated by this spec."

### Decision

Use **recharts v3.x** with `react-is@^19.0.0`.

### Rationale

- React 19 compatible — maintainers' own site runs React 19; no peer dep issues (only `react-is` version must be aligned)
- Works in Next.js App Router with `"use client"` boundary — pure SVG, no `window`/`document` access at import time
- Built-in `<ResponsiveContainer>` (ResizeObserver-based) satisfies FR-009
- Built-in `<Tooltip>` with full custom renderers satisfies FR-007
- Declarative composable API (`LineChart`, `BarChart`, `ComposedChart`) covers all four user stories
- 16.7M weekly downloads; v3.8.0 published in March 2026 — actively maintained
- TypeScript types bundled; no separate `@types/*` package needed
- Colors set via `stroke`/`fill` props accepting any CSS value — works with the project's existing design tokens

**Install**:

```bash
bun add recharts react-is@^19.0.0
```

### Alternatives Considered and Rejected

| Library                        | Reason Rejected                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **react-chartjs-2 + Chart.js** | Canvas-based (not SVG) — CSS/Tailwind styling not applicable; React wrapper peer deps only declare `react@^18`; wrapper not actively maintained        |
| **@nivo**                      | Last published 10 months ago; slower release cadence with uncertain React 19 signals; heavier D3 bundle                                                |
| **Victory**                    | Last published ~1 year ago; maintenance-only mode; requires legacy `prop-types` peer dep                                                               |
| **visx**                       | Low-level SVG primitives, not a chart library — requires hours of assembly work per chart type; no `<ResponsiveContainer>`                             |
| **Tremor Charts**              | Built on recharts internally — adds an abstraction layer with no gain; Tremor itself underwent a major deprecation cycle in 2024–2025 (stability risk) |

### React 19 Notes

- The only watch-out is the `react-is` package — it must match the React version in use. Install `react-is@^19.0.0` explicitly or add a `package.json` override.
- No `next/dynamic` wrapper needed. A plain `"use client"` directive on the chart component file is sufficient.

---

## R-002: Dedicated Chart API Routes vs. Extending Existing Routes

**Unknown from spec**: Whether chart data endpoints should be new routes or extend existing ones.

### Decision

Create **new dedicated `GET /api/charts/*` routes** for each chart data shape.

| Route                                   | Purpose                                     |
| --------------------------------------- | ------------------------------------------- |
| `GET /api/charts/events-over-time`      | Daily event counts (time-series line chart) |
| `GET /api/charts/events-by-application` | Per-application event totals (bar chart)    |
| `GET /api/charts/quality-trends`        | Multi-metric quality time-series            |

### Rationale

- Existing routes (`/api/quality`, `/api/events`) serve paginated tabular data — fundamentally different response shape from chart series `{ date, value }[]`
- New routes can carry their own `Cache-Control` / `next: { revalidate }` headers independently
- Avoids branching on response shape inside shared handlers
- Keeps existing API contracts stable for consumers

### Alternatives Considered

- **Extend `/api/quality` with `format=chart` param** — rejected because it complicates the handler and couples two response contracts to the same path; harder to cache independently.

---

## R-003: Date Gap-Filling Strategy

**Unknown from spec**: How to represent days with zero events in time-series charts (FR-010).

### Decision

Gap-fill **in SQL** using PostgreSQL `generate_series` with a `LEFT JOIN` to the aggregated counts.

### Rationale

- Single database round-trip — no second pass needed in application code
- Guarantees zero-fill at the data layer (FR-010 compliance is enforced at the query, not the caller)
- Existing codebase (`lib/services/query-builder.ts`) already uses `$queryRawUnsafe` for aggregation — raw SQL is the established pattern
- Prisma `groupBy` cannot group by computed expressions (`date_trunc`) — it only accepts model field names

### Pattern

```sql
WITH date_series AS (
  SELECT generate_series(
    date_trunc('day', $start::timestamptz),
    date_trunc('day', $end::timestamptz),
    '1 day'::interval
  )::date AS day
),
daily AS (
  SELECT date_trunc('day', "timestamp")::date AS day, COUNT(*)::int AS count
  FROM events
  WHERE "applicationId" = $appId AND "timestamp" BETWEEN $start AND $end
  GROUP BY 1
)
SELECT ds.day::text AS date, COALESCE(d.count, 0) AS count
FROM date_series ds LEFT JOIN daily d USING (day)
ORDER BY ds.day
```

Use Prisma `$queryRaw` tagged-template (not `$queryRawUnsafe`) for fixed parameterized queries — parameters are automatically escaped.

---

## R-004: Client-Side Time Range Switching (FR-012)

**Unknown from spec**: Mechanism for "update chart without full page reload" when user changes time range.

### Decision

**Client component with `fetch` + `AbortController`**, not a Server Action or `router.push`.

### Rationale

- Server Actions are designed for mutations; using them for reads is semantically incorrect and loses HTTP caching
- `AbortController` cleanup resolves the rapid filter-change edge case from the spec ("only the last requested dataset is rendered") — previous in-flight requests are cancelled on param change
- A `GET` API route is independently cacheable by the browser and any CDN layer
- Simpler than the `useTransition` + `router.push` alternative (URL state not required per spec)

### Pattern

```tsx
'use client';
useEffect(() => {
  const controller = new AbortController();
  setLoading(true);
  fetch(`/api/charts/events-over-time?days=${days}`, {
    signal: controller.signal,
  })
    .then((r) => r.json())
    .then((data) => {
      setSeries(data.series);
      setLoading(false);
    })
    .catch((err) => {
      if (err.name !== 'AbortError') setLoading(false);
    });
  return () => controller.abort();
}, [days]);
```

---

## R-005: Query Result Chart Eligibility Detection (FR-004, FR-005)

**Unknown from spec**: What makes a query result "suitable for chart rendering" (toggle disabled state in FR-005).

### Decision

A query result is **chart-eligible** when:

1. At least one column in the result set is numeric (`typeof value === 'number'`)
2. **And** there is at least one non-numeric column to serve as labels/categories

This check runs client-side inside the `QueryForm` component on the result object. No API change needed.

### Rationale

The query result already arrives as `Record<string, unknown>[]` — the types of columns are directly inspectable. This is the simplest possible detection without requiring the API to annotate column types.

---

## Summary Table

| #     | Question                 | Decision                                |
| ----- | ------------------------ | --------------------------------------- |
| R-001 | Chart library            | recharts v3 + react-is@^19              |
| R-002 | API shape                | New dedicated GET /api/charts/\* routes |
| R-003 | Date gap-filling         | PostgreSQL generate_series + LEFT JOIN  |
| R-004 | Client time range switch | fetch + AbortController in useEffect    |
| R-005 | Query chart eligibility  | Client-side column type inspection      |
