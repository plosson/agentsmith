#!/bin/bash
EVENT_TYPE="$1"
if [ -z "$AGENTSMITH_KEY" ]; then
  CONFIG="$HOME/.config/agentsmith/config"
  [ -f "$CONFIG" ] && . "$CONFIG"
fi
[ -z "$AGENTSMITH_KEY" ] && exit 0
# Per-project config overrides
LOCAL_CONFIG=".claude/agentsmith/config"
[ -f "$LOCAL_CONFIG" ] && . "$LOCAL_CONFIG"
PAYLOAD=$(cat)
# Extract session_id from the hook JSON (top-level field in Claude Code payloads)
SESSION_ID=$(echo "$PAYLOAD" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4)
printf '{"room_id":"%s","type":"%s","format":"claude_code_v27","sender":{"user_id":"%s","session_id":"%s"},"payload":%s}' \
  "$AGENTSMITH_ROOM" "$EVENT_TYPE" "$AGENTSMITH_USER" "$SESSION_ID" "$PAYLOAD" \
  | curl -s --max-time 2 -X POST \
    "$AGENTSMITH_CLIENT_URL/api/v1/rooms/$AGENTSMITH_ROOM/events" \
    -H "Authorization: Bearer $AGENTSMITH_KEY" \
    -H "Content-Type: application/json" \
    -d @-
exit 0
