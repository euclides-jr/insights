# Feature Specification: Query Explorer Completion

**Feature Branch**: `005-query-explorer-completion`  
**Created**: 2026-03-19  
**Status**: Implemented  
**Input**: User description: "Make Query Explorer more feature complete"

## Summary

The current Query Explorer supports basic event aggregation over a date range, with optional event-name filtering, one aggregation mode, one grouping key, and a chart/table toggle. It is usable for simple counts and sums, but it still feels like a thin form over `/api/query` rather than a full analytics workbench.

This feature completes the Query Explorer by adding:

1. Multi-row event property filters with typed operators
2. Time bucketing over `timestamp` for trend queries
3. Schema-aware field pickers for grouping and aggregation fields
4. Sorting, row limits, and result pagination controls
5. URL/report hydration so saved query reports reopen directly in the Query Explorer
6. CSV/JSON export from the results panel

This feature intentionally does **not** add SQL editing, arbitrary JOINs, formulas, or cross-application queries. The goal is a stronger product-analytics query surface, not a general BI layer.

## Current Implementation Snapshot

Implemented today:

1. Single-application query form at `/query`
2. Optional `eventName`, `startDate`, `endDate`, `aggregation`, `aggregationField`, and `groupBy`
3. Table/chart result rendering
4. Saved-report integration from the Query Explorer
5. API-key-protected query execution through `POST /api/query`
6. Typed property filter builder with string/number/boolean operators
7. Time-series grouping by `hour` / `day` / `week` / `month`
8. Schema-aware field suggestions for grouping, aggregation fields, and property filters
9. Grouped-result sorting, row limits, and pagination controls
10. Query form hydration from saved reports and URL state
11. CSV/JSON export actions in the results panel

Polish completed:

1. grouped SQL assembly was refactored for maintainability in `lib/services/query-builder.ts`
2. quickstart scenarios were revalidated against the current seeded environment and automated coverage

## User Story 1 - Property Filters and Typed Operators (Priority: P1)

A product analyst wants to ask questions like “purchase events where currency = USD and amount > 100” without manually editing payloads or relying on exact-value-only filters.

**Why this priority**: The API already has the beginning of a filter model, but the UI does not expose it and the backend only supports exact equality. This is the biggest gap between the current Query Explorer and what users expect from an analytics tool.

**Independent Test**: Configure a query with multiple property filters using string, numeric, and boolean operators, run it, and verify the result rows match the seeded dataset.

### Acceptance Scenarios

1. **Given** a query with two property filters, **When** the user runs it, **Then** only events matching both filters are included.
2. **Given** a numeric property filter such as `amount > 100`, **When** the query executes, **Then** the filter is evaluated numerically rather than lexically.
3. **Given** a property key that is not valid for querying, **When** the request is submitted, **Then** the user sees a validation error rather than a server crash.

## User Story 2 - Time Bucketing and Trend Queries (Priority: P1)

A user wants to chart event counts by day or week without encoding time as an event property. They need the Query Explorer to group directly on event timestamps.

**Why this priority**: Trend analysis is one of the most common uses of a query explorer, and it is currently awkward because `groupBy` only supports event properties.

**Independent Test**: Run a count query grouped by day over the last 30 days and verify the result includes one row per matching bucket in chronological order.

### Acceptance Scenarios

1. **Given** a selected time bucket of `day`, **When** the query runs, **Then** results are grouped by calendar day based on event timestamps.
2. **Given** a selected time bucket of `week`, **When** the query runs, **Then** results are grouped into weekly timestamp buckets.
3. **Given** chart view is active, **When** a time-bucketed query completes, **Then** the chart renders the bucketed timeline without needing a manual `groupBy` property.

## User Story 3 - Query Form Intelligence and Result Controls (Priority: P2)

A dashboard user wants the form to help them discover valid fields and to control how large result sets are returned, instead of typing free-form property names and hoping the query works.

**Why this priority**: The current free-text approach increases invalid requests and makes the feature feel unfinished even when the backend can answer the query.

**Independent Test**: Select an application and event name, choose schema-derived property fields from the UI, run a grouped query, and verify sorting and row-limit controls affect the returned results.

### Acceptance Scenarios

1. **Given** a selected application and event name, **When** the user opens the field picker for grouping or aggregation, **Then** the UI lists schema-derived properties relevant to that selection.
2. **Given** the user selects a row limit and sort direction, **When** the query runs, **Then** the results respect those controls.
3. **Given** a grouped query returns more than one page of rows, **When** the user navigates to the next page, **Then** the current query state is preserved.

## User Story 4 - Saved Query Hydration and Shareable State (Priority: P3)

A user opens a saved query report and wants the Query Explorer to load the exact saved configuration into the form so it can be rerun and adjusted directly.

**Why this priority**: Saved reports exist, but the Query Explorer does not yet treat saved query configurations as first-class form state. That makes reports less useful than they should be.

**Independent Test**: Save a query report, open it from reports, navigate to the Query Explorer with that report or equivalent URL state, and verify that the form values match the saved configuration.

### Acceptance Scenarios

1. **Given** a saved query report, **When** the user opens it in the Query Explorer, **Then** the form fields are hydrated from the saved configuration.
2. **Given** a query configured entirely in the UI, **When** the URL is copied and opened in a new browser session, **Then** the same form state is restored.
3. **Given** a hydrated query form, **When** the user modifies one filter and reruns the query, **Then** the new results reflect the changed state without losing the rest of the configuration.

## User Story 5 - Export (Priority: P4)

A user wants to take query results into another tool or share them outside the dashboard without manually copying table rows.

**Why this priority**: Export is common in analytics tooling and relatively low complexity compared with query-engine changes.

**Independent Test**: Run a grouped query, export CSV and JSON, and verify both outputs contain the same rows rendered in the UI.

### Acceptance Scenarios

1. **Given** a completed query with result rows, **When** the user clicks `Export CSV`, **Then** a CSV file containing the visible result set is downloaded.
2. **Given** a completed query with result rows, **When** the user clicks `Export JSON`, **Then** a JSON file containing the result payload is downloaded.
3. **Given** no results have been run yet, **When** the user views the export controls, **Then** export actions are disabled.

## Requirements

### Functional Requirements

- **FR-001**: The Query Explorer MUST allow users to define multiple event property filters in the dashboard UI.
- **FR-002**: Property filters MUST support typed operators for string, numeric, and boolean values.
- **FR-003**: The query API MUST validate filter operator/value combinations and reject invalid combinations with a 400 response.
- **FR-004**: The Query Explorer MUST support grouping by event timestamp buckets: `hour`, `day`, `week`, and `month`.
- **FR-005**: Time-bucketed results MUST be returned in chronological order.
- **FR-006**: The Query Explorer MUST expose schema-aware field selection for `groupBy`, `aggregationField`, and property-filter keys.
- **FR-007**: The query form MUST support explicit row limits and sort configuration.
- **FR-008**: Grouped query results MUST support pagination when the result set exceeds the configured page size.
- **FR-009**: Saved query reports MUST be reopenable directly in the Query Explorer with form hydration.
- **FR-010**: Query Explorer form state MUST be representable in URL query parameters or an equivalent shareable state model.
- **FR-011**: The Query Explorer MUST allow export of completed result sets as CSV and JSON.
- **FR-012**: Exported rows MUST match the currently displayed query result set.
- **FR-013**: Dashboard query execution MUST remain session-protected at the page layer, while programmatic query execution via `/api/query` MUST preserve its API-key contract until a future spec explicitly changes it.

### Non-Functional Requirements

- **NFR-001**: Time-bucketed and grouped queries over a 30-day range MUST return within 5 seconds on the target dataset.
- **NFR-002**: Query form hydration from saved report or URL state MUST render in under 1 second after page load.
- **NFR-003**: Export generation for result sets up to 10,000 rows MUST complete within 3 seconds in the dashboard.
- **NFR-004**: Query validation failures MUST be deterministic and human-readable in both API and UI responses.

## Key Entities

- **QueryDefinition**: The complete dashboard query configuration, including application, date range, event filter, property filters, aggregation, grouping, sorting, and pagination state.
- **PropertyFilter**: One filter row over an event property key, operator, typed value, and filter logic.
- **TimeBucket**: A timestamp grouping mode applied to `Event.timestamp`.
- **QueryReportState**: Saved or URL-encoded state used to rehydrate the Query Explorer form.
- **QueryExport**: A serialized representation of a query result set, produced as CSV or JSON from a completed query.

## Success Criteria

- **SC-001**: Analysts can construct a multi-filter query with no free-text JSON editing in under 2 minutes.
- **SC-002**: At least 90% of seeded analytics questions covered in automated tests can be expressed entirely through the Query Explorer UI.
- **SC-003**: Saved query reports reopen in the Query Explorer with no configuration drift in 100% of regression tests.
- **SC-004**: CSV and JSON exports exactly match the rendered result rows in automated tests.
- **SC-005**: Query Explorer validation errors are surfaced without uncaught exceptions in 100% of covered invalid-input tests.

## Out of Scope

- Raw SQL editor or arbitrary custom query language
- Cross-application joins or workspace-wide combined queries
- Custom formulas or calculated fields beyond current aggregation support
- Scheduled exports or external warehouse destinations
- Dashboard-side replacement of the existing public `/api/query` contract
