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

# Start SSH tunnel in background (fails if forwarding cannot be established)
ssh -i "$SSH_KEY" -o ExitOnForwardFailure=yes -f -N -L ${LOCAL_PORT}:${REMOTE_HOST}:${REMOTE_PORT} ${SSH_USER_HOST}

# Choose python from the project's virtualenv if available
PYTHON="$DIR/.venv/bin/python"
if [ ! -x "$PYTHON" ]; then
  PYTHON=$(command -v python3 || command -v python)
fi

"$PYTHON" "$DIR/bridge.py" > "$LOGDIR/bridge.log" 2>&1 &
BRIDGE_PID=$!

"$PYTHON" "$DIR/dashboard_api.py" > "$LOGDIR/dashboard_api.log" 2>&1 &
API_PID=$!

echo "Started SSH tunnel and services"
echo "Bridge PID: $BRIDGE_PID"
echo "Dashboard API PID: $API_PID"
echo "Logs: $LOGDIR"
