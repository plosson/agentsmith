# Claude Code Plugin & Hooks Specification

> **Status:** Reference
> **Source:** [Plugins](https://code.claude.com/docs/en/plugins.md) · [Hooks](https://code.claude.com/docs/en/hooks)
> **Min version:** Claude Code 1.0.33+

---

## Table of Contents

1. [Plugin Structure](#1-plugin-structure)
2. [Plugin Manifest](#2-plugin-manifest)
3. [Plugin Components](#3-plugin-components)
4. [Hooks System](#4-hooks-system)
5. [Hook Events Reference](#5-hook-events-reference)
6. [Hook Input & Output](#6-hook-input--output)
7. [Testing & Debugging](#7-testing--debugging)

---

## 1. Plugin Structure

A plugin is a directory containing a `.claude-plugin/plugin.json` manifest and optional component directories at the plugin root.

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json          # Manifest (ONLY file inside .claude-plugin/)
├── commands/                 # Slash commands (Markdown files)
├── agents/                   # Custom agent definitions
├── skills/                   # Agent Skills (folders with SKILL.md)
├── hooks/
│   └── hooks.json            # Event handlers
├── .mcp.json                 # MCP server configurations
├── .lsp.json                 # LSP server configurations
└── settings.json             # Default settings applied when plugin is enabled
```

> **Warning:** Never put `commands/`, `agents/`, `skills/`, or `hooks/` inside `.claude-plugin/`. Only `plugin.json` goes there.

Skills are namespaced: a skill `hello/` in a plugin named `my-plugin` creates `/my-plugin:hello`.

---

## 2. Plugin Manifest

File: `.claude-plugin/plugin.json`

```json
{
  "name": "agentsmith",
  "description": "AgentSmith - collaborative awareness for Claude Code sessions",
  "version": "0.1.0",
  "author": {
    "name": "Your Name"
  }
}
```

| Field         | Required | Purpose                                                    |
|---------------|----------|------------------------------------------------------------|
| `name`        | yes      | Unique identifier and skill namespace prefix               |
| `description` | yes      | Shown in the plugin manager                                |
| `version`     | yes      | Semantic versioning                                        |
| `author`      | no       | Attribution                                                |
| `homepage`    | no       | URL for the plugin                                         |
| `repository`  | no       | Source repository URL                                      |
| `license`     | no       | License identifier                                         |

---

## 3. Plugin Components

### Skills

Skills live in `skills/<name>/SKILL.md`. They are model-invoked (Claude uses them automatically based on context).

```yaml
---
name: code-review
description: Reviews code for best practices. Use when reviewing code or checking PRs.
---

When reviewing code, check for:
1. Code organization and structure
2. Error handling
3. Security concerns
```

Use `$ARGUMENTS` in skill content to capture user input.

### Hooks

Defined in `hooks/hooks.json`. See [Hooks System](#4-hooks-system) below.

### Settings

`settings.json` at plugin root applies default configuration. Currently supports the `agent` key to activate a custom agent as the main thread.

```json
{
  "agent": "security-reviewer"
}
```

---

## 4. Hooks System

Hooks are shell commands or LLM prompts that execute at specific points in Claude Code's lifecycle.

### Hook Locations (priority order)

| Location                        | Scope               | Shareable |
|---------------------------------|----------------------|-----------|
| Managed policy settings         | Organization-wide    | Admin     |
| `~/.claude/settings.json`       | All user projects    | No        |
| `.claude/settings.json`         | Single project       | Yes (git) |
| `.claude/settings.local.json`   | Single project       | No        |
| Plugin `hooks/hooks.json`       | When plugin enabled  | Yes       |
| Skill/agent frontmatter         | Component lifecycle  | Yes       |

### Configuration Format

```json
{
  "hooks": {
    "<HookEvent>": [
      {
        "matcher": "<regex>",
        "hooks": [
          {
            "type": "command",
            "command": "path/to/script.sh",
            "timeout": 600,
            "async": false
          }
        ]
      }
    ]
  }
}
```

### Hook Handler Types

| Type      | Description                                         | Default Timeout |
|-----------|-----------------------------------------------------|-----------------|
| `command` | Shell command. Receives JSON on stdin                | 600s            |
| `prompt`  | Single-turn LLM evaluation                          | 30s             |
| `agent`   | Multi-turn subagent with tool access (Read, Grep…)  | 60s             |

### Matcher Patterns

The `matcher` field is a regex. Omit or use `"*"` to match all.

| Event type                                            | Matches on    | Examples                       |
|-------------------------------------------------------|---------------|--------------------------------|
| `PreToolUse`, `PostToolUse`, `PermissionRequest`, etc | tool name     | `Bash`, `Edit\|Write`          |
| `SessionStart`                                        | session start | `startup`, `resume`, `compact` |
| `SessionEnd`                                          | exit reason   | `clear`, `other`               |
| `Notification`                                        | notif type    | `permission_prompt`            |
| `SubagentStart`, `SubagentStop`                       | agent type    | `Bash`, `Explore`, `Plan`      |
| `PreCompact`                                          | trigger       | `manual`, `auto`               |
| `ConfigChange`                                        | source        | `project_settings`, `skills`   |

Events without matcher support (always fire): `UserPromptSubmit`, `Stop`, `TeammateIdle`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove`.

### Environment Variables

| Variable              | Description                                               |
|-----------------------|-----------------------------------------------------------|
| `$CLAUDE_PROJECT_DIR` | Project root directory                                    |
| `${CLAUDE_PLUGIN_ROOT}` | Plugin root directory (for scripts bundled with plugin) |
| `$CLAUDE_ENV_FILE`    | Path for persisting env vars (SessionStart only)          |
| `$CLAUDE_CODE_REMOTE` | `"true"` in remote web environments                       |

---

## 5. Hook Events Reference

### Lifecycle Overview

```
SessionStart
  └─► UserPromptSubmit
       └─► PreToolUse → [tool execution] → PostToolUse / PostToolUseFailure
            └─► PermissionRequest (if permission dialog needed)
       └─► SubagentStart → SubagentStop
       └─► Stop
  └─► Notification (anytime)
  └─► ConfigChange (anytime)
  └─► PreCompact (before compaction)
SessionEnd
```

### Event Summary

| Event                | Can Block? | Input Fields (beyond common)                        |
|----------------------|------------|-----------------------------------------------------|
| `SessionStart`       | No         | `source`, `model`, `agent_type?`                    |
| `UserPromptSubmit`   | Yes        | `prompt`                                            |
| `PreToolUse`         | Yes        | `tool_name`, `tool_input`, `tool_use_id`            |
| `PermissionRequest`  | Yes        | `tool_name`, `tool_input`, `permission_suggestions` |
| `PostToolUse`        | No*        | `tool_name`, `tool_input`, `tool_response`          |
| `PostToolUseFailure` | No*        | `tool_name`, `tool_input`, `error`, `is_interrupt`  |
| `Notification`       | No         | `message`, `title?`, `notification_type`            |
| `SubagentStart`      | No         | `agent_id`, `agent_type`                            |
| `SubagentStop`       | Yes        | `agent_id`, `agent_type`, `last_assistant_message`  |
| `Stop`               | Yes        | `stop_hook_active`, `last_assistant_message`        |
| `TeammateIdle`       | Yes        | `teammate_name`, `team_name`                        |
| `TaskCompleted`      | Yes        | `task_id`, `task_subject`, `task_description?`      |
| `ConfigChange`       | Yes**      | `source`, `file_path?`                              |
| `WorktreeCreate`     | Yes        | `name`                                              |
| `WorktreeRemove`     | No         | `worktree_path`                                     |
| `PreCompact`         | No         | `trigger`, `custom_instructions`                    |
| `SessionEnd`         | No         | `reason`                                            |

\* Can provide feedback to Claude via `decision: "block"`.
\** Cannot block `policy_settings` changes.

### Common Input Fields (all events)

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/path/to/project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse"
}
```

---

## 6. Hook Input & Output

### Exit Codes

| Exit Code | Meaning          | Behavior                                         |
|-----------|------------------|--------------------------------------------------|
| `0`       | Success          | Parse stdout for JSON. Action proceeds           |
| `2`       | Blocking error   | stderr fed to Claude. Blocks action (if allowed) |
| Other     | Non-blocking err | stderr shown in verbose mode. Continues          |

### JSON Output (on exit 0)

Universal fields:

| Field            | Default | Description                                      |
|------------------|---------|--------------------------------------------------|
| `continue`       | `true`  | `false` stops Claude entirely                    |
| `stopReason`     | —       | Message shown when `continue` is `false`         |
| `suppressOutput` | `false` | Hides stdout from verbose output                 |
| `systemMessage`  | —       | Warning message shown to user                    |

### Decision Control Patterns

**Top-level decision** (UserPromptSubmit, PostToolUse, Stop, SubagentStop, ConfigChange):

```json
{ "decision": "block", "reason": "Explanation for Claude" }
```

**PreToolUse** (hookSpecificOutput):

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask",
    "permissionDecisionReason": "Reason",
    "updatedInput": { "field": "new_value" },
    "additionalContext": "Extra context for Claude"
  }
}
```

**PermissionRequest** (hookSpecificOutput):

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow|deny",
      "updatedInput": {},
      "message": "Reason (deny only)"
    }
  }
}
```

**Exit code only** (TeammateIdle, TaskCompleted): exit 2 + stderr message.

### Tool Input Schemas (PreToolUse)

| Tool      | Key Fields                                            |
|-----------|-------------------------------------------------------|
| `Bash`    | `command`, `description?`, `timeout?`                 |
| `Write`   | `file_path`, `content`                                |
| `Edit`    | `file_path`, `old_string`, `new_string`, `replace_all?` |
| `Read`    | `file_path`, `offset?`, `limit?`                      |
| `Glob`    | `pattern`, `path?`                                    |
| `Grep`    | `pattern`, `path?`, `glob?`, `output_mode?`           |
| `WebFetch`| `url`, `prompt`                                       |
| `Task`    | `prompt`, `description`, `subagent_type`              |

---

## 7. Testing & Debugging

### Local Testing

```bash
# Load plugin from directory
claude --plugin-dir ./packages/plugin

# Load multiple plugins
claude --plugin-dir ./plugin-one --plugin-dir ./plugin-two
```

Restart Claude Code after changes. Test components:
- Skills: `/plugin-name:skill-name`
- Agents: `/agents`
- Hooks: trigger the relevant event

### Debug Mode

```bash
claude --debug
```

Shows hook execution details: matched hooks, exit codes, output. Toggle verbose mode with `Ctrl+O`.

### Async Hooks

Set `"async": true` on command hooks to run in background without blocking. Output is delivered on the next conversation turn. Cannot return decisions.

```json
{
  "type": "command",
  "command": "path/to/script.sh",
  "async": true,
  "timeout": 120
}
```
