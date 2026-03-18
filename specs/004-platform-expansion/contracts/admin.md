# API Contract: Collaboration and Governance

**Phase**: 1 — Contracts  
**Branch**: `004-platform-expansion`  
**Date**: 2026-03-18  
**Depends on**: [../data-model.md](../data-model.md), [../research.md](../research.md)

## Overview

This document defines the internal admin/dashboard APIs for:

- invitations
- membership/role management
- audit log access

These are dashboard-only APIs protected by Better Auth sessions and role checks.

---

## Authentication and Authorization

All endpoints require an authenticated dashboard session.

Admin-only endpoints:

- `POST /api/invitations`
- `POST /api/invitations/[id]/revoke`
- `GET /api/members`
- `PATCH /api/members/[userId]`
- `DELETE /api/members/[userId]`
- `GET /api/audit`

Invitation acceptance is the exception:

- `POST /api/invitations/accept` requires a signed-in user, but not admin role

---

## Endpoints

### POST /api/invitations

Create a workspace invitation.

**Request**

```ts
{
  email: string;
  role: 'VIEWER' | 'EDITOR' | 'ADMIN';
  expiresInDays?: number; // default 7
}
```

**Response: 201 Created**

```ts
{
  id: string;
  email: string;
  role: 'VIEWER' | 'EDITOR' | 'ADMIN';
  expiresAt: string;
  inviteUrl: string; // local/manual delivery in v1
  createdAt: string;
}
```

---

### POST /api/invitations/accept

Accept an invitation as the currently signed-in user.

**Request**

```ts
{
  token: string;
}
```

**Response: 200 OK**

```ts
{
  membership: {
    userId: string;
    role: 'VIEWER' | 'EDITOR' | 'ADMIN';
    createdAt: string;
    updatedAt: string;
  };
}
```

Validation rules:

- invite must exist
- invite must not be expired
- invite must not already be accepted
- signed-in user email must match invited email

---

### GET /api/members

List workspace members.

**Response: 200 OK**

```ts
{
  members: Array<{
    userId: string;
    email: string;
    name: string | null;
    role: 'VIEWER' | 'EDITOR' | 'ADMIN';
    createdAt: string;
    updatedAt: string;
  }>;
}
```

---

### PATCH /api/members/[userId]

Change a member’s role.

**Request**

```ts
{
  role: 'VIEWER' | 'EDITOR' | 'ADMIN';
}
```

**Response: 200 OK**

```ts
{
  userId: string;
  role: 'VIEWER' | 'EDITOR' | 'ADMIN';
  updatedAt: string;
}
```

Business rules:

- an admin cannot demote the last remaining admin
- users cannot change their own role unless separately allowed later

---

### DELETE /api/members/[userId]

Remove a workspace member.

**Response: 204 No Content**

Business rules:

- last remaining admin cannot be removed

---

### GET /api/audit

List audit log entries.

**Query parameters**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `actorUserId` | string | no | Filter by actor |
| `action` | string | no | Filter by action |
| `targetType` | string | no | Filter by target type |
| `page` | number | no | 1-based page |
| `pageSize` | number | no | default 50, max 200 |

**Response: 200 OK**

```ts
{
  entries: Array<{
    id: string;
    actorUserId: string;
    actorEmail: string;
    action: string;
    targetType: string;
    targetId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}
```

---

## Error Shape

```ts
{
  error: string;
  details?: Array<{ field?: string; message: string }>;
}
```

Common statuses:

- `401` unauthenticated
- `403` insufficient role
- `404` invitation/member not found
- `409` invalid state, e.g. invite already accepted
- `400` validation failure
