# Quickstart: Analytics Chart Visualizations

**Feature**: 003-analytics-charts  
**Date**: 2026-03-15

---

## Prerequisites

1. Local environment is running (`bun run dev` against a PostgreSQL database with existing event and quality metric data)
2. Node.js ≥ 20, Bun installed

---

## 1. Install the chart library

```bash
bun add recharts react-is@^19.0.0
```

Verify the install:

```bash
bun pm ls | grep recharts
```

---

## 2. Run the seed to ensure sufficient chart data

Charts need at least 7 days of data to appear meaningful. If the local database was freshly seeded, re-run with the extended seed:

```bash
bun run db:seed
```

The seed script (`prisma/seed.ts`) populates events and `data_quality_metrics` spanning 30+ days.

---

## 3. Start the dev server

```bash
bun run dev
```

---

## 4. Verify connectivity for new chart routes (once implemented)

Use curl to spot-check each new API route:

```bash
# Event volume trend (last 7 days, all apps)
curl "http://localhost:3000/api/charts/events-over-time?days=7"

# Events by application
curl "http://localhost:3000/api/charts/events-by-application?days=7"

# Quality trends (last 14 days)
curl "http://localhost:3000/api/charts/quality-trends?days=14"
```

Expected: `200 OK` with `series` array. Each point should have a `date` field and numeric value fields.

---

## 5. Smoke-test the dashboard chart

1. Open `http://localhost:3000`
2. Verify a line chart appears below the metric tiles
3. Change the time range dropdown (7 → 30 days) — chart should update without page reload

---

## 6. Smoke-test the quality chart

1. Open `http://localhost:3000/quality`
2. Verify a multi-line chart appears above the table
3. Apply an application filter — chart series should update to reflect only that application

---

## 7. Smoke-test the query result chart toggle

1. Open `http://localhost:3000/query`
2. Run a query with `aggregation = count` and a `groupBy` value (e.g., `eventName`)
3. Verify "View as Chart" button appears and is enabled
4. Click it — a bar chart should render the same data shown in the table

---

## 8. Run unit tests

```bash
bun run test --run
```

---

## 9. Run E2E tests for charts (once added)

```bash
bun run test:e2e tests/e2e/charts.spec.ts
```

---

## Key File Locations

| Purpose               | Path                                            |
| --------------------- | ----------------------------------------------- |
| Chart components      | `components/charts/`                            |
| API: events over time | `app/api/charts/events-over-time/route.ts`      |
| API: events by app    | `app/api/charts/events-by-application/route.ts` |
| API: quality trends   | `app/api/charts/quality-trends/route.ts`        |
| Dashboard page        | `app/page.tsx`                                  |
| Quality page          | `app/quality/page.tsx`                          |
| Query form            | `components/query-form.tsx`                     |
| Time range selector   | `components/ui/time-range-selector.tsx`         |
| Unit tests            | `tests/unit/charts.test.ts`                     |
| E2E tests             | `tests/e2e/charts.spec.ts`                      |
