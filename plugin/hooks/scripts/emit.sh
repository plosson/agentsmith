#!/bin/bash
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPTS_DIR/env.sh"
[ -z "$AGENTSMITH_CLIENT_URL" ] && exit 0
# Send raw hook payload to proxy — proxy owns envelope construction
cat | curl -s --max-time 2 -X POST \
  "$AGENTSMITH_CLIENT_URL/api/v1/rooms/$AGENTSMITH_ROOM/events" \
  -H "Content-Type: application/json" \
  -d @-
exit 0
