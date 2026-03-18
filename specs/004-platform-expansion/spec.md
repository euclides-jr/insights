# Feature Specification: Advanced Analytics and Collaboration

**Feature Branch**: `004-platform-expansion`  
**Created**: 2026-03-18  
**Status**: In Progress  
**Input**: User description: "Plan the common features missing from the current analytics platform"

## Summary

The current platform covers event ingestion, attribute-backed user querying, segments, charts, quality monitoring, and a protected internal dashboard. What it lacks relative to common analytics products are higher-level product analysis workflows and team-oriented dashboard operations. This feature package closes the most important gaps with five additions:

1. Funnel analysis
2. Retention and cohort analysis
3. Saved reports and dashboard bookmarks
4. Team invitations and role-based access control
5. Audit logging for administrative changes

This package intentionally does **not** include session replay, heatmaps, billing, warehouse sync, or SDK expansion. Those are important, but they are less foundational than the analysis and collaboration gaps above.

## Implementation Snapshot

Implemented in the current codebase:

1. Funnel CRUD, execution APIs, dashboard UI, and regression coverage
2. Retention execution API, dashboard page, and regression coverage
3. Saved report CRUD APIs, reports list/detail pages, and save-entry integration from query, funnel, and retention views

Still pending from this umbrella feature:

1. Team invitations and multi-user RBAC management UI/API
2. Audit log writes and admin audit surfaces

## User Story 1 - Funnel Analysis (Priority: P1)

A product manager wants to understand where users drop off in a multi-step flow such as `signup_started -> email_verified -> workspace_created`. Instead of running several manual queries and comparing counts by hand, they define the ordered steps once and immediately see conversion and drop-off at each stage.

**Why this priority**: Funnel analysis is one of the most common capabilities expected in an event analytics product, and the current query explorer does not provide a workflow-oriented view of multi-step conversion.

**Independent Test**: Seed users across a three-step funnel with known conversion/drop-off rates. Create a funnel definition in the dashboard and verify that step counts, conversion percentages, and drop-off percentages match the seeded dataset.

### Acceptance Scenarios

1. **Given** a valid ordered list of event steps, **When** the user runs a funnel analysis, **Then** the system shows the number of users who reached each step in order.
2. **Given** users complete steps out of order, **When** the funnel is calculated, **Then** only users matching the declared step order are counted as converted to later steps.
3. **Given** a time window and application filter, **When** the funnel is recalculated, **Then** only matching events for that application and window are included.

## User Story 2 - Retention and Cohort Analysis (Priority: P2)

An analyst wants to know whether users who first appeared this week return in later days or weeks. They need a cohort table showing how many users return after their first-seen date, rather than only raw event counts.

**Why this priority**: Retention is a standard product analytics question and cannot be answered quickly from the existing dashboard surfaces.

**Independent Test**: Seed first-seen users across multiple cohort dates with known day-1 and day-7 return behavior. Run a retention analysis and verify the cohort table matches the seeded return rates.

### Acceptance Scenarios

1. **Given** user profiles with `firstSeen` timestamps and follow-up events, **When** the user selects daily retention for the last 14 days, **Then** the system renders a cohort grid with one row per cohort date and one column per retention interval.
2. **Given** an application filter, **When** the retention report is opened, **Then** only cohorts for that application are shown.
3. **Given** no returning users for a cohort interval, **When** the grid renders, **Then** the cell shows zero rather than a blank or missing value.

## User Story 3 - Saved Reports and Dashboard Bookmarks (Priority: P3)

A team member creates a useful query, funnel, or retention view and wants to save it for later instead of rebuilding the filters every time. They also want a simple list of saved reports on the dashboard.

**Why this priority**: Reusable reports are a common workflow feature and materially improve the usefulness of the existing analytics surfaces.

**Independent Test**: Save a query-based report and a funnel report, reload the application, and verify both can be reopened with the same configuration and visible results.

### Acceptance Scenarios

1. **Given** a configured query, funnel, or retention analysis, **When** the user clicks save and provides a name, **Then** the report is persisted and listed in saved reports.
2. **Given** a saved report, **When** another authorized dashboard user opens it, **Then** the same configuration is restored and results can be rerun.
3. **Given** a renamed or deleted saved report, **When** the saved reports list refreshes, **Then** the change is immediately reflected.

## User Story 4 - Team Invitations and Role-Based Access Control (Priority: P4)

An organization wants more than a single admin login. They need to invite teammates, assign roles, and restrict destructive actions such as application deletion or webhook management to admins.

**Why this priority**: Team access control is a baseline requirement for internal analytics tools once more than one person uses the dashboard.

**Independent Test**: Invite a viewer and an admin, sign in as both users, and verify that the viewer can read dashboards but cannot perform protected mutations while the admin can.

### Acceptance Scenarios

1. **Given** an admin user, **When** they invite a teammate by email, **Then** the teammate can accept the invitation and sign in.
2. **Given** a viewer role, **When** that user visits write-capable areas such as applications or webhooks, **Then** create, update, and delete actions are hidden or rejected.
3. **Given** an editor or admin role, **When** that user performs an allowed change, **Then** the action succeeds without needing route-by-route custom auth logic outside the centralized session model.

## User Story 5 - Audit Logging (Priority: P5)

An admin needs visibility into who changed application settings, API keys, schemas, webhooks, and saved reports. They want a searchable audit log instead of relying on memory or database inspection.

**Why this priority**: Auditability is a common administrative feature and complements multi-user access control.

**Independent Test**: Perform a sequence of tracked admin actions from two different users and verify that the audit log shows actor, action, target, and timestamp entries in chronological order.

### Acceptance Scenarios

1. **Given** a tracked administrative mutation, **When** the request succeeds, **Then** an audit entry is recorded with actor, action, target type, target id, and timestamp.
2. **Given** the audit log UI, **When** the user filters by actor or action type, **Then** only matching entries are shown.
3. **Given** a viewer role, **When** the user tries to access the audit log, **Then** access is denied.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST allow dashboard users to define a funnel as an ordered list of 2-10 event steps plus an application and time window.
- **FR-002**: Funnel analysis MUST count unique users per step and show step-to-step conversion and drop-off percentages.
- **FR-003**: Funnel analysis MUST enforce event order by timestamp for each user.
- **FR-004**: The system MUST provide a retention analysis view based on first observed event cohorts inside the selected lookback window and subsequent return activity.
- **FR-005**: Retention analysis MUST support daily and weekly intervals.
- **FR-006**: The system MUST allow authenticated dashboard users to save query, funnel, and retention configurations as named reports.
- **FR-007**: Saved reports MUST preserve sufficient configuration to reproduce the same analysis view later.
- **FR-008**: The system MUST support at least three dashboard roles: `viewer`, `editor`, and `admin`.
- **FR-009**: Only admins MUST be allowed to invite users, manage roles, and access the audit log.
- **FR-010**: Viewers MUST be able to access read-only dashboard pages but MUST NOT be able to mutate applications, schemas, webhooks, or saved reports owned by others unless elevated permissions allow it.
- **FR-011**: The system MUST record audit log entries for administrative mutations affecting applications, schemas, webhooks, roles, invitations, and saved reports.
- **FR-012**: Audit log entries MUST include actor identity, action type, target type, target identifier, and timestamp.
- **FR-013**: All new dashboard pages and APIs added by this feature MUST remain protected by the centralized Better Auth session gate and role checks, not by ad hoc public-route exceptions.
- **FR-014**: Funnel, retention, and saved report views MUST support application scoping consistent with the existing multi-application model.

### Non-Functional Requirements

- **NFR-001**: Funnel and retention queries over a 30-day window MUST return within 5 seconds on the target dataset size defined in the plan.
- **NFR-002**: Saved report open and list actions MUST render within 2 seconds in the dashboard UI.
- **NFR-003**: Role enforcement failures MUST return deterministic 403 responses for APIs and a clear denied state in the dashboard UI.

## Key Entities

- **FunnelDefinition**: A reusable ordered set of event steps, scoped to an application and optional saved-report wrapper.
- **RetentionReport**: A persisted or transient analysis definition describing cohort basis, interval type, and return event rule.
- **SavedReport**: Named saved configuration for a query, funnel, or retention analysis.
- **WorkspaceMember**: Dashboard user with assigned role for the installation.
- **Invitation**: Pending invite token tied to an email and intended role.
- **AuditLogEntry**: Immutable record of an administrative action performed by a workspace member.

## Success Criteria

- **SC-001**: A user can create and interpret a basic three-step funnel without manual cross-checking queries.
- **SC-002**: A retention cohort report for the last 14 days can be generated and rendered in under 5 seconds on the target dataset.
- **SC-003**: 100% of tracked administrative mutations create an audit log entry in automated tests.
- **SC-004**: Viewer-role users are prevented from performing protected mutations in 100% of covered API and E2E authorization tests.
- **SC-005**: At least 90% of saved reports reopen with no configuration drift in automated regression tests.

## Current Deviations

- Saved reports reopen through `/reports/[id]` and source-page links. Query reports currently preserve configuration for reopening, but the query explorer does not yet auto-hydrate its form directly from report config via URL params.
- The role model exists in schema/helpers, but invitation, member-management, and audit-log user stories remain unimplemented.

## Out of Scope

- Session replay, heatmaps, or click maps
- Billing, quotas, or Stripe integration
- Data warehouse sync or external export destinations
- Native mobile/browser SDK packages beyond the current examples
- SSO, SCIM, or enterprise directory sync
