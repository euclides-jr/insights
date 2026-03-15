import { createHmac } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import {
  failureRateAlert,
  completenessAlert,
  duplicateRateAlert,
  overallAlert,
  type AlertLevel,
} from '@/lib/charts/quality-thresholds';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QualityWebhookPayload {
  event: 'quality.alert';
  level: AlertLevel;
  applicationId: string;
  applicationName: string;
  triggeredAt: string; // ISO 8601
  metrics: {
    eventsReceived: number;
    eventsRejected: number;
    validationFailureRate: number;
    completenessRate: number;
    duplicateRate: number;
    date: string;
  };
  alerts: {
    validationFailureRate: AlertLevel;
    completenessRate: AlertLevel;
    duplicateRate: AlertLevel;
    overall: AlertLevel;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a relative ordering for alert level comparison.
 * "error" > "warning" > "ok"
 */
function levelRank(level: AlertLevel): number {
  return level === 'error' ? 2 : level === 'warning' ? 1 : 0;
}

/**
 * Returns true if `actual` is at least as severe as `minimum`.
 */
function meetsMinLevel(actual: AlertLevel, minimum: string): boolean {
  const min = minimum === 'warning' ? 1 : minimum === 'error' ? 2 : 99;
  return levelRank(actual) >= min;
}

/**
 * Sign a request body with HMAC-SHA256 using the webhook secret.
 * Returns the header value: `sha256=<hex_digest>`
 */
function signPayload(body: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(body);
  return `sha256=${hmac.digest('hex')}`;
}

// ─── Core delivery ────────────────────────────────────────────────────────────

/**
 * Deliver a single webhook. Returns the HTTP status code (or 0 on network error).
 * Updates `lastTriggeredAt` and `lastStatus` on the record regardless of outcome.
 */
async function deliverWebhook(
  webhookId: string,
  url: string,
  secret: string | null,
  payload: QualityWebhookPayload,
): Promise<number> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'EventPulse-Webhooks/1.0',
  };

  if (secret) {
    headers['X-Webhook-Signature'] = signPayload(body, secret);
  }

  let status = 0;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10_000), // 10-second timeout
    });
    status = res.status;
  } catch {
    // Network error or timeout — status stays 0
  }

  // Always record the delivery attempt
  await prisma.webhookAlert.update({
    where: { id: webhookId },
    data: { lastTriggeredAt: new Date(), lastStatus: status },
  });

  return status;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check today's quality metrics for `applicationId` and fire any active,
 * matching webhooks. Designed to be called fire-and-forget from the events
 * ingestion route (`void fireQualityWebhooksIfNeeded(...)`).
 */
export async function fireQualityWebhooksIfNeeded(
  applicationId: string,
  applicationName: string,
): Promise<void> {
  // 1. Fetch today's quality metric
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const metric = await prisma.dataQualityMetric.findUnique({
    where: { applicationId_date: { applicationId, date: today } },
  });

  if (!metric) return;

  // 2. Compute alert levels
  const failureAlert = failureRateAlert(metric.validationFailureRate);
  const compAlert = completenessAlert(metric.completenessRate);
  const dupAlert = duplicateRateAlert(metric.duplicateRate);
  const overall = overallAlert(failureAlert, compAlert, dupAlert);

  // Only proceed if something is at least a warning
  if (overall === 'ok') return;

  // 3. Find active webhooks for this app
  const webhooks = await prisma.webhookAlert.findMany({
    where: { applicationId, isActive: true },
  });

  if (webhooks.length === 0) return;

  // 4. Build payload once
  const payload: QualityWebhookPayload = {
    event: 'quality.alert',
    level: overall,
    applicationId,
    applicationName,
    triggeredAt: new Date().toISOString(),
    metrics: {
      eventsReceived: metric.eventsReceived,
      eventsRejected: metric.eventsRejected,
      validationFailureRate: metric.validationFailureRate,
      completenessRate: metric.completenessRate,
      duplicateRate: metric.duplicateRate,
      date: metric.date.toISOString().slice(0, 10),
    },
    alerts: {
      validationFailureRate: failureAlert,
      completenessRate: compAlert,
      duplicateRate: dupAlert,
      overall,
    },
  };

  // 5. Fire matching webhooks concurrently
  const deliveries = webhooks
    .filter((wh) => meetsMinLevel(overall, wh.minLevel))
    .map((wh) => deliverWebhook(wh.id, wh.url, wh.secret, payload));

  await Promise.allSettled(deliveries);
}

/**
 * Build a test payload for a webhook (uses synthetic metric values that
 * deliberately breach all thresholds so the recipient can see the format).
 */
export function buildTestPayload(
  applicationId: string,
  applicationName: string,
): QualityWebhookPayload {
  return {
    event: 'quality.alert',
    level: 'error',
    applicationId,
    applicationName,
    triggeredAt: new Date().toISOString(),
    metrics: {
      eventsReceived: 1000,
      eventsRejected: 200,
      validationFailureRate: 0.2,
      completenessRate: 0.7,
      duplicateRate: 0.18,
      date: new Date().toISOString().slice(0, 10),
    },
    alerts: {
      validationFailureRate: 'error',
      completenessRate: 'error',
      duplicateRate: 'error',
      overall: 'error',
    },
  };
}
