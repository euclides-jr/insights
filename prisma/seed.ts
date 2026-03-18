import 'dotenv/config';
import {
  PrismaClient,
  Prisma,
  SavedReportType,
  WorkspaceRole,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { auth } from '../lib/auth';
import { refreshSegmentCount } from '../lib/services/segment-engine';

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

  const adminEmail = process.env.AUTH_ADMIN_EMAIL ?? 'admin@eventpulse.local';
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? 'changeme12345';
  const adminName = process.env.AUTH_ADMIN_NAME ?? 'EventPulse Admin';
  const editorEmail = 'editor@eventpulse.local';
  const viewerEmail = 'viewer@eventpulse.local';
  const sharedPassword = process.env.AUTH_ADMIN_PASSWORD ?? 'changeme12345';

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

  await prisma.user.deleteMany({
    where: {
      email: {
        in: [adminEmail, editorEmail, viewerEmail],
      },
    },
  });

  await Promise.all([
    auth.api.signUpEmail({
      body: {
        email: adminEmail,
        password: adminPassword,
        name: adminName,
      },
    }),
    auth.api.signUpEmail({
      body: {
        email: editorEmail,
        password: sharedPassword,
        name: 'EventPulse Editor',
      },
    }),
    auth.api.signUpEmail({
      body: {
        email: viewerEmail,
        password: sharedPassword,
        name: 'EventPulse Viewer',
      },
    }),
  ]);

  await prisma.user.updateMany({
    where: {
      email: {
        in: [adminEmail, editorEmail, viewerEmail],
      },
    },
    data: { emailVerified: true },
  });

  const [adminUser, editorUser, viewerUser] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: adminEmail } }),
    prisma.user.findUniqueOrThrow({ where: { email: editorEmail } }),
    prisma.user.findUniqueOrThrow({ where: { email: viewerEmail } }),
  ]);

  await prisma.workspaceMember.upsert({
    where: { userId: adminUser.id },
    update: { role: WorkspaceRole.ADMIN, invitedByUserId: null },
    create: { userId: adminUser.id, role: WorkspaceRole.ADMIN },
  });

  await prisma.workspaceMember.upsert({
    where: { userId: editorUser.id },
    update: {
      role: WorkspaceRole.EDITOR,
      invitedByUserId: adminUser.id,
    },
    create: {
      userId: editorUser.id,
      role: WorkspaceRole.EDITOR,
      invitedByUserId: adminUser.id,
    },
  });

  await prisma.workspaceMember.upsert({
    where: { userId: viewerUser.id },
    update: {
      role: WorkspaceRole.VIEWER,
      invitedByUserId: adminUser.id,
    },
    create: {
      userId: viewerUser.id,
      role: WorkspaceRole.VIEWER,
      invitedByUserId: adminUser.id,
    },
  });

  console.log(
    `✅ Auth users: ${adminEmail} (admin), ${editorEmail} (editor), ${viewerEmail} (viewer)`,
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
    let seg = await prisma.segment.findFirst({
      where: { applicationId: def.applicationId, name: def.name },
    });
    if (!seg) {
      seg = await prisma.segment.create({
        data: {
          ...def,
          criteria: def.criteria as object,
          memberCount: 0,
          lastRefreshedAt: new Date(),
        },
      });
    }
    // Evaluate criteria against real event data so memberCount is accurate
    await refreshSegmentCount(seg.id);
  }
  console.log('✅ Segments created');

  // ── 6. User Profiles (User Attributes) ────────────────────────────────────
  // Seed representative user attribute profiles for the web app so the
  // /users dashboard and API tests have meaningful data to query against.

  const countries = [
    'US',
    'GB',
    'DE',
    'FR',
    'CA',
    'AU',
    'JP',
    'BR',
    'IN',
    'MX',
  ];
  const companies = [
    'Acme Corp',
    'Globex',
    'Initech',
    'Umbrella',
    'Hooli',
    'Pied Piper',
    'Dunder Mifflin',
    'Vandelay Industries',
    'Sterling Cooper',
    'Bluth Company',
  ];
  const roles = ['admin', 'editor', 'viewer', 'developer', 'analyst'];

  // ── Type-schema registry entries ──────────────────────────────────────────
  const schemaEntries = [
    {
      attributeKey: 'plan',
      valueType: 'STRING' as const,
      description: 'Subscription plan tier',
      isIndexed: true,
    },
    {
      attributeKey: 'country',
      valueType: 'STRING' as const,
      description: 'ISO 3166-1 alpha-2 country code',
      isIndexed: true,
    },
    {
      attributeKey: 'company',
      valueType: 'STRING' as const,
      description: 'Organisation name',
      isIndexed: false,
    },
    {
      attributeKey: 'role',
      valueType: 'STRING' as const,
      description: 'User role within org',
      isIndexed: false,
    },
    {
      attributeKey: 'account_age_days',
      valueType: 'NUMBER' as const,
      description: 'Days since account creation',
      isIndexed: false,
    },
    {
      attributeKey: 'is_trial',
      valueType: 'BOOLEAN' as const,
      description: 'Whether user is on trial',
      isIndexed: false,
    },
    {
      attributeKey: 'signed_up_at',
      valueType: 'DATE' as const,
      description: 'ISO 8601 signup timestamp',
      isIndexed: false,
    },
  ];

  for (const entry of schemaEntries) {
    await prisma.userAttributeSchema.upsert({
      where: {
        applicationId_attributeKey: {
          applicationId: webApp.id,
          attributeKey: entry.attributeKey,
        },
      },
      update: {
        valueType: entry.valueType,
        description: entry.description,
        isIndexed: entry.isIndexed,
      },
      create: { applicationId: webApp.id, ...entry },
    });
  }
  console.log('✅ Attribute schemas registered');

  // ── Representative profiles — one per plan with enough variety for filtering tests ──
  type ProfileDef = {
    userId: string;
    attributes: Record<string, unknown>;
  };

  const profileDefs: ProfileDef[] = [
    // ── Enterprise users ──
    {
      userId: 'web_user_1',
      attributes: {
        plan: 'enterprise',
        country: 'US',
        company: 'Acme Corp',
        role: 'admin',
        account_age_days: 720,
        is_trial: false,
        signed_up_at: daysAgo(720).toISOString(),
      },
    },
    {
      userId: 'web_user_2',
      attributes: {
        plan: 'enterprise',
        country: 'GB',
        company: 'Sterling Cooper',
        role: 'editor',
        account_age_days: 540,
        is_trial: false,
        signed_up_at: daysAgo(540).toISOString(),
      },
    },
    {
      userId: 'web_user_3',
      attributes: {
        plan: 'enterprise',
        country: 'DE',
        company: 'Globex',
        role: 'developer',
        account_age_days: 365,
        is_trial: false,
        signed_up_at: daysAgo(365).toISOString(),
      },
    },
    // ── Pro users ──
    {
      userId: 'web_user_4',
      attributes: {
        plan: 'pro',
        country: 'US',
        company: 'Hooli',
        role: 'admin',
        account_age_days: 180,
        is_trial: false,
        signed_up_at: daysAgo(180).toISOString(),
      },
    },
    {
      userId: 'web_user_5',
      attributes: {
        plan: 'pro',
        country: 'CA',
        company: 'Pied Piper',
        role: 'developer',
        account_age_days: 120,
        is_trial: false,
        signed_up_at: daysAgo(120).toISOString(),
      },
    },
    {
      userId: 'web_user_6',
      attributes: {
        plan: 'pro',
        country: 'AU',
        company: 'Bluth Company',
        role: 'analyst',
        account_age_days: 90,
        is_trial: false,
        signed_up_at: daysAgo(90).toISOString(),
      },
    },
    // ── Starter users ──
    {
      userId: 'web_user_7',
      attributes: {
        plan: 'starter',
        country: 'FR',
        company: 'Initech',
        role: 'editor',
        account_age_days: 60,
        is_trial: false,
        signed_up_at: daysAgo(60).toISOString(),
      },
    },
    {
      userId: 'web_user_8',
      attributes: {
        plan: 'starter',
        country: 'JP',
        company: 'Umbrella',
        role: 'viewer',
        account_age_days: 45,
        is_trial: true,
        signed_up_at: daysAgo(45).toISOString(),
      },
    },
    {
      userId: 'web_user_9',
      attributes: {
        plan: 'starter',
        country: 'IN',
        company: 'Dunder Mifflin',
        role: 'analyst',
        account_age_days: 30,
        is_trial: true,
        signed_up_at: daysAgo(30).toISOString(),
      },
    },
    // ── Free users ──
    {
      userId: 'web_user_10',
      attributes: {
        plan: 'free',
        country: 'BR',
        company: 'Vandelay Industries',
        role: 'viewer',
        account_age_days: 14,
        is_trial: false,
        signed_up_at: daysAgo(14).toISOString(),
      },
    },
    {
      userId: 'web_user_11',
      attributes: {
        plan: 'free',
        country: 'MX',
        company: 'Acme Corp',
        role: 'viewer',
        account_age_days: 7,
        is_trial: false,
        signed_up_at: daysAgo(7).toISOString(),
      },
    },
    {
      userId: 'web_user_12',
      attributes: {
        plan: 'free',
        country: 'US',
        company: 'Initech',
        role: 'viewer',
        account_age_days: 3,
        is_trial: true,
        signed_up_at: daysAgo(3).toISOString(),
      },
    },
  ];

  // Remaining users get randomised attributes to bulk-populate the list
  for (let i = 13; i <= 30; i++) {
    const plan = randItem([...plans]);
    profileDefs.push({
      userId: `web_user_${i}`,
      attributes: {
        plan,
        country: randItem(countries),
        company: randItem(companies),
        role: randItem(roles),
        account_age_days: randInt(1, 730),
        is_trial: Math.random() > 0.7,
        signed_up_at: daysAgo(randInt(1, 730)).toISOString(),
      },
    });
  }

  // Upsert each profile — write full attributes + derive system fields from existing events
  for (const { userId, attributes } of profileDefs) {
    const existingProfile = await prisma.userProfile.findUnique({
      where: { applicationId_userId: { applicationId: webApp.id, userId } },
    });

    // Derive firstSeen / lastSeen / eventCount from actual events in DB
    const eventAgg = await prisma.event.aggregate({
      where: { applicationId: webApp.id, userId },
      _min: { timestamp: true },
      _max: { timestamp: true },
      _count: { id: true },
    });
    const lastEvent = await prisma.event.findFirst({
      where: { applicationId: webApp.id, userId },
      orderBy: { timestamp: 'desc' },
      select: { eventName: true },
    });

    const firstSeen = eventAgg._min.timestamp ?? new Date();
    const lastSeen = eventAgg._max.timestamp ?? new Date();
    const eventCount = eventAgg._count.id;
    const lastEventName = lastEvent?.eventName ?? null;

    if (existingProfile) {
      await prisma.userProfile.update({
        where: { applicationId_userId: { applicationId: webApp.id, userId } },
        data: {
          attributes: attributes as object,
          firstSeen:
            existingProfile.firstSeen < firstSeen
              ? existingProfile.firstSeen
              : firstSeen,
          lastSeen:
            existingProfile.lastSeen > lastSeen
              ? existingProfile.lastSeen
              : lastSeen,
          eventCount: eventCount,
          lastEventName: lastEventName,
        },
      });
    } else {
      await prisma.userProfile.create({
        data: {
          applicationId: webApp.id,
          userId,
          attributes: attributes as object,
          firstSeen,
          lastSeen,
          eventCount,
          lastEventName,
        },
      });
    }

    // Write initial history entries for each attribute (old = null → new = value)
    for (const [key, value] of Object.entries(attributes)) {
      const alreadyRecorded = await prisma.userAttributeHistory.findFirst({
        where: { applicationId: webApp.id, userId, attributeKey: key },
      });
      if (!alreadyRecorded) {
        await prisma.userAttributeHistory.create({
          data: {
            applicationId: webApp.id,
            userId,
            attributeKey: key,
            oldValue: Prisma.DbNull,
            newValue: value as object,
          },
        });
      }
    }
  }
  console.log(`✅ User profiles seeded (${profileDefs.length} users)`);

  // ── Mobile user profiles (lighter — just plan + country) ─────────────────
  for (let i = 1; i <= 20; i++) {
    const userId = `mob_user_${i}`;
    const existingMob = await prisma.userProfile.findUnique({
      where: { applicationId_userId: { applicationId: mobileApp.id, userId } },
    });
    if (!existingMob) {
      const mobEventAgg = await prisma.event.aggregate({
        where: { applicationId: mobileApp.id, userId },
        _min: { timestamp: true },
        _max: { timestamp: true },
        _count: { id: true },
      });
      const mobLast = await prisma.event.findFirst({
        where: { applicationId: mobileApp.id, userId },
        orderBy: { timestamp: 'desc' },
        select: { eventName: true },
      });
      await prisma.userProfile.create({
        data: {
          applicationId: mobileApp.id,
          userId,
          attributes: {
            plan: randItem([...plans]),
            country: randItem(countries),
          } as object,
          firstSeen: mobEventAgg._min.timestamp ?? new Date(),
          lastSeen: mobEventAgg._max.timestamp ?? new Date(),
          eventCount: mobEventAgg._count.id,
          lastEventName: mobLast?.eventName ?? null,
        },
      });
    }
  }
  console.log('✅ Mobile user profiles seeded');

  await prisma.funnel.upsert({
    where: { id: 'seed_signup_activation_funnel' },
    update: {
      applicationId: webApp.id,
      name: 'Signup Activation',
      description: 'Signup to purchase conversion funnel',
      createdByUserId: adminUser.id,
      steps: {
        deleteMany: {},
        create: [
          { position: 1, eventName: 'signup' },
          { position: 2, eventName: 'button_click' },
          { position: 3, eventName: 'purchase' },
        ],
      },
    },
    create: {
      id: 'seed_signup_activation_funnel',
      applicationId: webApp.id,
      name: 'Signup Activation',
      description: 'Signup to purchase conversion funnel',
      createdByUserId: adminUser.id,
      steps: {
        create: [
          { position: 1, eventName: 'signup' },
          { position: 2, eventName: 'button_click' },
          { position: 3, eventName: 'purchase' },
        ],
      },
    },
  });

  await prisma.savedReport.upsert({
    where: { id: 'seed_signup_funnel_report' },
    update: {
      name: 'Signup Funnel (30d)',
      reportType: SavedReportType.FUNNEL,
      applicationId: webApp.id,
      createdByUserId: adminUser.id,
      updatedByUserId: adminUser.id,
      config: {
        funnelId: 'seed_signup_activation_funnel',
        timeWindow: { value: 30, unit: 'days' },
      },
    },
    create: {
      id: 'seed_signup_funnel_report',
      name: 'Signup Funnel (30d)',
      reportType: SavedReportType.FUNNEL,
      applicationId: webApp.id,
      createdByUserId: adminUser.id,
      updatedByUserId: adminUser.id,
      config: {
        funnelId: 'seed_signup_activation_funnel',
        timeWindow: { value: 30, unit: 'days' },
      },
    },
  });

  console.log('✅ Platform expansion seed data created');

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
