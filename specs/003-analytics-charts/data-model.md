# Data Model: Analytics Chart Visualizations

**Feature**: 003-analytics-charts  
**Date**: 2026-03-15

## Schema Changes

**None.** This feature introduces no new Prisma models, no migrations, and no schema alterations.

All chart data is computed on-the-fly from existing tables using read-only aggregation queries:

| Existing Table              | Used By                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `events`                    | Dashboard event volume trend, event breakdown by application |
| `data_quality_metrics`      | Quality trends chart                                         |
| `events` (via `/api/query`) | Query result chart toggle                                    |

---

## Computed Data Shapes

These are the TypeScript interfaces describing the data that flows from the new API routes to chart components. They are **not stored** — they are computed per request.

### `TimeSeriesPoint`

Represents a single day's value in a time-series chart.

```ts
interface TimeSeriesPoint {
  date: string; // ISO date string, e.g. "2026-03-01" (date only, not datetime)
  count: number; // Non-negative integer; 0 for gap days (FR-010)
}
```

### `EventsOverTimeResponse`

Response shape of `GET /api/charts/events-over-time`.

```ts
interface EventsOverTimeResponse {
  series: TimeSeriesPoint[];
  totalCount: number; // Sum of all counts in the window
  windowDays: number; // Actual window used (7 | 30 | 90)
}
```

### `ApplicationEventCount`

One bar in the per-application breakdown chart.

```ts
interface ApplicationEventCount {
  applicationId: string;
  applicationName: string;
  count: number;
}
```

### `EventsByApplicationResponse`

Response shape of `GET /api/charts/events-by-application`.

```ts
interface EventsByApplicationResponse {
  series: ApplicationEventCount[];
}
```

### `QualityTrendPoint`

One data point in the quality trends multi-line chart.

```ts
interface QualityTrendPoint {
  date: string; // ISO date string "YYYY-MM-DD"
  validationFailureRate: number; // 0.0–1.0
  completenessRate: number; // 0.0–1.0
  duplicateRate: number; // 0.0–1.0
}
```

### `QualityTrendsResponse`

Response shape of `GET /api/charts/quality-trends`.

```ts
interface QualityTrendsResponse {
  series: QualityTrendPoint[];
  windowDays: number;
  applicationId: string | null; // null = all applications
}
```

---

## Entity Relationships (read paths only)

```
Application (id, name)
    │
    ├──< Event (applicationId, timestamp)          → events-over-time, events-by-application
    │
    └──< DataQualityMetric (applicationId, date,   → quality-trends
             validationFailureRate, completenessRate,
             duplicateRate)
```

No new foreign keys, indexes, or junction tables are introduced.

---

## Front-End State Entities

These exist only in React component state — they are never persisted.

### `TimeRangeOption`

```ts
type TimeRangeOption = 7 | 30 | 90; // days
```

Used by the `TimeRangeSelector` component on the dashboard and quality pages. Stored in `useState`; not reflected in URL (URL-based state is out of scope per the spec).

### `ChartViewMode`

```ts
type ChartViewMode = 'table' | 'chart';
```

Used by the `QueryForm` component to toggle between table and chart display of query results. Stored in `useState` alongside existing `result` state.

### `ChartEligibility`

```ts
interface ChartEligibility {
  eligible: boolean;
  reason?: string; // Human-readable explanation shown in disabled tooltip (FR-005)
}
```

Computed from `QueryResult.results` by inspecting column types before the toggle is rendered.
