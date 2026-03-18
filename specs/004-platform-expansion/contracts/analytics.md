# API Contract: Advanced Analytics

**Phase**: 1 — Contracts  
**Branch**: `004-platform-expansion`  
**Date**: 2026-03-18  
**Depends on**: [../data-model.md](../data-model.md), [../research.md](../research.md)

## Overview

This document defines HTTP routes for the new analytics surfaces:

- funnels
- retention
- saved reports

These are internal dashboard APIs. They are not public ingestion endpoints and are authenticated with Better Auth sessions plus role checks, not `X-API-Key`.

---

## Authentication

All endpoints in this contract:

- require an authenticated dashboard session
- are reachable only behind the dashboard gate enforced by `proxy.ts`
- require role checks in server code as appropriate

Role rules:

- `viewer`: read-only access
- `editor`: create/update analytics definitions and reports
- `admin`: same as editor for analytics routes

---

## Endpoints

### POST /api/funnels

Create a reusable funnel definition.

**Request**

```ts
{
  applicationId: string;
  name: string;
  description?: string;
  steps: Array<{
    eventName: string;
    properties?: Record<string, unknown>;
  }>; // 2-10 items
}
```

**Response: 201 Created**

```ts
{
  id: string;
  applicationId: string;
  name: string;
  description: string | null;
  steps: Array<{
    id: string;
    position: number;
    eventName: string;
    properties: Record<string, unknown> | null;
  }>;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}
```

**Authorization**

- `viewer` → 403
- `editor`, `admin` → allowed

---

### GET /api/funnels

List funnel definitions.

**Query parameters**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `applicationId` | string | no | Scope to application |
| `q` | string | no | Name search |

**Response: 200 OK**

```ts
{
  funnels: Array<{
    id: string;
    applicationId: string;
    name: string;
    description: string | null;
    stepCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

---

### POST /api/funnels/[id]/run

Execute a funnel and return the computed step metrics.

**Request**

```ts
{
  applicationId?: string; // optional override if validating ownership
  timeWindow: {
    value: number;
    unit: 'days' | 'weeks';
  };
}
```

**Response: 200 OK**

```ts
{
  funnelId: string;
  generatedAt: string;
  steps: Array<{
    position: number;
    eventName: string;
    users: number;
    conversionRate: number | null;
    dropOffRate: number | null;
  }>;
}
```

---

### POST /api/retention/run

Run a retention analysis for an application.

**Request**

```ts
{
  applicationId: string;
  interval: 'daily' | 'weekly';
  cohortWindow: {
    value: number;
    unit: 'days' | 'weeks';
  };
  returnEventName?: string; // omitted in v1 means any return event
}
```

**Response: 200 OK**

```ts
{
  applicationId: string;
  interval: 'daily' | 'weekly';
  buckets: string[]; // e.g. ["D0", "D1", "D2", ...]
  cohorts: Array<{
    cohortStart: string;
    cohortSize: number;
    cells: Array<{
      bucket: string;
      users: number;
      rate: number;
    }>;
  }>;
}
```

---

### POST /api/reports

Create a saved report.

**Request**

```ts
{
  name: string;
  reportType: 'QUERY' | 'FUNNEL' | 'RETENTION';
  applicationId?: string;
  config: Record<string, unknown>;
}
```

**Response: 201 Created**

```ts
{
  id: string;
  name: string;
  reportType: 'QUERY' | 'FUNNEL' | 'RETENTION';
  applicationId: string | null;
  config: Record<string, unknown>;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}
```

**Authorization**

- `viewer` → 403
- `editor`, `admin` → allowed

---

### GET /api/reports

List saved reports.

**Query parameters**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `reportType` | string | no | Filter by type |
| `applicationId` | string | no | Filter by application |

**Response: 200 OK**

```ts
{
  reports: Array<{
    id: string;
    name: string;
    reportType: 'QUERY' | 'FUNNEL' | 'RETENTION';
    applicationId: string | null;
    updatedAt: string;
  }>;
}
```

---

### GET /api/reports/[id]

Fetch one saved report.

**Response: 200 OK**

```ts
{
  id: string;
  name: string;
  reportType: 'QUERY' | 'FUNNEL' | 'RETENTION';
  applicationId: string | null;
  config: Record<string, unknown>;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## Error Shape

All endpoints use:

```ts
{
  error: string;
  details?: Array<{ field?: string; message: string }>;
}
```

Common statuses:

- `401` unauthenticated
- `403` insufficient role
- `404` resource not found
- `400` validation failure
