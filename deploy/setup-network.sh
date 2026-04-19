#!/usr/bin/env bash
# Membuat shared Docker network `transity-net` agar Terminal, Console,
# dan App bisa saling komunikasi via nama service di dalam Docker.
# Aman dijalankan berulang kali (idempoten).
set -euo pipefail

NETWORK_NAME="transity-net"

if docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
  echo "Network '$NETWORK_NAME' sudah ada. Skip."
else
  docker network create "$NETWORK_NAME"
  echo "Network '$NETWORK_NAME' berhasil dibuat."
fi
