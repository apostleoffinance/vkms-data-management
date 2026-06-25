#!/usr/bin/env bash
# Create a compressed PostgreSQL backup from the production stack.
#
# Usage:
#   chmod +x deploy/scripts/backup-postgres.sh
#   ./deploy/scripts/backup-postgres.sh
#
# Optional env vars:
#   BACKUP_DIR=/var/backups/vkms
#   RETENTION_DAYS=14

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/vkms_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

echo "Backing up ${POSTGRES_DB} to ${BACKUP_FILE}..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --format=plain \
  | gzip > "$BACKUP_FILE"

echo "Backup complete: ${BACKUP_FILE} ($(du -h "$BACKUP_FILE" | awk '{print $1}'))"

if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && [[ "$RETENTION_DAYS" -gt 0 ]]; then
  find "$BACKUP_DIR" -name "vkms_${POSTGRES_DB}_*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -delete
  echo "Removed backups older than ${RETENTION_DAYS} days."
fi
