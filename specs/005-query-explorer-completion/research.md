# Research: Query Explorer Completion

## 1. Typed Property Filters

### Decision

Support a constrained operator matrix by value type:

- `string`: `eq`, `neq`, `contains`, `not_contains`, `in`, `not_in`, `exists`, `not_exists`
- `number`: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between`, `exists`, `not_exists`
- `boolean`: `eq`, `neq`, `exists`, `not_exists`

### Rationale

This is broad enough to cover common product-analytics questions without forcing the UI to become a generic expression editor. It also maps cleanly to PostgreSQL JSONB extraction and typed casts.

### Rejected Alternatives

- **Only equality plus UI sugar**: does not materially improve the current Explorer.
- **Arbitrary expression language**: too much surface area for this product and codebase.

## 2. Time Bucketing

### Decision

Implement `hour`, `day`, `week`, and `month` buckets via `date_trunc()` on `"timestamp"` in PostgreSQL.

### Rationale

The event timestamp is already the canonical event-time dimension. `date_trunc()` is standard, efficient, and compatible with chronological sorting and chart rendering.

### Notes

- Return bucket labels as ISO timestamps or normalized strings derived from the SQL result.
- Chronological ordering must override the current value-desc ordering used by grouped results.

## 3. Schema-Aware Field Selection

### Decision

Build field suggestions from active `event_schemas` for the selected application and optional event name.

### Rationale

The platform already stores schema definitions. Reusing them for property selection reduces invalid queries and makes the UI self-documenting.

### Notes

- Schema-derived suggestions are hints, not strict enforcement of data existence.
- The UI should still allow a manual entry escape hatch for properties that exist in data but are not yet registered in schema definitions.

## 4. Query State Hydration

### Decision

Represent dashboard query state as URL query parameters and use the same normalized state shape for saved query reports.

### Rationale

This yields:

1. shareable URLs
2. direct report-to-form hydration
3. one canonical form of state serialization

### Notes

- Complex filter rows should be compactly encoded, likely as JSON in a single query param or as repeated structured params.
- The serializer/deserializer must be deterministic and versionable.

## 5. Export Strategy

### Decision

Client-side export from the already-returned result set for the first version.

### Rationale

The current API caps rows and already returns the rendered result data. There is no need for server-side export jobs, storage, or background processing for initial CSV/JSON support.

### Rejected Alternatives

- **Dedicated export endpoint**: adds more moving parts than necessary for the current scale.
- **Asynchronous export jobs**: useful only if the result size grows beyond the current request/response model.

## 6. Public API Compatibility

### Decision

Evolve `POST /api/query` in place while preserving the validity of existing request bodies.

### Rationale

The current tests and UI already depend on this route. Adding optional fields is low-risk; replacing the contract entirely is not.

### Compatibility Rules

Existing valid requests must continue to work:

- no filters
- exact event name
- scalar count/unique/avg/sum
- single property `groupBy`

New request fields should be optional and additive.
