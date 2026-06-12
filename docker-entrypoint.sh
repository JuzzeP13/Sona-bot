#!/bin/sh
set -eu

missing=0

require_env() {
  var_name="$1"
  eval "value=\${$var_name:-}"

  if [ -z "$value" ]; then
    echo "Missing required environment variable: $var_name" >&2
    missing=1
  fi
}

find_postgres_bin() {
  if [ -n "${POSTGRES_BIN:-}" ] && [ -x "${POSTGRES_BIN}/initdb" ]; then
    return
  fi

  for dir in /usr/lib/postgresql/*/bin; do
    if [ -x "${dir}/initdb" ]; then
      POSTGRES_BIN="$dir"
      export POSTGRES_BIN
      return
    fi
  done

  echo "PostgreSQL binaries were not found in the container." >&2
  missing=1
}

escape_sql_literal() {
  printf "%s" "$1" | sed "s/'/''/g"
}

escape_sql_identifier() {
  printf "%s" "$1" | sed 's/"/""/g'
}

start_embedded_postgres() {
  find_postgres_bin
  if [ "$missing" -ne 0 ]; then
    return
  fi

  PGDATA="${PGDATA:-/data/postgres}"
  POSTGRES_RUN_DIR="${POSTGRES_RUN_DIR:-/var/run/postgresql}"
  POSTGRES_DB="${POSTGRES_DB:-sona_bot}"
  POSTGRES_USER="${POSTGRES_USER:-sona_user}"
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-sona_local_password}"
  POSTGRES_PORT="${POSTGRES_PORT:-5432}"
  export PGDATA POSTGRES_RUN_DIR POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD POSTGRES_PORT

  install -d -m 700 -o postgres -g postgres "$PGDATA"
  install -d -m 775 -o postgres -g postgres "$POSTGRES_RUN_DIR"

  if [ ! -s "${PGDATA}/PG_VERSION" ]; then
    echo "Initializing embedded PostgreSQL in ${PGDATA}."
    su postgres -c "\"${POSTGRES_BIN}/initdb\" -D \"${PGDATA}\" --encoding=UTF8 --locale=C.UTF-8"
    {
      echo "listen_addresses = '127.0.0.1'"
      echo "port = ${POSTGRES_PORT}"
      echo "unix_socket_directories = '${POSTGRES_RUN_DIR}'"
    } >> "${PGDATA}/postgresql.conf"
  else
    echo "Using existing embedded PostgreSQL data directory: ${PGDATA}."
  fi

  echo "Starting embedded PostgreSQL on 127.0.0.1:${POSTGRES_PORT}."
  su postgres -c "\"${POSTGRES_BIN}/pg_ctl\" -D \"${PGDATA}\" -o \"-c listen_addresses=127.0.0.1 -c unix_socket_directories=${POSTGRES_RUN_DIR} -p ${POSTGRES_PORT}\" -w start"

  db_ident="$(escape_sql_identifier "$POSTGRES_DB")"
  db_lit="$(escape_sql_literal "$POSTGRES_DB")"
  user_ident="$(escape_sql_identifier "$POSTGRES_USER")"
  user_lit="$(escape_sql_literal "$POSTGRES_USER")"
  pass_lit="$(escape_sql_literal "$POSTGRES_PASSWORD")"
  init_sql="/tmp/sona-bot-postgres-init.sql"

  cat > "$init_sql" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${user_lit}') THEN
    CREATE ROLE "${user_ident}" LOGIN PASSWORD '${pass_lit}';
  ELSE
    ALTER ROLE "${user_ident}" LOGIN PASSWORD '${pass_lit}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE "${db_ident}" OWNER "${user_ident}"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${db_lit}')\gexec

GRANT ALL PRIVILEGES ON DATABASE "${db_ident}" TO "${user_ident}";
SQL

  chmod 600 "$init_sql"
  chown postgres:postgres "$init_sql"
  su postgres -c "\"${POSTGRES_BIN}/psql\" -v ON_ERROR_STOP=1 --username postgres --dbname postgres --file \"${init_sql}\""
  rm -f "$init_sql"

  DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"
  export DATABASE_URL
  echo "DATABASE_URL assembled for embedded PostgreSQL: host=127.0.0.1, port=${POSTGRES_PORT}, db=${POSTGRES_DB}, user=${POSTGRES_USER}."
}

configure_database_url() {
  if [ "${EMBEDDED_POSTGRES_ENABLED:-true}" = "true" ]; then
    start_embedded_postgres
    return
  fi

  if [ -n "${DATABASE_URL:-}" ]; then
    echo "Using DATABASE_URL from environment."
    return
  fi

  if [ -n "${POSTGRES_HOST:-}" ] \
    && [ -n "${POSTGRES_DB:-}" ] \
    && [ -n "${POSTGRES_USER:-}" ] \
    && [ -n "${POSTGRES_PASSWORD:-}" ]; then
    postgres_port="${POSTGRES_PORT:-5432}"
    DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${postgres_port}/${POSTGRES_DB}?schema=public"
    export DATABASE_URL
    echo "DATABASE_URL assembled from external POSTGRES_* variables: host=${POSTGRES_HOST}, port=${postgres_port}, db=${POSTGRES_DB}, user=${POSTGRES_USER}."
    return
  fi

  echo "DATABASE_URL is required, or provide POSTGRES_HOST, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD." >&2
  missing=1
}

configure_database_url
require_env JWT_SECRET
require_env ADMIN_NAME
require_env ADMIN_EMAIL
require_env ADMIN_PASSWORD

if [ "${TELEGRAM_ENABLED:-false}" = "true" ]; then
  require_env TELEGRAM_BOT_TOKEN

  if [ -z "${TELEGRAM_LEAD_CHANNEL_ID:-}" ] && [ -z "${TELEGRAM_ADMIN_CHAT_ID:-}" ]; then
    echo "Telegram notifications are disabled: set TELEGRAM_LEAD_CHANNEL_ID or TELEGRAM_ADMIN_CHAT_ID to receive new lead alerts." >&2
  fi
fi

if [ "$missing" -ne 0 ]; then
  exit 1
fi

exec "$@"
