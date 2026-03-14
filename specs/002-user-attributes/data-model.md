# Data Model: User Attributes and Combined Querying

**Phase**: 1 — Design  
**Branch**: `002-user-attributes`  
**Date**: March 14, 2026  
**Depends on**: [research.md](research.md), existing schema in `prisma/schema.prisma`

## Overview

This feature adds three new tables to the existing PostgreSQL schema:

1. **`user_profiles`** — one row per unique user per application; holds current attribute values (JSONB) and system-managed fields (first_seen, last_seen, event_count)
2. **`user_attribute_history`** — append-only EAV log of every attribute change per user
3. **`user_attribute_schemas`** — optional type registry per (application, attribute key) enabling typed query casting and expression indexes

The three new tables integrate with the existing `Application` and `Event` tables without modifying them.

---

## New Entities

### UserProfile

Represents a unique user within an application. Created automatically on first event or explicitly via the identify SDK call.

| Field           | Type       | Constraints                   | Description                            |
| --------------- | ---------- | ----------------------------- | -------------------------------------- |
| `id`            | `String`   | PK, UUID                      | Internal surrogate key                 |
| `applicationId` | `String`   | FK → Application.id, NOT NULL | Owning application                     |
| `userId`        | `String`   | NOT NULL                      | Client-assigned user identifier        |
| `firstSeen`     | `DateTime` | NOT NULL, auto                | Timestamp of first event for this user |
| `lastSeen`      | `DateTime` | NOT NULL, auto                | Timestamp of most recent event         |
| `eventCount`    | `Int`      | NOT NULL, default 0, auto     | Total events tracked for this user     |
| `lastEventName` | `String?`  | nullable, auto                | Name of the most recent event          |
| `attributes`    | `Json`     | NOT NULL, default `{}`        | User-defined key/value pairs (JSONB)   |
| `createdAt`     | `DateTime` | NOT NULL, auto                | When profile was first created         |
| `updatedAt`     | `DateTime` | NOT NULL, auto                | When profile was last modified         |

**Constraints**:

- Unique on `(applicationId, userId)` — one profile per user per application
- Index on `(applicationId)` for listing all users in an application
- Index on `(applicationId, lastSeen)` for recency-sorted queries
- GIN index on `attributes` for containment queries (`@>`)

**Validation rules**:

- `userId` max 512 characters
- `attributes` keys must match `/^[a-zA-Z0-9_]{1,128}$/`
- Attribute value size limit: 10KB per attribute key
- Reserved attribute keys (`first_seen`, `last_seen`, `user_id`, `event_count`, `last_event_name`) are rejected at API boundary

---

### UserAttributeHistory

Append-only log of every change made to user attributes. Never deleted (supports point-in-time attribute lookups).

| Field           | Type       | Constraints                   | Description                            |
| --------------- | ---------- | ----------------------------- | -------------------------------------- |
| `id`            | `String`   | PK, UUID                      | Internal surrogate key                 |
| `applicationId` | `String`   | FK → Application.id, NOT NULL | Owning application                     |
| `userId`        | `String`   | NOT NULL                      | User identifier (not FK, for perf)     |
| `attributeKey`  | `String`   | NOT NULL                      | Name of the changed attribute          |
| `oldValue`      | `Json?`    | nullable                      | Previous value (null if new attribute) |
| `newValue`      | `Json?`    | nullable                      | New value (null if attribute deleted)  |
| `changedAt`     | `DateTime` | NOT NULL, default now()       | When the change occurred               |

**Constraints**:

- Index on `(applicationId, userId, attributeKey, changedAt)` for point-in-time lookups
- Index on `(applicationId, userId)` for full attribute history per user

**Notes**:

- No foreign key on userId to avoid join overhead on every write; referential integrity is enforced at service layer
- This table is write-heavy and read-rarely; consider PostgreSQL table partitioning by `changedAt` after high volume is reached

---

### UserAttributeSchema

Optional type registry for user-defined attribute keys. Enables the query builder to emit correct SQL casts and create expression indexes for range queries. Analogous to the existing `EventSchema` model.

| Field           | Type                 | Constraints                   | Description                      |
| --------------- | -------------------- | ----------------------------- | -------------------------------- |
| `id`            | `String`             | PK, UUID                      | Internal surrogate key           |
| `applicationId` | `String`             | FK → Application.id, NOT NULL | Owning application               |
| `attributeKey`  | `String`             | NOT NULL                      | Attribute name being typed       |
| `valueType`     | `AttributeValueType` | NOT NULL                      | Declared type enum               |
| `description`   | `String?`            | nullable                      | Human-readable description       |
| `isIndexed`     | `Boolean`            | NOT NULL, default false       | Whether to emit expression index |
| `createdAt`     | `DateTime`           | NOT NULL, auto                | When registered                  |

**Enum `AttributeValueType`**: `STRING`, `NUMBER`, `BOOLEAN`, `DATE`

**Constraints**:

- Unique on `(applicationId, attributeKey)` — one type registration per key per application
- Index on `(applicationId)` for lookup at query-build time

---

## Relationships

```
Application (existing)
  ├── has many Events (existing)
  ├── has many EventSchemas (existing)
  ├── has many Segments (existing)
  ├── has many DataQualityMetrics (existing)
  ├── has many UserProfiles (NEW)           ← one UserProfile per unique userId
  ├── has many UserAttributeHistories (NEW) ← append-only log
  └── has many UserAttributeSchemas (NEW)   ← optional type registry

UserProfile
  └── implicitly references Events via userId (no FK — join at query time)
```

---

## Prisma Schema Addition

```prisma
// UserProfile holds one row per unique user per application
model UserProfile {
  id            String   @id @default(uuid())
  applicationId String
  userId        String
  firstSeen     DateTime @default(now())
  lastSeen      DateTime @default(now())
  eventCount    Int      @default(0)
  lastEventName String?
  attributes    Json     @default("{}")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([applicationId, userId])
  @@index([applicationId])
  @@index([applicationId, lastSeen])
  @@map("user_profiles")
}

// Append-only log of every user attribute change
model UserAttributeHistory {
  id            String    @id @default(uuid())
  applicationId String
  userId        String
  attributeKey  String
  oldValue      Json?
  newValue      Json?
  changedAt     DateTime  @default(now())

  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([applicationId, userId])
  @@index([applicationId, userId, attributeKey, changedAt])
  @@map("user_attribute_history")
}

// Optional type registry enabling typed query casting
model UserAttributeSchema {
  id            String              @id @default(uuid())
  applicationId String
  attributeKey  String
  valueType     AttributeValueType
  description   String?
  isIndexed     Boolean             @default(false)
  createdAt     DateTime            @default(now())

  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([applicationId, attributeKey])
  @@index([applicationId])
  @@map("user_attribute_schemas")
}

enum AttributeValueType {
  STRING
  NUMBER
  BOOLEAN
  DATE
}
```

---

## State Transitions

### User Profile Lifecycle

```
[Event received with userId]
         │
         ▼
  UserProfile exists?
     /          \
   No            Yes
   │              │
   ▼              ▼
CREATE profile  UPDATE lastSeen, eventCount, lastEventName
(firstSeen = event.timestamp)
```

### Attribute Update Lifecycle

```
PATCH /api/users/:userId with { plan: "pro" }
         │
         ▼
  Validate attribute keys (reserved check, name format, value size)
         │
         ▼
  Read current attributes from UserProfile
         │
         ▼
  For each changed key: write row to UserAttributeHistory (oldValue → newValue)
         │
         ▼
  Update UserProfile.attributes (JSON merge/patch)
```

---

## Indexes and Performance Notes

| Query pattern                                | Index used                                                                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| All users in application                     | `(applicationId)` on `user_profiles`                                                                                       |
| Users sorted by last activity                | `(applicationId, lastSeen)` on `user_profiles`                                                                             |
| Attribute containment (e.g., `plan = "pro"`) | GIN on `attributes` with `jsonb_path_ops` (manual migration step)                                                          |
| Numeric range queries (e.g., `age > 25`)     | Expression index `((attributes->>'age')::numeric)` — created at `UserAttributeSchema` registration when `isIndexed = true` |
| Attribute history for a specific key         | `(applicationId, userId, attributeKey, changedAt)` on `user_attribute_history`                                             |

> **Note**: The GIN index and expression indexes are not expressible in Prisma schema SDL and must be added as raw SQL in a separate migration file.

---

## Validation Rules Summary

| Entity               | Field              | Rule                                                                    |
| -------------------- | ------------------ | ----------------------------------------------------------------------- |
| UserProfile          | `userId`           | Max 512 characters, non-empty                                           |
| UserProfile          | `attributes` key   | `/^[a-zA-Z0-9_]{1,128}$/`, not in RESERVED_KEYS                         |
| UserProfile          | `attributes` value | Serialized size ≤ 10KB per key                                          |
| UserAttributeHistory | `attributeKey`     | Must match registered UserAttributeSchema key or be any valid key       |
| UserAttributeSchema  | `attributeKey`     | `/^[a-zA-Z0-9_]{1,128}$/`, not in RESERVED_KEYS; unique per application |
| UserAttributeSchema  | `valueType`        | Must be one of STRING, NUMBER, BOOLEAN, DATE                            |
