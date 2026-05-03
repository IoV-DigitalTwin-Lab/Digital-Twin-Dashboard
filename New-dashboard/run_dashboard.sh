#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGDIR="$DIR/logs"
mkdir -p "$LOGDIR"

SSH_KEY="$DIR/id_rsa"
SSH_USER_HOST="mihiraja@192.248.10.117"
LOCAL_PORT=16379
REMOTE_HOST=127.0.0.1
REMOTE_PORT=6379

echo "[1/3] Ensuring SSH tunnel ${LOCAL_PORT} -> ${REMOTE_HOST}:${REMOTE_PORT}"

TUNNEL_PATTERN="ssh .*${LOCAL_PORT}:${REMOTE_HOST}:${REMOTE_PORT} .*${SSH_USER_HOST}"
if pgrep -f "$TUNNEL_PATTERN" >/dev/null 2>&1; then
  echo "    Existing tunnel found"
else
  if ! ssh -i "$SSH_KEY" -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -f -N -L ${LOCAL_PORT}:${REMOTE_HOST}:${REMOTE_PORT} ${SSH_USER_HOST}; then
    echo "ERROR: Failed to create SSH tunnel." >&2
    echo "Run manually to see the real SSH error:" >&2
    echo "ssh -i \"$SSH_KEY\" -N -L ${LOCAL_PORT}:${REMOTE_HOST}:${REMOTE_PORT} ${SSH_USER_HOST}" >&2
    exit 1
  fi
fi

if ! ss -ltn | grep -q ":${LOCAL_PORT} "; then
  echo "ERROR: Local tunnel port ${LOCAL_PORT} is not listening." >&2
  exit 1
fi

# Choose python from the project's virtualenv if available
PYTHON="$DIR/.venv/bin/python"
if [ ! -x "$PYTHON" ]; then
  PYTHON=$(command -v python3 || command -v python)
fi

echo "[2/3] Starting bridge service"
if pgrep -f "$DIR/bridge.py" >/dev/null 2>&1; then
  BRIDGE_PID=$(pgrep -f "$DIR/bridge.py" | head -n1)
  echo "    bridge.py already running (PID: $BRIDGE_PID)"
else
  "$PYTHON" "$DIR/bridge.py" > "$LOGDIR/bridge.log" 2>&1 &
  BRIDGE_PID=$!
  sleep 1
  if ! kill -0 "$BRIDGE_PID" >/dev/null 2>&1; then
    echo "ERROR: bridge.py exited immediately. See $LOGDIR/bridge.log" >&2
    exit 1
  fi
fi

echo "[3/3] Starting dashboard API"
if pgrep -f "$DIR/dashboard_api.py" >/dev/null 2>&1; then
  API_PID=$(pgrep -f "$DIR/dashboard_api.py" | head -n1)
  echo "    dashboard_api.py already running (PID: $API_PID)"
else
  "$PYTHON" "$DIR/dashboard_api.py" > "$LOGDIR/dashboard_api.log" 2>&1 &
  API_PID=$!
  sleep 1
  if ! kill -0 "$API_PID" >/dev/null 2>&1; then
    echo "ERROR: dashboard_api.py exited immediately. See $LOGDIR/dashboard_api.log" >&2
    exit 1
  fi
fi

echo "Started SSH tunnel and services"
echo "Bridge PID: $BRIDGE_PID"
echo "Dashboard API PID: $API_PID"
echo "Logs: $LOGDIR"
