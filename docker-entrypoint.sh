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

require_env DATABASE_URL
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
