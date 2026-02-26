#!/bin/bash
if [ -z "$AGENTSMITH_CLIENT_URL" ]; then
  CONFIG="$HOME/.config/agentsmith/config"
  [ -f "$CONFIG" ] && . "$CONFIG"
fi
[ -z "$AGENTSMITH_CLIENT_URL" ] && exit 0
LOCAL_CONFIG=".claude/agentsmith/config"
[ -f "$LOCAL_CONFIG" ] && . "$LOCAL_CONFIG"
# Send raw hook payload to proxy — proxy owns envelope construction
cat | curl -s --max-time 2 -X POST \
  "$AGENTSMITH_CLIENT_URL/api/v1/rooms/$AGENTSMITH_ROOM/events" \
  -H "Content-Type: application/json" \
  -d @-
exit 0
