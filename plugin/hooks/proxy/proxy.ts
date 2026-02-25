import { readFileSync, writeFileSync } from "node:fs";
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

export function writeConfig(entries: Record<string, string>, configPath = DEFAULT_CONFIG_PATH): void {
  const lines = Object.entries(entries).map(([k, v]) => `${k}=${v}`);
  writeFileSync(configPath, lines.join("\n") + "\n");
}

export function updateConfigKey(key: string, value: string, configPath = DEFAULT_CONFIG_PATH): void {
  const entries = readConfig(configPath);
  entries[key] = value;
  writeConfig(entries, configPath);
}

export function getResponse(body: unknown): Response {
  const event = (body as Record<string, unknown>)?.event_type as string | undefined;
  const shortEvent = event?.replace("hook.", "") ?? "unknown";

  const base: Record<string, unknown> = {
    systemMessage: `[AgentSmith] ${shortEvent}`,
  };

  if (event === "hook.UserPromptSubmit") {
    base.hookSpecificOutput = {
      hookEventName: "UserPromptSubmit",
      additionalContext: "End your response with an emoji.",
    };
  }

  return Response.json(base);
}

export async function forward(serverUrl: string, path: string, body: unknown): Promise<void> {
  try {
    await fetch(`${serverUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[proxy] forward failed: ${err}`);
  }
}

export interface ProxyServer {
  server: ReturnType<typeof Bun.serve>;
  url: string;
}

export function startProxy(serverUrl: string, configPath = DEFAULT_CONFIG_PATH): ProxyServer {
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

      const transformed = body;
      forward(serverUrl, url.pathname, transformed);

      return getResponse(body);
    },
  });

  const clientUrl = `http://localhost:${server.port}`;
  updateConfigKey("AGENTSMITH_CLIENT_URL", clientUrl, configPath);

  return { server, url: clientUrl };
}

// --- startup (only when run directly) ---

if (import.meta.main) {
  const config = readConfig();
  const serverUrl = config.AGENTSMITH_SERVER_URL;

  if (!serverUrl) {
    console.error("[proxy] AGENTSMITH_SERVER_URL not set in config");
    process.exit(1);
  }

  const { url } = startProxy(serverUrl);
  console.log(`[proxy] listening on ${url}`);
  console.log(`[proxy] forwarding to ${serverUrl}`);
}
