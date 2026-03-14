# Insights

A self-hosted event analytics platform for tracking user interactions, monitoring data quality, and extracting insights from your applications.

## Features

- **Event Tracking** — Ingest single or batched events from any web or mobile app via a simple REST API
- **Application Management** — Register multiple applications, each with its own API key
- **Event Schemas** — Define and version expected event structures for validation
- **User Segments** — Build dynamic user groups using event-based AND/OR criteria
- **Analytics Queries** — Filter, aggregate, and group events with a flexible query builder
- **Data Quality Monitoring** — Track validation failures, duplicates, and completeness metrics
- **Dashboard** — View event trends, quality metrics, and application overviews at a glance

## Tech Stack

- **[Next.js](https://nextjs.org/)** (App Router) + **[React](https://react.dev/)** + **[TypeScript](https://www.typescriptlang.org/)**
- **[Prisma](https://www.prisma.io/)** ORM with **[PostgreSQL](https://www.postgresql.org/)**
- **[Tailwind CSS](https://tailwindcss.com/)** for styling
- **[Zod](https://zod.dev/)** for schema validation
- **[Vitest](https://vitest.dev/)** for unit tests and **[Playwright](https://playwright.dev/)** for end-to-end tests

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (or [Bun](https://bun.sh/))
- A running [PostgreSQL](https://www.postgresql.org/) instance

## Getting Started

### 1. Install dependencies

```bash
npm install
# or
bun install
```

### 2. Configure the environment

Create a `.env` file at the project root and set your database connection string:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/insights"
```

### 3. Set up the database

Generate the Prisma client and apply migrations:

```bash
npm run db:generate
npm run db:migrate
```

Optionally seed the database with sample data:

```bash
npm run db:seed
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm start` | Start the production server |
| `npm run lint` | Lint the codebase with ESLint |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | Run database migrations (dev) |
| `npm run db:push` | Push schema changes without migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed the database with sample data |
| `npm run test` | Run unit tests with Vitest |
| `npm run test:ui` | Run unit tests with the Vitest UI |
| `npm run test:e2e` | Run end-to-end tests with Playwright |
| `npm run test:e2e:ui` | Run end-to-end tests with the Playwright UI |

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
  api/          # REST API route handlers (events, applications, schemas, segments, query, quality)
  applications/ # Application management pages
  events/       # Event browser pages
  schemas/      # Schema management pages
  segments/     # Segment builder pages
  query/        # Analytics query builder pages
  quality/      # Data quality dashboard pages
  page.tsx      # Main dashboard
components/     # Shared React components
lib/
  services/     # Business logic (query builder, segment engine)
  db/           # Database client configuration
prisma/         # Prisma schema, migrations, and seed script
docs/           # API documentation
tests/          # Unit and end-to-end tests
```
