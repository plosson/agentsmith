#!/bin/bash
EVENT_TYPE="$1"
if [ -z "$AGENTSMITH_KEY" ]; then
  CONFIG="$HOME/.config/agentsmith/config"
  [ -f "$CONFIG" ] && . "$CONFIG"
fi
[ -z "$AGENTSMITH_KEY" ] && exit 0
PAYLOAD=$(cat)
printf '{"event_type":"%s","payload":%s}' "$EVENT_TYPE" "$PAYLOAD" \
  | curl -s --max-time 2 -X POST \
    "$AGENTSMITH_URL/api/v1/rooms/$AGENTSMITH_ROOM/events" \
    -H "Authorization: Bearer $AGENTSMITH_KEY" \
    -H "Content-Type: application/json" \
    -d @-
echo
