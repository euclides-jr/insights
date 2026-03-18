# Quickstart: Advanced Analytics and Collaboration

**Branch**: `004-platform-expansion`  
**Date**: 2026-03-18

## Prerequisites

- The existing Insights application is running locally
- Better Auth admin login works
- Sample applications and events are seeded
- At least one non-admin dashboard user exists or can be invited

---

## 1. Create and Run a Funnel

Create a three-step funnel:

```ts
await fetch('/api/funnels', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    applicationId: 'demo-app-id',
    name: 'Signup Activation',
    steps: [
      { eventName: 'signup_started' },
      { eventName: 'email_verified' },
      { eventName: 'workspace_created' },
    ],
  }),
});
```

Run it:

```ts
await fetch('/api/funnels/funnel-id/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    timeWindow: { value: 30, unit: 'days' },
  }),
});
```

Expected result:

- each step shows user count
- conversion percentages decrease or stay equal across steps
- drop-off is visible between steps

---

## 2. Run a Retention Report

```ts
await fetch('/api/retention/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    applicationId: 'demo-app-id',
    interval: 'daily',
    cohortWindow: { value: 14, unit: 'days' },
  }),
});
```

Expected result:

- one cohort row per day
- `D0` equals cohort size
- later buckets show retained user counts/rates

---

## 3. Save a Report

Save a funnel:

```ts
await fetch('/api/reports', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    name: 'Signup Funnel',
    reportType: 'FUNNEL',
    applicationId: 'demo-app-id',
    config: {
      funnelId: 'funnel-id',
      timeWindow: { value: 30, unit: 'days' },
    },
  }),
});
```

Expected result:

- the report appears in `/reports`
- reopening it restores the same configuration

---

## 4. Invite a Viewer

```ts
const invite = await fetch('/api/invitations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'viewer@example.com',
    role: 'VIEWER',
  }),
}).then((r) => r.json());

console.log(invite.inviteUrl);
```

Open `inviteUrl` while signed in as that user and accept the invitation.

Expected result:

- membership is created
- invited user can access dashboard pages
- invited user cannot mutate admin-owned resources

---

## 5. Verify RBAC

As a `viewer`:

- dashboard pages load
- attempts to create funnels or reports fail with `403`
- audit log is inaccessible

As an `editor`:

- funnels, retention, and reports can be created
- invitations and role management remain forbidden

As an `admin`:

- full dashboard/admin capabilities are available

---

## 6. Inspect the Audit Log

After creating a funnel, saving a report, and inviting a user:

```ts
await fetch('/api/audit?page=1&pageSize=20', {
  credentials: 'include',
});
```

Expected result:

- entries exist for those actions
- actor, action, target, and timestamp are visible
- newest entries appear first
