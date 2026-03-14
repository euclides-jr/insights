import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid() {
  return randomBytes(16).toString('hex');
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(d: number, jitterHours = 0): Date {
  const ms = Date.now() - d * 86_400_000 - jitterHours * 3_600_000;
  return new Date(ms);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Seed ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database…');

  // ── 1. Applications ────────────────────────────────────────────────────────
  const [webApp, mobileApp, adminApp] = await Promise.all([
    prisma.application.upsert({
      where: { apiKey: 'demo_app_key_123' },
      update: { name: 'Demo Web App' },
      create: { name: 'Demo Web App', apiKey: 'demo_app_key_123' },
    }),
    prisma.application.upsert({
      where: { apiKey: 'mobile_app_key_456' },
      update: { name: 'EventPulse iOS' },
      create: { name: 'EventPulse iOS', apiKey: 'mobile_app_key_456' },
    }),
    prisma.application.upsert({
      where: { apiKey: 'admin_app_key_789' },
      update: { name: 'Admin Dashboard' },
      create: { name: 'Admin Dashboard', apiKey: 'admin_app_key_789' },
    }),
  ]);

  console.log(
    '✅ Applications:',
    [webApp.name, mobileApp.name, adminApp.name].join(', '),
  );

  // ── 2. Event Schemas (Web App) ─────────────────────────────────────────────
  const schemaRows = [
    {
      applicationId: webApp.id,
      eventName: 'button_click',
      version: 1,
      schemaDefinition: {
        properties: {
          buttonId: { type: 'string', required: true },
          page: { type: 'string', required: true },
          label: { type: 'string', required: false },
        },
      },
      isActive: true,
    },
    {
      applicationId: webApp.id,
      eventName: 'purchase',
      version: 1,
      schemaDefinition: {
        properties: {
          amount: { type: 'number', required: true },
          currency: { type: 'string', required: true },
          productId: { type: 'string', required: true },
          quantity: { type: 'number', required: false },
          coupon: { type: 'string', required: false },
        },
      },
      isActive: true,
    },
    {
      applicationId: webApp.id,
      eventName: 'page_view',
      version: 1,
      schemaDefinition: {
        properties: {
          path: { type: 'string', required: true },
          referrer: { type: 'string', required: false },
          duration: { type: 'number', required: false },
        },
      },
      isActive: true,
    },
    {
      applicationId: webApp.id,
      eventName: 'signup',
      version: 1,
      schemaDefinition: {
        properties: {
          plan: { type: 'string', required: true },
          source: { type: 'string', required: false },
          invited: { type: 'boolean', required: false },
        },
      },
      isActive: true,
    },
    {
      applicationId: mobileApp.id,
      eventName: 'app_open',
      version: 1,
      schemaDefinition: {
        properties: {
          version: { type: 'string', required: true },
          platform: { type: 'string', required: true },
          cold: { type: 'boolean', required: false },
        },
      },
      isActive: true,
    },
    {
      applicationId: mobileApp.id,
      eventName: 'push_notification_tapped',
      version: 1,
      schemaDefinition: {
        properties: {
          campaignId: { type: 'string', required: true },
          action: { type: 'string', required: false },
        },
      },
      isActive: true,
    },
  ];

  for (const s of schemaRows) {
    const existing = await prisma.eventSchema.findFirst({
      where: {
        applicationId: s.applicationId,
        eventName: s.eventName,
        version: s.version,
      },
    });
    if (!existing) {
      await prisma.eventSchema.create({
        data: s as Parameters<typeof prisma.eventSchema.create>[0]['data'],
      });
    }
  }
  console.log('✅ Event schemas created');

  // ── 3. Events ──────────────────────────────────────────────────────────────
  // 30 web users, 20 mobile users, 5 admin users
  const webUsers = Array.from({ length: 30 }, (_, i) => `web_user_${i + 1}`);
  const mobileUsers = Array.from({ length: 20 }, (_, i) => `mob_user_${i + 1}`);
  const adminUsers = Array.from({ length: 5 }, (_, i) => `adm_user_${i + 1}`);

  const pages = [
    '/',
    '/pricing',
    '/features',
    '/blog',
    '/docs',
    '/signup',
    '/login',
    '/dashboard',
  ];
  const products = [
    'prod_starter',
    'prod_pro',
    'prod_enterprise',
    'prod_addon_sso',
    'prod_addon_api',
  ];
  const plans = ['free', 'starter', 'pro', 'enterprise'];
  const sources = ['organic', 'google_ads', 'twitter', 'referral', 'email'];
  const iosPlatforms = ['iOS 17', 'iOS 16', 'iOS 15'];
  const campaigns = [
    'camp_onboarding',
    'camp_winback',
    'camp_promo_march',
    'camp_feature_launch',
  ];

  const events: {
    eventId: string;
    applicationId: string;
    eventName: string;
    userId: string;
    sessionId: string;
    timestamp: Date;
    properties: object;
  }[] = [];

  // Web: page_view — heavy traffic, spread over 30 days
  for (let d = 0; d < 30; d++) {
    const dailyViews = randInt(60, 140);
    for (let i = 0; i < dailyViews; i++) {
      events.push({
        eventId: uuid(),
        applicationId: webApp.id,
        eventName: 'page_view',
        userId: randItem(webUsers),
        sessionId: `wsess_${uuid().slice(0, 8)}`,
        timestamp: daysAgo(d, randInt(0, 23)),
        properties: {
          path: randItem(pages),
          referrer:
            Math.random() > 0.4
              ? randItem([
                  'https://google.com',
                  'https://twitter.com',
                  'https://hn.algolia.com',
                  '',
                ])
              : '',
          duration: randInt(5, 600),
        },
      });
    }
  }

  // Web: signup — 2–6 per day
  for (let d = 0; d < 30; d++) {
    const count = randInt(2, 6);
    for (let i = 0; i < count; i++) {
      events.push({
        eventId: uuid(),
        applicationId: webApp.id,
        eventName: 'signup',
        userId: randItem(webUsers),
        sessionId: `wsess_${uuid().slice(0, 8)}`,
        timestamp: daysAgo(d, randInt(0, 23)),
        properties: {
          plan: randItem(plans),
          source: randItem(sources),
          invited: Math.random() > 0.7,
        },
      });
    }
  }

  // Web: purchase — 5–15 per day, valid + a few invalid
  for (let d = 0; d < 30; d++) {
    const count = randInt(5, 15);
    for (let i = 0; i < count; i++) {
      const valid = Math.random() > 0.08; // ~8% schema violations
      events.push({
        eventId: uuid(),
        applicationId: webApp.id,
        eventName: 'purchase',
        userId: randItem(webUsers),
        sessionId: `wsess_${uuid().slice(0, 8)}`,
        timestamp: daysAgo(d, randInt(0, 23)),
        properties: valid
          ? {
              amount: parseFloat((randInt(9, 499) + Math.random()).toFixed(2)),
              currency: randItem(['USD', 'EUR', 'GBP']),
              productId: randItem(products),
              quantity: randInt(1, 4),
              coupon:
                Math.random() > 0.7
                  ? randItem(['SAVE10', 'LAUNCH20', ''])
                  : undefined,
            }
          : {
              // missing required fields — intentionally invalid
              productId: randItem(products),
              quantity: randInt(1, 4),
            },
      });
    }
  }

  // Mobile: app_open — 30–80 per day
  for (let d = 0; d < 30; d++) {
    const count = randInt(30, 80);
    for (let i = 0; i < count; i++) {
      events.push({
        eventId: uuid(),
        applicationId: mobileApp.id,
        eventName: 'app_open',
        userId: randItem(mobileUsers),
        sessionId: `msess_${uuid().slice(0, 8)}`,
        timestamp: daysAgo(d, randInt(0, 23)),
        properties: {
          version: randItem(['2.4.1', '2.4.0', '2.3.9']),
          platform: randItem(iosPlatforms),
          cold: Math.random() > 0.6,
        },
      });
    }
  }

  // Mobile: push notification taps — 10–30 per day
  for (let d = 0; d < 30; d++) {
    const count = randInt(10, 30);
    for (let i = 0; i < count; i++) {
      events.push({
        eventId: uuid(),
        applicationId: mobileApp.id,
        eventName: 'push_notification_tapped',
        userId: randItem(mobileUsers),
        sessionId: `msess_${uuid().slice(0, 8)}`,
        timestamp: daysAgo(d, randInt(0, 23)),
        properties: {
          campaignId: randItem(campaigns),
          action: randItem(['open_app', 'view_promo', 'dismiss']),
        },
      });
    }
  }

  // Admin: page_view — light traffic
  for (let d = 0; d < 30; d++) {
    const count = randInt(5, 20);
    for (let i = 0; i < count; i++) {
      events.push({
        eventId: uuid(),
        applicationId: adminApp.id,
        eventName: 'page_view',
        userId: randItem(adminUsers),
        sessionId: `asess_${uuid().slice(0, 8)}`,
        timestamp: daysAgo(d, randInt(0, 23)),
        properties: {
          path: randItem([
            '/admin',
            '/admin/users',
            '/admin/billing',
            '/admin/settings',
            '/admin/reports',
          ]),
          duration: randInt(30, 900),
        },
      });
    }
  }

  // Insert in batches of 500
  const batchSize = 500;
  for (let i = 0; i < events.length; i += batchSize) {
    await prisma.event.createMany({
      data: events.slice(i, i + batchSize),
      skipDuplicates: true,
    });
    process.stdout.write(
      `  events: ${Math.min(i + batchSize, events.length)}/${events.length}\r`,
    );
  }
  console.log(`\n✅ Created ${events.length} events`);

  // ── 4. Data Quality Metrics (30 days × 3 apps) ────────────────────────────
  const appConfigs = [
    {
      app: webApp,
      baseReceived: 180,
      baseRejected: 14,
      failRate: 0.08,
      dupRate: 0.02,
      complRate: 0.93,
    },
    {
      app: mobileApp,
      baseReceived: 120,
      baseRejected: 4,
      failRate: 0.03,
      dupRate: 0.01,
      complRate: 0.98,
    },
    {
      app: adminApp,
      baseReceived: 20,
      baseRejected: 1,
      failRate: 0.04,
      dupRate: 0.0,
      complRate: 0.99,
    },
  ];

  for (const cfg of appConfigs) {
    for (let d = 0; d < 30; d++) {
      const date = startOfDay(daysAgo(d));
      const received = randInt(
        Math.floor(cfg.baseReceived * 0.7),
        Math.ceil(cfg.baseReceived * 1.3),
      );
      const rejected = randInt(0, Math.ceil(cfg.baseRejected * 1.5));
      const jitter = () => (Math.random() - 0.5) * 0.02;

      await prisma.dataQualityMetric.upsert({
        where: { applicationId_date: { applicationId: cfg.app.id, date } },
        update: {},
        create: {
          applicationId: cfg.app.id,
          date,
          eventsReceived: received,
          eventsRejected: rejected,
          validationFailureRate: Math.max(
            0,
            Math.min(1, cfg.failRate + jitter()),
          ),
          duplicateRate: Math.max(
            0,
            Math.min(1, cfg.dupRate + Math.abs(jitter())),
          ),
          completenessRate: Math.max(0, Math.min(1, cfg.complRate + jitter())),
        },
      });
    }
  }
  console.log('✅ Data quality metrics');

  // ── 5. Segments ────────────────────────────────────────────────────────────
  const segmentDefs = [
    {
      applicationId: webApp.id,
      name: 'High-value buyers',
      description: 'Users with 3+ purchases in the last 30 days',
      criteria: {
        logic: 'AND',
        eventFilters: [
          {
            eventName: 'purchase',
            count: { min: 3 },
            timeWindow: { value: 30, unit: 'days' },
          },
        ],
      },
    },
    {
      applicationId: webApp.id,
      name: 'Recent sign-ups',
      description: 'Users who signed up in the last 7 days',
      criteria: {
        logic: 'AND',
        eventFilters: [
          {
            eventName: 'signup',
            count: { min: 1 },
            timeWindow: { value: 7, unit: 'days' },
          },
        ],
      },
    },
    {
      applicationId: webApp.id,
      name: 'Active readers',
      description: 'Users with 10+ page views in the last 14 days',
      criteria: {
        logic: 'AND',
        eventFilters: [
          {
            eventName: 'page_view',
            count: { min: 10 },
            timeWindow: { value: 14, unit: 'days' },
          },
        ],
      },
    },
    {
      applicationId: mobileApp.id,
      name: 'Push-engaged users',
      description:
        'Mobile users who tapped a push notification in the last 7 days',
      criteria: {
        logic: 'AND',
        eventFilters: [
          {
            eventName: 'push_notification_tapped',
            count: { min: 1 },
            timeWindow: { value: 7, unit: 'days' },
          },
        ],
      },
    },
    {
      applicationId: mobileApp.id,
      name: 'Daily actives',
      description:
        'Mobile users who opened the app at least once in the last 24 hours',
      criteria: {
        logic: 'AND',
        eventFilters: [
          {
            eventName: 'app_open',
            count: { min: 1 },
            timeWindow: { value: 1, unit: 'days' },
          },
        ],
      },
    },
  ];

  for (const def of segmentDefs) {
    const existing = await prisma.segment.findFirst({
      where: { applicationId: def.applicationId, name: def.name },
    });
    if (!existing) {
      await prisma.segment.create({
        data: {
          ...def,
          criteria: def.criteria as object,
          memberCount: 0,
          lastRefreshedAt: new Date(),
        },
      });
    }
  }
  console.log('✅ Segments created');

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
