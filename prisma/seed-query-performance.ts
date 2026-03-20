import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const EVENT_COUNT = parsePositiveInt(
  process.env.QUERY_PERF_EVENT_COUNT,
  10_000_000,
);
const BATCH_SIZE = parsePositiveInt(
  process.env.QUERY_PERF_BATCH_SIZE,
  250_000,
);
const USER_COUNT = parsePositiveInt(
  process.env.QUERY_PERF_USER_COUNT,
  250_000,
);
const SESSION_COUNT = parsePositiveInt(
  process.env.QUERY_PERF_SESSION_COUNT,
  1_000_000,
);
const LOOKBACK_DAYS = parsePositiveInt(
  process.env.QUERY_PERF_LOOKBACK_DAYS,
  365,
);

const APP_ID = 'query_perf_app';
const APP_NAME = 'Query Performance App';
const APP_API_KEY = 'qp_query_perf_app_key';

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function resetQueryPerfData() {
  await prisma.event.deleteMany({
    where: { applicationId: APP_ID },
  });
  await prisma.eventSchema.deleteMany({
    where: { applicationId: APP_ID },
  });
  await prisma.application.deleteMany({
    where: { id: APP_ID },
  });
}

async function seedApplication() {
  await prisma.application.create({
    data: {
      id: APP_ID,
      name: APP_NAME,
      apiKey: APP_API_KEY,
    },
  });
}

async function seedSchemas() {
  const schemas = [
    {
      eventName: 'page_view',
      schemaDefinition: {
        path: { type: 'string', required: true },
        referrer: { type: 'string' },
        browser: { type: 'string' },
        deviceType: { type: 'string' },
        country: { type: 'string' },
        durationMs: { type: 'number' },
      },
    },
    {
      eventName: 'signup',
      schemaDefinition: {
        plan: { type: 'string', required: true },
        source: { type: 'string', required: true },
        invited: { type: 'boolean' },
        companySize: { type: 'number' },
        country: { type: 'string' },
      },
    },
    {
      eventName: 'workspace_created',
      schemaDefinition: {
        template: { type: 'string', required: true },
        importedDemoData: { type: 'boolean' },
        memberCount: { type: 'number' },
        plan: { type: 'string' },
      },
    },
    {
      eventName: 'integration_connected',
      schemaDefinition: {
        integration: { type: 'string', required: true },
        category: { type: 'string' },
        success: { type: 'boolean' },
        setupMinutes: { type: 'number' },
      },
    },
    {
      eventName: 'report_exported',
      schemaDefinition: {
        format: { type: 'string', required: true },
        reportType: { type: 'string' },
        rowCount: { type: 'number' },
      },
    },
    {
      eventName: 'purchase',
      schemaDefinition: {
        amount: { type: 'number', required: true },
        currency: { type: 'string', required: true },
        plan: { type: 'string' },
        billingInterval: { type: 'string' },
      },
    },
  ];

  await prisma.eventSchema.createMany({
    data: schemas.map((schema, index) => ({
      applicationId: APP_ID,
      eventName: schema.eventName,
      version: 1,
      isActive: true,
      schemaDefinition: schema.schemaDefinition,
      createdAt: new Date(Date.now() - index * 1_000),
    })),
  });
}

async function seedEvents() {
  const startTime = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);

  for (let batchStart = 1; batchStart <= EVENT_COUNT; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, EVENT_COUNT);

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "events" (
          "id",
          "eventId",
          "applicationId",
          "eventName",
          "userId",
          "sessionId",
          "timestamp",
          "properties",
          "createdAt"
        )
        SELECT
          md5('evt-row-' || n::text),
          'qp_evt_' || n::text,
          $1,
          CASE n % 10
            WHEN 0 THEN 'purchase'
            WHEN 1 THEN 'page_view'
            WHEN 2 THEN 'page_view'
            WHEN 3 THEN 'signup'
            WHEN 4 THEN 'workspace_created'
            WHEN 5 THEN 'integration_connected'
            WHEN 6 THEN 'report_exported'
            WHEN 7 THEN 'page_view'
            WHEN 8 THEN 'integration_connected'
            ELSE 'page_view'
          END,
          'qp_user_' || (((n - 1) % $2) + 1)::text,
          'qp_session_' || (((n - 1) % $3) + 1)::text,
          $4::timestamptz + ((n - 1) * (($5::numeric * 86400) / $6::numeric)) * interval '1 second',
          jsonb_build_object(
            'plan',
            CASE n % 4
              WHEN 0 THEN 'free'
              WHEN 1 THEN 'starter'
              WHEN 2 THEN 'pro'
              ELSE 'enterprise'
            END,
            'country',
            CASE n % 8
              WHEN 0 THEN 'US'
              WHEN 1 THEN 'CA'
              WHEN 2 THEN 'GB'
              WHEN 3 THEN 'DE'
              WHEN 4 THEN 'BR'
              WHEN 5 THEN 'IN'
              WHEN 6 THEN 'AU'
              ELSE 'JP'
            END,
            'source',
            CASE n % 5
              WHEN 0 THEN 'organic'
              WHEN 1 THEN 'ads'
              WHEN 2 THEN 'partner'
              WHEN 3 THEN 'referral'
              ELSE 'sales'
            END,
            'path',
            CASE n % 6
              WHEN 0 THEN '/pricing'
              WHEN 1 THEN '/features'
              WHEN 2 THEN '/docs'
              WHEN 3 THEN '/integrations'
              WHEN 4 THEN '/dashboard'
              ELSE '/reports'
            END,
            'browser',
            CASE n % 4
              WHEN 0 THEN 'Chrome'
              WHEN 1 THEN 'Safari'
              WHEN 2 THEN 'Firefox'
              ELSE 'Edge'
            END,
            'deviceType',
            CASE n % 3
              WHEN 0 THEN 'desktop'
              WHEN 1 THEN 'mobile'
              ELSE 'tablet'
            END,
            'durationMs',
            ((n % 900) + 100),
            'template',
            CASE n % 4
              WHEN 0 THEN 'product'
              WHEN 1 THEN 'growth'
              WHEN 2 THEN 'engineering'
              ELSE 'blank'
            END,
            'integration',
            CASE n % 5
              WHEN 0 THEN 'slack'
              WHEN 1 THEN 'hubspot'
              WHEN 2 THEN 'stripe'
              WHEN 3 THEN 'salesforce'
              ELSE 'github'
            END,
            'category',
            CASE n % 4
              WHEN 0 THEN 'messaging'
              WHEN 1 THEN 'crm'
              WHEN 2 THEN 'payments'
              ELSE 'developer'
            END,
            'success',
            (n % 12) <> 0,
            'setupMinutes',
            ((n % 45) + 1),
            'format',
            CASE n % 3
              WHEN 0 THEN 'csv'
              WHEN 1 THEN 'xlsx'
              ELSE 'pdf'
            END,
            'reportType',
            CASE n % 4
              WHEN 0 THEN 'query'
              WHEN 1 THEN 'funnel'
              WHEN 2 THEN 'retention'
              ELSE 'segment'
            END,
            'rowCount',
            ((n % 5000) + 25),
            'amount',
            round((((n % 25000) + 999)::numeric / 100), 2),
            'currency',
            CASE n % 3
              WHEN 0 THEN 'USD'
              WHEN 1 THEN 'EUR'
              ELSE 'GBP'
            END,
            'billingInterval',
            CASE n % 2
              WHEN 0 THEN 'monthly'
              ELSE 'annual'
            END,
            'invited',
            (n % 7) = 0,
            'importedDemoData',
            (n % 5) = 0,
            'memberCount',
            ((n % 250) + 1),
            'companySize',
            CASE
              WHEN n % 10 = 0 THEN 1000
              WHEN n % 5 = 0 THEN 250
              ELSE 25 + (n % 75)
            END
          ),
          $4::timestamptz + ((n - 1) * (($5::numeric * 86400) / $6::numeric)) * interval '1 second'
        FROM generate_series($7::bigint, $8::bigint) AS gs(n);
      `,
      APP_ID,
      USER_COUNT,
      SESSION_COUNT,
      startTime.toISOString(),
      LOOKBACK_DAYS,
      EVENT_COUNT,
      batchStart,
      batchEnd,
    );

    const inserted = batchEnd.toLocaleString('en-US');
    const total = EVENT_COUNT.toLocaleString('en-US');
    console.log(`✅ Inserted ${inserted} / ${total} events`);
  }
}

async function main() {
  console.log('🌱 Building Query Explorer performance dataset…');
  console.log(
    `   target events=${EVENT_COUNT.toLocaleString('en-US')} batchSize=${BATCH_SIZE.toLocaleString('en-US')}`,
  );

  await resetQueryPerfData();
  console.log('✅ Cleared previous query performance dataset');

  await seedApplication();
  await seedSchemas();
  console.log('✅ Application and event schemas created');

  await seedEvents();

  const totals = await prisma.$queryRawUnsafe<
    Array<{ event_count: bigint; total_bytes: bigint }>
  >(
    `
      SELECT
        (SELECT count(*)::bigint FROM "events" WHERE "applicationId" = $1) AS event_count,
        pg_total_relation_size('events')::bigint AS total_bytes
    `,
    APP_ID,
  );

  const summary = totals[0];
  console.log('');
  console.log('🎉 Query performance dataset ready');
  console.log(`   applicationId: ${APP_ID}`);
  console.log(
    `   events: ${Number(summary.event_count).toLocaleString('en-US')}`,
  );
  console.log(
    `   events table total size: ${(Number(summary.total_bytes) / 1024 / 1024).toFixed(2)} MB`,
  );
}

main()
  .catch((error) => {
    console.error('❌ Query performance seed failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
