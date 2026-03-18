# Feature Specification: Analytics Chart Visualizations

**Feature Branch**: `003-analytics-charts`  
**Created**: 2026-03-15  
**Status**: Implemented  
**Input**: User description: "Add visualization with charts to improve analytics"

## Overview

The platform currently presents all analytics data — event volumes, quality metrics, query results, and dashboard summaries — exclusively through tables and static numeric tiles. Users cannot spot trends, compare periods, or quickly identify anomalies without manually scanning rows. This feature adds interactive charts across the platform to make patterns, trends, and outliers immediately visible.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Event Volume Trend on Dashboard (Priority: P1)

An analyst opens the main dashboard and wants to understand at a glance how event intake is trending over the last 7 or 30 days. Instead of seeing only a static "Total Events" count, they see a time-series line chart showing daily event volume, with a visible spike or dip on a specific day.

**Why this priority**: The dashboard is the first screen users see. Replacing static number tiles with a trend chart delivers immediate value and establishes the visual pattern for the rest of the feature.

**Independent Test**: Can be fully tested by loading the dashboard with at least 7 days of event data in the database and verifying that a time-series chart renders with correctly grouped daily counts.

**Acceptance Scenarios**:

1. **Given** the dashboard is loaded with events spanning multiple days, **When** the user views the dashboard, **Then** a line chart displays daily event counts for the selected time window (default: last 7 days).
2. **Given** the dashboard chart is visible, **When** the user hovers over a data point, **Then** a tooltip shows the exact date and event count for that day.
3. **Given** no events exist in the database, **When** the user views the dashboard, **Then** the chart area shows an empty-state message ("No event data yet") rather than a broken chart.
4. **Given** the dashboard chart is rendered, **When** the user changes the time range (e.g., 7 days → 30 days), **Then** the chart updates to reflect the new range without a full page reload.

---

### User Story 2 - Data Quality Trends on Quality Page (Priority: P2)

A data engineer reviews quality metrics and wants to see whether failure rates and completeness scores are improving or worsening over time. Currently the quality page shows a flat table of daily snapshots. With this feature, they see multi-line trend charts per metric (failure rate, completeness, duplicate rate) so they can instantly spot degradation.

**Why this priority**: Quality degradation that goes unnoticed until it becomes critical is a core pain point. Visualizing trends makes early detection possible without reading every table row.

**Independent Test**: Can be fully tested by loading the quality page with at least 14 days of quality metric data and verifying that each metric renders its own trend line, color-coded by alert level.

**Acceptance Scenarios**:

1. **Given** quality metrics exist for multiple days, **When** the user views the Quality page, **Then** a multi-line chart displays failure rate, completeness rate, and duplicate rate over the selected date range.
2. **Given** a metric crosses an alert threshold on a specific day, **When** the chart is displayed, **Then** that data point is visually distinguished (e.g., different color or marker) to indicate the alert state.
3. **Given** a specific application filter is applied, **When** the user views the quality chart, **Then** the chart reflects only the data for the selected application.
4. **Given** the quality chart is displayed, **When** the user hovers over a data point, **Then** a tooltip shows the date, metric name, and exact value.

---

### User Story 3 - Query Result Visualization (Priority: P3)

A product manager runs an aggregation query in the Query Explorer (e.g., "count events by day") and instead of reading through a results table, they want to see the data plotted as a bar or line chart. They can toggle between table and chart view of the same result set.

**Why this priority**: Query results often represent time-series or categorical distributions that are far more readable as charts. This story builds on the existing query infrastructure.

**Independent Test**: Can be fully tested by running any query that returns numeric aggregation results and verifying that a chart renders the same data visible in the results table.

**Acceptance Scenarios**:

1. **Given** a query returns aggregated numeric results, **When** the user clicks "View as Chart", **Then** a bar chart (or line chart for time-based grouping) renders the query results.
2. **Given** the chart view is active, **When** the user clicks "View as Table", **Then** the results table is shown again and the chart is hidden.
3. **Given** a query returns non-numeric or non-aggregated results, **When** the user attempts to view as chart, **Then** the chart toggle is disabled with a tooltip explaining that chart view requires aggregated data.
4. **Given** a query returns more than 50 data points for chart display, **When** the chart renders, **Then** the chart displays all points with appropriate axis scaling (no data is silently dropped).

---

### User Story 4 - Event Breakdown by Application (Priority: P4)

A platform engineer wants to compare event volumes across all registered applications using a bar chart on the dashboard. This shows which applications are most active and which are silent.

**Why this priority**: Multi-application breakdowns are a common analytics need but are supplementary to the primary time-series story.

**Independent Test**: Can be fully tested by loading the dashboard with events from at least 2 applications and verifying a chart showing per-application counts.

**Acceptance Scenarios**:

1. **Given** events from multiple applications exist, **When** the user views the dashboard, **Then** a bar chart displays total event counts grouped by application.
2. **Given** the bar chart is visible, **When** the user clicks on an application's bar, **Then** the user is navigated to the events page filtered to that application.
3. **Given** only one application exists, **When** the dashboard chart renders, **Then** the single-application bar is shown without error.

---

### Edge Cases

- What happens when a chart receives a single data point (no trend possible)? → Chart renders a single point with a clear label; no line is drawn.
- What happens when date gaps exist in the data (e.g., no events on weekends)? → Gaps are explicitly shown as zero values, not omitted, to avoid misleading slope illusions.
- How does the system handle very large numeric values (e.g., millions of events)? → Axis labels use abbreviated notation (e.g., "1.2M") to prevent overflow.
- What happens if a chart container is too narrow (mobile / sidebar collapsed)? → Charts are responsive and reflow to fill available width without distortion.
- What happens when a user rapidly changes filter parameters? → Only the last requested dataset is rendered; intermediate in-flight data fetches are cancelled or ignored.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The dashboard MUST display a time-series chart of daily event volume for a selectable time range (7 days, 30 days, 90 days).
- **FR-002**: The quality page MUST display a multi-line trend chart showing failure rate, completeness rate, and duplicate rate over the currently selected date range.
- **FR-003**: The quality page chart MUST respect the active application filter, showing only data for the selected application when one is chosen.
- **FR-004**: The Query Explorer MUST provide a "View as Chart" toggle for queries that return aggregated numeric results.
- **FR-005**: The chart toggle in the Query Explorer MUST be disabled (with explanatory tooltip) when the current result set is not suitable for chart rendering.
- **FR-006**: The dashboard MUST display a bar chart of event counts grouped by application.
- **FR-007**: All charts MUST display a tooltip on hover showing the exact data values for the hovered point or bar.
- **FR-008**: All charts MUST render an empty-state message when there is no data to display.
- **FR-009**: All charts MUST be responsive — they MUST reflow to fill their container width when the viewport or layout changes.
- **FR-010**: Date gaps in event count charts MUST be represented as zero values, not omitted, to avoid misleading slope illusions. For rate-based charts (quality metrics), days with no data MUST be represented as `null` and rendered as broken line segments — a zero rate is a meaningful alert-level value and MUST NOT be used as a gap sentinel.
- **FR-011**: Charts with large numeric values MUST abbreviate axis labels (K, M, B) to prevent label overflow.
- **FR-012**: The dashboard time-series chart MUST update without a full page reload when the user changes the selected time range.
- **FR-013**: All charts that fetch data asynchronously MUST display a loading indicator (skeleton or spinner) while data is in flight.

### Key Entities

- **Chart Data Series**: A named sequence of (label, value) pairs derived from an existing data source (events, quality metrics, query results). No new stored entities required — charts are computed views over existing data.
- **Time Range Selector**: A UI control (shared across dashboard and quality pages) that sets the window (7, 30, 90 days) for all charts on the current page.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can identify event volume trends for any 7-day window at a glance without reading a table — validated by user observation showing trend identification in under 10 seconds.
- **SC-002**: All charts render within 2 seconds of the page load or filter change on a dataset of up to 90 days of data.
- **SC-003**: 100% of chart states (data present, no data, loading) display a meaningful visual — no blank white boxes or unhandled render errors.
- **SC-004**: The quality page chart correctly reflects only the filtered application's data in 100% of filter-change scenarios.
- **SC-005**: Query result charts display the same values as the corresponding table view with zero data discrepancies.
- **SC-006**: All chart color choices MUST meet WCAG 2.1 Level AA contrast requirements — a minimum contrast ratio of 3:1 for graphical objects (data series lines, bars, dots) against their background, and 4.5:1 for any text labels embedded in charts.

## Assumptions

- The existing database already stores sufficient historical data (events and quality metrics) to populate charts without schema changes.
- A chart library will be selected that fits the project's existing build tooling; no specific library is mandated by this spec.
- The time range selector on the quality page already supports 7 / 30 / 90 day windows via URL parameters — the chart reuses the same parameter.
- Chart data for the dashboard and quality page is fetched server-side (consistent with the current page rendering pattern) but may use client-side fetching for the time range change interaction.
- No new user roles or permissions are introduced; chart visibility follows existing access rules.

## Out of Scope

- Real-time / live-updating charts (streaming data) — charts reflect data at page load or filter change only.
- Chart export (PNG, CSV download) — a future enhancement.
- Custom chart configuration by end users (e.g., choosing chart type, custom colors).
- Embedded charts in external dashboards or iframes.

## Current Implementation Notes

- Chart endpoints are internal dashboard APIs and require an authenticated dashboard session.
- Dashboard access is protected centrally by `proxy.ts`; chart routes are not public ingestion APIs.
- E2E coverage should avoid relying on page-1 ordering of seeded schemas or records, because API tests may add more fixtures during the same test run.
