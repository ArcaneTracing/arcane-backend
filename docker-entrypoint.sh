#!/bin/sh
set -e

echo "[Entrypoint] Running database migrations..."
npm run migration:run
echo "[Entrypoint] Migrations complete. Starting application..."
exec "$@"
