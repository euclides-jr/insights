# Research: Advanced Analytics and Collaboration

**Phase**: 0 — Research  
**Branch**: `004-platform-expansion`  
**Date**: 2026-03-18

## Overview

This document resolves the main design questions for the next expansion of the platform. The research focuses on six topics:

1. Funnel query execution
2. Retention/cohort semantics
3. Saved report persistence shape
4. Role-based access control model
5. Invitation flow
6. Audit logging enforcement

---

## Decision 1: Funnel Query Pattern

**Decision**: Implement funnel execution as a single SQL statement built from successive CTEs, where each step constrains the next step by user and timestamp order.

For a three-step funnel:

```sql
WITH step1 AS (
  SELECT e."userId", MIN(e."timestamp") AS ts
  FROM events e
  WHERE e."applicationId" = $1
    AND e."eventName" = $2
    AND e."timestamp" >= $3
  GROUP BY e."userId"
),
step2 AS (
  SELECT e."userId", MIN(e."timestamp") AS ts
  FROM events e
  JOIN step1 s1 ON s1."userId" = e."userId"
  WHERE e."applicationId" = $1
    AND e."eventName" = $4
    AND e."timestamp" > s1.ts
  GROUP BY e."userId"
),
step3 AS (
  SELECT e."userId", MIN(e."timestamp") AS ts
  FROM events e
  JOIN step2 s2 ON s2."userId" = e."userId"
  WHERE e."applicationId" = $1
    AND e."eventName" = $5
    AND e."timestamp" > s2.ts
  GROUP BY e."userId"
)
SELECT ...
```

**Rationale**: This keeps all ordering semantics in PostgreSQL, avoids shipping large intermediate user lists to application code, and is compatible with the existing query-service style already used in user and event analysis features. It is also explainable and testable.

**Alternatives considered**:

- _Multi-pass Node.js execution_: simpler to prototype, but poor at scale and hard to keep consistent with time ordering.
- _Materialized temporary tables_: useful only if funnels become high-frequency or very large; too heavy for v1.

---

## Decision 2: Retention Semantics

**Decision**: Retention v1 uses `user_profiles.firstSeen` as the cohort anchor and counts a user as retained in interval `N` if they perform any event in that interval after the cohort start.

Supported interval modes:

- `daily`
- `weekly`

Supported windows:

- up to 14 daily buckets
- up to 12 weekly buckets

**Rationale**: The project already maintains `firstSeen` accurately, so this avoids inventing another acquisition model. “Any return event” is the most common baseline retention definition and provides immediate value before more advanced variants such as “retained by a specific event.”

**Alternatives considered**:

- _Selected return event only_: useful, but better as a v2 extension after the cohort matrix exists.
- _Session-based retention_: not justified because sessions are not a first-class analysis construct in the current UI.

---

## Decision 3: Saved Report Storage

**Decision**: Use a single `saved_reports` table with `reportType` plus a JSON `config` payload rather than one table per report kind.

```ts
type SavedReportConfig =
  | QueryReportConfig
  | FunnelReportConfig
  | RetentionReportConfig;
```

**Rationale**: Query, funnel, and retention reports are all configuration wrappers around existing analyses. A single table is easier to manage and matches the current codebase’s pragmatic use of typed JSON payloads for dynamic analytics definitions.

**Alternatives considered**:

- _Separate tables per report type_: stronger structural typing, but more migration and routing overhead for little v1 benefit.
- _Opaque serialized URLs only_: too brittle and not expressive enough for future evolution.

---

## Decision 4: RBAC Model

**Decision**: Keep Better Auth as identity and add a local `workspace_members` table keyed by Better Auth `user.id`, with one of three roles:

- `viewer`
- `editor`
- `admin`

Authorization is evaluated server-side through shared helpers in `lib/auth/roles.ts`.

**Rationale**: Better Auth already handles sign-in/session concerns. Role membership is an application concern, not an authentication concern, and belongs in the local database where it can participate in audit logging and admin UIs. This also avoids depending on provider-specific metadata behavior.

**Alternatives considered**:

- _Store roles only in Better Auth metadata_: harder to query and less aligned with Prisma-managed admin operations.
- _Ad hoc role checks per route_: already contrary to the current centralized access direction.

---

## Decision 5: Invitation Flow

**Decision**: Implement invitations as database-backed tokens with explicit acceptance. An admin creates an invitation for an email and role; the recipient signs in or creates an account, then the invite is redeemed into a workspace membership.

Core fields:

- `email`
- `role`
- `tokenHash`
- `expiresAt`
- `acceptedAt`
- `invitedByUserId`

**Rationale**: This flow is straightforward, works with email/password auth, and does not require outbound email infrastructure in v1. The initial quickstart can expose the acceptance link directly for local/manual use, with email delivery added later.

**Alternatives considered**:

- _Direct admin-created accounts_: less secure and less user-friendly.
- _Magic-link-only invites_: adds delivery complexity immediately.

---

## Decision 6: Audit Logging Boundary

**Decision**: Audit logging is written at service-layer mutation boundaries, not scattered in UI code and not implemented as a generic Prisma middleware.

Tracked actions in v1:

- application create/update/delete
- schema create/update/delete
- webhook create/update/delete/test
- saved report create/update/delete
- invitation create/revoke/accept
- member role change/remove

**Rationale**: Service-layer logging keeps audit events explicit and semantically meaningful. Generic middleware can tell that “a row changed,” but not why. This project already favors direct, understandable service logic over indirection.

**Alternatives considered**:

- _Prisma middleware_: too low-level for meaningful audit payloads.
- _Page/UI logging_: incomplete and easy to bypass.

---

## Summary

| Topic | Resolution |
| --- | --- |
| Funnel execution | Ordered CTE chain in PostgreSQL |
| Retention semantics | `firstSeen` cohorts + any-return-event retention |
| Saved reports | Single table with typed JSON config |
| RBAC | Better Auth identity + local membership table |
| Invitations | DB-backed invite tokens with acceptance |
| Audit logging | Explicit service-layer audit writes |

No blocking design questions remain. Proceed to data model and contract definition.
