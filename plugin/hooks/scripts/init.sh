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

# Load config into Claude env
while IFS='=' read -r key value; do
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
  echo "${key}=${value}" >> "$CLAUDE_ENV_FILE"
done < "$CONFIG"

# Display session info
ROOM=$(grep '^AGENTSMITH_ROOM=' "$CONFIG" | cut -d= -f2)
echo "{\"systemMessage\": \"AgentSmith proxy running — room: $ROOM\"}"
