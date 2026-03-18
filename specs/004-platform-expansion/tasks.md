# Tasks: Advanced Analytics and Collaboration

**Input**: Design documents from `/specs/004-platform-expansion/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/analytics.md ✅, contracts/admin.md ✅, quickstart.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths included in every task description

---

## Phase 1: Setup

**Purpose**: Extend Prisma schema before any implementation work begins.

- [x] T001 Extend `prisma/schema.prisma` — add `Funnel`, `FunnelStep`, `SavedReport`, `WorkspaceMember`, `Invitation`, `AuditLogEntry`, plus `WorkspaceRole` and `SavedReportType` enums and required `User` / `Application` relation fields from `data-model.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Migrations, auth helpers, validation schemas, and service skeletons must exist before user story work begins.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [x] T002 Run `prisma migrate dev --name add-platform-expansion` and review the generated migration for all new tables and indexes before applying it
- [x] T003 [P] Create `lib/auth/roles.ts` — shared helpers for `requireRole`, `getCurrentWorkspaceMember`, and role predicates (`isViewer`, `isEditor`, `isAdmin`)
- [x] T004 [P] Create `lib/validations/funnel-schemas.ts`, `lib/validations/retention-schemas.ts`, `lib/validations/report-schemas.ts`, and `lib/validations/admin-schemas.ts` — Zod schemas matching the new contracts
- [x] T005 [P] Create `lib/services/funnel-service.ts`, `lib/services/retention-service.ts`, `lib/services/report-service.ts`, `lib/services/membership-service.ts`, and `lib/services/audit-service.ts` with typed function signatures and `not implemented` stubs
- [x] T006 [P] Extend `prisma/seed.ts` — add at least one viewer user, one editor user, one sample funnel, and one saved report fixture for local/manual testing

**Checkpoint**: DB schema, role helpers, validators, and service files all exist.

---

## Phase 3: User Story 1 — Funnel Analysis (Priority: P1) 🎯 MVP

**Goal**: Users can define and run ordered funnels from the dashboard.

**Independent Test**: Seed a three-step funnel dataset and verify the dashboard shows correct step counts, conversion, and drop-off.

- [x] T007 [P] [US1] Implement funnel creation/list/update logic in `lib/services/funnel-service.ts`
- [x] T008 [P] [US1] Implement funnel execution SQL in `lib/services/funnel-service.ts` using ordered CTE step joins
- [x] T009 [P] [US1] Create `app/api/funnels/route.ts` — `GET` list and `POST` create handlers with session + role checks
- [x] T010 [P] [US1] Create `app/api/funnels/[id]/route.ts` and `app/api/funnels/[id]/run/route.ts` — fetch/update/delete/run handlers
- [x] T011 [US1] Create `components/funnels/FunnelBuilder.tsx` — application selector, step editor, create/update form
- [x] T012 [US1] Create `components/funnels/FunnelResults.tsx` — step table/cards with conversion and drop-off metrics
- [x] T013 [US1] Create `app/funnels/page.tsx` — funnel listing, builder, and result runner UI
- [x] T014 [P] [US1] Add `tests/unit/funnel-service.test.ts`, `tests/api/funnels.test.ts`, and `tests/e2e/funnels.spec.ts`

**Checkpoint**: Funnels are usable end-to-end and provide the first missing high-value analytics feature.

---

## Phase 4: User Story 2 — Retention and Cohorts (Priority: P2)

**Goal**: Users can generate cohort retention grids from existing user/event data.

**Independent Test**: Seed cohort and return data, run retention, and verify the grid values.

- [x] T015 [P] [US2] Implement cohort generation and retention matrix logic in `lib/services/retention-service.ts`
- [x] T016 [P] [US2] Create `app/api/retention/run/route.ts` — retention execution endpoint with session auth and read-only role access
- [x] T017 [US2] Create `components/retention/RetentionGrid.tsx` — cohort matrix UI with empty/loading states
- [x] T018 [US2] Create `app/retention/page.tsx` — filter form + retention grid page
- [x] T019 [P] [US2] Add `tests/unit/retention-service.test.ts`, `tests/api/retention.test.ts`, and `tests/e2e/retention.spec.ts`

**Checkpoint**: Retention analysis is independently functional.

---

## Phase 5: User Story 3 — Saved Reports (Priority: P3)

**Goal**: Users can persist and reopen query, funnel, and retention views.

**Independent Test**: Save a report, reload the app, reopen it, and verify config fidelity.

- [x] T020 [P] [US3] Implement create/read/update/delete report logic in `lib/services/report-service.ts`
- [x] T021 [P] [US3] Create `app/api/reports/route.ts` and `app/api/reports/[id]/route.ts`
- [x] T022 [US3] Create `components/reports/SaveReportDialog.tsx` and `components/reports/SavedReportsList.tsx`
- [x] T023 [US3] Create `app/reports/page.tsx` and `app/reports/[id]/page.tsx`
- [x] T024 [US3] Add “Save report” entry points to existing query/funnel/retention pages
- [x] T025 [P] [US3] Add `tests/unit/report-service.test.ts`, `tests/api/reports.test.ts`, and `tests/e2e/reports.spec.ts`

**Checkpoint**: Reusable analytics views are now first-class.

---

## Phase 6: User Story 4 — Team Invitations and RBAC (Priority: P4)

**Goal**: Multiple dashboard users can collaborate with role-appropriate access.

**Independent Test**: Invite viewer/admin users and verify access differences across UI and APIs.

- [ ] T026 [P] [US4] Implement invitation create/accept/revoke and membership role-change logic in `lib/services/membership-service.ts`
- [ ] T027 [P] [US4] Create `app/api/invitations/route.ts`, `app/api/invitations/accept/route.ts`, and `app/api/invitations/[id]/revoke/route.ts`
- [ ] T028 [P] [US4] Create `app/api/members/route.ts` and `app/api/members/[userId]/route.ts`
- [ ] T029 [US4] Create `components/settings/InviteMemberDialog.tsx` and `components/settings/MemberTable.tsx`
- [ ] T030 [US4] Create `app/settings/members/page.tsx`
- [ ] T031 [US4] Add role-aware UI hiding/disabled states across mutating surfaces: applications, schemas, webhooks, funnels, reports
- [ ] T032 [P] [US4] Add `tests/unit/roles.test.ts`, `tests/api/members.test.ts`, and `tests/e2e/admin-rbac.spec.ts`

**Checkpoint**: Multi-user dashboard usage is supported and protected.

---

## Phase 7: User Story 5 — Audit Logging (Priority: P5)

**Goal**: Admins can inspect a reliable history of administrative changes.

**Independent Test**: Perform tracked admin actions and verify corresponding audit entries.

- [ ] T033 [P] [US5] Implement append-only audit writes and list/query logic in `lib/services/audit-service.ts`
- [ ] T034 [P] [US5] Create `app/api/audit/route.ts`
- [ ] T035 [US5] Wire audit writes into mutating services and routes for applications, schemas, webhooks, reports, invitations, and members
- [ ] T036 [US5] Create `components/settings/AuditLogTable.tsx`
- [ ] T037 [US5] Create `app/settings/audit/page.tsx`
- [ ] T038 [P] [US5] Add `tests/api/audit.test.ts` and extend `tests/e2e/admin-rbac.spec.ts` or add `tests/e2e/audit.spec.ts`

**Checkpoint**: Admin actions are observable and searchable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Tighten performance, authorization consistency, and docs.

- [ ] T039 [P] Add `EXPLAIN`-driven performance validation for funnel and retention SQL in `tests/unit` or scripted checks under `scripts/`
- [ ] T040 [P] Audit all new dashboard APIs for consistent `401`/`403`/`404`/`400` behavior and shared error shapes
- [ ] T041 Update [README.md](/Users/e.dosreissilvajunior/Documents/insights/README.md) and [docs/API.md](/Users/e.dosreissilvajunior/Documents/insights/docs/API.md) to document new dashboard capabilities and role model
- [ ] T042 Validate `specs/004-platform-expansion/quickstart.md` end-to-end against the local seeded environment

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1: no dependencies
- Phase 2: depends on Phase 1 and blocks all stories
- Phase 3: depends on Phase 2
- Phase 4: depends on Phase 2; independent of Phase 3 in code, but best done after it
- Phase 5: depends on Phases 3–4 because reports wrap those surfaces
- Phase 6: depends on Phase 2; can start earlier, but is safer after the first analytics artifacts exist
- Phase 7: depends on mutation surfaces from earlier phases
- Phase 8: after all desired stories

### Recommended Delivery Order

1. Phase 1–2 foundation
2. Phase 3 funnels
3. Phase 4 retention
4. Phase 5 saved reports
5. Phase 6 RBAC/invitations
6. Phase 7 audit logging
7. Phase 8 polish

---

## Summary

| Phase | Story | Tasks | Parallelizable |
| --- | --- | --- | --- |
| 1 — Setup | — | T001 | — |
| 2 — Foundational | — | T002–T006 | T003, T004, T005, T006 |
| 3 — Funnels | US1 (P1) | T007–T014 | T007, T008, T009, T010, T014 |
| 4 — Retention | US2 (P2) | T015–T019 | T015, T016, T019 |
| 5 — Saved Reports | US3 (P3) | T020–T025 | T020, T021, T025 |
| 6 — RBAC & Invites | US4 (P4) | T026–T032 | T026, T027, T028, T032 |
| 7 — Audit Log | US5 (P5) | T033–T038 | T033, T034, T038 |
| 8 — Polish | — | T039–T042 | T039, T040 |

**Total**: 42 tasks across 8 phases  
**Completed**: T001–T025  
**Next active scope**: Phase 6 — RBAC & invitations
