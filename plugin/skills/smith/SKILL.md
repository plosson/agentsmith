---
name: smith
description: "Manage Agent Smith"
disable-model-invocation: true
argument-hint: "[status|restart|link|enable|disable]"
---

The user ran `/smith $ARGUMENTS`.

If `$ARGUMENTS` is **"restart"**, restart the proxy by running:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/init.sh" --restart
```

Report the result to the user.

---

If `$ARGUMENTS` is **"status"** (or empty/missing), check the proxy status by running:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/init.sh" --status
```

Report the result to the user in a clean summary table.

---

If `$ARGUMENTS` starts with **"link"**, link this session to an AgentSmith server using a token.

Parse the arguments: `/smith link <token> [local]`.

- `<token>` is required — an `asm_` prefixed token obtained from the AgentSmith frontend.

Run `link.sh` with the appropriate flags:

If `local` was specified:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/link.sh" -s local "<token>"
```

Otherwise:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/link.sh" "<token>"
```

Report the output to the user. If successful, restart the proxy to pick up the new config:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/init.sh" --restart
```

Tell the user the link was established and suggest running `/smith status` to verify connectivity.

If the token is missing, tell the user: **"Usage: `/smith link <token> [local]`"** — they can get a link token from the AgentSmith web frontend.

---

If `$ARGUMENTS` starts with **"enable"**, enable AgentSmith for the current project.

Parse the optional room argument: `/smith enable [room-name]`.

Write the config to `.claude/agentsmith/config`:

```bash
CONFIG_FILE=".claude/agentsmith/config"
mkdir -p "$(dirname "$CONFIG_FILE")"

upsert() {
  local KEY="$1" VALUE="$2"
  touch "$CONFIG_FILE"
  if grep -q "^${KEY}=" "$CONFIG_FILE"; then
    sed -i '' "s|^${KEY}=.*|${KEY}=${VALUE}|" "$CONFIG_FILE"
  else
    echo "${KEY}=${VALUE}" >> "$CONFIG_FILE"
  fi
}

upsert AGENTSMITH_ENABLED true
```

If a room name was provided (e.g., `/smith enable myroom`), also write:

```bash
upsert AGENTSMITH_ROOM "<room-name>"
```

Then tell the user AgentSmith is now enabled for this project. If a room was set, mention it. Remind them to restart the Claude Code session (or run `/smith restart`) for the change to take effect.

---

If `$ARGUMENTS` is **"disable"**, disable AgentSmith for the current project.

Write `AGENTSMITH_ENABLED=false` to `.claude/agentsmith/config`:

```bash
CONFIG_FILE=".claude/agentsmith/config"
mkdir -p "$(dirname "$CONFIG_FILE")"

upsert() {
  local KEY="$1" VALUE="$2"
  touch "$CONFIG_FILE"
  if grep -q "^${KEY}=" "$CONFIG_FILE"; then
    sed -i '' "s|^${KEY}=.*|${KEY}=${VALUE}|" "$CONFIG_FILE"
  else
    echo "${KEY}=${VALUE}" >> "$CONFIG_FILE"
  fi
}

upsert AGENTSMITH_ENABLED false
```

Tell the user AgentSmith is now disabled for this project. Remind them to restart the Claude Code session for the change to take effect.

---

If `$ARGUMENTS` is anything else, tell the user the available subcommands: `status`, `restart`, `link <token> [local]`, `enable [room]`, `disable`.
