# Implementation Plan: Advanced Analytics and Collaboration

**Branch**: `004-platform-expansion` | **Date**: 2026-03-18 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/004-platform-expansion/spec.md`

## Summary

Add the most common missing analytics-platform capabilities on top of the existing event, user, chart, and Better Auth foundations. The delivery is intentionally split into two layers:

1. **Advanced analysis**: funnels, retention cohorts, and saved reports
2. **Team operations**: invitations, roles, and audit logging

This sequence keeps product value high early while building team/admin controls only once there are more dashboard assets worth sharing.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16.x (App Router)  
**Primary Dependencies**: Next.js 16, Prisma 7.x, React 19, PostgreSQL 15+, Better Auth, Zod 3.x  
**Storage**: PostgreSQL — extend current schema with funnel, report, invitation, membership, and audit tables  
**Testing**: Vitest for unit/API tests, Playwright for E2E tests  
**Target Platform**: Internal web dashboard plus existing programmatic JSON APIs  
**Project Type**: Full-stack web service extending the current Next.js application  
**Performance Goals**: Funnel/retention report queries ≤ 5s for 30-day windows; saved report load ≤ 2s; role checks constant-time at request boundaries  
**Constraints**: Preserve centralized session enforcement in `proxy.ts`; avoid route-by-route public exceptions; keep API-key auth unchanged for ingestion/data APIs; remain maintainable by a small team  
**Scale/Scope**: Up to 10 applications, 1M users, tens of millions of events, low double-digit internal dashboard users

## Constitution Check

No repository-specific constitution is defined beyond the current project conventions.

Implementation must continue to respect the existing architectural rules:

- Single Next.js application
- Direct Prisma access from server code
- Better Auth for dashboard sessions
- `proxy.ts` remains the centralized page gate
- Programmatic APIs keep their existing `X-API-Key` model unless explicitly changed by a future spec

## Delivery Strategy

This feature package is too large for a single atomic delivery. It should be executed as a staged roadmap under one umbrella plan.

### Stage 1 — Analysis Surfaces

Deliver the three user-facing analytics gaps first:

1. Funnels
2. Retention cohorts
3. Saved reports

This stage creates the highest immediate end-user value and leverages the strongest existing foundations:

- event ingestion
- user profiles and `firstSeen`
- chart rendering primitives
- query explorer UI patterns

### Stage 2 — Collaboration and Governance

Deliver the operational/team capabilities after analysis artifacts exist:

1. Workspace membership and roles
2. Invitations
3. Audit log

This stage depends on Better Auth integration already being live and should reuse the current dashboard session plumbing rather than layering a second auth system on top.

## Current Status

Completed:

1. Foundation schema, migration, role helpers, validation schemas, and seeded platform-expansion fixtures
2. Funnels end-to-end: APIs, service layer, dashboard CRUD/runner UI, and tests
3. Retention end-to-end: service, API, dashboard page, and tests
4. Saved reports end-to-end: CRUD service/routes, list/detail pages, and save entry points from query/funnel/retention
5. First Phase 6 slice: invitations/member-management APIs, members settings page, and focused regression coverage

Remaining:

1. Role-aware restrictions across the broader dashboard
2. Audit logging delivery
3. Cross-cutting polish tasks

## Project Structure

### Documentation (this feature)

```text
specs/004-platform-expansion/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Query strategy, RBAC model, audit design
├── data-model.md        # New entities and relationships
├── quickstart.md        # Local flows for funnels, retention, invites, reports
├── contracts/           # HTTP contracts for new routes
│   ├── analytics.md
│   └── admin.md
└── tasks.md             # Generated task breakdown
```

### Source Code (planned)

```text
app/
├── funnels/
│   └── page.tsx
├── retention/
│   └── page.tsx
├── reports/
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
├── settings/
│   ├── members/
│   │   └── page.tsx
│   └── audit/
│       └── page.tsx
└── api/
    ├── funnels/
    │   ├── route.ts
    │   └── [id]/route.ts
    ├── retention/
    │   └── route.ts
    ├── reports/
    │   ├── route.ts
    │   └── [id]/route.ts
    ├── invitations/
    │   ├── route.ts
    │   └── accept/route.ts
    ├── members/
    │   └── route.ts
    └── audit/
        └── route.ts

components/
├── funnels/
│   ├── FunnelBuilder.tsx
│   └── FunnelResults.tsx
├── retention/
│   └── RetentionGrid.tsx
├── reports/
│   ├── SaveReportDialog.tsx
│   └── SavedReportsList.tsx
└── settings/
    ├── MemberTable.tsx
    ├── InviteMemberDialog.tsx
    └── AuditLogTable.tsx

lib/
├── services/
│   ├── funnel-service.ts
│   ├── retention-service.ts
│   ├── report-service.ts
│   ├── membership-service.ts
│   └── audit-service.ts
├── auth/
│   └── roles.ts
└── validations/
    ├── funnel-schemas.ts
    ├── retention-schemas.ts
    ├── report-schemas.ts
    └── admin-schemas.ts

prisma/
└── schema.prisma

tests/
├── api/
│   ├── funnels.test.ts
│   ├── retention.test.ts
│   ├── reports.test.ts
│   ├── members.test.ts
│   └── audit.test.ts
├── e2e/
│   ├── funnels.spec.ts
│   ├── retention.spec.ts
│   ├── reports.spec.ts
│   └── admin-rbac.spec.ts
└── unit/
    ├── funnel-service.test.ts
    ├── retention-service.test.ts
    ├── report-service.test.ts
    └── roles.test.ts
```

## Proposed Data Model Additions

### Stage 1

- `Funnel` and `FunnelStep`
- `SavedReport`
- optional `SavedReportRun` later if report history is needed

### Stage 2

- `WorkspaceMember`
- `Invitation`
- `AuditLogEntry`

### Deliberate Simplifications

- Single-installation workspace model, not multi-tenant organizations
- Roles assigned directly to dashboard users, not group-based permission graphs
- Audit log is append-only and queryable in-app; no external log sink required for the first version

## Implementation Phases

## Phase 0 — Research

Resolve the main design questions before schema work:

- Funnel query strategy in PostgreSQL:
  determine whether step matching should use CTEs with successive timestamp joins, window functions, or materialized intermediate tables
- Retention semantics:
  define exact return rule (`any event after cohort start` vs selected event)
- Saved report typing:
  decide whether one JSON config column is sufficient or whether report-type-specific tables are justified
- Better Auth role model:
  decide whether roles live in Better Auth user metadata, a local membership table, or both
- Audit hook points:
  define which mutations produce audit entries and where logging should be enforced

## Phase 1 — Design

Produce:

- `research.md`
- `data-model.md`
- `contracts/analytics.md`
- `contracts/admin.md`
- `quickstart.md`

Then re-check the scope and split if needed. If funnels or retention require materially different query architectures, separate them into independent delivery tracks.

## Phase 2 — Foundation

Shared prerequisites before user stories:

- extend Prisma schema and migration set
- add role helpers and server-side authorization utilities
- define Zod request/response contracts
- establish audit logging primitives
- seed local development data for multi-user dashboards and reusable reports

## Phase 3 — User Story 1: Funnels (P1)

Deliver funnel definition, execution service, result visualization, and tests.

### Implemented Technical Approach

- Saved funnel definitions backed by `Funnel` and `FunnelStep`
- Ordered CTE SQL over `events` with timestamp joins
- Distinct-user step counts plus conversion/drop-off metrics
- Dashboard list/create/edit/delete plus runner and preview surfaces

## Phase 4 — User Story 2: Retention (P2)

Deliver cohort generation and retention matrix rendering.

### Implemented Technical Approach

- Cohorts are based on each user’s first event observed inside the selected lookback window
- Supports both daily and weekly interval grouping
- Returns a bucketed matrix response shape optimized for grid rendering

## Phase 5 — User Story 3: Saved Reports (P3)

Persist reusable analysis definitions.

### Implemented Technical Approach

- Stores report type plus JSON config in `saved_reports`
- Supports create/read/update/delete via dashboard session routes
- Includes `/reports` list and `/reports/[id]` detail page with source-page links
- Save-entry dialogs are integrated into query, funnel, and retention views

## Phase 6 — User Story 4: Roles and Invitations (P4)

Add multi-user dashboard support.

### Current Technical Approach

- Better Auth remains the identity provider
- Local membership and invitation records are keyed to Better Auth user ids
- Admin-only invitation/member routes are implemented
- `/settings/members` provides invitation creation, invitation revocation, member listing, role changes, and member removal
- Broader role-aware UI restrictions outside member management are still pending

## Phase 7 — User Story 5: Audit Log (P5)

Record administrative changes and expose a searchable admin-only UI.

### Expected Technical Approach

- Append-only audit writes from service boundaries
- Log only successful mutations in v1
- Include before/after summaries only where cheap and safe; avoid full object snapshots unless justified

## Testing Strategy

### Unit

- funnel ordering semantics
- retention cohort bucketing
- report config serialization
- role resolution helpers
- audit log payload generation

### API

- happy path and validation failures for each new route
- 401/403 role enforcement behavior
- application scoping
- saved report persistence/retrieval

### E2E

- create and run a funnel
- open retention view and inspect cohort cells
- save and reopen a report
- invite viewer/admin users and verify role restrictions
- inspect audit log after admin mutations

## Risks and Mitigations

- **Risk**: Funnel SQL becomes expensive on large event tables.  
  **Mitigation**: start with bounded windows and application scoping; add indexes and explain-plan tests before UI polish.

- **Risk**: Retention semantics become ambiguous.  
  **Mitigation**: lock exact cohort and return definitions in contracts before implementation.

- **Risk**: RBAC logic becomes scattered.  
  **Mitigation**: centralize role checks in dedicated helpers and keep page access under `proxy.ts`.

- **Risk**: Audit logging is forgotten on some mutations.  
  **Mitigation**: enforce writes through service-layer mutation functions and add coverage that asserts audit entry creation.

## Recommended Execution Order

1. Research and contracts
2. Prisma schema changes
3. Funnels
4. Retention
5. Saved reports
6. Roles and invitations
7. Audit log

This order keeps the feature set incremental, testable, and aligned with how users will derive value from the platform.
