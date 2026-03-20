import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:3000';
const AUTH_EMAIL = __ENV.AUTH_EMAIL || 'admin@eventpulse.local';
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD || 'changeme12345';
const APPLICATION_ID = __ENV.APPLICATION_ID || 'query_perf_app';
const APPLICATION_NAME = __ENV.APPLICATION_NAME || 'Query Performance App';
const DURATION = __ENV.QUERY_PERF_DURATION || '1m';
const TIME_BUCKET_VUS = Number(__ENV.QUERY_PERF_TIME_BUCKET_VUS || 8);
const PROPERTY_BREAKDOWN_VUS = Number(
  __ENV.QUERY_PERF_PROPERTY_BREAKDOWN_VUS || 6,
);
const FILTERED_SUM_VUS = Number(__ENV.QUERY_PERF_FILTERED_SUM_VUS || 4);

const responseByStatus = new Counter('load_response_by_status');
const requestFailures = new Rate('load_request_failures');
const requestLatency = new Trend('load_request_latency', true);
const endpointLatency = new Trend('load_endpoint_latency', true);
const queryExecutionTime = new Trend('query_execution_time_ms', true);

export const options = {
  scenarios: {
    timeBucketCount: {
      executor: 'constant-vus',
      vus: TIME_BUCKET_VUS,
      duration: DURATION,
      exec: 'timeBucketCount',
    },
    propertyBreakdown: {
      executor: 'constant-vus',
      vus: PROPERTY_BREAKDOWN_VUS,
      duration: DURATION,
      exec: 'propertyBreakdown',
    },
    filteredRevenue: {
      executor: 'constant-vus',
      vus: FILTERED_SUM_VUS,
      duration: DURATION,
      exec: 'filteredRevenue',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{query_shape:time-bucket-count}': ['p(95)<1500'],
    'http_req_duration{query_shape:property-breakdown}': ['p(95)<2000'],
    'http_req_duration{query_shape:filtered-sum}': ['p(95)<2000'],
    'query_execution_time_ms{query_shape:time-bucket-count}': ['p(95)<1200'],
    'query_execution_time_ms{query_shape:property-breakdown}': ['p(95)<1500'],
    'query_execution_time_ms{query_shape:filtered-sum}': ['p(95)<1500'],
  },
};

function recordResponseMetrics(response, endpoint, queryShape, ok) {
  const tags = {
    endpoint,
    flow: 'query-explorer',
    query_shape: queryShape,
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
    tags: { endpoint: 'applications', flow: 'query-explorer' },
  });

  const ok = response.status === 200;
  recordResponseMetrics(response, 'applications', 'setup', ok);
  check(response, { 'applications fetched': () => ok });

  const payload = response.json();
  const applications = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.applications)
      ? payload.applications
      : [];

  const preferredApplication =
    applications.find((application) => application.name === APPLICATION_NAME) ||
    applications[0];

  if (!preferredApplication) {
    throw new Error('No applications returned for query explorer perf test');
  }

  return preferredApplication.id;
}

function runQuery(cookieHeader, body, queryShape) {
  const response = http.post(`${BASE_URL}/api/query`, JSON.stringify(body), {
    headers: {
      Cookie: cookieHeader,
      'Content-Type': 'application/json',
    },
    tags: {
      endpoint: 'query',
      flow: 'query-explorer',
      query_shape: queryShape,
    },
  });

  const ok = response.status === 200;
  recordResponseMetrics(response, 'query', queryShape, ok);
  check(response, { 'query ok': () => ok });

  if (ok) {
    const payload = response.json();
    if (payload && typeof payload.executionTimeMs === 'number') {
      queryExecutionTime.add(payload.executionTimeMs, {
        endpoint: 'query',
        flow: 'query-explorer',
        query_shape: queryShape,
      });
    }
  }

  return response;
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
      tags: { endpoint: 'auth-sign-in', flow: 'query-explorer' },
    },
  );

  const ok = response.status === 200;
  recordResponseMetrics(response, 'auth-sign-in', 'setup', ok);
  check(response, { 'sign in succeeded': () => ok });

  const cookieHeader = buildSessionCookie(response);

  return {
    cookieHeader,
    applicationId: resolveApplicationId(cookieHeader),
  };
}

export function timeBucketCount(data) {
  runQuery(
    data.cookieHeader,
    {
      applicationId: data.applicationId,
      eventName: 'purchase',
      startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      aggregation: 'count',
      groupBy: {
        kind: 'time',
        bucket: 'day',
      },
      pageSize: 90,
    },
    'time-bucket-count',
  );
}

export function propertyBreakdown(data) {
  runQuery(
    data.cookieHeader,
    {
      applicationId: data.applicationId,
      eventName: 'page_view',
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      aggregation: 'count',
      groupBy: {
        kind: 'property',
        key: 'country',
      },
      propertyFilters: [
        {
          key: 'deviceType',
          valueType: 'string',
          operator: 'eq',
          value: 'desktop',
        },
      ],
      sortBy: 'value',
      sortOrder: 'desc',
      pageSize: 25,
    },
    'property-breakdown',
  );
}

export function filteredRevenue(data) {
  runQuery(
    data.cookieHeader,
    {
      applicationId: data.applicationId,
      eventName: 'purchase',
      startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      aggregation: 'sum',
      aggregationField: 'amount',
      groupBy: {
        kind: 'property',
        key: 'currency',
      },
      propertyFilters: [
        {
          key: 'plan',
          valueType: 'string',
          operator: 'in',
          value: ['pro', 'enterprise'],
        },
        {
          key: 'amount',
          valueType: 'number',
          operator: 'gt',
          value: 100,
          logic: 'and',
        },
      ],
      sortBy: 'value',
      sortOrder: 'desc',
      pageSize: 10,
    },
    'filtered-sum',
  );
}
