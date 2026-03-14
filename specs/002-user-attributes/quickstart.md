# Quickstart: User Attributes and Combined Querying

**Branch**: `002-user-attributes`  
**Date**: March 14, 2026

## Prerequisites

- The base event analytics service (feature 001) is deployed and accepting events
- You have an application API key (from the Applications page or `/api/applications`)
- Node.js / Bun installed for SDK examples

---

## 1. Identify a User (Set Attributes)

Call the identify endpoint when you know who the user is — at signup, login, or when any known property changes.

```typescript
// Identify a user with attributes
const response = await fetch('/api/users/identify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key',
  },
  body: JSON.stringify({
    userId: 'user_abc123',
    attributes: {
      email: 'alice@example.com',
      plan: 'pro',
      country: 'US',
      account_age_days: 45,
      is_beta_tester: true,
    },
  }),
});

const profile = await response.json();
console.log(profile.userId); // "user_abc123"
console.log(profile.attributes.plan); // "pro"
```

**Identify on plan upgrade** (attributes are merged, not replaced):

```typescript
await fetch('/api/users/identify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'your-api-key' },
  body: JSON.stringify({
    userId: 'user_abc123',
    attributes: { plan: 'enterprise' }, // Only plan is updated; other attributes unchanged
  }),
});
```

---

## 2. Track Events as Usual

No changes to event tracking. Events are linked to user profiles automatically via `userId`.

```typescript
await fetch('/api/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'your-api-key' },
  body: JSON.stringify({
    eventName: 'checkout_clicked',
    userId: 'user_abc123', // Must match userId used in identify
    sessionId: 'session_xyz',
    timestamp: new Date().toISOString(),
    properties: { cart_value: 149.99 },
  }),
});
```

> The system automatically updates `lastSeen`, `eventCount`, and `lastEventName` on the user's profile each time an event is received.

---

## 3. Get a User Profile

```typescript
const res = await fetch('/api/users/user_abc123', {
  headers: { 'X-API-Key': 'your-api-key' },
});
const profile = await res.json();

// Current attributes
console.log(profile.attributes);
// { email: "alice@example.com", plan: "enterprise", country: "US", ... }

// System attributes
console.log(profile.systemAttributes.firstSeen); // "2026-03-01T10:00:00Z"
console.log(profile.systemAttributes.eventCount); // 42
console.log(profile.systemAttributes.lastSeen); // "2026-03-14T09:30:00Z"
```

---

## 4. Query Users by Attributes

Find all pro users in the US:

```typescript
const filters = JSON.stringify([
  { key: 'plan', operator: 'eq', value: 'pro' },
  { key: 'country', operator: 'eq', value: 'US' },
]);

const res = await fetch(`/api/users?filters=${encodeURIComponent(filters)}`, {
  headers: { 'X-API-Key': 'your-api-key' },
});

const { users, pagination } = await res.json();
console.log(`Found ${pagination.totalCount} pro users in the US`);
```

Find users with account age over 30 days:

```typescript
const filters = JSON.stringify([
  { key: 'account_age_days', operator: 'gt', value: 30 },
]);
const res = await fetch(`/api/users?filters=${encodeURIComponent(filters)}`, {
  headers: { 'X-API-Key': 'your-api-key' },
});
```

---

## 5. Combined Query: Attributes + Event Behavior

Find pro users who clicked checkout but didn't purchase in the last 7 days:

```typescript
const res = await fetch('/api/users/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'your-api-key' },
  body: JSON.stringify({
    filters: [{ key: 'plan', operator: 'eq', value: 'pro' }],
    eventFilters: [
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
    ],
    pageSize: 100,
    sortBy: 'lastSeen',
    sortOrder: 'desc',
  }),
});

const { users, pagination } = await res.json();
console.log(`${pagination.totalCount} pro users abandoned checkout`);
// Export userIds for re-engagement campaign
const userIds = users.map((u) => u.userId);
```

Find users with 5+ page views in the last 30 days, who are on the free plan:

```typescript
const res = await fetch('/api/users/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'your-api-key' },
  body: JSON.stringify({
    filters: [{ key: 'plan', operator: 'eq', value: 'free' }],
    eventFilters: [
      {
        eventName: 'page_view',
        operator: 'performed',
        count: { min: 5 },
        timeWindow: { value: 30, unit: 'days' },
      },
    ],
  }),
});
```

---

## 6. View Attribute History

See when a user's plan changed:

```typescript
const res = await fetch('/api/users/user_abc123/history?attributeKey=plan', {
  headers: { 'X-API-Key': 'your-api-key' },
});
const { history } = await res.json();

history.forEach((entry) => {
  console.log(`${entry.changedAt}: ${entry.oldValue} → ${entry.newValue}`);
});
// 2026-03-01T10:00:00Z: null → "free"
// 2026-03-10T14:30:00Z: "free" → "pro"
// 2026-03-14T09:00:00Z: "pro" → "enterprise"
```

---

## 7. Register Attribute Types (Optional, for range queries)

For range queries on numeric or date attributes to perform optimally, register the attribute type:

```typescript
await fetch('/api/users/attributes/schema', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'your-api-key' },
  body: JSON.stringify({
    attributeKey: 'account_age_days',
    valueType: 'NUMBER',
    description: 'Number of days since the user signed up',
    isIndexed: true, // Creates an expression index for fast range queries
  }),
});
```

---

## 8. Batch Identify Multiple Users

```typescript
await fetch('/api/users/identify/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'your-api-key' },
  body: JSON.stringify({
    users: [
      { userId: 'user_001', attributes: { plan: 'free', country: 'UK' } },
      { userId: 'user_002', attributes: { plan: 'pro', country: 'DE' } },
      { userId: 'user_003', attributes: { plan: 'enterprise', country: 'US' } },
    ],
  }),
});
```

---

## Dashboard

The query UI is accessible at `/users` in the analytics dashboard. From there you can:

- Search and browse all users with their current attributes
- Filter by attribute values using a form interface
- Add event behavior conditions to find behavioral cohorts
- Click through to individual user profiles with attribute history

---

## Common Patterns

| Goal                        | Approach                                                                    |
| --------------------------- | --------------------------------------------------------------------------- |
| Identify user on login      | `POST /api/users/identify` with `{ userId, attributes }`                    |
| Track plan change           | `POST /api/users/identify` with only the changed attribute                  |
| Find churned users          | Combine `plan = "paid"` attribute with `not_performed: "login"` for 30 days |
| High-value inactive users   | Combine `plan = "enterprise"` with `not_performed: "checkout"` for 14 days  |
| New power users             | Combine `account_age_days < 30` with `page_view count >= 10`                |
| Bulk import user attributes | `POST /api/users/identify/batch`                                            |
| Audit attribute changes     | `GET /api/users/:userId/history`                                            |
