#!/usr/bin/env bash
# Obtain or renew Let's Encrypt certificates for production deployment.
#
# Prerequisites:
#   - DNS A records for FRONTEND_DOMAIN and BACKEND_DOMAIN point to this server
#   - Ports 80/443 open in cloud firewall and UFW
#   - .env file populated from .env.production
#   - Stack running: docker compose -f docker-compose.prod.yml up -d
#
# Usage:
#   chmod +x deploy/scripts/init-letsencrypt.sh
#   ./deploy/scripts/init-letsencrypt.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.production to .env and edit it first."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${FRONTEND_DOMAIN:?Set FRONTEND_DOMAIN in .env}"
: "${BACKEND_DOMAIN:?Set BACKEND_DOMAIN in .env}"
: "${LETSENCRYPT_EMAIL:?Set LETSENCRYPT_EMAIL in .env}"

STAGING="${CERTBOT_STAGING:-0}"
STAGING_ARG=""
if [[ "$STAGING" == "1" ]]; then
  STAGING_ARG="--staging"
  echo "Using Let's Encrypt STAGING (test certificates)."
fi

echo "Ensuring production stack is running..."
docker compose -f "$COMPOSE_FILE" up -d

echo "Removing temporary self-signed certificate (if present)..."
docker compose -f "$COMPOSE_FILE" exec nginx sh -c "
  if [ ! -f /etc/letsencrypt/renewal/${FRONTEND_DOMAIN}.conf ]; then
    rm -rf /etc/letsencrypt/live/${FRONTEND_DOMAIN}
    rm -rf /etc/letsencrypt/archive/${FRONTEND_DOMAIN}
  fi
"

echo "Requesting Let's Encrypt certificate..."
docker compose -f "$COMPOSE_FILE" --profile tools run --rm certbot certonly --webroot \
  -w /var/www/certbot \
  $STAGING_ARG \
  --email "$LETSENCRYPT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$FRONTEND_DOMAIN" \
  -d "$BACKEND_DOMAIN"

echo "Reloading nginx with real certificate..."
docker compose -f "$COMPOSE_FILE" exec nginx nginx -s reload

echo "Done. Verify:"
echo "  https://${FRONTEND_DOMAIN}"
echo "  https://${BACKEND_DOMAIN}/health"
