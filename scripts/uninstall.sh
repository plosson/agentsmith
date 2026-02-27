#!/bin/sh
set -e

# ── AgentSmith uninstaller ───────────────────────────────────────────
# curl -LsSf https://raw.githubusercontent.com/plosson/agentsmith/main/scripts/uninstall.sh | sh
# ─────────────────────────────────────────────────────────────────────

MARKETPLACE="agentsmith-marketplace"
PLUGIN="agentsmith"
CONFIG_DIR="$HOME/.config/agentsmith"

# ── Helpers ──────────────────────────────────────────────────────────

info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m ✓\033[0m  %s\n' "$*"; }

# ── Banner ───────────────────────────────────────────────────────────

printf '\n'
printf '\033[1m  █▀█ █▀▀ █▀▀ █▄ █ ▀█▀   █▀ █▀▄▀█ █ ▀█▀ █ █\033[0m\n'
printf '\033[1m  █▀█ █ █ ██▀ █ ▀█  █    ▄█ █ ▀ █ █  █  █▀█\033[0m\n'
printf '\033[1m  ▀ ▀ ▀▀▀ ▀▀▀ ▀  ▀  ▀    ▀▀ ▀   ▀ ▀  ▀  ▀ ▀\033[0m\n'
printf '\n'

info "Uninstalling AgentSmith..."

# ── Uninstall plugin from all scopes ─────────────────────────────────

for scope in user project local; do
  out=$(claude plugin uninstall "$PLUGIN" -s "$scope" 2>&1) || true
  if printf '%s' "$out" | grep -qi "not found\|not installed"; then
    : # not installed in this scope
  else
    ok "Plugin removed from ${scope} scope"
  fi
done

# ── Remove marketplace ───────────────────────────────────────────────

mp_out=$(claude plugin marketplace remove "$MARKETPLACE" 2>&1) || true
if printf '%s' "$mp_out" | grep -qi "not found\|not installed\|does not exist"; then
  ok "Marketplace already removed"
else
  ok "Marketplace removed"
fi

# ── Offer to remove config ───────────────────────────────────────────

printf '\n'
printf '  Remove config at %s? [y/N]: ' "$CONFIG_DIR"
read -r remove_config < /dev/tty
case "$remove_config" in
  [yY]|[yY][eE][sS])
    rm -rf "$CONFIG_DIR"
    ok "Config removed"
    ;;
  *)
    ok "Config kept at ${CONFIG_DIR}"
    ;;
esac

# ── Done ─────────────────────────────────────────────────────────────

printf '\n'
printf '\033[1;32m  AgentSmith uninstalled.\033[0m\n'
printf '  Restart Claude Code to complete removal.\n'
printf '\n'
