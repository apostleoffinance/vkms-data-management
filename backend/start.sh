#!/usr/bin/env bash
# Render / cloud startup: migrate, seed (idempotent), then serve API.
set -euo pipefail

cd "$(dirname "$0")"

echo "Running database migrations..."
alembic upgrade head

echo "Running seed (idempotent)..."
python scripts/seed.py

echo "Starting API on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
