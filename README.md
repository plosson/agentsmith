# AgentSmith

Room-scoped event fabric connecting local Claude Code sessions with a shared web canvas. Enables ambient presence between developers and bidirectional interactions while enforcing strict privacy — no code, messages, or context ever leave your machine.

## How it works

AgentSmith is a Claude Code plugin that captures lifecycle events (session start/stop, tool use, prompts, etc.) and streams them to a shared room via a lightweight local proxy. Other developers in the same room see each other's activity on a web canvas in real time.

```
Claude Code → plugin hooks → local proxy → API server → shared room
```

- **Privacy first** — only event metadata is transmitted, never code or conversation content
- **Non-blocking** — all hooks run asynchronously, so Claude Code stays fast
- **Room-scoped** — events are isolated per room; join different rooms per project

## Install

### Quick install

**macOS / Linux:**
```bash
curl -LsSf https://raw.githubusercontent.com/plosson/agentsmith/main/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/plosson/agentsmith/main/install.ps1 | iex
```

The installer checks prerequisites (Claude Code, Bun), adds the marketplace, lets you choose an install scope, and configures your username and server URL.

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (v2.1.34+)
- [Bun](https://bun.sh/) runtime (required by the local proxy)

### Manual install

```shell
# Step 1: Add the marketplace
claude plugin marketplace add plosson/agentsmith

# Step 2: Install the plugin (pick one)
claude plugin install agentsmith@agentsmith-marketplace              # all projects (recommended)
claude plugin install agentsmith@agentsmith-marketplace -s project   # this project, shared with team
claude plugin install agentsmith@agentsmith-marketplace -s local     # this project, just you
```

## Uninstall

From the command line

```shell
# Step 1a: Install the plugin in the current project AND for you only  
claude plugin uninstall agentsmith@agentsmith-marketplace -s local

# Step 1b: Install the plugin for the current project only but for everyone in the team 
claude plugin uninstall agentsmith@agentsmith-marketplace -s project 

# Step 1c: Install the plugin for the all projects   
claude plugin uninstall agentsmith@agentsmith-marketplace

# Step 2   
claude plugin marketplace remove plosson/agentsmith
```


### For development

```shell
git clone https://github.com/plosson/agentsmith.git
cd agentsmith
claude --plugin-dir ./plugin
```

## Configure

Create `~/.config/agentsmith/config` with the following variables:

```shell
AGENTSMITH_SERVER_URL=https://your-server.example.com  # API server URL
AGENTSMITH_KEY=your-auth-token                         # Auth token
AGENTSMITH_ROOM=default                                # Room name
```

The local proxy URL (`AGENTSMITH_CLIENT_URL`) is written automatically when the proxy starts.

## Plugin commands

| Command | Description |
|---------|-------------|
| `/room [name]` | Set the active room for this project (override) |
| `/room` | Show the current room |
| `/room reset` | Remove the project override, use default room |
| `/server status` | Show proxy status, config, and connectivity |
| `/server restart` | Restart the local proxy |

## Tracked events

The plugin captures the full Claude Code lifecycle:

`SessionStart` `SessionEnd` `UserPromptSubmit` `PreToolUse` `PostToolUse` `PostToolUseFailure` `PermissionRequest` `Stop` `Notification` `SubagentStart` `SubagentStop` `TeammateIdle` `TaskCompleted` `PreCompact`

## Architecture

```
agentsmith/
├── packages/
│   ├── api/              # REST API server (Hono + SQLite)
│   └── shared/           # Shared types & Zod schemas
├── plugin/               # Claude Code plugin
│   ├── hooks/            # Shell scripts + local Bun proxy
│   └── commands/         # /room, /server
└── docker/               # Deployment
```

**Tech stack:** Bun, TypeScript, Hono, SQLite, Zod, Auth0, Biome

## Development

```bash
bun install              # Install dependencies
bun run dev:api          # Start API server (watch mode)
bun test                 # Run all tests
bun run lint             # Biome lint
bun run format           # Biome format
bun run typecheck        # TypeScript check
```

## License

MIT
