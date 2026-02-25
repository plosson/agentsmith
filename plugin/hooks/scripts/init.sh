#!/bin/bash
CONFIG="$HOME/.config/agentsmith/config"
[ -f "$CONFIG" ] || exit 0
while IFS='=' read -r key value; do
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
  echo "${key}=${value}" >> "$CLAUDE_ENV_FILE"
done < "$CONFIG"
