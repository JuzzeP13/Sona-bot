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

configure_database_url() {
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
    echo "DATABASE_URL assembled from POSTGRES_* variables: host=${POSTGRES_HOST}, port=${postgres_port}, db=${POSTGRES_DB}, user=${POSTGRES_USER}."
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
    echo "Missing required environment variable: TELEGRAM_LEAD_CHANNEL_ID or TELEGRAM_ADMIN_CHAT_ID" >&2
    missing=1
  fi
fi

if [ "$missing" -ne 0 ]; then
  exit 1
fi

exec "$@"
