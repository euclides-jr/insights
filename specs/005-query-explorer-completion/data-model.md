# Data Model: Query Explorer Completion

This feature does not require new database tables. It adds shared in-code state models and extends the semantics of the existing `/api/query` contract.

## 1. QueryDefinition

Canonical dashboard query state shared by:

- Query Explorer form state
- `/api/query` request validation
- saved query report config
- URL hydration/serialization

### Shape

```ts
type QueryDefinition = {
  applicationId: string;
  eventName?: string;
  startDate: string;
  endDate: string;
  propertyFilters?: PropertyFilter[];
  aggregation: 'count' | 'unique_users' | 'avg' | 'sum';
  aggregationField?: string;
  groupBy?: GroupByDefinition;
  sort?: QuerySort;
  page?: number;
  pageSize?: number;
};
```

## 2. PropertyFilter

Represents one filter row in the UI and one predicate in the query builder.

### Shape

```ts
type PropertyFilter = {
  id: string;
  key: string;
  valueType: 'string' | 'number' | 'boolean';
  operator:
    | 'eq'
    | 'neq'
    | 'contains'
    | 'not_contains'
    | 'in'
    | 'not_in'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'between'
    | 'exists'
    | 'not_exists';
  value?: string | number | boolean;
  secondValue?: number;
  logic?: 'and' | 'or';
};
```

### Notes

- `logic` is only meaningful from the second row onward.
- `between` is numeric-only and uses `value` + `secondValue`.
- `exists` and `not_exists` do not require a value.

## 3. GroupByDefinition

Supports both property grouping and timestamp bucketing.

### Shape

```ts
type GroupByDefinition =
  | { kind: 'property'; key: string }
  | { kind: 'time'; bucket: 'hour' | 'day' | 'week' | 'month' };
```

## 4. QuerySort

Controls grouped-result ordering.

### Shape

```ts
type QuerySort = {
  field: 'group' | 'value';
  direction: 'asc' | 'desc';
};
```

### Notes

- Time-bucketed queries use chronological order regardless of default grouped-value ordering.
- The UI may restrict some sort combinations to keep the interaction understandable.

## 5. QueryResultPage

Expanded grouped-result response payload.

### Shape

```ts
type QueryResultPage = {
  results: Record<string, unknown>[];
  totalCount: number;
  executionTimeMs: number;
  pagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
};
```

### Notes

- Scalar aggregations can omit `pagination`.
- Grouped queries should include it when paging is active.

## 6. QueryReportState

Saved query-report config remains stored inside `SavedReport.config`, but should now conform to `QueryDefinition`.

### Consequence

Existing saved query reports may need a lightweight normalization step on read so older configs still hydrate the form correctly.
