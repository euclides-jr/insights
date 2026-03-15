# Implementation Plan: User Attributes and Combined Querying

**Branch**: `002-user-attributes` | **Date**: March 14, 2026 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/002-user-attributes/spec.md`

## Summary

Extend the existing analytics service with persistent user profiles and attributes. The system adds a `UserProfile` entity linked to the existing `Event` table via `userId`, stores typed key-value attributes with full history, and exposes a `/api/users` query endpoint combining attribute filters and event behavior conditions. The query builder service is extended to join user profiles with event data for cohort-style lookups. A lightweight dashboard page surfaces attribute management and combined querying without duplicating existing UI primitives.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16.x (App Router)  
**Primary Dependencies**: Next.js 16, Prisma 7.x, React 19, PostgreSQL 15+, Zod 3.x  
**Storage**: PostgreSQL — new `user_profiles` and `user_attribute_history` tables alongside existing event tables  
**Testing**: Vitest for unit/integration tests, Playwright for E2E tests  
**Target Platform**: Web application (same deployment as feature 001)  
**Project Type**: Full-stack web service — extends existing Next.js App Router application  
**Performance Goals**: Attribute write <200ms p95; user attribute queries <2s for 1M profiles; combined queries <5s for 3 criteria  
**Constraints**: Solo developer maintainable; no new infrastructure beyond existing PostgreSQL; reuse existing auth/API-key pattern  
**Scale/Scope**: 1M user profiles, up to 100 attributes per user, dataset shared with 001 event store

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

✅ Single web application project (extends 001 — no new project added)  
✅ Direct Prisma access from server components and API routes (no new abstraction layers)  
✅ Standard Next.js App Router structure (mirrors 001 conventions)  
✅ Same PostgreSQL database (no additional storage system introduced)  
✅ Attribute history stored as append-only rows, not a separate audit service

**Post-design re-check** (after Phase 1): ✅ — data model adds two tables to the existing database, query service extension is additive, no principles violated.

## Project Structure

### Documentation (this feature)

```text
specs/002-user-attributes/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── users-api.md     # User attribute & query API contract
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (Next.js App Router — extends 001 layout)

```text
app/
├── api/
│   └── users/
│       ├── route.ts              # POST /api/users/identify + GET /api/users (query)
│       └── [userId]/
│           └── route.ts          # GET/PATCH /api/users/:userId (profile + attributes)
├── users/
│   ├── page.tsx                  # User list / query UI
│   └── [userId]/
│       └── page.tsx              # User profile detail page

lib/
├── services/
│   └── user-attribute-service.ts # Identify, update, read attributes + history
├── validations/
│   └── user-schemas.ts           # Zod schemas for user attribute API inputs

components/
├── forms/
│   └── UserAttributeForm.tsx     # Set/update attributes for a user
└── tables/
    └── UsersTable.tsx            # Paginated user list with attribute columns

prisma/
└── schema.prisma                 # Extended with UserProfile + UserAttributeHistory

tests/
├── api/
│   └── users.test.ts             # Vitest integration tests for /api/users
├── e2e/
│   └── users.spec.ts             # Playwright E2E tests for user profile flows
└── unit/
    └── user-attribute-service.test.ts
```

**Structure Decision**: Extends the existing Next.js App Router project from feature 001. New files follow the exact same conventions — API routes under `app/api/`, server pages under `app/`, services under `lib/services/`, Zod validation under `lib/validations/`. No new project, no new infrastructure, no new layout conventions.

## Delivery Status — 15 March 2026

### Overall: Feature Complete (29/29 tasks done; 1 open sub-item in T028)

| Phase                        | Tasks                  | Status                 |
| ---------------------------- | ---------------------- | ---------------------- |
| 1 — Setup                    | T001                   | ✅ Done                |
| 2 — Foundational             | T002–T005              | ✅ Done                |
| 3 — US1: Set User Attributes | T006–T011, T025        | ✅ Done                |
| 4 — US2: Query by Attributes | T012–T015              | ✅ Done                |
| 5 — US3: Combined Queries    | T016–T019, T028        | ⚠️ Partial (see below) |
| 6 — US4: Attribute History   | T020–T022              | ✅ Done                |
| 7 — US5: Auto System Attrs   | T023                   | ✅ Done                |
| 8 — Polish                   | T024, T026, T027, T029 | ✅ Done                |
| 9 — Post-completion fixes    | T030, T031, T032, T033 | ✅ Done                |

### Open: T028 — FR-019 Historical Attribute Correlation (not yet integrated)

`getAttributesAt(applicationId, userId, timestamp)` is implemented and exported from `lib/services/user-attribute-service.ts`. It correctly reconstructs point-in-time attribute state using `DISTINCT ON` over `user_attribute_history`.

**Gap**: it is not yet called from `buildCombinedUserQuery`. Combined queries still filter on current `user_profiles.attributes` rather than the attributes that were active at each event's timestamp. This means a user who was on `plan = "pro"` last week but upgraded to `enterprise` today will be excluded from a query for `"pro users who performed checkout_clicked last 7 days"`.

**Remaining work**: modify the event-behavior subquery loop in `buildCombinedUserQuery` to compute a per-event history CTE (`WITH _history_at AS (SELECT … FROM user_attribute_history WHERE changedAt <= e.timestamp …)`) and join against it instead of reading `user_profiles.attributes` directly.

### Post-completion fixes

Two bugs were found via the new pagination e2e tests (T032) and patched:

1. **`total` vs `totalCount` mismatch** (`components/forms/UsersPageClient.tsx`) — API returns `pagination.totalCount`; client used `pagination.total`. Showing banner rendered `"Showing 1–NaN of undefined"`. Fixed by normalising on assignment.
2. **Dead URL-based `<Pagination>` buttons** (`components/tables/UsersTable.tsx`) — buttons used `router.push(?page=N)` but `UsersPageClient` never reads `page` from the URL, silently leaving rows stale. Replaced with a plain showing-text `<p>`; `← Prev` / `Next →` in `UsersPageClient` are the sole pagination controls.

**T033 — Unit tests for `user-attribute-service.ts`** (`tests/unit/user-attribute-service.test.ts`)  
41 tests across 5 describes covering `normalizeAndValidateAttributes`, `serializeProfile`, `inferSqlCast`, `buildAttributeCondition`, `buildAttributeWhereClause`, and `getAttributeHistory`. Follows the [Prisma-recommended singleton pattern](https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing) using `jest-mock-extended`'s `mockDeep<PrismaClient>()` factory inside `vi.mock`, with a shared `prismaMock` re-exported from `tests/unit/prisma-singleton.ts` and `vi.resetAllMocks()` in a global `beforeEach`. A one-line shim (`Object.assign(globalThis, { jest: vi })`) in `tests/setup.ts` bridges `jest-mock-extended`'s internal use of the `jest` global to Vitest's `vi`.

### Test coverage summary

| Suite                    | File                                        | Tests                                       |
| ------------------------ | ------------------------------------------- | ------------------------------------------- |
| API integration (Vitest) | `tests/api/users.test.ts`                   | 23                                          |
| E2E (Playwright)         | `tests/e2e/users.spec.ts`                   | 44 (32 original + 10 pagination + 2 others) |
| Unit (Vitest)            | `tests/unit/user-attribute-service.test.ts` | 41 — all passing                            |

---

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
