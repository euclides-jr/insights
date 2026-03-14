# API Contract: User Attributes

**Phase**: 1 — Contracts  
**Branch**: `002-user-attributes`  
**Date**: March 14, 2026  
**Depends on**: [data-model.md](../data-model.md), [research.md](../research.md)

## Overview

This document defines all HTTP endpoints added by the User Attributes feature. Endpoints follow the same conventions as the existing analytics API: JSON bodies, `X-API-Key` header for authentication, and structured error responses.

All endpoints are namespaced under `/api/users`.

---

## Authentication

All endpoints require the `X-API-Key` header containing a valid application API key. The key identifies the application context; users are always scoped to the authenticated application.

```
X-API-Key: <applicationApiKey>
```

---

## Endpoints

### POST /api/users/identify

Identify a user and set or update their attributes. Creates the user profile if it doesn't exist. Existing attributes not present in the request body are preserved.

**Request**

```typescript
{
  userId: string;           // Required. Client-assigned user identifier (max 512 chars)
  attributes?: {            // Optional. Key-value attributes to set/update
    [key: string]: string | number | boolean | null;
  };
}
```

**Response: 200 OK** (user identified and attributes updated)

```typescript
{
  userId: string;
  applicationId: string;
  attributes: Record<string, string | number | boolean | null>;
  firstSeen: string; // ISO 8601
  lastSeen: string; // ISO 8601
  eventCount: number;
  lastEventName: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

**Response: 400 Bad Request** (validation failure)

```typescript
{
  error: 'Validation failed';
  details: Array<{ field: string; message: string }>;
}
```

**Examples**

```typescript
// Set user attributes for the first time
POST /api/users/identify
{
  "userId": "user_abc123",
  "attributes": {
    "plan": "pro",
    "country": "US",
    "age": 28,
    "is_beta": true
  }
}

// Update a single attribute without affecting others
POST /api/users/identify
{
  "userId": "user_abc123",
  "attributes": {
    "plan": "enterprise"
  }
}
// → plan updated, country/age/is_beta preserved

// Create a profile with no attributes (useful when userId is first seen)
POST /api/users/identify
{
  "userId": "user_abc123"
}
```

---

### GET /api/users/:userId

Retrieve a single user's profile including current attributes.

**Path parameter**: `userId` — URL-encoded user identifier

**Query parameters**:

| Parameter        | Type    | Default | Description                                 |
| ---------------- | ------- | ------- | ------------------------------------------- |
| `includeHistory` | boolean | false   | When true, include attribute change history |

**Response: 200 OK**

```typescript
{
  userId: string;
  applicationId: string;
  attributes: Record<string, string | number | boolean | null>;
  systemAttributes: {
    firstSeen: string;       // ISO 8601
    lastSeen: string;        // ISO 8601
    eventCount: number;
    lastEventName: string | null;
  };
  history?: Array<{          // Present only when includeHistory=true
    attributeKey: string;
    oldValue: string | number | boolean | null;
    newValue: string | number | boolean | null;
    changedAt: string;       // ISO 8601
  }>;
  createdAt: string;         // ISO 8601
  updatedAt: string;         // ISO 8601
}
```

**Response: 404 Not Found**

```typescript
{
  error: 'User not found';
  userId: string;
}
```

---

### GET /api/users

Query users by attributes with optional event behavior filters. Returns paginated results.

**Query parameters**:

| Parameter      | Type          | Required | Description                                                                                |
| -------------- | ------------- | -------- | ------------------------------------------------------------------------------------------ |
| `filters`      | string (JSON) | no       | Attribute filter conditions (see format below)                                             |
| `eventFilters` | string (JSON) | no       | Event behavior conditions (see format below)                                               |
| `page`         | number        | no       | Page number, 1-based (default: 1)                                                          |
| `pageSize`     | number        | no       | Results per page, max 200 (default: 50)                                                    |
| `sortBy`       | string        | no       | Field to sort by: `lastSeen`, `firstSeen`, `eventCount`, `createdAt` (default: `lastSeen`) |
| `sortOrder`    | string        | no       | `asc` or `desc` (default: `desc`)                                                          |

**`filters` format** (URL-encoded JSON array):

```typescript
type AttributeFilter = {
  key: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';
  value: string | number | boolean | null;
  logic?: 'AND' | 'OR'; // How to combine with next filter (default: "AND")
};

// Example: plan = "pro" AND country = "US"
filters = [
  { key: 'plan', operator: 'eq', value: 'pro' },
  { key: 'country', operator: 'eq', value: 'US' },
];

// Example: age > 25 OR plan = "enterprise"
filters = [
  { key: 'age', operator: 'gt', value: 25 },
  { key: 'plan', operator: 'eq', value: 'enterprise', logic: 'OR' },
];
```

**`eventFilters` format** (URL-encoded JSON array):

```typescript
type EventFilter = {
  eventName: string;
  operator: 'performed' | 'not_performed'; // whether user did or didn't do this
  count?: { min?: number; max?: number }; // frequency constraint
  timeWindow?: {
    value: number;
    unit: 'days' | 'hours' | 'minutes';
  };
  properties?: Record<string, unknown>; // event property conditions
  logic?: 'AND' | 'OR'; // combine with next filter (default: "AND")
};

// Example: users who clicked checkout in last 7 days but never purchased
eventFilters = [
  {
    eventName: 'checkout_clicked',
    operator: 'performed',
    timeWindow: { value: 7, unit: 'days' },
  },
  {
    eventName: 'purchase_completed',
    operator: 'not_performed',
    timeWindow: { value: 7, unit: 'days' },
  },
];

// Example: users with 5+ page views in last 30 days
eventFilters = [
  {
    eventName: 'page_view',
    operator: 'performed',
    count: { min: 5 },
    timeWindow: { value: 30, unit: 'days' },
  },
];
```

**Response: 200 OK**

```typescript
{
  users: Array<{
    userId: string;
    attributes: Record<string, string | number | boolean | null>;
    systemAttributes: {
      firstSeen: string; // ISO 8601
      lastSeen: string; // ISO 8601
      eventCount: number;
      lastEventName: string | null;
    };
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  }
  executionTimeMs: number;
}
```

**Response: 400 Bad Request**

```typescript
{
  error: 'Invalid query parameters';
  details: Array<{ field: string; message: string }>;
}
```

**Examples**

```
# All pro users in the US
GET /api/users?filters=[{"key":"plan","operator":"eq","value":"pro"},{"key":"country","operator":"eq","value":"US"}]

# Pro users who clicked checkout but didn't purchase in last 7 days
GET /api/users
  ?filters=[{"key":"plan","operator":"eq","value":"pro"}]
  &eventFilters=[
    {"eventName":"checkout_clicked","operator":"performed","timeWindow":{"value":7,"unit":"days"}},
    {"eventName":"purchase_completed","operator":"not_performed","timeWindow":{"value":7,"unit":"days"}}
  ]

# Users with 5+ page views, sorted by first seen
GET /api/users
  ?eventFilters=[{"eventName":"page_view","operator":"performed","count":{"min":5},"timeWindow":{"value":30,"unit":"days"}}]
  &sortBy=firstSeen&sortOrder=asc
```

---

### POST /api/users/query (batch query endpoint)

Alternative to GET /api/users for complex queries where URL encoding is impractical. Accepts the same parameters as a JSON body.

**Request**

```typescript
{
  filters?: Array<AttributeFilter>;
  eventFilters?: Array<EventFilter>;
  page?: number;              // default: 1
  pageSize?: number;          // default: 50, max: 200
  sortBy?: "lastSeen" | "firstSeen" | "eventCount" | "createdAt";  // default: lastSeen
  sortOrder?: "asc" | "desc"; // default: desc
}
```

**Response**: Same as `GET /api/users`

---

### GET /api/users/:userId/history

Retrieve the full attribute change history for a user.

**Path parameter**: `userId` — URL-encoded user identifier

**Query parameters**:

| Parameter      | Type              | Default | Description                              |
| -------------- | ----------------- | ------- | ---------------------------------------- |
| `attributeKey` | string            | -       | Filter history to a single attribute key |
| `since`        | string (ISO 8601) | -       | Return changes after this timestamp      |
| `until`        | string (ISO 8601) | -       | Return changes before this timestamp     |

**Response: 200 OK**

```typescript
{
  userId: string;
  applicationId: string;
  history: Array<{
    id: string;
    attributeKey: string;
    oldValue: string | number | boolean | null;
    newValue: string | number | boolean | null;
    changedAt: string; // ISO 8601
  }>;
  totalCount: number;
}
```

---

### POST /api/users/attributes/schema

Register a type declaration for a user attribute key. Enables typed query casting and optional expression indexes for range performance.

**Request**

```typescript
{
  attributeKey: string;           // Attribute name to register
  valueType: "STRING" | "NUMBER" | "BOOLEAN" | "DATE";
  description?: string;           // Human-readable description
  isIndexed?: boolean;            // Whether to create an expression index (default: false)
}
```

**Response: 201 Created**

```typescript
{
  id: string;
  applicationId: string;
  attributeKey: string;
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE';
  description: string | null;
  isIndexed: boolean;
  createdAt: string; // ISO 8601
}
```

**Response: 409 Conflict** (attribute key already registered)

```typescript
{
  error: 'Attribute key already registered';
  attributeKey: string;
  existingType: string;
}
```

---

### POST /api/users/identify/batch

Set or update attributes for multiple users in a single request. Useful for bulk imports or SDK batching.

**Request**

```typescript
{
  users: Array<{
    userId: string;
    attributes?: Record<string, string | number | boolean | null>;
  }>; // Max 100 users per request
}
```

**Response: 200 OK**

```typescript
{
  processed: number;
  failed: number;
  errors?: Array<{
    userId: string;
    error: string;
  }>;
}
```

---

## Error Response Format

All error responses follow this structure, consistent with the existing API:

```typescript
{
  error: string;        // Human-readable error summary
  details?: Array<{     // Present for validation errors
    field: string;
    message: string;
  }>;
}
```

## Status Code Reference

| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| 200  | Success (GET, PUT/PATCH, POST query)              |
| 201  | Created (new resource created)                    |
| 400  | Invalid request body or parameters                |
| 401  | Missing or invalid API key                        |
| 404  | User or resource not found                        |
| 409  | Conflict (duplicate resource)                     |
| 413  | Request entity too large (attribute value > 10KB) |
| 429  | Rate limit exceeded                               |
| 500  | Internal server error                             |
