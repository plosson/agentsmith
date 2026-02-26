#!/bin/bash
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$(cd "$SCRIPTS_DIR/.." && pwd)"
PIDFILE="$HOME/.config/agentsmith/proxy.pid"
LOGFILE="$HOME/.config/agentsmith/proxy.log"

. "$SCRIPTS_DIR/env.sh"
[ -z "$AGENTSMITH_SERVER_URL" ] && [ -z "$AGENTSMITH_ROOM" ] && exit 0

# Stop proxy (used by --restart)
stop_proxy() {
  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    kill "$(cat "$PIDFILE")" 2>/dev/null
    sleep 0.3
  fi
  rm -f "$PIDFILE"
}

# Start proxy if not already running
start_proxy() {
  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    return
  fi
  local abs_local
  abs_local="$(pwd)/$_AS_LOCAL"
  AGENTSMITH_LOCAL_CONFIG="$abs_local" \
    nohup bun run "$HOOKS_DIR/proxy/proxy.ts" > "$LOGFILE" 2>&1 &
  echo $! > "$PIDFILE"
}

if [ "$1" = "--status" ]; then
  echo "=== PROXY ==="
  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "RUNNING (pid $(cat "$PIDFILE"))"
  else
    echo "NOT RUNNING"
  fi

  echo ""
  echo "=== CONFIG ==="
  echo "server: ${AGENTSMITH_SERVER_URL:-<not set>}"
  echo "room: ${AGENTSMITH_ROOM:-<not set>}"
  echo "user: ${AGENTSMITH_USER:-<not set>}"
  echo "key: ${AGENTSMITH_KEY:+****}"

  echo ""
  echo "=== PROXY ==="
  if [ -n "$AGENTSMITH_CLIENT_URL" ]; then
    HEALTH=$(curl -s --max-time 2 "$AGENTSMITH_CLIENT_URL/health" 2>&1)
    if [ $? -eq 0 ]; then
      echo "OK at $AGENTSMITH_CLIENT_URL"
    else
      echo "UNREACHABLE at $AGENTSMITH_CLIENT_URL"
    fi
  else
    echo "NO CLIENT_URL configured"
  fi

  echo ""
  echo "=== SERVER ==="
  MODE="${AGENTSMITH_SERVER_MODE:-remote}"
  if [ "$MODE" = "remote" ] && [ -n "$AGENTSMITH_SERVER_URL" ]; then
    AUTH_HEADER=""
    [ -n "$AGENTSMITH_KEY" ] && AUTH_HEADER="Authorization: Bearer $AGENTSMITH_KEY"
    SERVER_HEALTH=$(curl -s --max-time 3 ${AUTH_HEADER:+-H "$AUTH_HEADER"} "$AGENTSMITH_SERVER_URL/health" 2>&1)
    if [ $? -eq 0 ]; then
      echo "OK at $AGENTSMITH_SERVER_URL"
      echo "$SERVER_HEALTH"
    else
      echo "UNREACHABLE at $AGENTSMITH_SERVER_URL"
    fi
  else
    echo "local mode (no remote server)"
  fi
  exit 0
fi

if [ "$1" = "--restart" ]; then
  stop_proxy
fi

start_proxy

if [ "$1" = "--restart" ]; then
  sleep 0.3
  if kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "Proxy restarted (pid $(cat "$PIDFILE"))"
  else
    echo "FAILED to start proxy — check $LOGFILE"
  fi
  exit 0
fi

# Wait briefly for proxy to write AGENTSMITH_CLIENT_URL to config
sleep 0.2

# Re-source to pick up AGENTSMITH_CLIENT_URL written by proxy
. "$SCRIPTS_DIR/env.sh"

# Write merged config to Claude env file
for cfg in "$_AS_GLOBAL" "$_AS_LOCAL"; do
  [ -f "$cfg" ] || continue
  while IFS='=' read -r key _; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    echo "${key}=${!key}" >> "$CLAUDE_ENV_FILE"
  done < "$cfg"
done

curl -s --max-time 2 "$AGENTSMITH_CLIENT_URL/health"
