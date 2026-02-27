#!/bin/sh
set -e

# ── AgentSmith installer ─────────────────────────────────────────────
# curl -LsSf https://raw.githubusercontent.com/plosson/agentsmith/main/install.sh | sh
# ─────────────────────────────────────────────────────────────────────

REPO="plosson/agentsmith"
CONFIG_DIR="$HOME/.config/agentsmith"
CONFIG_FILE="$CONFIG_DIR/config"

# ── Helpers ──────────────────────────────────────────────────────────

info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m ✓\033[0m  %s\n' "$*"; }
err()   { printf '\033[1;31m ✗\033[0m  %s\n' "$*" >&2; }
bold()  { printf '\033[1m%s\033[0m' "$*"; }

# Write or update a KEY=VALUE in the config file
set_config() {
  key="$1" value="$2"
  mkdir -p "$CONFIG_DIR"
  if [ -f "$CONFIG_FILE" ] && grep -q "^${key}=" "$CONFIG_FILE" 2>/dev/null; then
    # Update existing key (portable sed in-place)
    tmp="$CONFIG_FILE.tmp.$$"
    sed "s|^${key}=.*|${key}=${value}|" "$CONFIG_FILE" > "$tmp" && mv "$tmp" "$CONFIG_FILE"
  else
    echo "${key}=${value}" >> "$CONFIG_FILE"
  fi
}

# ── Banner ───────────────────────────────────────────────────────────

printf '\n'
printf '\033[1m  █▀█ █▀▀ █▀▀ █▄ █ ▀█▀   █▀ █▀▄▀█ █ ▀█▀ █ █\033[0m\n'
printf '\033[1m  █▀█ █ █ ██▀ █ ▀█  █    ▄█ █ ▀ █ █  █  █▀█\033[0m\n'
printf '\033[1m  ▀ ▀ ▀▀▀ ▀▀▀ ▀  ▀  ▀    ▀▀ ▀   ▀ ▀  ▀  ▀ ▀\033[0m\n'
printf '\n'

# ── Step 1: Check prerequisites ─────────────────────────────────────

info "Checking prerequisites..."

if command -v claude >/dev/null 2>&1; then
  ok "Claude Code found ($(claude --version 2>/dev/null || echo 'unknown version'))"
else
  err "Claude Code is not installed."
  printf '    Install it from: https://docs.anthropic.com/en/docs/claude-code\n'
  exit 1
fi

if command -v bun >/dev/null 2>&1; then
  ok "Bun found ($(bun --version 2>/dev/null || echo 'unknown version'))"
else
  err "Bun is not installed. The local proxy requires Bun to run."
  printf '    Install it from: https://bun.sh\n'
  exit 1
fi

# ── Step 2: Add marketplace ──────────────────────────────────────────

info "Adding AgentSmith marketplace..."
mp_out=$(claude plugin marketplace add "$REPO" 2>&1) || true
if printf '%s' "$mp_out" | grep -qi "already installed"; then
  ok "Marketplace already added"
else
  ok "Marketplace added"
fi

# ── Step 3: Choose install scope ─────────────────────────────────────

printf '\n'
info "Where should AgentSmith be installed?"
printf '\n'
printf '    [1] All projects          — available everywhere (recommended)\n'
printf '    [2] This project (team)   — shared with your team via .claude/\n'
printf '    [3] This project (just me) — local to you, not committed\n'
printf '\n'
printf '  Choose [1/2/3] (default: 1): '
read -r scope_choice < /dev/tty

case "$scope_choice" in
  2) scope_flag="-s project" ; scope_label="project (team)" ;;
  3) scope_flag="-s local"   ; scope_label="project (just me)" ;;
  *)  scope_flag=""           ; scope_label="all projects" ;;
esac

info "Installing for ${scope_label}..."
# shellcheck disable=SC2086
inst_out=$(claude plugin install agentsmith@agentsmith-marketplace $scope_flag 2>&1) || true
if printf '%s' "$inst_out" | grep -qi "already installed"; then
  ok "Plugin already installed"
else
  ok "Plugin installed"
fi

# ── Step 4: Username ─────────────────────────────────────────────────

printf '\n'
default_user=$(git config user.email 2>/dev/null || echo "")
if [ -n "$default_user" ]; then
  printf '  Username [%s]: ' "$default_user"
else
  printf '  Username (email): '
fi
read -r user_input < /dev/tty
user="${user_input:-$default_user}"

if [ -z "$user" ]; then
  err "Username is required."
  exit 1
fi

set_config "AGENTSMITH_USER" "$user"
ok "Username set to ${user}"

# ── Step 5: Server URL ──────────────────────────────────────────────

printf '\n'
printf '  Server URL: '
read -r server_url < /dev/tty

if [ -z "$server_url" ]; then
  err "Server URL is required."
  exit 1
fi

set_config "AGENTSMITH_SERVER_URL" "$server_url"
ok "Server URL set to ${server_url}"

# ── Done ─────────────────────────────────────────────────────────────

printf '\n'
printf '\033[1;32m  AgentSmith installed successfully!\033[0m\n'
printf '\n'
printf '  Config: %s\n' "$CONFIG_FILE"
printf '  Restart Claude Code to activate the plugin.\n'
printf '\n'
