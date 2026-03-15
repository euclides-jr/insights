# API Contracts: Analytics Chart Visualizations

**Feature**: 003-analytics-charts  
**Date**: 2026-03-15  
**Base URL**: `/api/charts`

All endpoints are `GET`, unauthenticated (consistent with existing analytics API pattern), and return `Content-Type: application/json`.

---

## GET /api/charts/events-over-time

Returns daily event counts for a given application and time window. Date gaps are filled with `count: 0`.

### Query Parameters

| Parameter       | Type            | Required | Default      | Constraints                                       |
| --------------- | --------------- | -------- | ------------ | ------------------------------------------------- |
| `applicationId` | `string` (UUID) | No       | — (all apps) | Must match an existing application ID if provided |
| `days`          | `integer`       | No       | `7`          | `1 ≤ days ≤ 90`                                   |

### Success Response — `200 OK`

```json
{
  "series": [
    { "date": "2026-03-09", "count": 142 },
    { "date": "2026-03-10", "count": 0 },
    { "date": "2026-03-11", "count": 87 }
  ],
  "totalCount": 229,
  "windowDays": 7
}
```

| Field            | Type                | Description                                                      |
| ---------------- | ------------------- | ---------------------------------------------------------------- |
| `series`         | `TimeSeriesPoint[]` | Ordered ascending by `date`; length equals `windowDays`; no gaps |
| `series[].date`  | `string`            | ISO 8601 date (`YYYY-MM-DD`)                                     |
| `series[].count` | `number`            | Non-negative integer                                             |
| `totalCount`     | `number`            | Sum of all `count` values in `series`                            |
| `windowDays`     | `number`            | Actual window applied (clamped to 1–90)                          |

### Error Responses

| Status | `error`                                | Condition                             |
| ------ | -------------------------------------- | ------------------------------------- |
| `400`  | `"days must be between 1 and 90"`      | `days` outside range                  |
| `400`  | `"applicationId must be a valid UUID"` | `applicationId` present but malformed |

---

## GET /api/charts/events-by-application

Returns total event counts grouped by application for a given time window. Used by the dashboard bar chart.

### Query Parameters

| Parameter | Type      | Required | Default | Constraints     |
| --------- | --------- | -------- | ------- | --------------- |
| `days`    | `integer` | No       | `7`     | `1 ≤ days ≤ 90` |

### Success Response — `200 OK`

```json
{
  "series": [
    { "applicationId": "a1b2...", "applicationName": "Web App", "count": 3201 },
    {
      "applicationId": "c3d4...",
      "applicationName": "Mobile SDK",
      "count": 891
    }
  ]
}
```

| Field                      | Type                      | Description                   |
| -------------------------- | ------------------------- | ----------------------------- |
| `series`                   | `ApplicationEventCount[]` | Ordered descending by `count` |
| `series[].applicationId`   | `string`                  | UUID                          |
| `series[].applicationName` | `string`                  | Display name                  |
| `series[].count`           | `number`                  | Total events in the window    |

### Error Responses

| Status | `error`                           | Condition            |
| ------ | --------------------------------- | -------------------- |
| `400`  | `"days must be between 1 and 90"` | `days` outside range |

---

## GET /api/charts/quality-trends

Returns multi-metric quality time-series suitable for a multi-line chart. Date gaps are filled using the last-known values from `data_quality_metrics`.

### Query Parameters

| Parameter       | Type            | Required | Default                | Constraints                                       |
| --------------- | --------------- | -------- | ---------------------- | ------------------------------------------------- |
| `applicationId` | `string` (UUID) | No       | — (all apps, averaged) | Must match an existing application ID if provided |
| `days`          | `integer`       | No       | `7`                    | `1 ≤ days ≤ 90`                                   |

### Success Response — `200 OK`

```json
{
  "series": [
    {
      "date": "2026-03-09",
      "validationFailureRate": 0.032,
      "completenessRate": 0.975,
      "duplicateRate": 0.011
    },
    {
      "date": "2026-03-10",
      "validationFailureRate": 0.0,
      "completenessRate": 1.0,
      "duplicateRate": 0.0
    }
  ],
  "windowDays": 7,
  "applicationId": null
}
```

| Field                            | Type                  | Description                                                  |
| -------------------------------- | --------------------- | ------------------------------------------------------------ |
| `series`                         | `QualityTrendPoint[]` | Ordered ascending by `date`; length equals `windowDays`      |
| `series[].date`                  | `string`              | ISO 8601 date (`YYYY-MM-DD`)                                 |
| `series[].validationFailureRate` | `number`              | `0.0–1.0`; `0.0` for gap days                                |
| `series[].completenessRate`      | `number`              | `0.0–1.0`; `0.0` for gap days                                |
| `series[].duplicateRate`         | `number`              | `0.0–1.0`; `0.0` for gap days                                |
| `windowDays`                     | `number`              | Actual window applied                                        |
| `applicationId`                  | `string \| null`      | The filtered application ID, or `null` for all-app aggregate |

### Error Responses

| Status | `error`                                | Condition                             |
| ------ | -------------------------------------- | ------------------------------------- |
| `400`  | `"days must be between 1 and 90"`      | `days` outside range                  |
| `400`  | `"applicationId must be a valid UUID"` | `applicationId` present but malformed |

---

## Chart Component Props Contract

The following TypeScript interfaces define the public props of each new chart component in `components/charts/`. These are internal contracts (not HTTP APIs) but documented here to align implementation.

### `<EventVolumeChart>`

```ts
interface EventVolumeChartProps {
  initialData: TimeSeriesPoint[]; // Server-rendered initial data
  applicationId?: string; // Passed through to API on time range change
}
```

### `<EventsByApplicationChart>`

```ts
interface EventsByApplicationChartProps {
  data: ApplicationEventCount[]; // Static; fetched server-side only
}
```

### `<QualityTrendsChart>`

```ts
interface QualityTrendsChartProps {
  initialData: QualityTrendPoint[];
  applicationId?: string;
  days: number;
}
```

### `<QueryResultChart>`

```ts
interface QueryResultChartProps {
  results: Record<string, unknown>[];
  labelKey: string; // Column name to use as X-axis / category labels
  valueKey: string; // Column name to use as Y-axis values
}
```
