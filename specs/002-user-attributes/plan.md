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

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
