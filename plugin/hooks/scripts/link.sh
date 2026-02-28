#!/bin/sh
set -e

# ── AgentSmith link ─────────────────────────────────────────────────
# Decodes an asm_ token and writes config values.
# Usage: link.sh <token>
# ─────────────────────────────────────────────────────────────────────

CONFIG_DIR="$HOME/.config/agentsmith"
CONFIG_FILE="$CONFIG_DIR/config"

# ── Helpers ──────────────────────────────────────────────────────────

info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m ✓\033[0m  %s\n' "$*"; }
err()   { printf '\033[1;31m ✗\033[0m  %s\n' "$*" >&2; }

set_config() {
  key="$1" value="$2"
  mkdir -p "$CONFIG_DIR"
  if [ -f "$CONFIG_FILE" ] && grep -q "^${key}=" "$CONFIG_FILE" 2>/dev/null; then
    tmp="$CONFIG_FILE.tmp.$$"
    sed "s|^${key}=.*|${key}=${value}|" "$CONFIG_FILE" > "$tmp" && mv "$tmp" "$CONFIG_FILE"
  else
    echo "${key}=${value}" >> "$CONFIG_FILE"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────

token=$(printf '%s' "$1" | tr -d '[:space:]')

if [ -z "$token" ]; then
  err "Usage: link.sh <token>"
  exit 1
fi

# Validate asm_ prefix
case "$token" in
  asm_*) ;;
  *)
    err "Invalid token — must start with asm_"
    exit 1
    ;;
esac

# Strip prefix, pad base64 to multiple of 4, then decode
b64="${token#asm_}"
while [ $(( ${#b64} % 4 )) -ne 0 ]; do b64="${b64}="; done
json=$(printf '%s' "$b64" | base64 -d 2>/dev/null) || {
  err "Failed to decode token (invalid base64)"
  exit 1
}

# Parse JSON fields using python3 (available on macOS/Linux)
server_url=$(printf '%s' "$json" | python3 -c "import sys,json; print(json.load(sys.stdin)['server_url'])" 2>/dev/null) || {
  err "Invalid token payload (missing server_url)"
  exit 1
}
email=$(printf '%s' "$json" | python3 -c "import sys,json; print(json.load(sys.stdin)['email'])" 2>/dev/null) || {
  err "Invalid token payload (missing email)"
  exit 1
}
api_key=$(printf '%s' "$json" | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])" 2>/dev/null) || {
  err "Invalid token payload (missing api_key)"
  exit 1
}

# Write config
set_config "AGENTSMITH_SERVER_URL" "$server_url"
set_config "AGENTSMITH_USER" "$email"
set_config "AGENTSMITH_KEY" "$api_key"

# Show results with masked key
masked_key=$(printf '%s' "$api_key" | cut -c1-8)
ok "Server:  $server_url"
ok "User:    $email"
ok "API key: ${masked_key}..."
printf '\n'
ok "Config written to $CONFIG_FILE"
