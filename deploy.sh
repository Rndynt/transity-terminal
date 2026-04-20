#!/bin/bash
set -e
cd /root/.openclaw/workspace/TransityTerminalNusa
git pull
docker compose up -d --build --remove-orphans
docker image prune -f --filter "until=24h" > /dev/null 2>&1
