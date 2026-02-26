---
name: server
description: "Manage the AgentSmith proxy server. Usage: /server status | /server restart"
---

The user ran `/server $ARGUMENTS`.

If `$ARGUMENTS` is **"restart"**, restart the proxy by running the following command using Bash:

```bash
PIDFILE="$HOME/.config/agentsmith/proxy.pid"
HOOKS_DIR="${CLAUDE_PLUGIN_ROOT}/hooks"
LOGFILE="$HOME/.config/agentsmith/proxy.log"

# Stop existing proxy
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  kill "$(cat "$PIDFILE")" 2>/dev/null
  sleep 0.3
fi
rm -f "$PIDFILE"

# Start proxy
nohup bun run "$HOOKS_DIR/proxy/proxy.ts" > "$LOGFILE" 2>&1 &
echo $! > "$PIDFILE"
sleep 0.3

# Verify
if kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "Proxy restarted (pid $(cat "$PIDFILE"))"
else
  echo "FAILED to start proxy — check $LOGFILE"
fi
```

Report the result to the user.

---

If `$ARGUMENTS` is **"status"** (or empty/missing), check the proxy status by running:

```bash
CONFIG="$HOME/.config/agentsmith/config"
PIDFILE="$HOME/.config/agentsmith/proxy.pid"

echo "=== CONFIG ==="
if [ -f "$CONFIG" ]; then
  cat "$CONFIG"
else
  echo "NOT FOUND: $CONFIG"
fi

echo ""
echo "=== PROXY ==="
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "RUNNING (pid $(cat "$PIDFILE"))"
else
  echo "NOT RUNNING"
fi

echo ""
echo "=== ROOM ==="
LOCAL_CONFIG=".claude/agentsmith/config"
DEFAULT_ROOM=$(grep '^AGENTSMITH_ROOM=' "$CONFIG" 2>/dev/null | cut -d= -f2)
OVERRIDE_ROOM=$(grep '^AGENTSMITH_ROOM=' "$LOCAL_CONFIG" 2>/dev/null | cut -d= -f2)
if [ -n "$OVERRIDE_ROOM" ]; then
  echo "$OVERRIDE_ROOM (project override, default: ${DEFAULT_ROOM:-<not set>})"
else
  echo "${DEFAULT_ROOM:-<not set>} (default)"
fi

echo ""
echo "=== CONNECTIVITY ==="
CLIENT_URL="${AGENTSMITH_CLIENT_URL}"
if [ -z "$CLIENT_URL" ] && [ -f "$CONFIG" ]; then
  CLIENT_URL=$(grep '^AGENTSMITH_CLIENT_URL=' "$CONFIG" | cut -d= -f2)
fi
if [ -n "$CLIENT_URL" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 -X POST "$CLIENT_URL/health" -H "Content-Type: application/json" -d '{"event_type":"hook.Stop","payload":{}}' 2>&1)
  if [ "$HTTP_CODE" = "000" ]; then
    echo "UNREACHABLE at $CLIENT_URL"
  else
    echo "OK (HTTP $HTTP_CODE) at $CLIENT_URL"
  fi
else
  echo "NO CLIENT_URL configured"
fi
```

**Report a summary to the user with:**

- Config: found or missing, which keys are set (mask the AGENTSMITH_KEY value)
- Proxy: running (with PID) or not running
- Room: active room name and whether it's a project override or default
- Connectivity: reachable or not
- Mode: "remote" if AGENTSMITH_SERVER_URL is set, "local" if empty/missing

---

If `$ARGUMENTS` is anything else, tell the user the available subcommands: `status`, `restart`.
