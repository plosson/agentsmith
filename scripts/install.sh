#!/bin/sh
set -e

# ── AgentSmith installer ─────────────────────────────────────────────
# curl -LsSf https://raw.githubusercontent.com/plosson/agentsmith/main/scripts/install.sh | sh
# ─────────────────────────────────────────────────────────────────────

REPO="plosson/agentsmith"
MARKETPLACE="agentsmith-marketplace"
PLUGIN="agentsmith"
PLUGIN_KEY="${PLUGIN}@${MARKETPLACE}"

PLUGINS_DIR="$HOME/.claude/plugins"
KNOWN_MP="$PLUGINS_DIR/known_marketplaces.json"
INSTALLED="$PLUGINS_DIR/installed_plugins.json"

# ── Helpers ──────────────────────────────────────────────────────────

info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m ✓\033[0m  %s\n' "$*"; }
err()   { printf '\033[1;31m ✗\033[0m  %s\n' "$*" >&2; }

# Check if a key exists in a JSON file (simple string match)
json_has_key() { [ -f "$1" ] && grep -q "\"$2\"" "$1"; }

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

# ── Step 2: Add or update marketplace ─────────────────────────────────

if json_has_key "$KNOWN_MP" "$MARKETPLACE"; then
  info "Marketplace already registered — updating..."
  claude plugin marketplace update "$MARKETPLACE" 2>&1 || true
  ok "Marketplace updated"
else
  info "Adding AgentSmith marketplace..."
  claude plugin marketplace add "$REPO" 2>&1 || true
  ok "Marketplace added"
fi

# ── Step 3: Install or update plugin ─────────────────────────────────

if json_has_key "$INSTALLED" "$PLUGIN_KEY"; then
  info "Plugin already installed — updating..."
  claude plugin update "$PLUGIN_KEY" 2>&1 || true
  ok "Plugin updated"
else
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
  claude plugin install "${PLUGIN_KEY}" $scope_flag 2>&1 || true
  ok "Plugin installed"
fi

# ── Step 4: Link token ───────────────────────────────────────────────

CONFIG_FILE="$HOME/.config/agentsmith/config"
EXISTING_KEY=""
if [ -f "$CONFIG_FILE" ]; then
  EXISTING_KEY=$(grep '^AGENTSMITH_KEY=' "$CONFIG_FILE" 2>/dev/null | cut -d= -f2)
fi

if [ -n "$EXISTING_KEY" ]; then
  masked=$(printf '%s' "$EXISTING_KEY" | cut -c1-8)
  ok "Already linked (key: ${masked}...)"
else
  # Find link.sh from the installed plugin (take latest version)
  LINK_SCRIPT=$(ls -d "$HOME/.claude/plugins/cache/${MARKETPLACE}/${PLUGIN}"/*/hooks/scripts/link.sh \
                2>/dev/null | sort -V | tail -1)
  if [ -z "$LINK_SCRIPT" ]; then
    err "Could not find link.sh — plugin installation may have failed."
    exit 1
  fi

  printf '\n'
  info "Visit https://agentsmith.me/#/link to get your setup token"
  printf '\n'
  printf '  Paste token: '
  read -r token < /dev/tty

  sh "$LINK_SCRIPT" "$token"
fi

# ── Step 5: Restart proxy if running ──────────────────────────────────

PIDFILE="$HOME/.config/agentsmith/proxy.pid"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  info "Restarting proxy..."
  kill "$(cat "$PIDFILE")" 2>/dev/null
  rm -f "$PIDFILE"
  sleep 0.3
  ok "Proxy stopped (will restart on next Claude Code session)"
fi

# ── Done ─────────────────────────────────────────────────────────────

printf '\n'
printf '\033[1;32m  AgentSmith installed successfully!\033[0m\n'
printf '\n'
printf '  Config: %s\n' "$HOME/.config/agentsmith/config"
printf '  Restart Claude Code to activate the plugin.\n'
printf '\n'
