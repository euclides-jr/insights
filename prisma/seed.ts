import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Seed the database with sample data for development
 */
async function main() {
  console.log('🌱 Seeding database...');

  // Create sample applications
  const demoApp = await prisma.application.upsert({
    where: { apiKey: 'demo_app_key_123' },
    update: {},
    create: {
      name: 'Demo Web App',
      apiKey: 'demo_app_key_123',
    },
  });

  const mobileApp = await prisma.application.upsert({
    where: { apiKey: 'mobile_app_key_456' },
    update: {},
    create: {
      name: 'Mobile App',
      apiKey: 'mobile_app_key_456',
    },
  });

  console.log('✅ Created applications:', { demoApp, mobileApp });

  // Create sample event schemas
  const purchaseSchema = await prisma.eventSchema.create({
    data: {
      applicationId: demoApp.id,
      eventName: 'purchase',
      version: 1,
      schemaDefinition: {
        properties: {
          amount: { type: 'number', required: true },
          currency: { type: 'string', required: true },
          productId: { type: 'string', required: true },
          quantity: { type: 'number', required: false },
        },
      },
    },
  });

  const clickSchema = await prisma.eventSchema.create({
    data: {
      applicationId: demoApp.id,
      eventName: 'button_click',
      version: 1,
      schemaDefinition: {
        properties: {
          buttonId: { type: 'string', required: true },
          page: { type: 'string', required: true },
        },
      },
    },
  });

  console.log('✅ Created event schemas:', { purchaseSchema, clickSchema });

  // Create sample events
  const now = new Date();
  const events = [];

  for (let i = 0; i < 20; i++) {
    const eventId = randomBytes(16).toString('hex');
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000); // Events spread over 20 hours

    events.push({
      eventId,
      applicationId: demoApp.id,
      eventName: i % 3 === 0 ? 'purchase' : 'button_click',
      userId: `user_${Math.floor(Math.random() * 10) + 1}`,
      sessionId: `session_${Math.floor(Math.random() * 5) + 1}`,
      timestamp,
      properties:
        i % 3 === 0
          ? {
              amount: Math.floor(Math.random() * 100) + 10,
              currency: 'USD',
              productId: `prod_${i}`,
            }
          : { buttonId: `btn_${i}`, page: '/home' },
    });
  }

  await prisma.event.createMany({
    data: events,
  });

  console.log(`✅ Created ${events.length} sample events`);

  // Create a sample segment
  const segment = await prisma.segment.create({
    data: {
      applicationId: demoApp.id,
      name: 'High-value customers',
      description: 'Users who made 3+ purchases in the last 30 days',
      criteria: {
        eventFilters: [
          {
            eventName: 'purchase',
            count: { min: 3 },
            timeWindow: { value: 30, unit: 'days' },
          },
        ],
        logic: 'AND',
      },
      memberCount: 0,
    },
  });

  console.log('✅ Created sample segment:', segment);

  // Create sample data quality metrics
  const qualityMetric = await prisma.dataQualityMetric.create({
    data: {
      applicationId: demoApp.id,
      date: new Date(now.toDateString()),
      eventsReceived: 100,
      eventsRejected: 5,
      validationFailureRate: 0.05,
      duplicateRate: 0.02,
      completenessRate: 0.98,
    },
  });

  console.log('✅ Created data quality metric:', qualityMetric);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
