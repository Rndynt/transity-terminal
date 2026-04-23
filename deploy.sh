#!/bin/bash
# Deploy / update TransityTerminal stack on the operator's VPS.
#
# Layers the engine sidecar overlay automatically when
# RESERVATION_ENGINE_ENABLED is present in .env (either true or false —
# the engine can run idle).
#
# Usage: ./deploy.sh
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example to .env and fill in operator values."
  exit 1
fi

# Build the compose file list. The engine overlay is added when the operator
# has the engine var configured (regardless of true/false) so the sidecar can
# soak idle before cutover. Operators who never want the engine can just
# leave the var out of .env.
COMPOSE_FILES=(-f docker-compose.yml)
if grep -q '^RESERVATION_ENGINE_ENABLED=' .env; then
  if [ -f deploy/engine/docker-compose.engine.yml ]; then
    COMPOSE_FILES+=(-f deploy/engine/docker-compose.engine.yml)
    echo "[deploy] engine overlay enabled"
  else
    echo "WARN: RESERVATION_ENGINE_ENABLED is set but deploy/engine/docker-compose.engine.yml is missing — running TT only."
  fi
fi

git pull
# Pull the engine image (no-op for the TT service since it builds locally).
docker compose "${COMPOSE_FILES[@]}" pull --ignore-pull-failures || true
docker compose "${COMPOSE_FILES[@]}" up -d --build --remove-orphans
docker image prune -f --filter "until=24h" >/dev/null 2>&1 || true

echo "Deployed: transity-terminal-$(grep ^OPERATOR_SLUG= .env | cut -d= -f2)"
