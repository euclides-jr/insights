# Tasks: User Attributes and Combined Querying

**Input**: Design documents from `/specs/002-user-attributes/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/users-api.md ✅, quickstart.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths included in every task description

---

## Phase 1: Setup

**Purpose**: Extend the Prisma schema with the three new models before any migration or code can be written.

- [ ] T001 Extend `prisma/schema.prisma` — add `UserProfile`, `UserAttributeHistory`, `UserAttributeSchema` models, `AttributeValueType` enum, and the three new `Application` relation fields (per data-model.md Prisma Schema Addition section)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database tables, indexes, validation schemas, and the service skeleton must all exist before any user story endpoint can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Run `prisma migrate dev --name add-user-profiles` to generate the migration SQL for `user_profiles`, `user_attribute_history`, `user_attribute_schemas` tables — **do NOT apply yet; review the generated file first**
- [ ] T003 Edit the generated migration file at `prisma/migrations/<timestamp>_add-user-profiles/migration.sql` before applying: append the GIN index (`CREATE INDEX … USING gin (attributes jsonb_path_ops)`) and composite indexes from data-model.md at the end of the file; then re-run `prisma migrate dev` (or `prisma migrate deploy`) to apply the complete edited file in a single step — do NOT create a second separate migration file, as this risks ordering issues in the Prisma migration table
- [ ] T004 [P] Create `lib/validations/user-schemas.ts` — Zod schemas for: `identifyRequestSchema` (userId + optional attributes), `attributeFilterSchema` (key, operator, value, logic), `eventFilterSchema` (eventName, operator, count, timeWindow, properties), `batchIdentifySchema` (array of up to 100 identify requests), `attributeSchemaRequestSchema` (attributeKey, valueType, description, isIndexed), `combinedQuerySchema` (attributeFilters array + eventFilters array — **distinct from `identifyRequestSchema`**, required for POST /api/users/query); **date attribute values** are accepted as ISO 8601 strings (`z.string().datetime()`), coerced to `::timestamptz` at SQL cast time
- [ ] T005 [P] Create `lib/services/user-attribute-service.ts` — export function signatures with TypeScript types for `upsertUserProfile`, `getUserProfile`, `listUsers`, `buildCombinedUserQuery`, `getAttributeHistory`; leave function bodies as `throw new Error('not implemented')` stubs

**Checkpoint**: Database schema is live, Zod schemas exist, service file is created — user story implementation can begin.

---

## Phase 3: User Story 1 — Set User Attributes (Priority: P1) 🎯 MVP

**Goal**: Developers can call `POST /api/users/identify` to create or update user profiles with arbitrary key-value attributes. Attributes persist and are retrievable via `GET /api/users/:userId`.

**Independent Test**: Set attributes for a test user via the API, retrieve the profile, verify attributes are stored. Update one attribute, verify the other attributes are unchanged. Attempt to set a reserved key (`first_seen`), verify a 400 error is returned.

### Implementation

- [ ] T006 [P] [US1] Implement `upsertUserProfile()` in `lib/services/user-attribute-service.ts` — normalize all incoming attribute key names to **lowercase** (`key.toLowerCase()`) before storage; perform Prisma upsert on `user_profiles`, diff old vs new attributes, write one `UserAttributeHistory` row per changed key; enforce reserved-key block (`RESERVED_KEYS` set) and attribute name format (`/^[a-z0-9_]{1,128}$/` after normalization); enforce 10 KB per-value size limit; apply **last-write-wins** merge — the most recently received value for a key overwrites the stored value with no client-side conflict resolution required (handles multi-device/concurrent writes consistently)
- [ ] T007 [P] [US1] Create `app/api/users/identify/route.ts` — `POST` handler: validate body with `identifyRequestSchema`, resolve `applicationId` from `X-API-Key`, call `upsertUserProfile`, return the updated profile as JSON (200)
- [ ] T008 [P] [US1] Create `app/api/users/[userId]/route.ts` — `GET` handler: resolve application from API key, fetch `UserProfile` via Prisma, optionally include `UserAttributeHistory` when `?includeHistory=true`, return 404 when user not found
- [ ] T009 [US1] Create `components/forms/UserAttributeForm.tsx` — client component: renders a textarea or key-value row editor for attributes; on submit calls `POST /api/users/identify`; shows validation errors inline
- [ ] T010 [US1] Create `app/users/[userId]/page.tsx` — server component: fetch user profile from DB via Prisma, render current attributes table + `UserAttributeForm` for updates + collapsible attribute history list grouped by `changedAt`
- [ ] T011 [US1] Add `/users` navigation link to `components/sidebar.tsx` (matches pattern of existing `/events`, `/schemas`, `/segments` links)
- [ ] T025 [P] [US1] Create `app/api/users/identify/batch/route.ts` — `POST /api/users/identify/batch`: accept an array of up to 100 identify requests, validate with `batchIdentifySchema`, call `upsertUserProfile` for each entry, return `{ processed, failed, errors?: Array<{index, userId, message}> }`; return 400 if array exceeds 100 entries (FR-015 is a Functional Requirement, not an enhancement)

**Checkpoint**: `POST /api/users/identify` creates/updates a profile. `GET /api/users/:userId` returns it. Batch identify (`POST /api/users/identify/batch`) works. The `/users/:userId` dashboard page renders correctly. US1 is independently functional.

---

## Phase 4: User Story 2 — Query Users by Attributes (Priority: P2)

**Goal**: Analysts can call `GET /api/users` with attribute filter conditions and receive a paginated list of matching users with their current attributes.

**Independent Test**: Seed 5 users with different `plan` and `country` attributes. Query `plan = "pro"` — verify only pro users return. Query `plan = "pro" AND country = "US"` — verify intersection. Query `account_age_days > 30` (numeric) — verify range comparison works. Paginate with `pageSize=2` — verify correct page tokens.

### Implementation

- [ ] T012 [P] [US2] Implement `listUsers()` in `lib/services/user-attribute-service.ts` — build parameterized SQL `WHERE` clause from `AttributeFilter[]` (infer SQL cast from JS value type: `number` → `::numeric`, `boolean` → `::boolean`, ISO string → `::timestamptz`, else text extract); evaluate the `logic` field per filter entry: filters with `logic: "or"` form separate OR groups, all others are AND-joined within their group; emit parenthesized SQL groups (`(group1) OR (group2)`) to correctly implement FR-006; apply pagination (`LIMIT`/`OFFSET`) and `ORDER BY` via `sortBy`/`sortOrder`; count total matching rows for pagination metadata
- [ ] T013 [P] [US2] Create `app/api/users/route.ts` — `GET` handler: parse `?filters=` JSON query param, validate with `attributeFilterSchema[]`, resolve application from API key, call `listUsers`, return `{ users, pagination, executionTimeMs }`; return 400 for invalid filter JSON
- [ ] T014 [P] [US2] Create `components/tables/UsersTable.tsx` — server or client component: renders a table with columns for `userId`, `lastSeen`, `eventCount`, `lastEventName`, and dynamic attribute columns based on returned data; includes `Pagination` component (reuse existing `components/ui/pagination.tsx`)
- [ ] T015 [US2] Create `app/users/page.tsx` — server component with `<Suspense>`: attribute filter form (key / operator / value rows, Add Filter / Remove Filter buttons), calls `GET /api/users` on submit, renders `UsersTable` with results and pagination

**Checkpoint**: `/users` page lists all users, attribute filter form narrows results, pagination works. US2 independently functional without requiring US3.

---

## Phase 5: User Story 3 — Combine Attributes with Event Behavior (Priority: P3)

**Goal**: Analysts can query users by combining attribute conditions with event behavior conditions (performed / not_performed, frequency count, time window, event properties) in a single request.

**Independent Test**: Seed 4 users: two with `plan = "pro"`, two with `plan = "free"`. Send `checkout_clicked` events for one pro user and one free user. Query `plan = "pro"` + `performed: checkout_clicked last 7 days`. Verify only the pro user with the event is returned. Add `not_performed: purchase_completed last 7 days` — verify same result. Test `performed: page_view count.min=3` frequency filter.

### Implementation

- [ ] T016 [P] [US3] Implement `buildCombinedUserQuery()` in `lib/services/user-attribute-service.ts` — generates a CTE-based SQL query: `WITH _users AS (SELECT user_id FROM user_profiles WHERE …)` joined to `events` table; handles `performed` (exists), `not_performed` (NOT EXISTS subquery), `count.min`/`count.max` (HAVING), `timeWindow` (timestamp range), and `properties` (JSONB containment); returns the same paginated `{ users, pagination, executionTimeMs }` shape as `listUsers`
- [ ] T017 [P] [US3] Create `app/api/users/query/route.ts` — `POST` handler: validate body with `combinedQuerySchema` (defined in T004; **distinct from `identifyRequestSchema`** — accepts attributeFilters + eventFilters arrays), call `buildCombinedUserQuery`, return results; output the same `{ users, pagination, executionTimeMs }` shape as `GET /api/users` so the UI can use either endpoint interchangeably
- [ ] T018 [US3] Update `app/users/page.tsx` — add a collapsible "Event Behavior" filter section below attribute filters: event name input, operator select (`performed` / `not_performed`), optional count min/max, optional time window (value + unit), optional property key=value pair; include both `filters` and `eventFilters` in the `POST /api/users/query` body when event filters are present
- [ ] T019 [US3] Update `components/tables/UsersTable.tsx` — when event filters are active, show a `matchedEvents` count column alongside the user results
- [ ] T028 [US3/US4] Implement `getAttributesAt(applicationId, userId, timestamp)` in `lib/services/user-attribute-service.ts` — query `UserAttributeHistory` to reconstruct the user's full attribute state at a given point in time (most-recent value per key with `changedAt ≤ timestamp`); integrate into `buildCombinedUserQuery` so event-behavior joins evaluate the user's historically-active attributes at each event's timestamp rather than current attributes, satisfying FR-019

**Checkpoint**: Combined queries work. Analyst can find "pro users who did X but not Y in last N days" from the dashboard. FR-019 (historical attribute correlation in event joins) is implemented. US3 independently functional and additive to US2.

---

## Phase 6: User Story 4 — Track Attribute History (Priority: P4)

**Goal**: Analysts can retrieve the full changelog of attribute changes for a user, filtered by key, and ask point-in-time questions ("what was this user's plan on date X?").

**Independent Test**: Identify a user with `plan = "free"`, then update to `plan = "pro"`, then to `plan = "enterprise"`. Call `GET /api/users/:userId/history?attributeKey=plan` — verify 3 history entries with correct old/new values and timestamps in reverse chronological order.

### Implementation

- [ ] T020 [P] [US4] Implement `getAttributeHistory()` in `lib/services/user-attribute-service.ts` — query `UserAttributeHistory` for a given `(applicationId, userId)` with optional `attributeKey`, `since`, and `until` filters; return rows ordered by `changedAt DESC`
- [ ] T021 [P] [US4] Create `app/api/users/[userId]/history/route.ts` — `GET` handler: parse and validate `?attributeKey`, `?since`, `?until`, and `?at=<ISO8601>` query params; when `?at` is provided, return the most-recent history row per attribute key with `changedAt ≤ at` (point-in-time snapshot, supporting US4 Acceptance Scenario 2); update `getAttributeHistory` signature in the service to accept an optional `at?: Date` parameter; return `{ userId, applicationId, history, totalCount }`
- [ ] T022 [US4] Update `app/users/[userId]/page.tsx` — expand the attribute history section to group entries by `changedAt` timestamp, show old → new value diffs per key, add `?attributeKey=` filter dropdown above the history list

**Checkpoint**: Full attribute history is visible on the user profile page. Point-in-time lookups work via API. US4 additive to US1 without breaking it.

---

## Phase 7: User Story 5 — Auto-Update System Attributes (Priority: P5)

**Goal**: Every time events are ingested, `first_seen`, `last_seen`, `event_count`, and `last_event_name` are automatically updated on `user_profiles` — no explicit identify call required.

**Independent Test**: Send 3 events with a new `userId` (no prior identify call). Fetch `GET /api/users/:userId` — verify `firstSeen` equals earliest event timestamp, `lastSeen` equals latest, `eventCount` = 3, `lastEventName` matches most recent event. Send 2 more events — verify `eventCount` increments to 5.

### Implementation

- [ ] T023 [US5] Update `app/api/events/route.ts` — after the existing `prisma.event.createMany` call, compute per-`userId` aggregate values (`minTimestamp`, `maxTimestamp`, `count`, `lastEventName`) from the `eventsToCreate` array already in memory; execute a single `prisma.$executeRaw` batch upsert (`INSERT INTO user_profiles … ON CONFLICT (application_id, user_id) DO UPDATE SET last_seen = GREATEST(…), first_seen = LEAST(…), event_count = user_profiles.event_count + excluded.event_count, last_event_name = excluded.last_event_name`)

**Checkpoint**: Events auto-populate user profiles. Users appear in `/users` dashboard without any explicit identify call. US5 transparent to all other stories.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Additional endpoints from the API contract, error handling consistency, and validation of the quickstart guide.

- [ ] T024 [P] Create `app/api/users/attributes/schema/route.ts` — `POST` handler to register attribute type declarations (save to `user_attribute_schemas`); `GET` handler to list all registered schemas for the application; used by query builder to look up registered types for `isIndexed = true` expression index annotation
- [ ] T026 [P] Audit all `app/api/users/` route handlers for consistent error handling — ensure: Zod validation errors return `{ error: "Validation failed", details: [...] }`; missing `X-API-Key` header returns 401; invalid/unrecognized key returns 403; not-found returns 404; oversized attributes return 413; BigInt values are correctly serialized — all consistent with existing `app/api/events/route.ts` behavior (FR-020)
- [ ] T029 [P] Add a Vitest concurrent test in `tests/api/users.test.ts` — fire 20 parallel `POST /api/users/identify` requests for the same `userId` with non-overlapping attribute keys; verify the final profile contains all expected attribute values and no writes are lost; this validates `ON CONFLICT DO UPDATE` correctness under concurrent load (SC-008)
- [ ] T027 Validate `specs/002-user-attributes/quickstart.md` scenarios end-to-end — run the SDK code examples from the quickstart against the running dev server (or write a `prisma/seed.ts` extension that exercises each scenario) and confirm all expected responses match

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US1)**: Requires Phase 2 complete — independent of US2–US5
- **Phase 4 (US2)**: Requires Phase 2 complete — independent of US1 (but benefits from US1 data)
- **Phase 5 (US3)**: Requires Phase 2 complete; integrates output of US2's `listUsers` — works without US1 but is richer with it
- **Phase 6 (US4)**: Requires Phase 2 complete; T022 extends US1's profile page — can be developed without US1's UI but needs the service layer
- **Phase 7 (US5)**: Requires Phase 2 complete; extends feature 001's event ingestion route — independent of US1–US4
- **Phase 8 (Polish)**: Requires all desired stories complete

### User Story Dependencies

- **US1 (P1)**: Independent — delivers value standalone
- **US2 (P2)**: Independent — can query users even before any explicit identify calls (if US5 is done)
- **US3 (P3)**: Extends US2 query engine — best implemented after US2's `listUsers` is working
- **US4 (P4)**: Extends US1's history write path — `UserAttributeHistory` rows are written in T006 so history data exists from US1 onwards
- **US5 (P5)**: Extends feature 001 event ingestion — completely independent of US1–US4

### Within Each Phase

- Parallel tasks (`[P]`) can be worked simultaneously — they touch different files
- Service implementation (Txx6, Txx2) before API routes (Txx7, Txx3)
- API routes before UI pages (Txx0, Txx5)

---

## Parallel Execution Examples

### Phase 2 Parallel Batch

```
Run together after T002 completes:
  T003 — raw SQL migration (prisma/migrations/)
  T004 — lib/validations/user-schemas.ts
  T005 — lib/services/user-attribute-service.ts
```

### Phase 3 (US1) Parallel Batch

```
Run together after Phase 2 completes:
  T006 — upsertUserProfile() service implementation
  T007 — app/api/users/identify/route.ts
  T008 — app/api/users/[userId]/route.ts
  T025 — app/api/users/identify/batch/route.ts
Then sequentially:
  T009 → T010 → T011
```

### Phase 4 (US2) Parallel Batch

```
Run together after Phase 2 completes (in parallel with US1):
  T012 — listUsers() service implementation
  T013 — app/api/users/route.ts
  T014 — components/tables/UsersTable.tsx
Then:
  T015 — app/users/page.tsx
```

---

## Implementation Strategy

### MVP (US1 only — Phases 1–3)

1. Complete Phase 1: Extend Prisma schema
2. Complete Phase 2: Run migration, create Zod schemas + service skeleton
3. Complete Phase 3 (US1): Identify endpoint + profile GET + dashboard page
4. **STOP and VALIDATE**: Developers can set and retrieve user attributes. History is recorded.
5. Deploy/demo MVP

### Incremental Delivery

1. Phases 1–2 → Foundation ready
2. Phase 3 (US1) → Set + retrieve user attributes (MVP)
3. Phase 4 (US2) → Query users by attributes
4. Phase 5 (US3) → Combined attribute + event behavior queries (full feature value)
5. Phase 6 (US4) → Attribute history timeline
6. Phase 7 (US5) → Auto-populated system attributes (reduces SDK integration overhead)
7. Phase 8 → Polish, batch endpoint, schema registration

---

## Summary

| Phase                   | Story    | Tasks                  | Parallelizable         |
| ----------------------- | -------- | ---------------------- | ---------------------- |
| 1 — Setup               | —        | T001                   | —                      |
| 2 — Foundational        | —        | T002–T005              | T003, T004, T005       |
| 3 — Set User Attributes | US1 (P1) | T006–T011, T025        | T006, T007, T008, T025 |
| 4 — Query by Attributes | US2 (P2) | T012–T015              | T012, T013, T014       |
| 5 — Combined Queries    | US3 (P3) | T016–T019, T028        | T016, T017             |
| 6 — Attribute History   | US4 (P4) | T020–T022              | T020, T021             |
| 7 — Auto System Attrs   | US5 (P5) | T023                   | —                      |
| 8 — Polish              | —        | T024, T026, T027, T029 | T024, T026, T029       |

**Total**: 29 tasks across 8 phases  
**MVP scope**: Phases 1–3 (12 tasks, US1 only — includes batch identify)  
**Parallel opportunities**: 15 tasks marked `[P]`
