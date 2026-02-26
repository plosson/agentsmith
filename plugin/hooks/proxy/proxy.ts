import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_CONFIG_PATH = join(process.env.HOME ?? "~", ".config", "agentsmith", "config");

export function readConfig(configPath = DEFAULT_CONFIG_PATH): Record<string, string> {
  const entries: Record<string, string> = {};
  try {
    const text = readFileSync(configPath, "utf-8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      entries[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  } catch {
    // config may not exist yet
  }
  return entries;
}

export function resolveConfig(configPath = DEFAULT_CONFIG_PATH): Record<string, string> {
  const config = readConfig(configPath);
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("AGENTSMITH_")) {
      config[key] = process.env[key] ?? "";
    }
  }
  return config;
}

export function writeConfig(
  entries: Record<string, string>,
  configPath = DEFAULT_CONFIG_PATH,
): void {
  const lines = Object.entries(entries).map(([k, v]) => `${k}=${v}`);
  writeFileSync(configPath, `${lines.join("\n")}\n`);
}

export function updateConfigKey(
  key: string,
  value: string,
  configPath = DEFAULT_CONFIG_PATH,
): void {
  const entries = readConfig(configPath);
  entries[key] = value;
  writeConfig(entries, configPath);
}

const DEFAULT_QUEUE_BASE = join(process.env.HOME ?? "~", ".config", "agentsmith", "queue");

export function getQueueDir(room: string, baseDir = DEFAULT_QUEUE_BASE): string {
  const dir = join(baseDir, room);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function enqueueMessages(
  room: string,
  messages: unknown[],
  baseDir = DEFAULT_QUEUE_BASE,
): void {
  const dir = getQueueDir(room, baseDir);
  const now = Date.now();
  for (let i = 0; i < messages.length; i++) {
    const filename = `${now}-${i}.json`;
    writeFileSync(join(dir, filename), JSON.stringify(messages[i]));
  }
}

export function dequeueMessage(room: string, baseDir = DEFAULT_QUEUE_BASE): unknown | null {
  const dir = getQueueDir(room, baseDir);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (files.length === 0) return null;
  const filePath = join(dir, files[0]);
  const content = readFileSync(filePath, "utf-8");
  rmSync(filePath);
  return JSON.parse(content);
}

export function getResponse(body: unknown, room?: string, baseDir = DEFAULT_QUEUE_BASE): Response {
  if (room) {
    const queued = dequeueMessage(room, baseDir);
    if (queued) {
      return Response.json(queued);
    }
  }

  const event = (body as Record<string, unknown>)?.event_type as string | undefined;
  const shortEvent = event?.replace("hook.", "") ?? "unknown";

  const base: Record<string, unknown> = {
    systemMessage: `[AgentSmith] ${shortEvent}`,
  };

  return Response.json(base);
}

export async function forward(
  serverUrl: string,
  path: string,
  body: unknown,
  baseDir = DEFAULT_QUEUE_BASE,
): Promise<void> {
  try {
    const res = await fetch(`${serverUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { success?: boolean; messages?: unknown[] };
    if (data.messages && data.messages.length > 0) {
      const roomMatch = path.match(/\/rooms\/([^/]+)\//);
      if (roomMatch) {
        enqueueMessages(roomMatch[1], data.messages, baseDir);
      }
    }
  } catch (err) {
    console.error(`[proxy] forward failed: ${err}`);
  }
}

export function forwardLocal(path: string, body: unknown, baseDir = DEFAULT_QUEUE_BASE): void {
  const event = (body as Record<string, unknown>)?.event_type as string | undefined;
  const messages: unknown[] = [];

  if (event === "hook.UserPromptSubmit") {
    messages.push({
      systemMessage: "[AgentSmith] UserPromptSubmit",
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "End your response with FIVE emojis at least.",
      },
    });
  }

  if (messages.length > 0) {
    const roomMatch = path.match(/\/rooms\/([^/]+)\//);
    if (roomMatch) {
      enqueueMessages(roomMatch[1], messages, baseDir);
    }
  }
}

export interface ProxyServer {
  server: ReturnType<typeof Bun.serve>;
  url: string;
}

export function startProxy(
  mode: "local" | "remote",
  serverUrl: string,
  configPath = DEFAULT_CONFIG_PATH,
  queueBaseDir = DEFAULT_QUEUE_BASE,
): ProxyServer {
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return new Response("invalid json", { status: 400 });
      }

      const roomMatch = url.pathname.match(/\/rooms\/([^/]+)\//);
      const room = roomMatch?.[1];

      if (mode === "local") {
        forwardLocal(url.pathname, body, queueBaseDir);
      } else {
        forward(serverUrl, url.pathname, body, queueBaseDir);
      }

      return getResponse(body, room, queueBaseDir);
    },
  });

  const clientUrl = `http://localhost:${server.port}`;
  updateConfigKey("AGENTSMITH_CLIENT_URL", clientUrl, configPath);

  return { server, url: clientUrl };
}

// --- startup (only when run directly) ---

if (import.meta.main) {
  const config = resolveConfig();
  const mode = (config.AGENTSMITH_SERVER_MODE ?? "remote") as "local" | "remote";
  const serverUrl = config.AGENTSMITH_SERVER_URL ?? "";

  const { url } = startProxy(mode, serverUrl);
  console.log(`[proxy] listening on ${url} (mode: ${mode})`);
  if (mode === "remote") {
    console.log(`[proxy] forwarding to ${serverUrl}`);
  }
}
