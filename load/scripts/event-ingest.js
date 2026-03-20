import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:3000';
const APP_API_KEY = __ENV.APP_API_KEY || 'demo_app_key_123';
const START_RATE = Number(__ENV.INGEST_START_RATE || 25);
const STAGE_1_RATE = Number(__ENV.INGEST_STAGE_1_RATE || 75);
const STAGE_2_RATE = Number(__ENV.INGEST_STAGE_2_RATE || 150);
const STAGE_3_RATE = Number(__ENV.INGEST_STAGE_3_RATE || 300);
const STAGE_1_DURATION = __ENV.INGEST_STAGE_1_DURATION || '1m';
const STAGE_2_DURATION = __ENV.INGEST_STAGE_2_DURATION || '2m';
const STAGE_3_DURATION = __ENV.INGEST_STAGE_3_DURATION || '2m';
const COOLDOWN_DURATION = __ENV.INGEST_COOLDOWN_DURATION || '30s';

const responseByStatus = new Counter('load_response_by_status');
const requestFailures = new Rate('load_request_failures');
const requestLatency = new Trend('load_request_latency', true);
const endpointLatency = new Trend('load_endpoint_latency', true);

export const options = {
  scenarios: {
    ingest_events: {
      executor: 'ramping-arrival-rate',
      startRate: START_RATE,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 400,
      stages: [
        { target: STAGE_1_RATE, duration: STAGE_1_DURATION },
        { target: STAGE_2_RATE, duration: STAGE_2_DURATION },
        { target: STAGE_3_RATE, duration: STAGE_3_DURATION },
        { target: 0, duration: COOLDOWN_DURATION },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1200', 'p(99)<2500'],
  },
};

function eventBody(iteration) {
  const timestamp = new Date().toISOString();
  const userId = `load_user_${iteration % 5000}`;
  const sessionId = `load_session_${Math.floor(iteration / 3)}`;
  const eventTemplates = [
    {
      eventName: 'page_view',
      properties: {
        path: ['/pricing', '/dashboard', '/reports', '/onboarding'][iteration % 4],
        referrer: ['google', 'newsletter', 'partner_blog'][iteration % 3],
        duration: 5 + (iteration % 90),
      },
    },
    {
      eventName: 'button_click',
      properties: {
        page: ['/dashboard', '/reports', '/onboarding'][iteration % 3],
        buttonId: ['upgrade-plan', 'create-report', 'connect-integration'][iteration % 3],
        label: ['Upgrade', 'Create Report', 'Connect'][iteration % 3],
      },
    },
    {
      eventName: 'signup',
      properties: {
        plan: ['free', 'starter', 'pro'][iteration % 3],
        source: ['organic_search', 'paid_search', 'community'][iteration % 3],
        invited: iteration % 5 === 0,
      },
    },
    {
      eventName: 'workspace_created',
      properties: {
        template: ['blank', 'marketing', 'product'][iteration % 3],
        importedDemoData: iteration % 2 === 0,
        memberCount: 1 + (iteration % 8),
      },
    },
    {
      eventName: 'integration_connected',
      properties: {
        integration: ['slack', 'stripe', 'salesforce'][iteration % 3],
        category: ['messaging', 'payments', 'crm'][iteration % 3],
        success: iteration % 7 !== 0,
        setupMinutes: 1 + (iteration % 20),
      },
    },
    {
      eventName: 'report_exported',
      properties: {
        format: ['csv', 'json', 'xlsx'][iteration % 3],
        reportType: ['query', 'funnel', 'retention'][iteration % 3],
        rowCount: 50 + (iteration % 500),
      },
    },
  ];
  const template = eventTemplates[iteration % eventTemplates.length];

  return JSON.stringify({
    eventId: `load_event_${iteration}_${Date.now()}`,
    eventName: template.eventName,
    userId,
    sessionId,
    timestamp,
    properties: template.properties,
  });
}

export default function () {
  const response = http.post(`${BASE_URL}/api/events`, eventBody(__ITER), {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': APP_API_KEY,
    },
    tags: {
      endpoint: 'events',
      flow: 'ingest',
    },
  });

  const ok =
    response.status === 201 || response.status === 202 || response.status === 200;
  const tags = {
    endpoint: 'events',
    flow: 'ingest',
    status: String(response.status),
  };

  responseByStatus.add(1, tags);
  requestFailures.add(!ok, tags);
  requestLatency.add(response.timings.duration, tags);
  endpointLatency.add(response.timings.duration, tags);

  check(response, {
    'events accepted': () => ok,
  });
}
