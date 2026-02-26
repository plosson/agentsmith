#!/bin/bash
CONFIG="$HOME/.config/agentsmith/config"
[ -f "$CONFIG" ] || exit 0

HOOKS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="$HOME/.config/agentsmith/proxy.pid"
LOGFILE="$HOME/.config/agentsmith/proxy.log"

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
  nohup bun run "$HOOKS_DIR/proxy/proxy.ts" > "$LOGFILE" 2>&1 &
  echo $! > "$PIDFILE"
}

load_config() {
  . "$CONFIG"
  LOCAL_CONFIG=".claude/agentsmith/config"
  [ -f "$LOCAL_CONFIG" ] && . "$LOCAL_CONFIG"
}

if [ "$1" = "--status" ]; then
  load_config

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
  echo "=== CONNECTIVITY ==="
  if [ -n "$AGENTSMITH_CLIENT_URL" ]; then
    HEALTH=$(curl -s --max-time 2 "$AGENTSMITH_CLIENT_URL/health" 2>&1)
    if [ $? -eq 0 ]; then
      echo "OK at $AGENTSMITH_CLIENT_URL"
      echo "$HEALTH"
    else
      echo "UNREACHABLE at $AGENTSMITH_CLIENT_URL"
    fi
  else
    echo "NO CLIENT_URL configured"
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

# Load global config into Claude env (env vars override file values)
while IFS='=' read -r key value; do
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
  env_val="${!key}"
  echo "${key}=${env_val-$value}" >> "$CLAUDE_ENV_FILE"
done < "$CONFIG"

# Overlay per-project config (values win over global)
LOCAL_CONFIG=".claude/agentsmith/config"
if [ -f "$LOCAL_CONFIG" ]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    echo "${key}=${value}" >> "$CLAUDE_ENV_FILE"
  done < "$LOCAL_CONFIG"
fi

# Read CLIENT_URL from config (proxy writes it on startup)
. "$CONFIG"
[ -f "$LOCAL_CONFIG" ] && . "$LOCAL_CONFIG"
curl -s --max-time 2 "$AGENTSMITH_CLIENT_URL/health"
