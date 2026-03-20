import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:3000';
const AUTH_EMAIL = __ENV.AUTH_EMAIL || 'admin@eventpulse.local';
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD || 'changeme12345';
const APPLICATION_ID = __ENV.APPLICATION_ID || '';
const STEP_1_RATE = Number(__ENV.DASHBOARD_STEP_1_RATE || 10);
const STEP_2_RATE = Number(__ENV.DASHBOARD_STEP_2_RATE || 25);
const STEP_3_RATE = Number(__ENV.DASHBOARD_STEP_3_RATE || 50);
const STEP_4_RATE = Number(__ENV.DASHBOARD_STEP_4_RATE || 80);
const STEP_1_DURATION = __ENV.DASHBOARD_STEP_1_DURATION || '1m';
const STEP_2_DURATION = __ENV.DASHBOARD_STEP_2_DURATION || '1m';
const STEP_3_DURATION = __ENV.DASHBOARD_STEP_3_DURATION || '1m';
const STEP_4_DURATION = __ENV.DASHBOARD_STEP_4_DURATION || '1m';
const COOLDOWN_DURATION = __ENV.DASHBOARD_STEP_COOLDOWN_DURATION || '30s';

const responseByStatus = new Counter('load_response_by_status');
const requestFailures = new Rate('load_request_failures');
const requestLatency = new Trend('load_request_latency', true);
const endpointLatency = new Trend('load_endpoint_latency', true);

export const options = {
  scenarios: {
    dashboard_step: {
      executor: 'ramping-arrival-rate',
      startRate: STEP_1_RATE,
      timeUnit: '1s',
      preAllocatedVUs: 30,
      maxVUs: 200,
      stages: [
        { target: STEP_1_RATE, duration: STEP_1_DURATION },
        { target: STEP_2_RATE, duration: STEP_2_DURATION },
        { target: STEP_3_RATE, duration: STEP_3_DURATION },
        { target: STEP_4_RATE, duration: STEP_4_DURATION },
        { target: 0, duration: COOLDOWN_DURATION },
      ],
      exec: 'dashboardRead',
    },
  },
};

function recordResponseMetrics(response, endpoint, ok) {
  const tags = {
    endpoint,
    flow: 'dashboard-step',
    status: String(response.status),
  };

  responseByStatus.add(1, tags);
  requestFailures.add(!ok, tags);
  requestLatency.add(response.timings.duration, tags);
  endpointLatency.add(response.timings.duration, tags);
}

function buildSessionCookie(response) {
  return Object.entries(response.cookies)
    .map(([name, values]) => `${name}=${values[0].value}`)
    .join('; ');
}

function resolveApplicationId(cookieHeader) {
  if (APPLICATION_ID) {
    return APPLICATION_ID;
  }

  const response = http.get(`${BASE_URL}/api/applications`, {
    headers: { Cookie: cookieHeader },
    tags: { endpoint: 'applications', flow: 'dashboard-step' },
  });

  const ok = response.status === 200;
  recordResponseMetrics(response, 'applications', ok);
  check(response, { 'applications fetched': () => ok });

  const payload = response.json();
  const applications =
    payload && Array.isArray(payload.applications) ? payload.applications : [];
  const preferredApplication =
    applications.find((application) => application.name === 'Demo Web App') ||
    applications[0];

  if (!preferredApplication) {
    throw new Error('No applications returned for dashboard step test');
  }

  return preferredApplication.id;
}

export function setup() {
  const response = http.post(
    `${BASE_URL}/api/auth/sign-in/email`,
    JSON.stringify({
      email: AUTH_EMAIL,
      password: AUTH_PASSWORD,
      rememberMe: true,
      callbackURL: '/',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE_URL,
      },
      tags: { endpoint: 'auth-sign-in', flow: 'dashboard-step' },
    },
  );

  const ok = response.status === 200;
  recordResponseMetrics(response, 'auth-sign-in', ok);
  check(response, { 'sign in succeeded': () => ok });

  const cookieHeader = buildSessionCookie(response);

  return {
    cookieHeader,
    applicationId: resolveApplicationId(cookieHeader),
  };
}

export function dashboardRead(data) {
  const response = http.post(
    `${BASE_URL}/api/query`,
    JSON.stringify({
      applicationId: data.applicationId,
      eventName: 'purchase',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      aggregation: 'count',
      groupMode: 'time',
      timeBucket: 'day',
      pageSize: 50,
    }),
    {
      headers: {
        Cookie: data.cookieHeader,
        'Content-Type': 'application/json',
      },
      tags: { endpoint: 'query', flow: 'dashboard-step' },
    },
  );

  const ok = response.status === 200;
  recordResponseMetrics(response, 'query', ok);
  check(response, { 'dashboard step query ok': () => ok });
}
