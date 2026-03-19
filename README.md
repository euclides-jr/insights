# Insights

A self-hosted event analytics platform for tracking user interactions, monitoring data quality, and extracting insights from your applications.

## Features

- **Event Tracking** — Ingest single or batched events from any web or mobile app via a simple REST API
- **Application Management** — Register multiple applications, each with its own API key
- **Event Schemas** — Define and version expected event structures for validation
- **User Segments** — Build dynamic user groups using event-based AND/OR criteria
- **User Profiles & Attributes** — Store typed key-value attributes against user profiles, query users by attribute values and event behaviour
- **Analytics Queries** — Filter, aggregate, and group events with typed property filters, time bucketing, schema-aware field suggestions, grouped pagination, saved-query hydration, export, and a table/chart toggle
- **Data Quality Monitoring** — Track validation failures, duplicates, and completeness metrics with threshold-based alerting
- **Dashboard** — View daily event volume trends, per-application event breakdowns, quality metric charts, and summary tiles at a glance

## Tech Stack

- **[Next.js](https://nextjs.org/) 16** (App Router) + **[React](https://react.dev/) 19** + **[TypeScript](https://www.typescriptlang.org/) 5**
- **[Prisma](https://www.prisma.io/) 7** ORM with **[PostgreSQL](https://www.postgresql.org/)**
- **[recharts](https://recharts.org/) v3** for interactive SVG charts
- **[Tailwind CSS](https://tailwindcss.com/) 4** for styling
- **[Zod](https://zod.dev/) 3** for schema validation
- **[Vitest](https://vitest.dev/)** for unit tests and **[Playwright](https://playwright.dev/)** for end-to-end tests

## Prerequisites

- [Bun](https://bun.sh/) 1.x (recommended) or [Node.js](https://nodejs.org/) 20+
- A running [PostgreSQL](https://www.postgresql.org/) instance

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Configure the environment

Create a `.env` file at the project root and set your database connection string:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/insights"
BETTER_AUTH_SECRET="replace-with-a-random-32-char-secret"
BETTER_AUTH_URL="http://localhost:3000"
AUTH_ADMIN_EMAIL="admin@eventpulse.local"
AUTH_ADMIN_PASSWORD="changeme12345"
AUTH_ADMIN_NAME="EventPulse Admin"
```

### 3. Set up the database

Generate the Prisma client and apply migrations:

```bash
bun run db:generate
bun run db:migrate
```

Optionally seed the database with sample data:

```bash
bun run db:seed
```

The seed creates a dashboard admin account using `AUTH_ADMIN_EMAIL` and
`AUTH_ADMIN_PASSWORD`. The `/sign-in` page is the only public dashboard route;
the rest of the Next.js UI now requires an authenticated Better Auth session.

### 4. Start the development server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

## Available Scripts

| Command               | Description                                 |
| --------------------- | ------------------------------------------- |
| `bun run dev`         | Start the development server (Turbopack)    |
| `bun run build`       | Build for production                        |
| `bun start`           | Start the production server                 |
| `bun run lint`        | Lint the codebase with ESLint               |
| `bun run db:generate` | Generate the Prisma client                  |
| `bun run db:migrate`  | Run database migrations (dev)               |
| `bun run db:push`     | Push schema changes without migrations      |
| `bun run db:studio`   | Open Prisma Studio                          |
| `bun run db:seed`     | Seed the database with sample data          |
| `bun run test`        | Run unit tests with Vitest                  |
| `bun run test:ui`     | Run unit tests with the Vitest UI           |
| `bun run test:e2e`    | Run end-to-end tests with Playwright        |
| `bun run test:e2e:ui` | Run end-to-end tests with the Playwright UI |

## Authentication Model

The project uses three distinct authentication paths:

- **Dashboard UI**: Better Auth email/password sessions. The Next.js `proxy.ts` gate protects all dashboard pages and only `/sign-in` is public.
- **Better Auth routes**: `/api/auth/**` is reserved for Better Auth session and credential flows.
- **Programmatic APIs**: ingestion and data APIs such as `/api/events`, `/api/users`, `/api/query`, `/api/schemas`, `/api/segments`, and `/api/webhooks` remain reachable as JSON APIs and enforce their own `X-API-Key` authentication where applicable.

This separation is intentional: page access is centralized in the proxy, while programmatic APIs are not redirected through the dashboard sign-in flow.

## Query Explorer

The Query Explorer at `/query` now supports:

- typed property filters for string, number, and boolean event properties
- time bucketing by `hour`, `day`, `week`, and `month`
- schema-aware suggestions for aggregation fields, group-by keys, and property filters
- grouped-result sorting, row limits, and pagination
- saved report and URL hydration through a shared query-state model
- CSV/JSON export of the current result set

Saved query reports can be reopened directly into the Query Explorer from `/reports/[id]`.

## Sending Events

Authenticate requests using the `X-API-Key` header. Retrieve your API key from the **Applications** section of the dashboard.

**Single event:**

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '{
    "eventName": "page_view",
    "userId": "user_123",
    "sessionId": "session_456",
    "properties": { "page": "/dashboard" }
  }'
```

**Batch events (up to 100):**

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '[
    { "eventName": "page_view", "userId": "user_123", "sessionId": "session_456" },
    { "eventName": "button_click", "userId": "user_123", "sessionId": "session_456", "properties": { "button_id": "signup" } }
  ]'
```

**JavaScript:**

```typescript
const response = await fetch('http://localhost:3000/api/events', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key_here',
  },
  body: JSON.stringify({
    eventName: 'page_view',
    userId: 'user_123',
    sessionId: 'session_456',
    properties: { page: window.location.pathname },
  }),
});
```

See [docs/API.md](docs/API.md) for the full API reference.

## Project Structure

```
app/
  api/
    events/         # Event ingestion endpoint
    applications/   # Application CRUD
    schemas/        # Event schema management
    segments/       # Segment builder
    query/          # Analytics query engine
    quality/        # Data quality metrics
    users/          # User profile & attribute endpoints
    charts/         # Chart data API routes (events-over-time, quality-trends, events-by-application)
  applications/     # Application management pages
  events/           # Event browser pages
  schemas/          # Schema management pages
  segments/         # Segment builder pages
  query/            # Analytics query explorer pages
  quality/          # Data quality dashboard pages
  users/            # User profile pages
  page.tsx          # Main dashboard
components/
  charts/           # Recharts-based chart components (EventVolumeChart, QualityTrendsChart, etc.)
  forms/            # User attribute and profile forms
  tables/           # Data table components
  ui/               # Shared primitives (Button, Badge, Input, TimeRangeSelector, …)
lib/
  charts/           # Shared chart types, colour constants, and alert thresholds
  services/         # Business logic (query builder, segment engine, user attribute service)
  utils/            # Formatting helpers
  db/               # Prisma client configuration
prisma/
  schema.prisma     # Database schema
  migrations/       # Applied migrations
  seed.ts           # Sample data seeder
docs/               # API documentation
tests/
  unit/             # Vitest unit tests
  api/              # Vitest API/integration tests
  e2e/              # Playwright end-to-end tests
specs/              # Feature design documents (spec, plan, tasks, contracts)
```
