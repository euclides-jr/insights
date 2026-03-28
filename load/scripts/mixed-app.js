import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://host.docker.internal:3000";
const APP_API_KEY = __ENV.APP_API_KEY || "demo_app_key_123";
const AUTH_EMAIL = __ENV.AUTH_EMAIL || "admin@eventpulse.local";
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD || "changeme12345";
const APPLICATION_ID = __ENV.APPLICATION_ID || "";
const INGEST_RATE = Number(__ENV.MIXED_INGEST_RATE || 120);
const IDENTIFY_RATE = Number(__ENV.MIXED_IDENTIFY_RATE || 20);
const DASHBOARD_VUS = Number(__ENV.MIXED_DASHBOARD_VUS || 12);
const DURATION = __ENV.MIXED_DURATION || "3m";
const DASHBOARD_START_TIME = __ENV.MIXED_DASHBOARD_START_TIME || "10s";
const NO_CONNECTION_REUSE = __ENV.K6_NO_CONNECTION_REUSE === "true";
const NO_VU_CONNECTION_REUSE = __ENV.K6_NO_VU_CONNECTION_REUSE === "true";
const GENERATOR_ID = __ENV.GENERATOR_ID || "generator-1";

const responseByStatus = new Counter("load_response_by_status");
const requestFailures = new Rate("load_request_failures");
const requestLatency = new Trend("load_request_latency", true);
const endpointLatency = new Trend("load_endpoint_latency", true);

export const options = {
  noConnectionReuse: NO_CONNECTION_REUSE,
  noVUConnectionReuse: NO_VU_CONNECTION_REUSE,
  scenarios: {
    ingest: {
      executor: "constant-arrival-rate",
      rate: INGEST_RATE,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: 40,
      maxVUs: 300,
      exec: "ingestEvents",
    },
    identify: {
      executor: "constant-arrival-rate",
      rate: IDENTIFY_RATE,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: 20,
      maxVUs: 80,
      exec: "identifyUsers",
    },
    dashboardReads: {
      executor: "constant-vus",
      vus: DASHBOARD_VUS,
      duration: DURATION,
      exec: "dashboardReads",
      startTime: DASHBOARD_START_TIME,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500", "p(99)<3000"],
    "http_req_duration{flow:dashboard}": ["p(95)<1200"],
    "http_req_duration{flow:ingest}": ["p(95)<1000"],
  },
};

function recordResponseMetrics(response, endpoint, flow, ok) {
  const tags = {
    endpoint,
    flow,
    status: String(response.status),
    generator: GENERATOR_ID,
  };

  responseByStatus.add(1, tags);
  requestFailures.add(!ok, tags);
  requestLatency.add(response.timings.duration, tags);
  endpointLatency.add(response.timings.duration, tags);
}

function buildSessionCookie(response) {
  return Object.entries(response.cookies)
    .map(([name, values]) => `${name}=${values[0].value}`)
    .join("; ");
}

function getApplicationId(cookieHeader) {
  if (APPLICATION_ID) {
    return APPLICATION_ID;
  }

  const response = http.get(`${BASE_URL}/api/applications`, {
    headers: {
      Cookie: cookieHeader,
    },
    tags: {
      endpoint: "applications",
      flow: "dashboard",
      generator: GENERATOR_ID,
    },
  });

  check(response, {
    "applications fetched": (res) => res.status === 200,
  });
  recordResponseMetrics(
    response,
    "applications",
    "dashboard",
    response.status === 200,
  );

  const payload = response.json();
  const applications = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.applications)
      ? payload.applications
      : [];

  if (applications.length === 0) {
    throw new Error("No applications returned for dashboard session");
  }

  const byApiKey = applications.find(
    (application) => application.apiKey === APP_API_KEY,
  );
  const byName = applications.find(
    (application) => application.name === "Demo Web App",
  );
  const preferredApplication = byApiKey || byName || applications[0];

  return preferredApplication.id;
}

export function setup() {
  const signInResponse = http.post(
    `${BASE_URL}/api/auth/sign-in/email`,
    JSON.stringify({
      email: AUTH_EMAIL,
      password: AUTH_PASSWORD,
      rememberMe: true,
      callbackURL: "/",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Origin: BASE_URL,
      },
      tags: {
        endpoint: "auth-sign-in",
        flow: "dashboard",
        generator: GENERATOR_ID,
      },
    },
  );

  check(signInResponse, {
    "sign in succeeded": (res) => res.status === 200,
  });
  recordResponseMetrics(
    signInResponse,
    "auth-sign-in",
    "dashboard",
    signInResponse.status === 200,
  );

  const cookieHeader = buildSessionCookie(signInResponse);
  const applicationId = getApplicationId(cookieHeader);

  return {
    applicationId,
    cookieHeader,
  };
}

export function ingestEvents() {
  const eventTemplates = [
    {
      eventName: "page_view",
      properties: {
        path: ["/dashboard", "/reports", "/integrations"][__ITER % 3],
        referrer: ["google", "newsletter", "partner_blog"][__ITER % 3],
      },
    },
    {
      eventName: "button_click",
      properties: {
        page: ["/dashboard", "/reports", "/integrations"][__ITER % 3],
        buttonId: ["upgrade-plan", "create-report", "connect-integration"][
          __ITER % 3
        ],
        label: ["Upgrade", "Create Report", "Connect"][__ITER % 3],
      },
    },
    {
      eventName: "purchase",
      properties: {
        amount: 49 + (__ITER % 150),
        currency: ["USD", "EUR", "GBP"][__ITER % 3],
        productId: ["starter-monthly", "pro-monthly", "enterprise-addon"][
          __ITER % 3
        ],
        quantity: 1 + (__ITER % 2),
        coupon: __ITER % 5 === 0 ? "LOAD10" : "",
      },
    },
  ];
  const template = eventTemplates[__ITER % eventTemplates.length];

  const response = http.post(
    `${BASE_URL}/api/events`,
    JSON.stringify({
      eventId: `mixed_event_${__VU}_${__ITER}_${Date.now()}`,
      eventName: template.eventName,
      userId: `mixed_user_${(__ITER + __VU) % 2500}`,
      sessionId: `mixed_session_${Math.floor(__ITER / 2)}`,
      timestamp: new Date().toISOString(),
      properties: template.properties,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": APP_API_KEY,
      },
      tags: {
        endpoint: "events",
        flow: "ingest",
        generator: GENERATOR_ID,
      },
    },
  );

  const ok =
    response.status === 201 ||
    response.status === 202 ||
    response.status === 200;
  recordResponseMetrics(response, "events", "ingest", ok);

  check(response, {
    "ingest ok": () => ok,
  });
}

export function identifyUsers() {
  const response = http.post(
    `${BASE_URL}/api/users/identify`,
    JSON.stringify({
      userId: `identify_user_${(__ITER + __VU) % 2500}`,
      attributes: {
        plan: ["free", "starter", "pro"][__ITER % 3],
        country: ["US", "DE", "GB"][__ITER % 3],
        beta_opt_in: __ITER % 4 === 0,
        lead_score: 35 + (__ITER % 60),
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": APP_API_KEY,
      },
      tags: {
        endpoint: "identify",
        flow: "identify",
        generator: GENERATOR_ID,
      },
    },
  );

  const ok = response.status === 200;
  recordResponseMetrics(response, "identify", "identify", ok);

  check(response, {
    "identify ok": () => ok,
  });
}

export function dashboardReads(data) {
  const cookieHeaders = {
    Cookie: data.cookieHeader,
    "Content-Type": "application/json",
  };

  const responses = http.batch([
    [
      "GET",
      `${BASE_URL}/api/quality?applicationId=${data.applicationId}&days=30`,
      null,
      {
        headers: { Cookie: data.cookieHeader },
        tags: {
          endpoint: "quality",
          flow: "dashboard",
          generator: GENERATOR_ID,
        },
      },
    ],
    [
      "GET",
      `${BASE_URL}/api/schemas?applicationId=${data.applicationId}`,
      null,
      {
        headers: { Cookie: data.cookieHeader },
        tags: {
          endpoint: "schemas",
          flow: "dashboard",
          generator: GENERATOR_ID,
        },
      },
    ],
    [
      "GET",
      `${BASE_URL}/api/segments?applicationId=${data.applicationId}`,
      null,
      {
        headers: { Cookie: data.cookieHeader },
        tags: {
          endpoint: "segments",
          flow: "dashboard",
          generator: GENERATOR_ID,
        },
      },
    ],
    [
      "POST",
      `${BASE_URL}/api/query`,
      JSON.stringify({
        applicationId: data.applicationId,
        eventName: "purchase",
        startDate: new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        endDate: new Date().toISOString(),
        aggregation: "count",
        groupBy: {
          kind: "time",
          bucket: "day",
        },
        pageSize: 25,
      }),
      {
        headers: cookieHeaders,
        tags: { endpoint: "query", flow: "dashboard", generator: GENERATOR_ID },
      },
    ],
  ]);

  const endpointNames = ["quality", "schemas", "segments", "query"];
  responses.forEach((response, index) => {
    const ok = response.status === 200;
    recordResponseMetrics(response, endpointNames[index], "dashboard", ok);
    check(response, {
      "dashboard call ok": () => ok,
    });
  });
}
