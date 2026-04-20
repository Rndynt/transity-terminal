#!/bin/bash
set -e

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example to .env and fill in operator values."
  exit 1
fi

git pull
docker compose up -d --build --remove-orphans
docker image prune -f --filter "until=24h" >/dev/null 2>&1
echo "Deployed: transity-terminal-$(grep OPERATOR_SLUG .env | cut -d= -f2)"
