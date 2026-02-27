#!/bin/bash
# Load AgentSmith config: global defaults + per-project overrides.
# Source this file to get all AGENTSMITH_* vars in the current shell.

_AS_GLOBAL="$HOME/.config/agentsmith/config"
_AS_LOCAL=".claude/agentsmith/config"

[ -f "$_AS_GLOBAL" ] && . "$_AS_GLOBAL"
[ -f "$_AS_LOCAL" ] && . "$_AS_LOCAL"

# Default room to "lobby" if not configured
[ -z "$AGENTSMITH_ROOM" ] && AGENTSMITH_ROOM="lobby"

# Default user to git email or system user
if [ -z "$AGENTSMITH_USER" ]; then
  AGENTSMITH_USER=$(git config user.email 2>/dev/null || echo "$USER")
fi

# Write all resolved AGENTSMITH_* vars to Claude env file.
# Called by init.sh once after proxy is ready.
as_export_env() {
  [ -z "$CLAUDE_ENV_FILE" ] && return
  for var in $(compgen -v AGENTSMITH_); do
    echo "${var}=${!var}" >> "$CLAUDE_ENV_FILE"
  done
}
