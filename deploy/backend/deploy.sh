#!/bin/sh
set -eu

log() {
  printf '%s\n' "$*"
}

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

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
    if COMPOSE_PROJECT_NAME="$DB_PROJECT" docker compose -f "$DB_COMPOSE_FILE" exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      return 0
    fi

    sleep "$delay"
    i=$((i + 1))
  done

  return 1
}

start_backend() {
  port="$1"
  project="$2"
  BACKEND_PORT="$port" COMPOSE_PROJECT_NAME="$project" docker compose -f "$APP_COMPOSE_FILE" up -d --build backend
}

stop_backend() {
  port="$1"
  project="$2"
  BACKEND_PORT="$port" COMPOSE_PROJECT_NAME="$project" docker compose -f "$APP_COMPOSE_FILE" down
}

backup_db() {
  backup_file="$BACKUP_DIR/$RELEASE_ID-$(date +%Y%m%d-%H%M%S).sql"
  if COMPOSE_PROJECT_NAME="$DB_PROJECT" docker compose -f "$DB_COMPOSE_FILE" exec -T db sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$backup_file"; then
    if gzip "$backup_file"; then
      log "Backup creado: $backup_file.gz"
    else
      rm -f "$backup_file"
      fail "No se pudo comprimir el backup de la base de datos"
    fi
  else
    rm -f "$backup_file"
    fail "No se pudo crear el backup de la base de datos"
  fi
}

run_migrations() {
  COMPOSE_PROJECT_NAME="$STAGING_PROJECT" BACKEND_PORT="$STAGING_PORT" docker compose -f "$APP_COMPOSE_FILE" exec -T backend sh -lc 'npm run prisma:migrate:deploy'
}

rollback_to_previous() {
  log "Iniciando rollback"
  stop_backend "$PRODUCTION_PORT" "$APP_PROJECT" >/dev/null 2>&1 || true

  if [ -n "$OLD_RELEASE" ]; then
    BACKEND_PORT="$PRODUCTION_PORT" COMPOSE_PROJECT_NAME="$OLD_PROJECT" docker compose -f "$APP_COMPOSE_FILE" up -d --build backend
    if ! wait_for_http "http://127.0.0.1:$PRODUCTION_PORT/health"; then
      fail "El rollback no respondió en healthcheck"
    fi
    log "Rollback activado desde $OLD_RELEASE"
  fi
}

RELEASE_DIR=${RELEASE_DIR:-$(pwd)}
CURRENT_LINK=${CURRENT_LINK:-/opt/app/backend/current}
PREVIOUS_LINK=${PREVIOUS_LINK:-/opt/app/backend/previous}
SHARED_DIR=${SHARED_DIR:-/opt/app/backend/shared}
BACKUP_DIR=${BACKUP_DIR:-/opt/app/backups/db}
NETWORK_NAME=${NETWORK_NAME:-cca_backend_net}
DB_COMPOSE_FILE=${DB_COMPOSE_FILE:-docker-compose.db.yml}
APP_COMPOSE_FILE=${APP_COMPOSE_FILE:-docker-compose.prod.yml}
STAGING_PORT=${STAGING_PORT:-19001}
PRODUCTION_PORT=${PRODUCTION_PORT:-9001}
DB_PROJECT=${DB_PROJECT:-cca-backend-db}

[ -f "$SHARED_DIR/.env" ] || fail "Falta el archivo compartido de entorno: $SHARED_DIR/.env"

set -a
. "$SHARED_DIR/.env"
set +a

mkdir -p "$BACKUP_DIR"
cd "$RELEASE_DIR"
ln -sfn "$SHARED_DIR/.env" .env

RELEASE_ID=$(basename "$RELEASE_DIR")
APP_PROJECT="backend-$RELEASE_ID"
STAGING_PROJECT="backend-$RELEASE_ID-staging"
OLD_RELEASE=""
OLD_PROJECT=""

if [ -L "$CURRENT_LINK" ] || [ -d "$CURRENT_LINK" ]; then
  OLD_RELEASE=$(readlink -f "$CURRENT_LINK" || true)
  if [ -n "$OLD_RELEASE" ]; then
    OLD_PROJECT="backend-$(basename "$OLD_RELEASE")"
  fi
fi

docker network inspect "$NETWORK_NAME" >/dev/null 2>&1 || docker network create "$NETWORK_NAME" >/dev/null

log "Levantando base de datos"
COMPOSE_PROJECT_NAME="$DB_PROJECT" docker compose -f "$DB_COMPOSE_FILE" up -d db
if ! wait_for_db; then
  fail "La base de datos no estuvo lista a tiempo"
fi

cleanup_staging() {
  stop_backend "$STAGING_PORT" "$STAGING_PROJECT" >/dev/null 2>&1 || true
}

trap cleanup_staging EXIT INT TERM

log "Levantando release candidato en puerto $STAGING_PORT"
start_backend "$STAGING_PORT" "$STAGING_PROJECT"

if ! wait_for_http "http://127.0.0.1:$STAGING_PORT/health"; then
  fail "El release candidato no pasó healthcheck"
fi

log "Creando backup previo a migraciones"
backup_db

log "Aplicando migraciones"
run_migrations

log "Cortando release anterior"
if [ -n "$OLD_RELEASE" ]; then
  BACKEND_PORT="$PRODUCTION_PORT" COMPOSE_PROJECT_NAME="$OLD_PROJECT" docker compose -f "$APP_COMPOSE_FILE" down >/dev/null 2>&1 || true
fi

log "Promoviendo release nuevo en puerto $PRODUCTION_PORT"
stop_backend "$STAGING_PORT" "$STAGING_PROJECT"
BACKEND_PORT="$PRODUCTION_PORT" COMPOSE_PROJECT_NAME="$APP_PROJECT" docker compose -f "$APP_COMPOSE_FILE" up -d --build backend

if ! wait_for_http "http://127.0.0.1:$PRODUCTION_PORT/health"; then
  rollback_to_previous
  fail "El release promovido no pasó healthcheck"
fi

ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
if [ -n "$OLD_RELEASE" ]; then
  ln -sfn "$OLD_RELEASE" "$PREVIOUS_LINK"
fi

trap - EXIT INT TERM
log "Despliegue completado correctamente"
