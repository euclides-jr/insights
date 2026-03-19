import 'dotenv/config';
import {
  Prisma,
  PrismaClient,
  SavedReportType,
  WorkspaceRole,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'crypto';
import { auth } from '../lib/auth';
import { refreshSegmentCount } from '../lib/services/segment-engine';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DAY_MS = 86_400_000;
const now = new Date();
const today = startOfDay(now);

type Tier = 'enterprise' | 'pro' | 'starter' | 'free';
type JsonMap = Record<string, Prisma.InputJsonValue>;

type UserSeed = {
  userId: string;
  plan: Tier;
  country: string;
  company: string;
  role: string;
  accountAgeDays: number;
  isTrial: boolean;
  industry: string;
  teamSize: number;
  lifecycle: 'new' | 'active' | 'power' | 'at_risk';
  changes?: Array<{
    key: string;
    oldValue: Prisma.InputJsonValue;
    newValue: Prisma.InputJsonValue;
    changedAt: Date;
  }>;
};

type EventRecord = {
  eventId: string;
  applicationId: string;
  eventName: string;
  userId: string;
  sessionId: string;
  timestamp: Date;
  properties: JsonMap;
};

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function dateDaysAgo(days: number, hour = 12, minute = 0) {
  const value = new Date(today.getTime() - days * DAY_MS);
  value.setHours(hour, minute, 0, 0);
  return value;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function resetDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "audit_log_entries",
      "invitations",
      "workspace_members",
      "saved_reports",
      "funnel_steps",
      "funnels",
      "user_attribute_schemas",
      "user_attribute_history",
      "user_profiles",
      "webhook_alerts",
      "data_quality_metrics",
      "segments",
      "event_schemas",
      "events",
      "verification",
      "account",
      "session",
      "user",
      "applications"
    RESTART IDENTITY CASCADE
  `);
}

function buildWebUsers(): UserSeed[] {
  const fixed: UserSeed[] = [
    {
      userId: 'web_user_1',
      plan: 'enterprise',
      country: 'US',
      company: 'Acme Corp',
      role: 'admin',
      accountAgeDays: 720,
      isTrial: false,
      industry: 'Fintech',
      teamSize: 420,
      lifecycle: 'power',
      changes: [
        {
          key: 'plan',
          oldValue: 'pro',
          newValue: 'enterprise',
          changedAt: dateDaysAgo(120, 11),
        },
      ],
    },
    {
      userId: 'web_user_2',
      plan: 'enterprise',
      country: 'GB',
      company: 'Sterling Cooper',
      role: 'editor',
      accountAgeDays: 540,
      isTrial: false,
      industry: 'Media',
      teamSize: 260,
      lifecycle: 'power',
    },
    {
      userId: 'web_user_3',
      plan: 'enterprise',
      country: 'DE',
      company: 'Globex',
      role: 'developer',
      accountAgeDays: 365,
      isTrial: false,
      industry: 'Manufacturing',
      teamSize: 310,
      lifecycle: 'active',
    },
    {
      userId: 'web_user_4',
      plan: 'pro',
      country: 'US',
      company: 'Hooli',
      role: 'admin',
      accountAgeDays: 180,
      isTrial: false,
      industry: 'SaaS',
      teamSize: 90,
      lifecycle: 'power',
      changes: [
        {
          key: 'plan',
          oldValue: 'starter',
          newValue: 'pro',
          changedAt: dateDaysAgo(60, 10),
        },
      ],
    },
    {
      userId: 'web_user_5',
      plan: 'pro',
      country: 'CA',
      company: 'Pied Piper',
      role: 'developer',
      accountAgeDays: 120,
      isTrial: false,
      industry: 'Developer Tools',
      teamSize: 42,
      lifecycle: 'active',
    },
    {
      userId: 'web_user_6',
      plan: 'pro',
      country: 'AU',
      company: 'Bluth Company',
      role: 'analyst',
      accountAgeDays: 90,
      isTrial: false,
      industry: 'E-commerce',
      teamSize: 75,
      lifecycle: 'active',
    },
    {
      userId: 'web_user_7',
      plan: 'starter',
      country: 'FR',
      company: 'Initech',
      role: 'editor',
      accountAgeDays: 60,
      isTrial: false,
      industry: 'SaaS',
      teamSize: 26,
      lifecycle: 'active',
    },
    {
      userId: 'web_user_8',
      plan: 'starter',
      country: 'JP',
      company: 'Umbrella',
      role: 'viewer',
      accountAgeDays: 45,
      isTrial: true,
      industry: 'Healthcare',
      teamSize: 58,
      lifecycle: 'at_risk',
      changes: [
        {
          key: 'is_trial',
          oldValue: false,
          newValue: true,
          changedAt: dateDaysAgo(7, 9),
        },
      ],
    },
    {
      userId: 'web_user_9',
      plan: 'starter',
      country: 'IN',
      company: 'Dunder Mifflin',
      role: 'analyst',
      accountAgeDays: 30,
      isTrial: true,
      industry: 'Logistics',
      teamSize: 18,
      lifecycle: 'active',
    },
    {
      userId: 'web_user_10',
      plan: 'free',
      country: 'BR',
      company: 'Vandelay Industries',
      role: 'viewer',
      accountAgeDays: 6,
      isTrial: false,
      industry: 'Retail',
      teamSize: 8,
      lifecycle: 'new',
    },
    {
      userId: 'web_user_11',
      plan: 'free',
      country: 'MX',
      company: 'Acme Corp',
      role: 'viewer',
      accountAgeDays: 4,
      isTrial: false,
      industry: 'Consulting',
      teamSize: 11,
      lifecycle: 'new',
    },
    {
      userId: 'web_user_12',
      plan: 'free',
      country: 'US',
      company: 'Initech',
      role: 'viewer',
      accountAgeDays: 2,
      isTrial: true,
      industry: 'Education',
      teamSize: 5,
      lifecycle: 'new',
      changes: [
        {
          key: 'is_trial',
          oldValue: false,
          newValue: true,
          changedAt: dateDaysAgo(1, 16),
        },
      ],
    },
  ];

  const countries = ['US', 'DE', 'GB', 'CA', 'AU', 'FR', 'JP', 'BR', 'IN', 'MX'];
  const companies = [
    'Northwind',
    'Soylent',
    'Wayne Enterprises',
    'Wonka Industries',
    'Stark Labs',
    'Initrode',
  ];
  const roles = ['viewer', 'analyst', 'editor', 'developer', 'admin'];
  const industries = [
    'SaaS',
    'E-commerce',
    'Fintech',
    'Healthcare',
    'Education',
    'Media',
  ];
  const plans: Tier[] = ['enterprise', 'pro', 'starter', 'free'];
  const lifecycles: UserSeed['lifecycle'][] = ['active', 'active', 'power', 'at_risk'];

  for (let index = 13; index <= 30; index += 1) {
    const plan = plans[(index - 13) % plans.length];
    fixed.push({
      userId: `web_user_${index}`,
      plan,
      country: countries[index % countries.length],
      company: companies[index % companies.length],
      role: roles[index % roles.length],
      accountAgeDays: 10 + ((index - 13) * 2),
      isTrial: plan === 'free' || index % 5 === 0,
      industry: industries[index % industries.length],
      teamSize: 6 + index * 3,
      lifecycle: lifecycles[index % lifecycles.length],
    });
  }

  return fixed;
}

function pushEvent(
  events: EventRecord[],
  sequence: { value: number },
  applicationId: string,
  eventName: string,
  userId: string,
  timestamp: Date,
  properties: JsonMap,
  sessionKey: string,
) {
  sequence.value += 1;
  events.push({
    eventId: `seed_${sequence.value.toString().padStart(6, '0')}`,
    applicationId,
    eventName,
    userId,
    sessionId: sessionKey,
    timestamp,
    properties,
  });
}

function buildWebEvents(applicationId: string, users: UserSeed[]) {
  const events: EventRecord[] = [];
  const sequence = { value: 0 };

  const pagePaths = ['/', '/pricing', '/docs', '/features', '/integrations', '/dashboard'];
  const referrers = ['https://google.com', 'https://news.ycombinator.com', 'https://x.com', ''];
  const buttonIds = ['cta_start_trial', 'cta_view_demo', 'upgrade_plan', 'invite_teammate'];
  const currencies = ['USD', 'EUR', 'GBP'];

  users.forEach((user, index) => {
    const signupAt = dateDaysAgo(user.accountAgeDays, 9 + (index % 4), 10);
    const signedUpDaysAgo = Math.max(0, Math.floor((today.getTime() - signupAt.getTime()) / DAY_MS));
    const sessionBase = `websess_${user.userId}`;

    pushEvent(
      events,
      sequence,
      applicationId,
      'signup',
      user.userId,
      signupAt,
      {
        plan: user.plan,
        source: index % 4 === 0 ? 'organic' : index % 4 === 1 ? 'google_ads' : index % 4 === 2 ? 'referral' : 'email',
        invited: jsonValue(index % 6 === 0),
      },
      `${sessionBase}_signup`,
    );

    if (index % 5 !== 4) {
      pushEvent(
        events,
        sequence,
        applicationId,
        'button_click',
        user.userId,
        addMinutes(signupAt, 15),
        {
          buttonId: buttonIds[index % buttonIds.length],
          page: '/signup',
          label: 'Complete onboarding',
        },
        `${sessionBase}_signup`,
      );
    }

    const pageViewBase =
      user.plan === 'enterprise' ? 4 : user.plan === 'pro' ? 3 : user.plan === 'starter' ? 2 : 1;
    const purchaseBase =
      user.plan === 'enterprise' ? 4 : user.plan === 'pro' ? 3 : user.plan === 'starter' ? 1 : 0;

    for (let day = 0; day <= 34; day += 1) {
      if (day > signedUpDaysAgo) continue;

      const viewCount = Math.max(1, pageViewBase + ((index + day) % 3) - 1);
      for (let viewIndex = 0; viewIndex < viewCount; viewIndex += 1) {
        pushEvent(
          events,
          sequence,
          applicationId,
          'page_view',
          user.userId,
          dateDaysAgo(day, 8 + ((index + viewIndex) % 10), (viewIndex * 11) % 60),
          {
            path: pagePaths[(index + day + viewIndex) % pagePaths.length],
            referrer: referrers[(index + viewIndex) % referrers.length],
            duration: 20 + ((index + day + viewIndex) % 18) * 18,
          },
          `${sessionBase}_${day}`,
        );
      }

      if (day <= 21 && (index + day) % 6 === 0) {
        pushEvent(
          events,
          sequence,
          applicationId,
          'button_click',
          user.userId,
          dateDaysAgo(day, 14, 5 + ((index + day) % 30)),
          {
            buttonId: day % 2 === 0 ? 'upgrade_plan' : 'invite_teammate',
            page: day % 2 === 0 ? '/pricing' : '/settings/members',
            label: day % 2 === 0 ? 'Upgrade now' : 'Invite teammate',
          },
          `${sessionBase}_${day}`,
        );
      }
    }

    for (let purchaseIndex = 0; purchaseIndex < purchaseBase; purchaseIndex += 1) {
      const purchaseDay = 3 + purchaseIndex * 6 + (index % 4);
      if (purchaseDay > 34 || purchaseDay > signedUpDaysAgo) continue;

      const eventTime = dateDaysAgo(purchaseDay, 16, purchaseIndex * 9);
      pushEvent(
        events,
        sequence,
        applicationId,
        'purchase',
        user.userId,
        eventTime,
        {
          amount:
            user.plan === 'enterprise'
              ? 299 + purchaseIndex * 40
              : user.plan === 'pro'
                ? 129 + purchaseIndex * 20
                : 49 + purchaseIndex * 5,
          currency: currencies[purchaseIndex % currencies.length],
          productId:
            user.plan === 'enterprise'
              ? 'prod_enterprise'
              : user.plan === 'pro'
                ? 'prod_pro'
                : 'prod_starter',
          quantity: 1 + (purchaseIndex % 2),
          coupon: purchaseIndex === 0 && user.plan === 'starter' ? 'START10' : '',
        },
        `${sessionBase}_purchase_${purchaseDay}`,
      );
    }
  });

  return events;
}

function buildMobileEvents(applicationId: string) {
  const events: EventRecord[] = [];
  const sequence = { value: 20_000 };
  const users = Array.from({ length: 20 }, (_, index) => `mob_user_${index + 1}`);
  const versions = ['3.2.1', '3.2.0', '3.1.8'];
  const platforms = ['iOS 17', 'iOS 16'];
  const campaigns = ['welcome_back', 'feature_launch', 'upgrade_prompt'];

  users.forEach((userId, index) => {
    const firstOpenDay = 2 + (index % 18);
    const firstOpenAt = dateDaysAgo(firstOpenDay, 7 + (index % 5), 20);

    pushEvent(
      events,
      sequence,
      applicationId,
      'app_open',
      userId,
      firstOpenAt,
      {
        version: versions[index % versions.length],
        platform: platforms[index % platforms.length],
        cold: true,
      },
      `mobile_${userId}_first_open`,
    );

    for (let day = 0; day <= 34; day += 1) {
      if (day > firstOpenDay) continue;

      const openCount = 1 + (((index * 2) + day) % 3);
      for (let openIndex = 0; openIndex < openCount; openIndex += 1) {
        pushEvent(
          events,
          sequence,
          applicationId,
          'app_open',
          userId,
          dateDaysAgo(day, 8 + openIndex * 4, (index * 7 + openIndex * 10) % 60),
          {
            version: versions[(index + day) % versions.length],
            platform: platforms[index % platforms.length],
            cold: false,
          },
          `mobile_${userId}_${day}`,
        );
      }

      if ((index + day) % 4 === 0) {
        pushEvent(
          events,
          sequence,
          applicationId,
          'push_notification_tapped',
          userId,
          dateDaysAgo(day, 12, (index * 9) % 60),
          {
            campaignId: campaigns[(index + day) % campaigns.length],
            action: day % 2 === 0 ? 'open_app' : 'view_offer',
          },
          `mobile_${userId}_${day}`,
        );
      }
    }

    if (index < 8) {
      pushEvent(
        events,
        sequence,
        applicationId,
        'subscription_started',
        userId,
        dateDaysAgo(14 + (index % 5), 18, 0),
        {
          plan: index % 2 === 0 ? 'starter' : 'pro',
          billingPeriod: index % 3 === 0 ? 'annual' : 'monthly',
        },
        `mobile_${userId}_subscription`,
      );
    }
  });

  return events;
}

function buildAdminEvents(applicationId: string) {
  const events: EventRecord[] = [];
  const sequence = { value: 40_000 };
  const users = Array.from({ length: 5 }, (_, index) => `adm_user_${index + 1}`);
  const pages = ['/admin', '/admin/quality', '/admin/reports', '/admin/settings/members'];

  users.forEach((userId, index) => {
    for (let day = 0; day <= 34; day += 1) {
      const pageViews = 1 + ((index + day) % 2);
      for (let pageIndex = 0; pageIndex < pageViews; pageIndex += 1) {
        pushEvent(
          events,
          sequence,
          applicationId,
          'page_view',
          userId,
          dateDaysAgo(day, 9 + pageIndex * 3, (index * 12 + pageIndex * 15) % 60),
          {
            path: pages[(index + day + pageIndex) % pages.length],
            duration: 90 + ((index + day + pageIndex) % 8) * 25,
          },
          `admin_${userId}_${day}`,
        );
      }

      if ((index + day) % 7 === 0) {
        pushEvent(
          events,
          sequence,
          applicationId,
          'report_exported',
          userId,
          dateDaysAgo(day, 16, 10),
          {
            format: day % 2 === 0 ? 'csv' : 'json',
            reportType: day % 3 === 0 ? 'funnel' : 'quality',
          },
          `admin_${userId}_${day}`,
        );
      }
    }
  });

  return events;
}

function buildAttributePayload(user: UserSeed): JsonMap {
  return {
    plan: user.plan,
    country: user.country,
    company: user.company,
    role: user.role,
    account_age_days: user.accountAgeDays,
    is_trial: user.isTrial,
    signed_up_at: dateDaysAgo(user.accountAgeDays, 9, 10).toISOString(),
    industry: user.industry,
    team_size: user.teamSize,
    lifecycle_stage: user.lifecycle,
  };
}

async function seedWorkspaceUsers() {
  const adminEmail = process.env.AUTH_ADMIN_EMAIL ?? 'admin@eventpulse.local';
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? 'changeme12345';
  const adminName = process.env.AUTH_ADMIN_NAME ?? 'EventPulse Admin';
  const editorEmail = 'editor@eventpulse.local';
  const viewerEmail = 'viewer@eventpulse.local';

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
        password: adminPassword,
        name: 'EventPulse Editor',
      },
    }),
    auth.api.signUpEmail({
      body: {
        email: viewerEmail,
        password: adminPassword,
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

  await prisma.workspaceMember.createMany({
    data: [
      {
        userId: adminUser.id,
        role: WorkspaceRole.ADMIN,
      },
      {
        userId: editorUser.id,
        role: WorkspaceRole.EDITOR,
        invitedByUserId: adminUser.id,
      },
      {
        userId: viewerUser.id,
        role: WorkspaceRole.VIEWER,
        invitedByUserId: adminUser.id,
      },
    ],
  });

  return { adminUser, editorUser, viewerUser, adminEmail, editorEmail, viewerEmail };
}

async function main() {
  console.log('🌱 Rebuilding seed dataset…');

  await resetDatabase();
  console.log('✅ Cleared existing data');

  const [webApp, mobileApp, adminApp] = await Promise.all([
    prisma.application.create({
      data: {
        name: 'Demo Web App',
        apiKey: 'demo_app_key_123',
        status: 'ACTIVE',
      },
    }),
    prisma.application.create({
      data: {
        name: 'EventPulse iOS',
        apiKey: 'mobile_app_key_456',
        status: 'ACTIVE',
      },
    }),
    prisma.application.create({
      data: {
        name: 'Admin Dashboard',
        apiKey: 'admin_app_key_789',
        status: 'INACTIVE',
      },
    }),
  ]);
  console.log('✅ Applications created');

  const { adminUser, editorUser, viewerUser, adminEmail, editorEmail, viewerEmail } =
    await seedWorkspaceUsers();
  console.log(
    `✅ Workspace users created: ${adminEmail}, ${editorEmail}, ${viewerEmail}`,
  );

  await prisma.eventSchema.createMany({
    data: [
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
            source: { type: 'string', required: true },
            invited: { type: 'boolean', required: false },
          },
        },
        isActive: true,
      },
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
          },
        },
        isActive: false,
      },
      {
        applicationId: webApp.id,
        eventName: 'purchase',
        version: 2,
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
      {
        applicationId: mobileApp.id,
        eventName: 'subscription_started',
        version: 1,
        schemaDefinition: {
          properties: {
            plan: { type: 'string', required: true },
            billingPeriod: { type: 'string', required: true },
          },
        },
        isActive: true,
      },
      {
        applicationId: adminApp.id,
        eventName: 'page_view',
        version: 1,
        schemaDefinition: {
          properties: {
            path: { type: 'string', required: true },
            duration: { type: 'number', required: false },
          },
        },
        isActive: true,
      },
      {
        applicationId: adminApp.id,
        eventName: 'report_exported',
        version: 1,
        schemaDefinition: {
          properties: {
            format: { type: 'string', required: true },
            reportType: { type: 'string', required: true },
          },
        },
        isActive: true,
      },
    ],
  });
  console.log('✅ Event schemas created');

  const webUsers = buildWebUsers();
  const events = [
    ...buildWebEvents(webApp.id, webUsers),
    ...buildMobileEvents(mobileApp.id),
    ...buildAdminEvents(adminApp.id),
  ].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());

  for (let index = 0; index < events.length; index += 500) {
    await prisma.event.createMany({
      data: events.slice(index, index + 500),
      skipDuplicates: true,
    });
  }
  console.log(`✅ Events created (${events.length})`);

  const eventStats = new Map<
    string,
    { firstSeen: Date; lastSeen: Date; eventCount: number; lastEventName: string }
  >();

  for (const event of events) {
    const key = `${event.applicationId}:${event.userId}`;
    const current = eventStats.get(key);

    if (!current) {
      eventStats.set(key, {
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
        eventCount: 1,
        lastEventName: event.eventName,
      });
      continue;
    }

    current.eventCount += 1;
    if (event.timestamp < current.firstSeen) current.firstSeen = event.timestamp;
    if (event.timestamp >= current.lastSeen) {
      current.lastSeen = event.timestamp;
      current.lastEventName = event.eventName;
    }
  }

  await prisma.userAttributeSchema.createMany({
    data: [
      {
        applicationId: webApp.id,
        attributeKey: 'plan',
        valueType: 'STRING',
        description: 'Current subscription plan',
        isIndexed: true,
      },
      {
        applicationId: webApp.id,
        attributeKey: 'country',
        valueType: 'STRING',
        description: 'Primary user country',
        isIndexed: true,
      },
      {
        applicationId: webApp.id,
        attributeKey: 'company',
        valueType: 'STRING',
        description: 'Associated company name',
        isIndexed: false,
      },
      {
        applicationId: webApp.id,
        attributeKey: 'role',
        valueType: 'STRING',
        description: 'User role in account',
        isIndexed: false,
      },
      {
        applicationId: webApp.id,
        attributeKey: 'account_age_days',
        valueType: 'NUMBER',
        description: 'Days since original signup',
        isIndexed: false,
      },
      {
        applicationId: webApp.id,
        attributeKey: 'is_trial',
        valueType: 'BOOLEAN',
        description: 'Whether the user is currently on trial',
        isIndexed: false,
      },
      {
        applicationId: webApp.id,
        attributeKey: 'signed_up_at',
        valueType: 'DATE',
        description: 'Original signup timestamp',
        isIndexed: false,
      },
      {
        applicationId: webApp.id,
        attributeKey: 'industry',
        valueType: 'STRING',
        description: 'Customer industry vertical',
        isIndexed: false,
      },
      {
        applicationId: webApp.id,
        attributeKey: 'team_size',
        valueType: 'NUMBER',
        description: 'Estimated account team size',
        isIndexed: false,
      },
      {
        applicationId: webApp.id,
        attributeKey: 'lifecycle_stage',
        valueType: 'STRING',
        description: 'Customer lifecycle segment',
        isIndexed: false,
      },
    ],
  });

  for (const user of webUsers) {
    const attributes = buildAttributePayload(user);
    const stat =
      eventStats.get(`${webApp.id}:${user.userId}`) ?? {
        firstSeen: dateDaysAgo(user.accountAgeDays, 9, 10),
        lastSeen: dateDaysAgo(0, 12, 0),
        eventCount: 0,
        lastEventName: 'signup',
      };

    await prisma.userProfile.create({
      data: {
        applicationId: webApp.id,
        userId: user.userId,
        firstSeen: stat.firstSeen,
        lastSeen: stat.lastSeen,
        eventCount: stat.eventCount,
        lastEventName: stat.lastEventName,
        attributes,
      },
    });

    const baseTimestamp = dateDaysAgo(user.accountAgeDays, 9, 10);
    for (const [key, value] of Object.entries(attributes)) {
      await prisma.userAttributeHistory.create({
        data: {
          applicationId: webApp.id,
          userId: user.userId,
          attributeKey: key,
          oldValue: Prisma.JsonNull,
          newValue: value,
          changedAt: baseTimestamp,
        },
      });
    }

    for (const change of user.changes ?? []) {
      await prisma.userAttributeHistory.create({
        data: {
          applicationId: webApp.id,
          userId: user.userId,
          attributeKey: change.key,
          oldValue: change.oldValue,
          newValue: change.newValue,
          changedAt: change.changedAt,
        },
      });
    }
  }
  console.log(`✅ Web user profiles seeded (${webUsers.length})`);

  const mobileCountries = ['US', 'CA', 'GB', 'DE', 'AU', 'JP'];
  for (let index = 0; index < 20; index += 1) {
    const userId = `mob_user_${index + 1}`;
    const stat = eventStats.get(`${mobileApp.id}:${userId}`);
    if (!stat) continue;

    await prisma.userProfile.create({
      data: {
        applicationId: mobileApp.id,
        userId,
        firstSeen: stat.firstSeen,
        lastSeen: stat.lastSeen,
        eventCount: stat.eventCount,
        lastEventName: stat.lastEventName,
        attributes: {
          plan: index < 8 ? (index % 2 === 0 ? 'starter' : 'pro') : 'free',
          country: mobileCountries[index % mobileCountries.length],
        },
      },
    });
  }
  console.log('✅ Mobile user profiles seeded');

  const qualityConfigs = [
    {
      appId: webApp.id,
      warningDays: new Set([7, 16, 27]),
      alertDays: new Set([3, 11]),
      rejectionBase: 4,
      completenessBase: 0.982,
      duplicateBase: 0.008,
    },
    {
      appId: mobileApp.id,
      warningDays: new Set([6, 18]),
      alertDays: new Set<number>(),
      rejectionBase: 1,
      completenessBase: 0.991,
      duplicateBase: 0.004,
    },
    {
      appId: adminApp.id,
      warningDays: new Set([8]),
      alertDays: new Set([22]),
      rejectionBase: 1,
      completenessBase: 0.995,
      duplicateBase: 0.002,
    },
  ];

  for (let day = 0; day <= 34; day += 1) {
    const dayStart = dateDaysAgo(day, 0, 0);
    const dayEnd = addDays(dayStart, 1);

    for (const config of qualityConfigs) {
      const accepted = events.filter(
        (event) =>
          event.applicationId === config.appId &&
          event.timestamp >= dayStart &&
          event.timestamp < dayEnd,
      ).length;

      const rejected = config.alertDays.has(day)
        ? config.rejectionBase + 18
        : config.warningDays.has(day)
          ? config.rejectionBase + 8
          : config.rejectionBase + (day % 3);

      const received = accepted + rejected;
      const failureRate = received === 0 ? 0 : rejected / received;
      const completenessRate = Math.max(
        0.82,
        config.completenessBase -
          (config.alertDays.has(day) ? 0.09 : config.warningDays.has(day) ? 0.04 : 0) -
          ((day % 4) * 0.002),
      );
      const duplicateRate =
        config.duplicateBase +
        (config.alertDays.has(day) ? 0.03 : config.warningDays.has(day) ? 0.012 : 0.003);

      await prisma.dataQualityMetric.create({
        data: {
          applicationId: config.appId,
          date: dayStart,
          eventsReceived: received,
          eventsRejected: rejected,
          validationFailureRate: Number(failureRate.toFixed(4)),
          duplicateRate: Number(duplicateRate.toFixed(4)),
          completenessRate: Number(completenessRate.toFixed(4)),
        },
      });
    }
  }
  console.log('✅ Data quality metrics created');

  const segments = await Promise.all([
    prisma.segment.create({
      data: {
        applicationId: webApp.id,
        name: 'High-value buyers',
        description: 'Users with 3 or more purchases in the last 30 days',
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
    }),
    prisma.segment.create({
      data: {
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
    }),
    prisma.segment.create({
      data: {
        applicationId: webApp.id,
        name: 'Active readers',
        description: 'Users with at least 10 page views in the last 14 days',
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
    }),
    prisma.segment.create({
      data: {
        applicationId: mobileApp.id,
        name: 'Push-engaged users',
        description: 'Users who tapped a push notification in the last 14 days',
        criteria: {
          logic: 'AND',
          eventFilters: [
            {
              eventName: 'push_notification_tapped',
              count: { min: 1 },
              timeWindow: { value: 14, unit: 'days' },
            },
          ],
        },
      },
    }),
  ]);

  for (const segment of segments) {
    await refreshSegmentCount(segment.id);
  }
  console.log('✅ Segments created and refreshed');

  await prisma.webhookAlert.createMany({
    data: [
      {
        applicationId: webApp.id,
        name: 'Slack Data Alerts',
        url: 'https://alerts.example.com/slack/web',
        secret: 'seed_webhook_secret_web',
        minLevel: 'warning',
        isActive: true,
        lastTriggeredAt: dateDaysAgo(1, 13),
        lastStatus: 204,
      },
      {
        applicationId: webApp.id,
        name: 'PagerDuty Escalation',
        url: 'https://alerts.example.com/pagerduty/web',
        secret: 'seed_webhook_secret_pd',
        minLevel: 'error',
        isActive: true,
        lastTriggeredAt: dateDaysAgo(3, 8),
        lastStatus: 500,
      },
      {
        applicationId: mobileApp.id,
        name: 'Mobile Ops Alert',
        url: 'https://alerts.example.com/slack/mobile',
        secret: null,
        minLevel: 'error',
        isActive: false,
        lastTriggeredAt: dateDaysAgo(5, 10),
        lastStatus: 202,
      },
    ],
  });
  console.log('✅ Webhooks created');

  await prisma.funnel.create({
    data: {
      id: 'seed_signup_activation_funnel',
      applicationId: webApp.id,
      name: 'Signup Activation',
      description: 'How signups progress into product interaction and purchase',
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

  await prisma.funnel.create({
    data: {
      applicationId: mobileApp.id,
      name: 'Mobile Re-engagement',
      description: 'Push notification tap-through into subscription start',
      createdByUserId: editorUser.id,
      steps: {
        create: [
          { position: 1, eventName: 'push_notification_tapped' },
          { position: 2, eventName: 'app_open' },
          { position: 3, eventName: 'subscription_started' },
        ],
      },
    },
  });

  await prisma.savedReport.createMany({
    data: [
      {
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
      {
        name: 'Web Retention (8w)',
        reportType: SavedReportType.RETENTION,
        applicationId: webApp.id,
        createdByUserId: editorUser.id,
        updatedByUserId: editorUser.id,
        config: {
          applicationId: webApp.id,
          interval: 'weekly',
          cohortWindow: { value: 8, unit: 'weeks' },
          returnEventName: 'page_view',
        },
      },
      {
        name: 'Revenue by Event',
        reportType: SavedReportType.QUERY,
        applicationId: webApp.id,
        createdByUserId: adminUser.id,
        updatedByUserId: viewerUser.id,
        config: {
          applicationId: webApp.id,
          metric: 'count',
          groupBy: 'eventName',
          filters: [{ key: 'eventName', operator: 'in', value: ['purchase', 'signup'] }],
        },
      },
    ],
  });
  console.log('✅ Funnels and reports created');

  await prisma.invitation.create({
    data: {
      email: 'pending-analyst@eventpulse.local',
      role: WorkspaceRole.EDITOR,
      tokenHash: hashToken('seed-invite-pending-analyst'),
      invitedByUserId: adminUser.id,
      expiresAt: addDays(today, 7),
    },
  });

  await prisma.auditLogEntry.createMany({
    data: [
      {
        actorUserId: adminUser.id,
        action: 'workspace.member.invited',
        targetType: 'invitation',
        metadata: {
          email: 'pending-analyst@eventpulse.local',
          role: 'EDITOR',
        },
      },
      {
        actorUserId: adminUser.id,
        action: 'funnel.created',
        targetType: 'funnel',
        targetId: 'seed_signup_activation_funnel',
        metadata: { name: 'Signup Activation' },
      },
      {
        actorUserId: editorUser.id,
        action: 'report.created',
        targetType: 'saved_report',
        metadata: { name: 'Web Retention (8w)', type: 'RETENTION' },
      },
    ],
  });
  console.log('✅ Invitations and audit entries created');

  console.log('\n🎉 Seed complete');
  console.log(`   Applications: 3`);
  console.log(`   Events: ${events.length}`);
  console.log(`   Web users: ${webUsers.length}`);
  console.log(`   Funnels: 2`);
  console.log(`   Saved reports: 3`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
