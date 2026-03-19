# Contract: Query Explorer

## POST /api/query

Run a filtered, aggregated event query for one application.

### Authentication

- Requires `X-API-Key`
- Dashboard UI may continue to call this route through the existing internal flow

### Request Body

```json
{
  "applicationId": "app_123",
  "eventName": "purchase",
  "startDate": "2026-03-01T00:00:00.000Z",
  "endDate": "2026-03-31T23:59:59.999Z",
  "propertyFilters": [
    {
      "key": "currency",
      "valueType": "string",
      "operator": "eq",
      "value": "USD"
    },
    {
      "key": "amount",
      "valueType": "number",
      "operator": "gt",
      "value": 100,
      "logic": "and"
    }
  ],
  "aggregation": "sum",
  "aggregationField": "amount",
  "groupBy": {
    "kind": "time",
    "bucket": "day"
  },
  "sort": {
    "field": "group",
    "direction": "asc"
  },
  "page": 1,
  "pageSize": 50
}
```

### Backwards-Compatible Request Body

The existing simpler request shape remains valid:

```json
{
  "applicationId": "app_123",
  "eventName": "purchase",
  "startDate": "2026-03-01T00:00:00.000Z",
  "endDate": "2026-03-31T23:59:59.999Z",
  "aggregation": "count",
  "groupBy": "currency"
}
```

## Success Response

### Scalar Aggregation

```json
{
  "results": [{ "value": 1284 }],
  "totalCount": 1,
  "executionTimeMs": 37
}
```

### Grouped Result

```json
{
  "results": [
    { "group": "2026-03-01T00:00:00.000Z", "value": 182 },
    { "group": "2026-03-02T00:00:00.000Z", "value": 205 }
  ],
  "totalCount": 14,
  "executionTimeMs": 82,
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalPages": 1
  }
}
```

## Error Responses

### 400 Validation Failed

```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": ["propertyFilters", 1, "value"],
      "message": "Numeric filter value is required"
    }
  ]
}
```

### 401 Missing or Invalid API Key

```json
{
  "error": "Missing X-API-Key header"
}
```

```json
{
  "error": "Invalid API key"
}
```

### 403 Application Mismatch

```json
{
  "error": "Access denied: applicationId does not match API key"
}
```

## Dashboard UI Contract

### Query Form

The Query Explorer UI must expose:

- application selector
- optional event-name selector/input
- date range inputs
- property filter builder
- aggregation selector
- aggregation field picker
- group-by selector supporting:
  - property
  - `hour`
  - `day`
  - `week`
  - `month`
- sort selector
- row-limit selector
- run / clear actions
- save current view
- export CSV / JSON after results exist

### Query Hydration

`/query` must be able to initialize its form from:

1. URL state
2. saved query report config

### Result Area

The results panel must support:

- table view
- chart view when eligible
- pagination for grouped results
- export actions for current results
