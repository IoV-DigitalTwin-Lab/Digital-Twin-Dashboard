#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Kill python processes by matching the script path
pkill -f "$DIR/bridge.py" || true
pkill -f "$DIR/dashboard_api.py" || true

# Kill SSH tunnels forwarding the local redis port
ps -ef | grep "16379:127.0.0.1:6379" | grep -v grep | awk '{print $2}' | xargs --no-run-if-empty kill || true

echo "Stopped services and SSH tunnel (if running)."
