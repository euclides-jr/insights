# Load Testing

This folder contains a containerized k6 setup for stressing the deployed app.

## Result hygiene

- Runtime outputs go to `load/results/` and are gitignored.
- Stable snapshots are summarized in [BENCHMARKS.md](./BENCHMARKS.md).

## Scenarios

- `scripts/event-ingest.js`
  - high-throughput SDK-style event ingestion against `/api/events`
- `scripts/mixed-app.js`
  - mixed load across:
    - `/api/events`
    - `/api/users/identify`
    - session-authenticated dashboard APIs:
      - `/api/quality`
      - `/api/schemas`
      - `/api/segments`
      - `/api/query`
- `scripts/dashboard-read-step.js`
  - step-load focused on the dashboard query path only
  - useful for finding the read-side knee point without ingest noise
- `scripts/query-explorer-perf.js`
  - dedicated Query Explorer load against `/api/query`
  - covers:
    - time-bucket count
    - property breakdown
    - filtered numeric sum

## Observability built into k6

The scripts now emit tagged custom metrics for:

- `endpoint`
- `flow`
- `status`

Key metrics:

- `load_response_by_status`
- `load_request_failures`
- `load_request_latency`
- `load_endpoint_latency`

## Local container usage

```bash
mkdir -p load/results

BASE_URL="$LOAD_TEST_BASE_URL" \
APP_API_KEY=demo_app_key_123 \
docker compose -f load/docker-compose.yml run --rm \
  k6 run --summary-export /results/event-ingest-summary.json /scripts/event-ingest.js
```

```bash
BASE_URL="$LOAD_TEST_BASE_URL" \
APP_API_KEY=demo_app_key_123 \
AUTH_EMAIL=admin@eventpulse.local \
AUTH_PASSWORD=changeme12345 \
docker compose -f load/docker-compose.yml run --rm \
  k6 run --summary-export /results/mixed-app-summary.json /scripts/mixed-app.js
```

```bash
BASE_URL="$LOAD_TEST_BASE_URL" \
AUTH_EMAIL=admin@eventpulse.local \
AUTH_PASSWORD=changeme12345 \
docker compose -f load/docker-compose.yml run --rm \
  k6 run --summary-export /results/dashboard-read-step-summary.json /scripts/dashboard-read-step.js
```

```bash
BASE_URL="$LOAD_TEST_BASE_URL" \
AUTH_EMAIL=admin@eventpulse.local \
AUTH_PASSWORD=changeme12345 \
APPLICATION_ID=query_perf_app \
docker compose -f load/docker-compose.yml run --rm \
  k6 run --summary-export /results/query-explorer-perf-summary.json /scripts/query-explorer-perf.js
```

## Convenience runner

`scripts/run-load-test.sh` executes:

- ingest ramp
- dashboard step load
- mixed workload

## Seeded defaults

- base dashboard account: `admin@eventpulse.local` / `changeme12345`
- demo web app API key: `demo_app_key_123`
- mobile app API key: `mobile_app_key_456`
- admin dashboard app API key: `admin_app_key_789`
