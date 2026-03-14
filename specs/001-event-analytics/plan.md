# Implementation Plan: Event Analytics Service

**Branch**: `001-event-analytics` | **Date**: March 13, 2026 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-event-analytics/spec.md`

## Summary

Build an event tracking and product analytics service for web and mobile applications that collects user interaction events, validates data quality, enables querying and analysis, and supports user segmentation for activation. The system will be implemented as a Next.js web application with API routes for event ingestion, Prisma ORM for data access, and PostgreSQL for storage. Server-side components will provide the dashboard interface with direct database access for optimal performance.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16.x (App Router)  
**Primary Dependencies**: Next.js, Prisma 7.x, React 19, PostgreSQL 15+  
**Storage**: PostgreSQL with optimized indexing for time-series event data  
**Testing**: Playwright for E2E tests, Vitest for unit/integration tests  
**Target Platform**: Web application deployed on Vercel/cloud platform  
**Project Type**: Full-stack web service with API and dashboard  
**Performance Goals**: 10,000 events/min ingestion, <3s query response for 10M events, <200ms API response  
**Constraints**: Solo developer maintainable, minimal operational overhead, <200ms p95 latency for ingestion  
**Scale/Scope**: 5 applications, 10M+ events, basic dashboard (10-15 pages)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

✅ Single web application project (within complexity limits)  
✅ Direct Prisma access from server components (no unnecessary abstractions)  
✅ Standard Next.js App Router structure (no custom frameworks)  
✅ PostgreSQL for both transactional and analytical queries (no premature multi-DB setup)

## Project Structure

### Documentation (this feature)

```text
specs/001-event-analytics/
├── plan.md              # This file (technical implementation plan)
├── spec.md              # Feature specification (completed)
├── checklists/          # Quality and readiness checklists
│   └── requirements.md  # Specification validation checklist
└── (future)
    ├── data-model.md    # Database schema and entity relationships
    ├── api-contracts.md # API endpoint specifications
    └── tasks.md         # Implementation task breakdown
```

### Source Code (Next.js App Router)

```text
app/
├── api/
│   ├── events/
│   │   └── route.ts              # POST /api/events - single and batch ingestion
│   ├── applications/
│   │   └── route.ts              # GET/POST /api/applications
│   ├── schemas/
│   │   ├── route.ts              # GET/POST /api/schemas
│   │   └── [id]/route.ts         # GET/PUT/DELETE /api/schemas/:id
│   ├── segments/
│   │   ├── route.ts              # GET/POST /api/segments
│   │   ├── [id]/route.ts         # GET/PUT/DELETE /api/segments/:id
│   │   └── [id]/export/route.ts  # GET /api/segments/:id/export
│   └── query/
│       └── route.ts              # POST /api/query - event analytics queries
├── (dashboard)/
│   ├── layout.tsx                # Dashboard shell with navigation
│   ├── page.tsx                  # Home/overview page
│   ├── applications/
│   │   ├── page.tsx              # List applications
│   │   └── [id]/
│   │       ├── page.tsx          # Application details
│   │       └── events/page.tsx   # Application events view
│   ├── schemas/
│   │   ├── page.tsx              # Manage event schemas
│   │   └── [id]/page.tsx         # Edit schema
│   ├── query/
│   │   └── page.tsx              # Query builder interface
│   ├── segments/
│   │   ├── page.tsx              # List segments
│   │   └── [id]/page.tsx         # Segment details
│   └── quality/
│       └── page.tsx              # Data quality dashboard
├── globals.css
└── layout.tsx                    # Root layout

lib/
├── db/
│   └── prisma.ts                 # Prisma client singleton
├── validations/
│   ├── event-validator.ts        # Event schema validation logic
│   └── schemas.ts                # Zod schemas for API inputs
├── services/
│   ├── event-ingestion.ts        # Event ingestion business logic
│   ├── query-builder.ts          # Query construction for analytics
│   ├── segment-engine.ts         # Segment evaluation logic
│   └── quality-metrics.ts        # Data quality calculations
└── utils/
    ├── deduplication.ts          # Event deduplication helpers
    └── rate-limiter.ts           # Rate limiting utilities

components/
├── ui/                           # shadcn/ui components
├── charts/                       # Chart components for analytics
│   ├── EventChart.tsx
│   ├── MetricCard.tsx
│   └── QualityIndicator.tsx
├── forms/
│   ├── EventSchemaForm.tsx
│   ├── SegmentForm.tsx
│   └── QueryBuilder.tsx
└── tables/
    ├── EventsTable.tsx
    └── SegmentsTable.tsx

prisma/
├── schema.prisma                 # Prisma schema definition
├── migrations/                   # Database migrations
└── seed.ts                       # Seed data for development

tests/
├── e2e/                          # Playwright E2E tests
│   ├── event-ingestion.spec.ts
│   ├── query-interface.spec.ts
│   ├── schema-management.spec.ts
│   └── segment-export.spec.ts
├── integration/                  # Vitest integration tests
│   ├── api/
│   │   ├── events.test.ts
│   │   ├── query.test.ts
│   │   └── segments.test.ts
│   └── services/
│       ├── event-validator.test.ts
│       └── segment-engine.test.ts
└── unit/                         # Vitest unit tests
    ├── validations.test.ts
    ├── query-builder.test.ts
    └── deduplication.test.ts
```

**Structure Decision**: Using Next.js App Router with server-side components for the dashboard. API routes handle event ingestion and queries. Prisma is accessed directly from server components and API routes. No separate backend/frontend split needed—Next.js unifies both concerns. Testing uses Playwright for E2E flows and Vitest for unit/integration tests.

## Data Model

### Core Entities (Prisma Schema)

**Application**

- `id`: String (UUID, primary key)
- `name`: String
- `apiKey`: String (unique, for authentication)
- `createdAt`: DateTime
- `updatedAt`: DateTime
- Relations: events, schemas, segments

**Event**

- `id`: String (UUID, primary key)
- `eventId`: String (unique, for deduplication)
- `applicationId`: String (foreign key)
- `eventName`: String (indexed)
- `userId`: String (indexed)
- `sessionId`: String (indexed)
- `timestamp`: DateTime (indexed)
- `properties`: JSON
- `createdAt`: DateTime
- Relations: application

**EventSchema**

- `id`: String (UUID, primary key)
- `applicationId`: String (foreign key)
- `eventName`: String (indexed)
- `version`: Int
- `schemaDefinition`: JSON (property definitions with types and rules)
- `isActive`: Boolean
- `createdAt`: DateTime
- Relations: application

**Segment**

- `id`: String (UUID, primary key)
- `applicationId`: String (foreign key)
- `name`: String
- `description`: String?
- `criteria`: JSON (segment definition rules)
- `memberCount`: Int (cached count)
- `lastRefreshedAt`: DateTime
- `createdAt`: DateTime
- `updatedAt`: DateTime
- Relations: application

**DataQualityMetric**

- `id`: String (UUID, primary key)
- `applicationId`: String (foreign key)
- `date`: DateTime (indexed)
- `eventsReceived`: Int
- `eventsRejected`: Int
- `validationFailureRate`: Float
- `duplicateRate`: Float
- `completenessRate`: Float
- `createdAt`: DateTime
- Relations: application

### Indexes & Performance

- **Event table**: Composite indexes on `(applicationId, timestamp)`, `(applicationId, eventName, timestamp)`, `(userId, timestamp)` for efficient time-range queries
- **Event deduplication**: Unique index on `eventId` for idempotency
- **Partitioning consideration**: For >10M events, consider PostgreSQL table partitioning by timestamp (monthly partitions)
- **JSON queries**: Use PostgreSQL JSONB type for `properties` field with GIN indexes for common filter properties

## API Contracts

### Event Ingestion

**POST /api/events**

```typescript
// Single event
Request: { ...Event }
// Batch (up to 100 events)
Request: Array<Event>

type Event = {
  eventId?: string;          // Optional; auto-generated if not provided (idempotency)
  eventName: string;
  userId: string;
  sessionId: string;
  timestamp?: string;        // ISO 8601; defaults to server time if missing
  properties?: Record<string, any>;
}
Headers:
  X-API-Key: <API_KEY>

Response: 201 Created
{
  success: true;
  received: number;          // Total events in request
  created: number;           // Events actually stored (0 if all were duplicates)
  rejected?: number;         // Present only when schema violations occurred
  violations?: Array<{       // Present only when rejected > 0
    eventName: string;
    violations: Array<{ property: string; message: string }>;
  }>;
  applicationId: string;
  applicationName: string;
}

Response: 400 Bad Request (malformed payload)
{
  error: "Validation failed";
  details: Array<{ field: string; message: string }>;
}

Response: 422 Unprocessable Entity (all events fail active schema)
{
  error: "Schema validation failed";
  received: number;
  rejected: number;
  violations: Array<{
    eventName: string;
    violations: Array<{ property: string; message: string }>;
  }>;
}
```

### Query Interface

**POST /api/query**

```typescript
Request:
{
  applicationId: string;
  eventName?: string;        // Filter by event type
  startDate: string;         // ISO 8601
  endDate: string;
  filters?: {                // Property filters
    [key: string]: any;
  };
  aggregation?: "count" | "unique_users" | "avg" | "sum";
  aggregationField?: string; // Required for avg/sum
  groupBy?: string;          // Group results by property
  limit?: number;            // Max 10000
}

Response: 200 OK
{
  results: Array<{
    [key: string]: any;      // Depends on groupBy and aggregation
  }>;
  totalCount: number;
  executionTimeMs: number;
}
```

### Segment Management

**POST /api/segments**

```typescript
Request:
{
  applicationId: string;
  name: string;
  description?: string;
  criteria: {
    eventFilters: Array<{
      eventName: string;
      count?: {min?: number, max?: number};
      timeWindow?: {value: number, unit: "days" | "hours"};
      properties?: Record<string, any>;
    }>;
    logic: "AND" | "OR";
  };
}

Response: 201 Created
{
  id: string;
  memberCount: number;
  estimatedRefreshTime: string;
}
```

**GET /api/segments/:id/export?format=csv|json**

```typescript
Response: 200 OK (CSV)
userId,lastEventDate,eventCount
user123,2026-03-13T10:00:00Z,5

Response: 200 OK (JSON)
{
  users: Array<{
    userId: string;
    lastEventDate: string;
    eventCount: number;
    properties: Record<string, any>;
  }>;
  segmentName: string;
  exportedAt: string;
}
```

## Architecture Decisions

### 1. Server-Side Rendering with Server Components

**Decision**: Use Next.js Server Components for dashboard pages to fetch data directly from Prisma without API layer

**Rationale**:

- Reduces latency (no extra HTTP hop)
- Simplifies architecture (no separate API for dashboard data)
- Leverages Next.js caching and revalidation
- Maintains security (database credentials never exposed to client)

**Trade-off**: Dashboard pages tightly coupled to database schema, but acceptable for solo developer with direct control

### 2. PostgreSQL as Single Data Store

**Decision**: Use PostgreSQL for both transactional (event ingestion) and analytical (queries/aggregations) workloads

**Rationale**:

- Simplifies deployment and operations
- PostgreSQL handles 10M events well with proper indexing
- JSONB support for flexible event properties
- Mature partitioning and performance tuning options
- Avoid premature optimization with separate OLAP database

**Trade-off**: May need to revisit if scale exceeds 100M+ events, but sufficient for MVP

### 3. Synchronous Event Ingestion

**Decision**: Process events synchronously in API routes (validate, deduplicate, insert)

**Rationale**:

- Simpler error handling and client feedback
- <200ms response time achievable with optimized Prisma queries
- No need for message queue infrastructure
- Prisma's connection pooling handles concurrent requests

**Trade-off**: Less resilient to traffic spikes than async queue, but acceptable with rate limiting

### 4. Batch Segment Refresh

**Decision**: Segments are refreshed on-demand or via periodic background job, not real-time

**Rationale**:

- Segment queries can be expensive (full table scans)
- 5-minute latency acceptable per success criteria
- Use cached `memberCount` to avoid re-counting on every view
- Background job can be implemented with Vercel Cron or similar

**Trade-off**: Segment membership not instantly updated, but meets requirements

### 5. Schema Versioning Strategy

**Decision**: Accept events with old schema versions, log warnings to data quality metrics

**Rationale**:

- Allows gradual client migration
- Prevents data loss during rollouts
- Warnings provide visibility without blocking

**Implementation**: Include schema version in validation, log mismatches, continue processing

## Testing Strategy

### Unit Tests (Vitest)

- Event validation logic
- Query builder functions
- Segment criteria evaluation
- Deduplication helpers
- Rate limiting utilities

**Coverage Target**: 80%+ for lib/ and services/

### Integration Tests (Vitest + Test DB)

- API routes with real Prisma client (test database)
- End-to-end event ingestion → validation → storage
- Query execution against populated test data
- Segment evaluation with various criteria
- Schema validation against real schemas

**Setup**: Use separate PostgreSQL test database, reset between tests

### E2E Tests (Playwright)

- Complete user flows:
  - Create application → Generate API key → Send events → View events
  - Define event schema → Send valid/invalid events → See validation results
  - Create segment → Refresh segment → Export segment (CSV and JSON)
  - Query events with filters → Verify results
  - View data quality dashboard → Verify metrics

**Coverage**: All P1, P2, P3 user stories from spec should have E2E tests

### Performance Tests

- Load test event ingestion (10,000 events/min sustained)
- Query performance test (queries on 10M event dataset, <3s response)
- Batch ingestion test (100 events per batch)

**Tools**: Artillery or k6 for load testing

## Development Phases

### Phase 1: Foundation (Week 1) ✅ Complete

- [x] Set up Next.js project with TypeScript
- [x] Configure Prisma with PostgreSQL
- [x] Define Prisma schema (Application, Event, EventSchema entities)
- [x] Create migrations
- [x] Set up testing infrastructure (Vitest, Playwright)
- [x] Implement basic authentication middleware (API key validation)

### Phase 2: Event Ingestion (Week 2) ✅ Complete

- [x] Implement POST /api/events endpoint
- [x] Event validation and schema checking (schema enforcement + Zod shape validation)
- [x] Deduplication logic (skipDuplicates on unique eventId)
- [x] Batch ingestion (POST /api/events accepts single object or array up to 100 events)
- [x] Unit and integration tests for ingestion (tests/api/events.test.ts — 20 test cases)
- [x] E2E test: send event → verify storage (tests/e2e/events.spec.ts)

### Phase 3: Query Interface (Week 3) ✅ Complete

- [X] Implement POST /api/query endpoint (app/api/query/route.ts)
- [X] Query builder service with filters and aggregations (lib/services/query-builder.ts)
- [X] Optimize database indexes for query performance (composite indexes in schema were already present)
- [X] Build query page in dashboard (app/query/page.tsx + components/query-form.tsx)
- [ ] E2E test: query events with various filters

### Phase 4: Schema Management (Week 4) 🔶 Partial

- [ ] Implement schema CRUD API endpoints (GET/POST/PUT/DELETE /api/schemas)
- [x] Event validation against schemas (active schemas enforced in POST /api/events — required fields + type checking)
- [ ] Schema versioning handling (model supports versioning; version-tolerance logic not yet implemented)
- [ ] Schema management dashboard pages (read-only list at /schemas; no create/edit UI yet)
- [x] E2E test: send valid/invalid event against active schema (covered in tests/api/events.test.ts Schema Enforcement block)

### Phase 5: Data Quality (Week 5) 🔶 Partial

- [x] Implement DataQualityMetric model (applicationId + date unique key; eventsReceived, eventsRejected, validationFailureRate, completenessRate)
- [x] Track validation failures and completeness (upserted in POST /api/events on schema violations)
- [ ] Data quality dashboard page (/quality route not yet created)
- [ ] Alert logic for quality thresholds
- [ ] E2E test: trigger quality issues → verify metrics

### Phase 6: Segmentation (Week 6) 🔶 Partial

- [ ] Implement segment CRUD API endpoints (GET/POST/PUT/DELETE /api/segments)
- [ ] Segment evaluation engine (criteria → matching userId query)
- [ ] Segment refresh logic (background job / on-demand)
- [ ] Segment export (CSV and JSON) — GET /api/segments/:id/export
- [x] Segment dashboard pages (read-only list at /segments; no create/edit/export UI yet)
- [ ] E2E test: create segment → export → verify users

### Phase 7: Polish & Deployment (Week 7) ⏳ Not Started

- [ ] Performance optimization (query tuning, indexing)
- [ ] Load testing and benchmarking
- [x] Documentation (docs/API.md — event ingestion API reference)
- [ ] Deployment to Vercel or cloud platform
- [ ] Set up monitoring and logging
- [ ] Final E2E test suite run

## Key Dependencies & Setup

### Package.json (Key Dependencies)

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "prisma": "^5.0.0",
    "@prisma/client": "^5.0.0",
    "zod": "^3.22.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "vitest": "^1.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0"
  }
}
```

### Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/analytics"
NEXTAUTH_SECRET="<random-secret>"
NODE_ENV="development|production"
```

### Database Setup

```bash
# Install PostgreSQL locally or use cloud service (Supabase, Neon, Railway)
# Initialize Prisma
npx prisma init
npx prisma migrate dev --name init
npx prisma generate

# Seed development data
npx prisma db seed
```

## Risks & Mitigations

| Risk                                        | Impact | Mitigation                                                                                         |
| ------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| Query performance degrades with >10M events | High   | Implement table partitioning, add targeted indexes, consider materialized views for common queries |
| Event ingestion can't handle burst traffic  | Medium | Add rate limiting, implement retry logic in SDK, consider async queue for future scaling           |
| Solo developer bandwidth for maintenance    | High   | Keep architecture simple, comprehensive tests for regression prevention, good documentation        |
| Schema changes break existing integrations  | Medium | Version tolerance strategy (accept old versions with warnings), clear migration guides             |
| Data quality issues go unnoticed            | High   | Automated quality metrics dashboard, alert thresholds, regular monitoring                          |

## Success Metrics

- [ ] Event ingestion API latency p95 <200ms (not yet benchmarked)
- [ ] Query response time <3s for 10M events (query interface not yet built)
- [ ] Successfully ingest 10,000 events/min (not yet load tested)
- [x] Zero data loss with idempotency testing (skipDuplicates on eventId; tested in events.test.ts)
- [ ] 80%+ test coverage (event ingestion well-covered; query/segments/quality not yet tested)
- [ ] All E2E user flows passing (event flow covered; query/schema/segment/export flows pending)
- [ ] Successfully export segments in <2 minutes (export not yet implemented)
- [ ] Data quality dashboard updates within 5 minutes (metrics written; dashboard page not yet built)

## Next Steps

1. Review and approve this technical plan
2. Set up development environment (Next.js, PostgreSQL, Prisma)
3. Begin Phase 1 implementation
4. Create data-model.md with detailed Prisma schema
5. Create api-contracts.md with complete API specifications
6. Use `/speckit.tasks` to break down phases into specific implementation tasks
