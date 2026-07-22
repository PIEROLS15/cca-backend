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
  attempts=450
  delay=2
  i=1

  while [ "$i" -le "$attempts" ]; do
    db_container_id=$(COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-cca-backend-test} docker compose --env-file "$ENV_FILE" -f "$APP_COMPOSE_FILE" ps -q db 2>/dev/null || true)

    if [ -n "$db_container_id" ]; then
      db_status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$db_container_id" 2>/dev/null || true)

      if [ "$db_status" = "healthy" ]; then
        return 0
      fi

      if [ "$db_status" = "running" ] && docker compose --env-file "$ENV_FILE" -f "$APP_COMPOSE_FILE" exec -T db pg_isready -U "$POSTGRES_USER_TEST" -d "$POSTGRES_DB_TEST" >/dev/null 2>&1; then
        return 0
      fi
    fi

    if docker compose --env-file "$ENV_FILE" -f "$APP_COMPOSE_FILE" exec -T db pg_isready -U "$POSTGRES_USER_TEST" -d "$POSTGRES_DB_TEST" >/dev/null 2>&1; then
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
ENV_FILE=${ENV_FILE:-.env}

[ -f "$SHARED_DIR/$ENV_FILE" ] || fail "Falta el archivo compartido de entorno: $SHARED_DIR/$ENV_FILE"

set -a
. "$SHARED_DIR/$ENV_FILE"
set +a

mkdir -p "$RELEASE_DIR"
cd "$RELEASE_DIR"
ln -sfn "$SHARED_DIR/$ENV_FILE" "$ENV_FILE"

log "Limpiando entorno de pruebas"
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-cca-backend-test} docker compose --env-file "$ENV_FILE" -f "$APP_COMPOSE_FILE" down -v >/dev/null 2>&1 || true

log "Levantando base de datos de pruebas"
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-cca-backend-test} docker compose --env-file "$ENV_FILE" -f "$APP_COMPOSE_FILE" up -d db
if ! wait_for_db; then
  fail "La base de datos de pruebas no estuvo lista a tiempo"
fi

log "Levantando backend de pruebas"
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-cca-backend-test} docker compose --env-file "$ENV_FILE" -f "$APP_COMPOSE_FILE" up -d --build backend
if ! wait_for_http "http://127.0.0.1:${BACKEND_TEST_PORT:-9101}/health"; then
  fail "El backend de pruebas no pasó healthcheck"
fi

log "Aplicando migraciones y seeds"
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-cca-backend-test} docker compose --env-file "$ENV_FILE" -f "$APP_COMPOSE_FILE" exec -T backend sh -lc 'npm run prisma:migrate:deploy && npm run prisma:seed'

log "Ejecutando pruebas"
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-cca-backend-test} docker compose --env-file "$ENV_FILE" -f "$APP_COMPOSE_FILE" exec -T backend npm test

log "Despliegue de pruebas completado"
