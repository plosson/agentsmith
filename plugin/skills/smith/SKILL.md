---
name: smith
description: "Manage Agent Smith"
disable-model-invocation: true
argument-hint: "[status|restart|setup]"
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

If `$ARGUMENTS` is **"setup"**, guide the user through configuring their AgentSmith connection.

**Step 1: Check current state**

Run the following to detect existing config:

```bash
GLOBAL_CONFIG="$HOME/.config/agentsmith/config"
LOCAL_CONFIG=".claude/agentsmith/config"

GLOBAL_URL=$(grep '^AGENTSMITH_SERVER_URL=' "$GLOBAL_CONFIG" 2>/dev/null | cut -d= -f2)
LOCAL_URL=$(grep '^AGENTSMITH_SERVER_URL=' "$LOCAL_CONFIG" 2>/dev/null | cut -d= -f2)

echo "GLOBAL_URL=$GLOBAL_URL"
echo "LOCAL_URL=$LOCAL_URL"
```

**Step 2: Decide what to do based on the result**

- If **both** are empty/missing → proceed to Step 3 (ask for URL).
- If a URL is already set → tell the user what's configured (show which file it comes from) and ask if they want to change it using `AskUserQuestion` with options "Keep current" and "Change it". If they choose to keep it, stop here.

**Step 3: Ask for the server URL**

Use `AskUserQuestion` to ask: **"What is the AgentSmith server URL?"** with these options:
- `http://localhost:6001` — "Local dev server"
- `https://agentsmith.fly.dev` — "Production server"

(The user can also type a custom URL via "Other".)

**Step 4: Ask for the scope**

Use `AskUserQuestion` to ask: **"Save this server URL for all projects or this project only?"** with these options:
- `All projects (global)` — "Writes to ~/.config/agentsmith/config"
- `This project only` — "Writes to .claude/agentsmith/config"

**Step 5: Write the config**

Based on the scope chosen:

- **Global**: Ensure `~/.config/agentsmith/` exists, then write/update `AGENTSMITH_SERVER_URL=<url>` in `~/.config/agentsmith/config`. If the file already exists, replace the existing `AGENTSMITH_SERVER_URL` line (or append if not present). Do not touch other keys.
- **Local**: Ensure `.claude/agentsmith/` exists, then write/update `AGENTSMITH_SERVER_URL=<url>` in `.claude/agentsmith/config`. Same rules — replace existing line or append.

Use the following bash pattern to upsert a key in a config file:

```bash
CONFIG_FILE="<path>"  # set to global or local path
KEY="AGENTSMITH_SERVER_URL"
VALUE="<url>"

mkdir -p "$(dirname "$CONFIG_FILE")"
touch "$CONFIG_FILE"
if grep -q "^${KEY}=" "$CONFIG_FILE"; then
  sed -i '' "s|^${KEY}=.*|${KEY}=${VALUE}|" "$CONFIG_FILE"
else
  echo "${KEY}=${VALUE}" >> "$CONFIG_FILE"
fi
```

**Step 6: Confirm**

Tell the user the config was saved and suggest running `/smith status` to verify connectivity, or `/smith restart` if the proxy needs to pick up the new URL.

---

If `$ARGUMENTS` is anything else, tell the user the available subcommands: `status`, `restart`, `setup`.
