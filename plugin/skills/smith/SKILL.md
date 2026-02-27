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

for KEY in AGENTSMITH_SERVER_URL AGENTSMITH_USER AGENTSMITH_ROOM AGENTSMITH_KEY; do
  G=$(grep "^${KEY}=" "$GLOBAL_CONFIG" 2>/dev/null | cut -d= -f2)
  L=$(grep "^${KEY}=" "$LOCAL_CONFIG" 2>/dev/null | cut -d= -f2)
  echo "${KEY}: global=${G:-<not set>} local=${L:-<not set>}"
done
```

Show the user a summary of their current configuration. Indicate which values are missing. Note that `AGENTSMITH_ROOM` defaults to `lobby` if not set, and `AGENTSMITH_KEY` is optional.

**Step 2: Decide what to do based on the result**

- If **all required fields** (`AGENTSMITH_SERVER_URL` and `AGENTSMITH_USER`) are already set → show the current config and ask the user if they want to change anything using `AskUserQuestion` with options "Looks good" and "Change settings". If they choose "Looks good", stop here.
- If any required field is missing → proceed to collect the missing values (Steps 3-5).

**Step 3: Ask for the server URL** (skip if already set and user didn't choose "Change settings")

Use `AskUserQuestion` to ask: **"What is the AgentSmith server URL?"** with these options:
- `http://localhost:6001` — "Local dev server"
- `https://agentsmith.fly.dev` — "Production server"

(The user can also type a custom URL via "Other".)

**Step 4: Ask for the username** (skip if already set and user didn't choose "Change settings")

Use `AskUserQuestion` to ask: **"What is your username (email)?"** with these options:
- Use 2-3 example emails that are clearly placeholders, e.g. `alice@example.com`, `bob@example.com`

(The user will type their actual email via "Other".)

**Step 5: Ask for the room** (skip if already set and user didn't choose "Change settings")

Use `AskUserQuestion` to ask: **"Which room should events be sent to?"** with these options:
- `lobby` — "Default shared room (Recommended)"
- `dev` — "Development room"

(The user can also type a custom room name via "Other".)

**Step 6: Ask for the scope**

Use `AskUserQuestion` to ask: **"Save config for all projects or this project only?"** with these options:
- `All projects (global)` — "Writes to ~/.config/agentsmith/config (Recommended)"
- `This project only` — "Writes to .claude/agentsmith/config"

**Step 7: Write the config**

Based on the scope chosen, write **all collected values** to the chosen config file. Use the following bash pattern to upsert each key:

```bash
CONFIG_FILE="<path>"  # set to global or local path based on scope

upsert() {
  local KEY="$1" VALUE="$2"
  mkdir -p "$(dirname "$CONFIG_FILE")"
  touch "$CONFIG_FILE"
  if grep -q "^${KEY}=" "$CONFIG_FILE"; then
    sed -i '' "s|^${KEY}=.*|${KEY}=${VALUE}|" "$CONFIG_FILE"
  else
    echo "${KEY}=${VALUE}" >> "$CONFIG_FILE"
  fi
}

upsert AGENTSMITH_SERVER_URL "<url>"
upsert AGENTSMITH_USER "<user>"
upsert AGENTSMITH_ROOM "<room>"
```

Only write keys that were collected/changed. Do not touch other keys in the file.

**Step 8: Restart proxy and confirm**

Restart the proxy to pick up the new config:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/init.sh" --restart
```

Tell the user the config was saved and the proxy restarted. Suggest running `/smith status` to verify connectivity.

---

If `$ARGUMENTS` is anything else, tell the user the available subcommands: `status`, `restart`, `setup`.
