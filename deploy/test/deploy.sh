#!/bin/sh
set -eu

log() { printf '%s\n' "$*"; }
fail() { printf '%s\n' "$*" >&2; exit 1; }

wait_for_http() {
  url="$1"
  attempts=60
  delay=2
  i=1

  while [ "$i" -le "$attempts" ]; do
    if docker run --rm --network host curlimages/curl:8.10.1 -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
    i=$((i + 1))
  done

  return 1
}

wait_for_db() {
  attempts=60
  delay=2
  i=1

  while [ "$i" -le "$attempts" ]; do
    if docker compose -f "$APP_COMPOSE_FILE" exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
    i=$((i + 1))
  done

  return 1
}

RELEASE_DIR=${RELEASE_DIR:-$(pwd)}
SHARED_DIR=${SHARED_DIR:-/opt/app/backend-test/shared}
APP_COMPOSE_FILE=${APP_COMPOSE_FILE:-docker-compose.test.yml}

[ -f "$SHARED_DIR/.env" ] || fail "Falta el archivo compartido de entorno: $SHARED_DIR/.env"

set -a
. "$SHARED_DIR/.env"
set +a

mkdir -p "$RELEASE_DIR"
cd "$RELEASE_DIR"
ln -sfn "$SHARED_DIR/.env" .env

log "Limpiando entorno de pruebas"
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-cca-backend-test} docker compose -f "$APP_COMPOSE_FILE" down -v >/dev/null 2>&1 || true

log "Levantando base de datos de pruebas"
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-cca-backend-test} docker compose -f "$APP_COMPOSE_FILE" up -d db
if ! wait_for_db; then
  fail "La base de datos de pruebas no estuvo lista a tiempo"
fi

log "Levantando backend de pruebas"
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-cca-backend-test} docker compose -f "$APP_COMPOSE_FILE" up -d --build backend
if ! wait_for_http "http://127.0.0.1:${BACKEND_TEST_PORT:-9101}/health"; then
  fail "El backend de pruebas no pasó healthcheck"
fi

log "Aplicando migraciones y seeds"
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-cca-backend-test} docker compose -f "$APP_COMPOSE_FILE" exec -T backend sh -lc 'npm run prisma:migrate:deploy && npm run prisma:seed'

log "Despliegue de pruebas completado"
