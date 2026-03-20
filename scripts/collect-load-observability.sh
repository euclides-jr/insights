#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  . "${ROOT_DIR}/.env"
  set +a
fi

HOST="${HOST:-${LOAD_TEST_SSH_HOST:-}}"
OUTPUT_DIR="${OUTPUT_DIR:-load/results/observability-$(date +%Y%m%d-%H%M%S)}"
REMOTE_DIR="${REMOTE_DIR:-/opt/insights}"

if [[ -z "${HOST}" ]]; then
  echo "HOST or LOAD_TEST_SSH_HOST is required"
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

ssh -o StrictHostKeyChecking=no "${HOST}" "journalctl -u 'insights@*' --since '30 minutes ago' --no-pager" \
  > "${OUTPUT_DIR}/app-workers.log" || true

ssh -o StrictHostKeyChecking=no "${HOST}" "journalctl -u pgbouncer --since '30 minutes ago' --no-pager" \
  > "${OUTPUT_DIR}/pgbouncer.log" || true

ssh -o StrictHostKeyChecking=no "${HOST}" "tail -n 2000 /var/log/nginx/insights_access.log" \
  > "${OUTPUT_DIR}/nginx_access.log" || true

ssh -o StrictHostKeyChecking=no "${HOST}" "tail -n 500 /var/log/nginx/insights_error.log" \
  > "${OUTPUT_DIR}/nginx_error.log" || true

ssh -o StrictHostKeyChecking=no "${HOST}" "docker compose -f '${REMOTE_DIR}/deploy/remote/docker-compose.yml' logs --tail=500 db" \
  > "${OUTPUT_DIR}/postgres.log" || true

ssh -o StrictHostKeyChecking=no "${HOST}" "docker compose -f '${REMOTE_DIR}/deploy/remote/docker-compose.yml' exec -T db psql -U insights -d insights -c 'select now();' -c \"select queryid, calls, total_exec_time, mean_exec_time, rows, left(regexp_replace(query, E'[[:space:]]+', ' ', 'g'), 220) as query from pg_stat_statements order by total_exec_time desc limit 20;\"" \
  > "${OUTPUT_DIR}/pg_stat_statements.txt" || true

echo "Observability artifacts written to ${OUTPUT_DIR}"
