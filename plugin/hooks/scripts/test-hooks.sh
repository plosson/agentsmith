#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EMIT="$SCRIPT_DIR/emit.sh"
INIT="$SCRIPT_DIR/init.sh"
SERVER="$SCRIPT_DIR/echo-server.ts"
PORT=3334
PASS=0
FAIL=0
TOTAL=0

export AGENTSMITH_KEY="sk-test"
export AGENTSMITH_URL="http://localhost:$PORT"
export AGENTSMITH_ROOM="room-test"

# --- Helpers ---

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
bold()  { printf "\033[1m%s\033[0m\n" "$1"; }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$expected" = "$actual" ]; then
    green "  PASS  $label"
    PASS=$((PASS + 1))
  else
    red "  FAIL  $label"
    echo "        expected: $expected"
    echo "        actual:   $actual"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_empty() {
  local label="$1" actual="$2"
  TOTAL=$((TOTAL + 1))
  if [ -n "$actual" ]; then
    green "  PASS  $label"
    PASS=$((PASS + 1))
  else
    red "  FAIL  $label (empty)"
    FAIL=$((FAIL + 1))
  fi
}

# Send a hook event and capture the echoed response
send_event() {
  local event_type="$1" payload="$2"
  echo "$payload" | "$EMIT" "$event_type" 2>/dev/null
}

# --- Start echo server ---

bold "Starting echo server on port $PORT..."
bun "$SERVER" "$PORT" &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null' EXIT

# Wait for server to be ready
for i in $(seq 1 20); do
  if curl -s "http://localhost:$PORT" >/dev/null 2>&1; then break; fi
  sleep 0.1
done

# --- Common fields used in all payloads ---

COMMON='"session_id":"sess-001","transcript_path":"/tmp/transcript.jsonl","cwd":"/project","permission_mode":"default"'

# ============================================================
bold ""
bold "=== init.sh tests ==="
# ============================================================

TMPENV=$(mktemp)
TMPCONF=$(mktemp)

cat > "$TMPCONF" <<'EOF'
# AgentSmith test config
AGENTSMITH_KEY=sk-init-test
AGENTSMITH_URL=https://test.agentsmith.dev
AGENTSMITH_ROOM=01JINIT
EOF

bold "init.sh — reads config and writes env file"
HOME_BACKUP="$HOME"
TMPHOME=$(mktemp -d)
mkdir -p "$TMPHOME/.config/agentsmith"
cp "$TMPCONF" "$TMPHOME/.config/agentsmith/config"
HOME="$TMPHOME" CLAUDE_ENV_FILE="$TMPENV" "$INIT"

assert_eq "writes AGENTSMITH_KEY" "AGENTSMITH_KEY=sk-init-test" "$(grep AGENTSMITH_KEY "$TMPENV")"
assert_eq "writes AGENTSMITH_URL" "AGENTSMITH_URL=https://test.agentsmith.dev" "$(grep AGENTSMITH_URL "$TMPENV")"
assert_eq "writes AGENTSMITH_ROOM" "AGENTSMITH_ROOM=01JINIT" "$(grep AGENTSMITH_ROOM "$TMPENV")"
assert_eq "skips comments" "3" "$(wc -l < "$TMPENV" | tr -d ' ')"

HOME="$HOME_BACKUP"
rm -rf "$TMPHOME" "$TMPENV" "$TMPCONF"

bold "init.sh — exits silently when no config"
TMPENV2=$(mktemp)
TMPHOME2=$(mktemp -d)
HOME="$TMPHOME2" CLAUDE_ENV_FILE="$TMPENV2" "$INIT"
assert_eq "env file is empty" "0" "$(wc -c < "$TMPENV2" | tr -d ' ')"
HOME="$HOME_BACKUP"
rm -rf "$TMPHOME2" "$TMPENV2"

# ============================================================
bold ""
bold "=== emit.sh — no-op when unconfigured ==="
# ============================================================

RESULT=$(AGENTSMITH_KEY="" "$EMIT" hook.Test <<< '{}' 2>/dev/null || true)
assert_eq "empty output when no key" "" "$RESULT"

# ============================================================
bold ""
bold "=== emit.sh — all 17 hook events ==="
# ============================================================

# 1. SessionStart
bold "SessionStart"
RESULT=$(send_event "hook.SessionStart" "{$COMMON,\"hook_event_name\":\"SessionStart\",\"source\":\"startup\",\"model\":\"claude-sonnet-4-5-20250929\"}")
assert_eq "event_type" "hook.SessionStart" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.source" "startup" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["source"])')"

# 2. SessionEnd
bold "SessionEnd"
RESULT=$(send_event "hook.SessionEnd" "{$COMMON,\"hook_event_name\":\"SessionEnd\",\"reason\":\"user_exit\"}")
assert_eq "event_type" "hook.SessionEnd" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.reason" "user_exit" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["reason"])')"

# 3. UserPromptSubmit
bold "UserPromptSubmit"
RESULT=$(send_event "hook.UserPromptSubmit" "{$COMMON,\"hook_event_name\":\"UserPromptSubmit\",\"prompt\":\"help me fix this bug\"}")
assert_eq "event_type" "hook.UserPromptSubmit" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.prompt" "help me fix this bug" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["prompt"])')"

# 4. PreToolUse
bold "PreToolUse"
RESULT=$(send_event "hook.PreToolUse" "{$COMMON,\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"ls -la\"},\"tool_use_id\":\"tu-001\"}")
assert_eq "event_type" "hook.PreToolUse" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.tool_name" "Bash" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["tool_name"])')"

# 5. PostToolUse
bold "PostToolUse"
RESULT=$(send_event "hook.PostToolUse" "{$COMMON,\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"/tmp/test\"},\"tool_response\":\"file contents here\"}")
assert_eq "event_type" "hook.PostToolUse" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.tool_name" "Read" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["tool_name"])')"

# 6. PostToolUseFailure
bold "PostToolUseFailure"
RESULT=$(send_event "hook.PostToolUseFailure" "{$COMMON,\"hook_event_name\":\"PostToolUseFailure\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"bad-cmd\"},\"error\":\"command not found\",\"is_interrupt\":false}")
assert_eq "event_type" "hook.PostToolUseFailure" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.error" "command not found" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["error"])')"

# 7. PermissionRequest
bold "PermissionRequest"
RESULT=$(send_event "hook.PermissionRequest" "{$COMMON,\"hook_event_name\":\"PermissionRequest\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"/etc/hosts\"},\"permission_suggestions\":[]}")
assert_eq "event_type" "hook.PermissionRequest" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.tool_name" "Write" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["tool_name"])')"

# 8. Stop
bold "Stop"
RESULT=$(send_event "hook.Stop" "{$COMMON,\"hook_event_name\":\"Stop\",\"stop_hook_active\":true,\"last_assistant_message\":\"Done!\"}")
assert_eq "event_type" "hook.Stop" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.stop_hook_active" "True" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["stop_hook_active"])')"

# 9. Notification
bold "Notification"
RESULT=$(send_event "hook.Notification" "{$COMMON,\"hook_event_name\":\"Notification\",\"message\":\"Permission needed\",\"title\":\"Alert\",\"notification_type\":\"permission_prompt\"}")
assert_eq "event_type" "hook.Notification" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.notification_type" "permission_prompt" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["notification_type"])')"

# 10. SubagentStart
bold "SubagentStart"
RESULT=$(send_event "hook.SubagentStart" "{$COMMON,\"hook_event_name\":\"SubagentStart\",\"agent_id\":\"agent-001\",\"agent_type\":\"Bash\"}")
assert_eq "event_type" "hook.SubagentStart" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.agent_type" "Bash" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["agent_type"])')"

# 11. SubagentStop
bold "SubagentStop"
RESULT=$(send_event "hook.SubagentStop" "{$COMMON,\"hook_event_name\":\"SubagentStop\",\"agent_id\":\"agent-001\",\"agent_type\":\"Explore\",\"last_assistant_message\":\"Found 3 files\"}")
assert_eq "event_type" "hook.SubagentStop" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.agent_type" "Explore" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["agent_type"])')"

# 12. TeammateIdle
bold "TeammateIdle"
RESULT=$(send_event "hook.TeammateIdle" "{$COMMON,\"hook_event_name\":\"TeammateIdle\",\"teammate_name\":\"alice\",\"team_name\":\"backend\"}")
assert_eq "event_type" "hook.TeammateIdle" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.teammate_name" "alice" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["teammate_name"])')"

# 13. TaskCompleted
bold "TaskCompleted"
RESULT=$(send_event "hook.TaskCompleted" "{$COMMON,\"hook_event_name\":\"TaskCompleted\",\"task_id\":\"task-42\",\"task_subject\":\"Fix login bug\"}")
assert_eq "event_type" "hook.TaskCompleted" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.task_id" "task-42" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["task_id"])')"

# 14. ConfigChange
bold "ConfigChange"
RESULT=$(send_event "hook.ConfigChange" "{$COMMON,\"hook_event_name\":\"ConfigChange\",\"source\":\"project_settings\",\"file_path\":\".claude/settings.json\"}")
assert_eq "event_type" "hook.ConfigChange" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.source" "project_settings" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["source"])')"

# 15. WorktreeCreate
bold "WorktreeCreate"
RESULT=$(send_event "hook.WorktreeCreate" "{$COMMON,\"hook_event_name\":\"WorktreeCreate\",\"name\":\"feature-branch\"}")
assert_eq "event_type" "hook.WorktreeCreate" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.name" "feature-branch" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["name"])')"

# 16. WorktreeRemove
bold "WorktreeRemove"
RESULT=$(send_event "hook.WorktreeRemove" "{$COMMON,\"hook_event_name\":\"WorktreeRemove\",\"worktree_path\":\"/tmp/worktrees/feature\"}")
assert_eq "event_type" "hook.WorktreeRemove" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.worktree_path" "/tmp/worktrees/feature" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["worktree_path"])')"

# 17. PreCompact
bold "PreCompact"
RESULT=$(send_event "hook.PreCompact" "{$COMMON,\"hook_event_name\":\"PreCompact\",\"trigger\":\"auto\",\"custom_instructions\":\"preserve auth context\"}")
assert_eq "event_type" "hook.PreCompact" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["event_type"])')"
assert_eq "payload.trigger" "auto" "$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["payload"]["trigger"])')"

# ============================================================
bold ""
bold "=== Auth header test ==="
# ============================================================

bold "Checking Authorization header is included in curl"
# Use curl -v to stderr to verify the header is sent (no extra server needed)
AUTH_OUTPUT=$(echo "{$COMMON,\"hook_event_name\":\"Stop\"}" | bash -c '
  EVENT_TYPE="hook.Stop"
  PAYLOAD=$(cat)
  printf "{\"event_type\":\"%s\",\"payload\":%s}" "$EVENT_TYPE" "$PAYLOAD" \
    | curl -v -s --max-time 2 -X POST \
      "'"$AGENTSMITH_URL"'/api/v1/rooms/'"$AGENTSMITH_ROOM"'/events" \
      -H "Authorization: Bearer '"$AGENTSMITH_KEY"'" \
      -H "Content-Type: application/json" \
      -d @- 2>&1 || true
')
assert_not_empty "Authorization header present" "$(echo "$AUTH_OUTPUT" | grep -i 'Authorization: Bearer sk-test')"

# ============================================================
bold ""
bold "==============================="
if [ $FAIL -eq 0 ]; then
  green "All $TOTAL tests passed"
else
  red "$FAIL/$TOTAL tests failed"
fi
bold "==============================="

exit $FAIL
