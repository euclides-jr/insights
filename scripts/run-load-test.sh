#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  . "${ROOT_DIR}/.env"
  set +a
fi

BASE_URL="${BASE_URL:-${LOAD_TEST_BASE_URL:-}}"
APP_API_KEY="${APP_API_KEY:-demo_app_key_123}"
AUTH_EMAIL="${AUTH_EMAIL:-admin@eventpulse.local}"
AUTH_PASSWORD="${AUTH_PASSWORD:-changeme12345}"
RESULTS_ROOT="${RESULTS_ROOT:-load/results}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RESULTS_DIR="${RESULTS_ROOT}/${TIMESTAMP}"

if [[ -z "${BASE_URL}" ]]; then
  echo "BASE_URL or LOAD_TEST_BASE_URL is required"
  exit 1
fi

mkdir -p "${RESULTS_DIR}"

event_status=0
docker compose -f load/docker-compose.yml run --rm \
  -e BASE_URL="${BASE_URL}" \
  -e APP_API_KEY="${APP_API_KEY}" \
  -e INGEST_START_RATE="${INGEST_START_RATE:-}" \
  -e INGEST_STAGE_1_RATE="${INGEST_STAGE_1_RATE:-}" \
  -e INGEST_STAGE_2_RATE="${INGEST_STAGE_2_RATE:-}" \
  -e INGEST_STAGE_3_RATE="${INGEST_STAGE_3_RATE:-}" \
  -e INGEST_STAGE_1_DURATION="${INGEST_STAGE_1_DURATION:-}" \
  -e INGEST_STAGE_2_DURATION="${INGEST_STAGE_2_DURATION:-}" \
  -e INGEST_STAGE_3_DURATION="${INGEST_STAGE_3_DURATION:-}" \
  -e INGEST_COOLDOWN_DURATION="${INGEST_COOLDOWN_DURATION:-}" \
  k6 run --summary-export "/results/${TIMESTAMP}/event-ingest-summary.json" /scripts/event-ingest.js || event_status=$?

dashboard_status=0
docker compose -f load/docker-compose.yml run --rm \
  -e BASE_URL="${BASE_URL}" \
  -e AUTH_EMAIL="${AUTH_EMAIL}" \
  -e AUTH_PASSWORD="${AUTH_PASSWORD}" \
  -e APPLICATION_ID="${APPLICATION_ID:-}" \
  -e DASHBOARD_STEP_1_RATE="${DASHBOARD_STEP_1_RATE:-}" \
  -e DASHBOARD_STEP_2_RATE="${DASHBOARD_STEP_2_RATE:-}" \
  -e DASHBOARD_STEP_3_RATE="${DASHBOARD_STEP_3_RATE:-}" \
  -e DASHBOARD_STEP_4_RATE="${DASHBOARD_STEP_4_RATE:-}" \
  -e DASHBOARD_STEP_1_DURATION="${DASHBOARD_STEP_1_DURATION:-}" \
  -e DASHBOARD_STEP_2_DURATION="${DASHBOARD_STEP_2_DURATION:-}" \
  -e DASHBOARD_STEP_3_DURATION="${DASHBOARD_STEP_3_DURATION:-}" \
  -e DASHBOARD_STEP_4_DURATION="${DASHBOARD_STEP_4_DURATION:-}" \
  -e DASHBOARD_STEP_COOLDOWN_DURATION="${DASHBOARD_STEP_COOLDOWN_DURATION:-}" \
  k6 run --summary-export "/results/${TIMESTAMP}/dashboard-read-step-summary.json" /scripts/dashboard-read-step.js || dashboard_status=$?

mixed_status=0
docker compose -f load/docker-compose.yml run --rm \
  -e BASE_URL="${BASE_URL}" \
  -e APP_API_KEY="${APP_API_KEY}" \
  -e AUTH_EMAIL="${AUTH_EMAIL}" \
  -e AUTH_PASSWORD="${AUTH_PASSWORD}" \
  -e APPLICATION_ID="${APPLICATION_ID:-}" \
  -e MIXED_INGEST_RATE="${MIXED_INGEST_RATE:-}" \
  -e MIXED_IDENTIFY_RATE="${MIXED_IDENTIFY_RATE:-}" \
  -e MIXED_DASHBOARD_VUS="${MIXED_DASHBOARD_VUS:-}" \
  -e MIXED_DURATION="${MIXED_DURATION:-}" \
  -e MIXED_DASHBOARD_START_TIME="${MIXED_DASHBOARD_START_TIME:-}" \
  k6 run --summary-export "/results/${TIMESTAMP}/mixed-app-summary.json" /scripts/mixed-app.js || mixed_status=$?

echo "Summaries written to ${RESULTS_DIR}"
echo "event-ingest exit code: ${event_status}"
echo "dashboard-step exit code: ${dashboard_status}"
echo "mixed-app exit code: ${mixed_status}"

if [[ "${event_status}" -ne 0 || "${dashboard_status}" -ne 0 || "${mixed_status}" -ne 0 ]]; then
  exit 1
fi
