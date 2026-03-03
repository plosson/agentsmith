#!/bin/bash
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$(cd "$SCRIPTS_DIR/.." && pwd)"
PIDFILE="$HOME/.config/agentsmith/proxy.pid"
LOGFILE="$HOME/.config/agentsmith/proxy.log"

. "$SCRIPTS_DIR/env.sh"

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

# Output ASCII banner as JSON systemMessage
print_banner() {
  local l1="" l2="" l3=""
  if [ -z "$AGENTSMITH_SERVER_URL" ]; then
    l2="not configured"
    l3="visit ${AGENTSMITH_WEB_URL:-https://agentsmith.me}/#/link"
  else
    local mode="${AGENTSMITH_SERVER_MODE:-remote}"
    if [ "$mode" = "remote" ]; then
      l1="url:    ${AGENTSMITH_CLIENT_URL:-…} -> ${AGENTSMITH_SERVER_URL} -> ${AGENTSMITH_WEB_URL}"
    else
      l1="url:    ${AGENTSMITH_CLIENT_URL:-…} (local)"
    fi
    l2="user:   ${AGENTSMITH_USER}  room: ${AGENTSMITH_ROOM}"
    # Health check for traffic light
    local indicator="🔴"
    if [ -n "$AGENTSMITH_CLIENT_URL" ]; then
      if curl -s --max-time 2 "$AGENTSMITH_CLIENT_URL/health" >/dev/null 2>&1; then
        indicator="🟢"
      fi
    fi
    l3="mode:   ${mode} ${indicator}"
  fi
  local msg=""
  msg+="\\n  █▀█ █▀▀ █▀▀ █▄ █ ▀█▀   █▀ █▀▄▀█ █ ▀█▀ █ █   ${l1}"
  msg+="\\n  █▀█ █ █ ██▀ █ ▀█  █    ▄█ █ ▀ █ █  █  █▀█   ${l2}"
  msg+="\\n  ▀ ▀ ▀▀▀ ▀▀▀ ▀  ▀  ▀    ▀▀ ▀   ▀ ▀  ▀  ▀ ▀   ${l3}"
  printf '{"systemMessage":"%s"}\n' "$msg"
}

# --status: detailed status (for /smith status)
if [ "$1" = "--status" ]; then
  echo "=== PROXY ==="
  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "RUNNING (pid $(cat "$PIDFILE"))"
  else
    echo "NOT RUNNING"
  fi

  echo ""
  echo "=== CONFIG ==="
  for var in $(compgen -v AGENTSMITH_); do
    if [ "$var" = "AGENTSMITH_KEY" ]; then
      echo "$var=${!var:+****}"
    else
      echo "$var=${!var:-<not set>}"
    fi
  done

  local GREEN="\033[32m" RED="\033[31m" RESET="\033[0m"

  echo ""
  echo "=== PROXY ==="
  if [ -n "$AGENTSMITH_CLIENT_URL" ]; then
    HEALTH=$(curl -s --max-time 2 "$AGENTSMITH_CLIENT_URL/health" 2>&1)
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}●${RESET} OK at $AGENTSMITH_CLIENT_URL"
    else
      echo -e "${RED}●${RESET} UNREACHABLE at $AGENTSMITH_CLIENT_URL"
    fi
  else
    echo -e "${RED}●${RESET} NO CLIENT_URL configured"
  fi

  echo ""
  echo "=== SERVER ==="
  MODE="${AGENTSMITH_SERVER_MODE:-remote}"
  if [ "$MODE" = "remote" ] && [ -n "$AGENTSMITH_SERVER_URL" ]; then
    AUTH_HEADER=""
    [ -n "$AGENTSMITH_KEY" ] && AUTH_HEADER="Authorization: Bearer $AGENTSMITH_KEY"
    SERVER_HEALTH=$(curl -s --max-time 3 ${AUTH_HEADER:+-H "$AUTH_HEADER"} "$AGENTSMITH_SERVER_URL/health" 2>&1)
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}●${RESET} OK at $AGENTSMITH_SERVER_URL"
      echo "$SERVER_HEALTH"
    else
      echo -e "${RED}●${RESET} UNREACHABLE at $AGENTSMITH_SERVER_URL"
    fi
  else
    echo "local mode (no remote server)"
  fi
  exit 0
fi

# --restart: stop + start proxy, then exit
if [ "$1" = "--restart" ]; then
  stop_proxy
  if [ -z "$AGENTSMITH_SERVER_URL" ]; then
    echo "No AGENTSMITH_SERVER_URL configured. Visit ${AGENTSMITH_WEB_URL:-https://agentsmith.me}/#/link"
    exit 0
  fi
  start_proxy
  sleep 0.3
  if kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "Proxy restarted (pid $(cat "$PIDFILE"))"
  else
    echo "FAILED to start proxy — check $LOGFILE"
  fi
  exit 0
fi

# --- SessionStart (no args) ---

# Not configured — banner + exit
if [ -z "$AGENTSMITH_SERVER_URL" ]; then
  print_banner
  exit 0
fi

# Not enabled in this project — show disabled banner + exit
if [ "$AGENTSMITH_ENABLED" != "true" ]; then
  printf '{"systemMessage":"AgentSmith installed but not enabled in this project. Run /smith enable to activate."}\n'
  exit 0
fi

start_proxy

# Wait for proxy to write AGENTSMITH_CLIENT_URL to config (up to 2s)
for _i in 1 2 3 4 5; do
  sleep 0.4
  AGENTSMITH_CLIENT_URL=$(grep '^AGENTSMITH_CLIENT_URL=' "$_AS_GLOBAL" 2>/dev/null | cut -d= -f2)
  [ -n "$AGENTSMITH_CLIENT_URL" ] && break
done

as_export_env
print_banner
