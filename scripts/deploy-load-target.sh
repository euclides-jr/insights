#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  . "${ROOT_DIR}/.env"
  set +a
fi

HOST="${HOST:-${LOAD_TEST_SSH_HOST:-}}"
REMOTE_DIR="${REMOTE_DIR:-/opt/insights}"
APP_PORT="${APP_PORT:-3000}"
APP_WORKERS="${APP_WORKERS:-4}"
BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-}"
BETTER_AUTH_URL="${BETTER_AUTH_URL:-${LOAD_TEST_BASE_URL:-}}"
AUTH_ADMIN_EMAIL="${AUTH_ADMIN_EMAIL:-admin@eventpulse.local}"
AUTH_ADMIN_PASSWORD="${AUTH_ADMIN_PASSWORD:-changeme12345}"
AUTH_ADMIN_NAME="${AUTH_ADMIN_NAME:-EventPulse Admin}"
PGBOUNCER_PORT="${PGBOUNCER_PORT:-6432}"
POSTGRES_USER="${POSTGRES_USER:-insights}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-insights}"
POSTGRES_DB="${POSTGRES_DB:-insights}"

if [[ -z "${HOST}" ]]; then
  echo "HOST or LOAD_TEST_SSH_HOST is required"
  exit 1
fi

if [[ -z "${BETTER_AUTH_URL}" ]]; then
  BETTER_AUTH_URL="http://${HOST#*@}:${APP_PORT}"
fi

if [[ -z "${BETTER_AUTH_SECRET}" ]]; then
  echo "BETTER_AUTH_SECRET is required"
  exit 1
fi

ssh -o StrictHostKeyChecking=no "${HOST}" "mkdir -p '${REMOTE_DIR}'"

rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'playwright-report' \
  --exclude 'test-results' \
  --exclude 'coverage' \
  --exclude 'load/results' \
  ./ "${HOST}:${REMOTE_DIR}/"

ssh -o StrictHostKeyChecking=no "${HOST}" "cat > '${REMOTE_DIR}/.env' <<EOF
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${PGBOUNCER_PORT}/${POSTGRES_DB}
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
BETTER_AUTH_URL=${BETTER_AUTH_URL}
AUTH_ADMIN_EMAIL=${AUTH_ADMIN_EMAIL}
AUTH_ADMIN_PASSWORD=${AUTH_ADMIN_PASSWORD}
AUTH_ADMIN_NAME=${AUTH_ADMIN_NAME}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
EOF"

ssh -o StrictHostKeyChecking=no "${HOST}" "apt-get update -qq >/dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unzip curl nginx pgbouncer >/dev/null"

ssh -o StrictHostKeyChecking=no "${HOST}" "command -v bun >/dev/null 2>&1 || curl -fsSL https://bun.sh/install | bash"

ssh -o StrictHostKeyChecking=no "${HOST}" "cd '${REMOTE_DIR}/deploy/remote' && docker compose up -d"

ssh -o StrictHostKeyChecking=no "${HOST}" "for i in \$(seq 1 30); do if docker compose -f '${REMOTE_DIR}/deploy/remote/docker-compose.yml' exec -T db pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} >/dev/null 2>&1; then exit 0; fi; sleep 2; done; exit 1"

ssh -o StrictHostKeyChecking=no "${HOST}" "docker compose -f '${REMOTE_DIR}/deploy/remote/docker-compose.yml' exec -T db psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c 'create extension if not exists pg_stat_statements;'"

ssh -o StrictHostKeyChecking=no "${HOST}" "cat > /etc/pgbouncer/pgbouncer.ini <<EOF
[databases]
${POSTGRES_DB} = host=127.0.0.1 port=5432 dbname=${POSTGRES_DB}

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = ${PGBOUNCER_PORT}
auth_type = plain
auth_file = /etc/pgbouncer/userlist.txt
admin_users = ${POSTGRES_USER}
pool_mode = transaction
default_pool_size = 80
min_pool_size = 20
reserve_pool_size = 20
max_client_conn = 1000
ignore_startup_parameters = extra_float_digits
server_reset_query = DISCARD ALL
EOF
printf '\"%s\" \"%s\"\\n' '${POSTGRES_USER}' '${POSTGRES_PASSWORD}' > /etc/pgbouncer/userlist.txt
chown postgres:postgres /etc/pgbouncer/userlist.txt /etc/pgbouncer/pgbouncer.ini
chmod 640 /etc/pgbouncer/userlist.txt /etc/pgbouncer/pgbouncer.ini
systemctl enable --now pgbouncer
systemctl restart pgbouncer"

ssh -o StrictHostKeyChecking=no "${HOST}" "cd '${REMOTE_DIR}' && export PATH=\"/root/.bun/bin:\$PATH\" && bun install --frozen-lockfile && bunx prisma generate && bunx prisma migrate deploy && bun prisma/seed.ts && bun run build"

ssh -o StrictHostKeyChecking=no "${HOST}" "cat > /etc/nginx/sites-available/insights <<'EOF'
upstream insights_backend {
$(for i in $(seq 1 "${APP_WORKERS}"); do printf '    server 127.0.0.1:%s;\n' "$((3000 + i))"; done)
    keepalive 64;
}

log_format insights_main '\$remote_addr - \$remote_user [\$time_local] '
                         '\"\$request\" \$status \$body_bytes_sent '
                         'rt=\$request_time uct=\$upstream_connect_time '
                         'uht=\$upstream_header_time urt=\$upstream_response_time '
                         'ua=\"\$http_user_agent\" us=\"\$upstream_status\"';

server {
    listen ${APP_PORT};
    server_name _;

    client_max_body_size 20m;
    access_log /var/log/nginx/insights_access.log insights_main;
    error_log /var/log/nginx/insights_error.log warn;

    location / {
        proxy_pass http://insights_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_read_timeout 120s;
    }
}
EOF
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/insights /etc/nginx/sites-enabled/insights
nginx -t
systemctl enable --now nginx
systemctl restart nginx"

ssh -o StrictHostKeyChecking=no "${HOST}" "cat > /etc/systemd/system/insights@.service <<EOF
[Unit]
Description=Insights Next.js app worker %i
After=docker.service network.target pgbouncer.service
Requires=docker.service pgbouncer.service

[Service]
Type=simple
WorkingDirectory=${REMOTE_DIR}
EnvironmentFile=${REMOTE_DIR}/.env
Environment=PATH=/root/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=PORT=%i
Environment=HOSTNAME=0.0.0.0
ExecStart=/root/.bun/bin/bun ${REMOTE_DIR}/.next/standalone/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl disable --now insights.service >/dev/null 2>&1 || true
rm -f /etc/systemd/system/insights.service
for unit in \$(systemctl list-units 'insights@*.service' --plain --no-legend | awk '{print \$1}'); do
  systemctl stop \"\$unit\" || true
done
for port in \$(seq 3001 $((3000 + ${APP_WORKERS}))); do
  systemctl enable --now insights@\"\${port}\".service
  systemctl restart insights@\"\${port}\".service
done"

echo "Deployment completed on ${HOST} at ${BETTER_AUTH_URL}"
