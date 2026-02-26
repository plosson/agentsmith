---
name: room
description: "Set the active room. Usage: /room [room-name]"
---

The user ran `/room $ARGUMENTS`.

If `$ARGUMENTS` is empty or missing, show the current room by running:

```bash
LOCAL=".claude/agentsmith/config"
DEFAULT=$(grep '^AGENTSMITH_ROOM=' "$HOME/.config/agentsmith/config" 2>/dev/null | cut -d= -f2)
OVERRIDE=$(grep '^AGENTSMITH_ROOM=' "$LOCAL" 2>/dev/null | cut -d= -f2)
if [ -n "$OVERRIDE" ]; then
  echo "Room: $OVERRIDE (project override)"
  echo "Default: ${DEFAULT:-<not set>}"
else
  echo "Room: ${DEFAULT:-<not set>} (default)"
fi
```

Report the current room name and whether it's an override or the default.

---

If `$ARGUMENTS` is **"reset"**, remove the room override by running:

```bash
LOCAL=".claude/agentsmith/config"
if [ -f "$LOCAL" ]; then
  sed -i '' '/^AGENTSMITH_ROOM=/d' "$LOCAL"
  # Remove file if empty
  [ ! -s "$LOCAL" ] && rm -f "$LOCAL"
fi
DEFAULT=$(grep '^AGENTSMITH_ROOM=' "$HOME/.config/agentsmith/config" 2>/dev/null | cut -d= -f2)
echo "Room override removed. Using default: ${DEFAULT:-<not set>}"
```

Report the result to the user.

---

Otherwise, set the room override by running:

```bash
LOCAL=".claude/agentsmith/config"
mkdir -p .claude/agentsmith
if [ -f "$LOCAL" ] && grep -q '^AGENTSMITH_ROOM=' "$LOCAL" 2>/dev/null; then
  sed -i '' "s|^AGENTSMITH_ROOM=.*|AGENTSMITH_ROOM=$ARGUMENTS|" "$LOCAL"
else
  echo "AGENTSMITH_ROOM=$ARGUMENTS" >> "$LOCAL"
fi
echo "Room set to: $ARGUMENTS"
```

Report the new room name to the user. The change takes effect immediately for all subsequent hook events in this project.
