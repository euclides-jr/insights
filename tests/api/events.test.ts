/**
 * API Events Endpoint Tests
 *
 * Tests for POST /api/events endpoint
 * Run with: bun test tests/api/events.test.ts
 */

import { describe, it, expect } from 'vitest';
import { sessionFetch } from './helpers/session';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_API_KEY = process.env.TEST_API_KEY || 'demo_app_key_123'; // From seed file

describe('POST /api/events', () => {
  describe('Authentication', () => {
    it('should return 401 when API key is missing', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'test_event',
          userId: 'user_123',
          sessionId: 'session_456',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Missing X-API-Key header');
    });

    it('should return 401 when API key is invalid', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'invalid_key_123',
        },
        body: JSON.stringify({
          eventName: 'test_event',
          userId: 'user_123',
          sessionId: 'session_456',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Invalid API key');
    });

    it('should return 401 when only a dashboard session is present', async () => {
      const response = await sessionFetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'test_event',
          userId: 'user_123',
          sessionId: 'session_456',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Missing X-API-Key header');
    });
  });

  describe('Single Event Submission', () => {
    it('should accept a valid event', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventName: 'test_event',
          userId: 'user_123',
          sessionId: 'session_456',
          properties: {
            test: true,
            timestamp: Date.now(),
          },
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.received).toBe(1);
      expect(data.created).toBe(1);
      expect(data.applicationName).toBe('Demo Web App');
    });

    it('should auto-generate eventId if not provided', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventName: 'auto_id_event',
          userId: 'user_456',
          sessionId: 'session_789',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.created).toBe(1);
    });

    it('should accept custom eventId for idempotency', async () => {
      const customEventId = `test_event_${Date.now()}`;

      // First submission
      const response1 = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventId: customEventId,
          eventName: 'idempotent_event',
          userId: 'user_789',
          sessionId: 'session_101',
        }),
      });

      expect(response1.status).toBe(201);
      const data1 = await response1.json();
      expect(data1.created).toBe(1);

      // Second submission with same eventId (should be skipped)
      const response2 = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventId: customEventId,
          eventName: 'idempotent_event',
          userId: 'user_789',
          sessionId: 'session_101',
        }),
      });

      expect(response2.status).toBe(201);
      const data2 = await response2.json();
      expect(data2.received).toBe(1);
      expect(data2.created).toBe(0); // Skipped duplicate
    });
  });

  describe('Validation', () => {
    it('should reject event without eventName', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          userId: 'user_123',
          sessionId: 'session_456',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should reject event without userId', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventName: 'test_event',
          sessionId: 'session_456',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should reject event without sessionId', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventName: 'test_event',
          userId: 'user_123',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });
  });

  describe('Batch Event Submission', () => {
    it('should accept multiple events in batch', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify([
          {
            eventName: 'batch_event_1',
            userId: 'user_batch',
            sessionId: 'session_batch',
          },
          {
            eventName: 'batch_event_2',
            userId: 'user_batch',
            sessionId: 'session_batch',
          },
          {
            eventName: 'batch_event_3',
            userId: 'user_batch',
            sessionId: 'session_batch',
          },
        ]),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.received).toBe(3);
      expect(data.created).toBeGreaterThanOrEqual(1);
    });

    it('should reject empty batch', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify([]),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should reject batch with invalid event', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify([
          {
            eventName: 'valid_event',
            userId: 'user_123',
            sessionId: 'session_456',
          },
          {
            // Missing userId - invalid
            eventName: 'invalid_event',
            sessionId: 'session_456',
          },
        ]),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });
  });

  describe('Properties Handling', () => {
    it('should accept events with complex properties', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventName: 'complex_event',
          userId: 'user_complex',
          sessionId: 'session_complex',
          properties: {
            page: '/products/123',
            product: {
              id: 'prod_123',
              name: 'Test Product',
              price: 99.99,
              tags: ['featured', 'new'],
            },
            metadata: {
              referrer: 'https://google.com',
              utm_source: 'newsletter',
            },
          },
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.created).toBe(1);
    });

    it('should accept events without properties', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventName: 'no_props_event',
          userId: 'user_no_props',
          sessionId: 'session_no_props',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});

describe('Schema Enforcement', () => {
  // The seed creates active schemas for 'purchase' and 'button_click' on the demo app.
  // purchase schema: amount (number, required), currency (string, required),
  //                  productId (string, required), quantity (number, optional)
  // button_click schema: buttonId (string, required), page (string, required)

  describe('purchase schema', () => {
    it('should reject a purchase event missing all required fields (422)', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventName: 'purchase',
          userId: 'user_schema',
          sessionId: 'session_schema',
          properties: {}, // missing amount, currency, productId
        }),
      });

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toBe('Schema validation failed');
      expect(data.rejected).toBe(1);
      expect(data.violations).toHaveLength(1);
      expect(data.violations[0].eventName).toBe('purchase');
      const violatedProps = data.violations[0].violations.map(
        (v: { property: string }) => v.property,
      );
      expect(violatedProps).toContain('amount');
      expect(violatedProps).toContain('currency');
      expect(violatedProps).toContain('productId');
    });

    it('should reject a purchase event when a required field has the wrong type (422)', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventName: 'purchase',
          userId: 'user_schema',
          sessionId: 'session_schema',
          properties: {
            amount: 'not-a-number', // should be number
            currency: 'USD',
            productId: 'prod_abc',
          },
        }),
      });

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toBe('Schema validation failed');
      const violatedProps = data.violations[0].violations.map(
        (v: { property: string }) => v.property,
      );
      expect(violatedProps).toContain('amount');
    });

    it('should accept a purchase event with all required fields (201)', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventName: 'purchase',
          userId: 'user_schema',
          sessionId: 'session_schema',
          properties: {
            amount: 49.99,
            currency: 'USD',
            productId: 'prod_abc',
          },
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.created).toBe(1);
      expect(data.rejected).toBeUndefined();
    });

    it('should accept a purchase event when optional field quantity is omitted (201)', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventName: 'purchase',
          userId: 'user_schema',
          sessionId: 'session_schema',
          properties: {
            amount: 19.0,
            currency: 'EUR',
            productId: 'prod_xyz',
            // quantity omitted (optional)
          },
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.created).toBe(1);
    });
  });

  describe('button_click schema', () => {
    it('should reject a button_click event missing required fields (422)', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventName: 'button_click',
          userId: 'user_schema',
          sessionId: 'session_schema',
          properties: { buttonId: 'btn_signup' }, // missing page
        }),
      });

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toBe('Schema validation failed');
      const violatedProps = data.violations[0].violations.map(
        (v: { property: string }) => v.property,
      );
      expect(violatedProps).toContain('page');
    });

    it('should accept a button_click event with all required fields (201)', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventName: 'button_click',
          userId: 'user_schema',
          sessionId: 'session_schema',
          properties: {
            buttonId: 'btn_signup',
            page: '/landing',
          },
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.created).toBe(1);
    });
  });

  describe('Batch with mixed schema results', () => {
    it('should accept valid events and report rejected ones in the same batch (201 partial)', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify([
          {
            // valid purchase
            eventName: 'purchase',
            userId: 'user_batch_schema',
            sessionId: 'session_batch_schema',
            properties: { amount: 10, currency: 'USD', productId: 'prod_1' },
          },
          {
            // invalid purchase - missing required fields
            eventName: 'purchase',
            userId: 'user_batch_schema',
            sessionId: 'session_batch_schema',
            properties: { productId: 'prod_2' }, // missing amount + currency
          },
        ]),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.received).toBe(2);
      expect(data.created).toBe(1);
      expect(data.rejected).toBe(1);
      expect(data.violations).toHaveLength(1);
      expect(data.violations[0].eventName).toBe('purchase');
    });

    it('should return 422 when every event in a batch fails schema validation', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify([
          {
            eventName: 'purchase',
            userId: 'user_all_bad',
            sessionId: 'session_all_bad',
            properties: {}, // invalid
          },
          {
            eventName: 'button_click',
            userId: 'user_all_bad',
            sessionId: 'session_all_bad',
            properties: {}, // invalid
          },
        ]),
      });

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toBe('Schema validation failed');
      expect(data.received).toBe(2);
      expect(data.rejected).toBe(2);
      expect(data.violations).toHaveLength(2);
    });
  });

  describe('Events without a schema', () => {
    it('should pass through events that have no active schema (201)', async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TEST_API_KEY,
        },
        body: JSON.stringify({
          eventName: 'unschema_event', // not in seed schemas
          userId: 'user_no_schema',
          sessionId: 'session_no_schema',
          properties: {}, // any properties allowed
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.created).toBe(1);
      expect(data.rejected).toBeUndefined();
    });
  });
});

describe('GET /api/events', () => {
  it('should return API info and health check', async () => {
    const response = await fetch(`${API_BASE_URL}/api/events`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.service).toBe('Event Ingestion API');
    expect(data.status).toBe('operational');
    expect(data.endpoints).toBeDefined();
  });
});
