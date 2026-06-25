#!/usr/bin/env bash
# Reload nginx after certificate renewal (run from host cron).
#
# Example crontab (daily at 03:15 UTC):
#   15 3 * * * /opt/vkms/deploy/scripts/renew-certs.sh >> /var/log/vkms-cert-renew.log 2>&1

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

docker compose -f docker-compose.prod.yml --profile tools run --rm certbot \
  certbot renew --webroot -w /var/www/certbot --quiet

docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo "$(date -Is) Certificate renewal check complete."
