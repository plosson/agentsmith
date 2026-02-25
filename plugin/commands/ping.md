---
name: ping
description: Test AgentSmith emit script connectivity
---

Test the AgentSmith emit script by sending a ping event to the API.

Run the following command using Bash and report the result to the user:

```bash
echo '{"ping":true}' | ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/emit.sh command.ping
```

**Interpreting the result:**

- If `AGENTSMITH_KEY` is not set, emit.sh exits silently (exit 0) — tell the user that AgentSmith is not configured. They need to create `~/.config/agentsmith/config` with `AGENTSMITH_KEY`, `AGENTSMITH_URL`, and `AGENTSMITH_ROOM`, then restart Claude Code so the SessionStart hook loads the config.
- If curl returns a JSON response with a `data` field, the ping was successful — show the response.
- If curl returns an error (connection refused, timeout, 4xx/5xx), report the error and suggest checking `AGENTSMITH_URL` and `AGENTSMITH_KEY` in `~/.config/agentsmith/config`.
