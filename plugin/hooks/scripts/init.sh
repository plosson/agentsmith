#!/bin/bash
CONFIG="$HOME/.config/agentsmith/config"
[ -f "$CONFIG" ] || exit 0

HOOKS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="$HOME/.config/agentsmith/proxy.pid"
LOGFILE="$HOME/.config/agentsmith/proxy.log"

# Start proxy if not already running
start_proxy() {
  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    return
  fi
  nohup bun run "$HOOKS_DIR/proxy/proxy.ts" > "$LOGFILE" 2>&1 &
  echo $! > "$PIDFILE"
}

start_proxy

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
