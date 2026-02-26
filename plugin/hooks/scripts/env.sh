#!/bin/bash
# Load AgentSmith config: global defaults + per-project overrides.
# Source this file to get all AGENTSMITH_* vars in the current shell.

_AS_GLOBAL="$HOME/.config/agentsmith/config"
_AS_LOCAL=".claude/agentsmith/config"

[ -f "$_AS_GLOBAL" ] && . "$_AS_GLOBAL"
[ -f "$_AS_LOCAL" ] && . "$_AS_LOCAL"
