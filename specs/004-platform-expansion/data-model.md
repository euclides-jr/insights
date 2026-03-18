# Data Model: Advanced Analytics and Collaboration

**Phase**: 1 — Design  
**Branch**: `004-platform-expansion`  
**Date**: 2026-03-18  
**Depends on**: [research.md](research.md), existing schema in `prisma/schema.prisma`

## Overview

This feature adds six new tables to the existing PostgreSQL schema:

1. `funnels`
2. `funnel_steps`
3. `saved_reports`
4. `workspace_members`
5. `invitations`
6. `audit_log_entries`

The design deliberately keeps the workspace model single-installation and local to this deployment. It does not introduce organizations, billing tenants, or external identity sync.

---

## New Entities

### Funnel

Reusable funnel definition for one application.

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `String` | PK, UUID | Internal id |
| `applicationId` | `String` | FK → Application.id, NOT NULL | Scoped application |
| `name` | `String` | NOT NULL | Human-readable name |
| `description` | `String?` | nullable | Optional description |
| `createdByUserId` | `String` | FK → User.id, NOT NULL | Better Auth user who created it |
| `createdAt` | `DateTime` | NOT NULL, default now() | Creation timestamp |
| `updatedAt` | `DateTime` | NOT NULL, updatedAt | Last update timestamp |

**Constraints**:

- Index on `(applicationId)`
- Index on `(createdByUserId)`

---

### FunnelStep

Ordered step within a funnel.

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `String` | PK, UUID | Internal id |
| `funnelId` | `String` | FK → Funnel.id, NOT NULL | Parent funnel |
| `position` | `Int` | NOT NULL | 1-based step index |
| `eventName` | `String` | NOT NULL | Required event name |
| `properties` | `Json?` | nullable | Optional event property filter |
| `createdAt` | `DateTime` | NOT NULL, default now() | Creation timestamp |

**Constraints**:

- Unique on `(funnelId, position)`
- Index on `(funnelId)`

---

### SavedReport

Named saved configuration for an analysis surface.

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `String` | PK, UUID | Internal id |
| `name` | `String` | NOT NULL | Display name |
| `reportType` | `SavedReportType` | NOT NULL | `QUERY`, `FUNNEL`, `RETENTION` |
| `applicationId` | `String?` | FK → Application.id | Optional application scope |
| `config` | `Json` | NOT NULL | Typed analysis config payload |
| `createdByUserId` | `String` | FK → User.id, NOT NULL | Creator |
| `updatedByUserId` | `String` | FK → User.id, NOT NULL | Last editor |
| `createdAt` | `DateTime` | NOT NULL, default now() | Creation timestamp |
| `updatedAt` | `DateTime` | NOT NULL, updatedAt | Last update timestamp |

**Constraints**:

- Index on `(reportType)`
- Index on `(createdByUserId)`
- Index on `(applicationId)`

---

### WorkspaceMember

Role assignment for a Better Auth user in this installation.

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `String` | PK, UUID | Internal id |
| `userId` | `String` | FK → User.id, unique, NOT NULL | Better Auth user id |
| `role` | `WorkspaceRole` | NOT NULL | `VIEWER`, `EDITOR`, `ADMIN` |
| `invitedByUserId` | `String?` | FK → User.id | Optional inviter |
| `createdAt` | `DateTime` | NOT NULL, default now() | Creation timestamp |
| `updatedAt` | `DateTime` | NOT NULL, updatedAt | Last update timestamp |

**Constraints**:

- Unique on `userId`
- Index on `role`

---

### Invitation

Pending or completed invitation into the dashboard workspace.

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `String` | PK, UUID | Internal id |
| `email` | `String` | NOT NULL | Invite target |
| `role` | `WorkspaceRole` | NOT NULL | Intended role |
| `tokenHash` | `String` | unique, NOT NULL | Hashed acceptance token |
| `invitedByUserId` | `String` | FK → User.id, NOT NULL | Inviter |
| `expiresAt` | `DateTime` | NOT NULL | Expiration timestamp |
| `acceptedAt` | `DateTime?` | nullable | Acceptance timestamp |
| `acceptedByUserId` | `String?` | FK → User.id | Redeeming user |
| `createdAt` | `DateTime` | NOT NULL, default now() | Creation timestamp |

**Constraints**:

- Index on `(email)`
- Index on `(expiresAt)`
- Index on `(acceptedAt)`

---

### AuditLogEntry

Immutable record of an administrative action.

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `String` | PK, UUID | Internal id |
| `actorUserId` | `String` | FK → User.id, NOT NULL | Acting user |
| `action` | `String` | NOT NULL | Action type, e.g. `report.create` |
| `targetType` | `String` | NOT NULL | Entity type, e.g. `saved_report` |
| `targetId` | `String?` | nullable | Target entity id |
| `metadata` | `Json?` | nullable | Safe structured context |
| `createdAt` | `DateTime` | NOT NULL, default now() | Timestamp |

**Constraints**:

- Index on `(actorUserId, createdAt DESC)`
- Index on `(action, createdAt DESC)`
- Index on `(targetType, targetId)`

---

## New Enums

```prisma
enum WorkspaceRole {
  VIEWER
  EDITOR
  ADMIN
}

enum SavedReportType {
  QUERY
  FUNNEL
  RETENTION
}
```

---

## Relationships

```text
User (Better Auth)
  ├── has one WorkspaceMember
  ├── has many Funnels (createdByUserId)
  ├── has many SavedReports (createdByUserId / updatedByUserId)
  ├── has many Invitations (invitedByUserId / acceptedByUserId)
  └── has many AuditLogEntries (actorUserId)

Application
  ├── has many Funnels
  └── has many SavedReports

Funnel
  └── has many FunnelSteps
```

---

## Prisma Schema Addition

```prisma
model Funnel {
  id              String   @id @default(uuid())
  applicationId   String
  name            String
  description     String?
  createdByUserId String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  createdBy   User        @relation("FunnelCreatedBy", fields: [createdByUserId], references: [id], onDelete: Cascade)
  steps       FunnelStep[]

  @@index([applicationId])
  @@index([createdByUserId])
  @@map("funnels")
}

model FunnelStep {
  id         String   @id @default(uuid())
  funnelId   String
  position   Int
  eventName  String
  properties Json?
  createdAt  DateTime @default(now())

  funnel Funnel @relation(fields: [funnelId], references: [id], onDelete: Cascade)

  @@unique([funnelId, position])
  @@index([funnelId])
  @@map("funnel_steps")
}

model SavedReport {
  id              String          @id @default(uuid())
  name            String
  reportType      SavedReportType
  applicationId   String?
  config          Json
  createdByUserId String
  updatedByUserId String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  application Application? @relation(fields: [applicationId], references: [id], onDelete: SetNull)
  createdBy   User         @relation("SavedReportCreatedBy", fields: [createdByUserId], references: [id], onDelete: Cascade)
  updatedBy   User         @relation("SavedReportUpdatedBy", fields: [updatedByUserId], references: [id], onDelete: Cascade)

  @@index([reportType])
  @@index([applicationId])
  @@index([createdByUserId])
  @@map("saved_reports")
}

model WorkspaceMember {
  id              String        @id @default(uuid())
  userId          String        @unique
  role            WorkspaceRole
  invitedByUserId String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  user      User  @relation("WorkspaceMemberUser", fields: [userId], references: [id], onDelete: Cascade)
  invitedBy User? @relation("WorkspaceMemberInvitedBy", fields: [invitedByUserId], references: [id], onDelete: SetNull)

  @@index([role])
  @@map("workspace_members")
}

model Invitation {
  id               String        @id @default(uuid())
  email            String
  role             WorkspaceRole
  tokenHash        String        @unique
  invitedByUserId  String
  expiresAt        DateTime
  acceptedAt       DateTime?
  acceptedByUserId String?
  createdAt        DateTime      @default(now())

  invitedBy  User  @relation("InvitationInvitedBy", fields: [invitedByUserId], references: [id], onDelete: Cascade)
  acceptedBy User? @relation("InvitationAcceptedBy", fields: [acceptedByUserId], references: [id], onDelete: SetNull)

  @@index([email])
  @@index([expiresAt])
  @@index([acceptedAt])
  @@map("invitations")
}

model AuditLogEntry {
  id          String   @id @default(uuid())
  actorUserId String
  action      String
  targetType  String
  targetId    String?
  metadata    Json?
  createdAt   DateTime @default(now())

  actor User @relation("AuditLogActor", fields: [actorUserId], references: [id], onDelete: Cascade)

  @@index([actorUserId, createdAt])
  @@index([action, createdAt])
  @@index([targetType, targetId])
  @@map("audit_log_entries")
}
```

---

## State Transitions

### Funnel Lifecycle

```text
Draft definition created
        │
        ▼
Persisted Funnel + FunnelSteps
        │
        ├── Run analysis on demand
        ├── Update definition
        └── Save as SavedReport
```

### Invitation Lifecycle

```text
Created
  │
  ├── Expires → unusable
  ├── Revoked → unusable
  └── Accepted → WorkspaceMember created/updated
```

### Audit Lifecycle

```text
Authorized mutation succeeds
        │
        ▼
AuditLogEntry appended
        │
        ▼
Never updated or deleted in normal operation
```
