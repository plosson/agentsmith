import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { type ProxyServer, readConfig, startProxy, updateConfigKey, writeConfig } from "./proxy";

// --- config helpers tests ---

describe("config", () => {
  const dir = mkdtempSync(join(tmpdir(), "proxy-test-"));
  const configPath = join(dir, "config");

  test("readConfig returns empty for missing file", () => {
    expect(readConfig(join(dir, "nonexistent"))).toEqual({});
  });

  test("readConfig parses KEY=VALUE lines", () => {
    writeFileSync(configPath, "FOO=bar\nBAZ=qux\n");
    expect(readConfig(configPath)).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  test("readConfig skips comments and empty lines", () => {
    writeFileSync(configPath, "# comment\n\nKEY=val\n");
    expect(readConfig(configPath)).toEqual({ KEY: "val" });
  });

  test("readConfig handles values containing =", () => {
    writeFileSync(configPath, "URL=http://host:3000/path?a=1\n");
    expect(readConfig(configPath)).toEqual({ URL: "http://host:3000/path?a=1" });
  });

  test("writeConfig writes KEY=VALUE lines", () => {
    writeConfig({ A: "1", B: "2" }, configPath);
    expect(readFileSync(configPath, "utf-8")).toBe("A=1\nB=2\n");
  });

  test("updateConfigKey adds key preserving existing", () => {
    writeFileSync(configPath, "EXISTING=yes\n");
    updateConfigKey("NEW", "val", configPath);
    const result = readConfig(configPath);
    expect(result.EXISTING).toBe("yes");
    expect(result.NEW).toBe("val");
  });

  test("updateConfigKey overwrites existing key", () => {
    writeFileSync(configPath, "KEY=old\n");
    updateConfigKey("KEY", "new", configPath);
    expect(readConfig(configPath)).toEqual({ KEY: "new" });
  });
});

// --- proxy server tests ---

describe("proxy server", () => {
  const dir = mkdtempSync(join(tmpdir(), "proxy-test-"));
  const configPath = join(dir, "config");

  let proxy: ProxyServer;
  let upstream: ReturnType<typeof Bun.serve>;
  let upstreamRequests: { path: string; body: unknown }[];

  beforeAll(() => {
    upstreamRequests = [];
    upstream = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        const body = await req.json();
        upstreamRequests.push({ path: url.pathname, body });
        return new Response("ok");
      },
    });

    writeFileSync(configPath, `AGENTSMITH_SERVER_URL=http://localhost:${upstream.port}\n`);
    proxy = startProxy(`http://localhost:${upstream.port}`, configPath);
  });

  afterAll(() => {
    proxy.server.stop();
    upstream.stop();
  });

  test("writes AGENTSMITH_CLIENT_URL to config on startup", () => {
    const config = readConfig(configPath);
    expect(config.AGENTSMITH_CLIENT_URL).toBe(proxy.url);
  });

  test("returns 200 for valid JSON POST", async () => {
    const res = await fetch(`${proxy.url}/api/v1/rooms/test/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "test", payload: {} }),
    });
    expect(res.status).toBe(200);
  });

  test("returns 400 for invalid JSON", async () => {
    const res = await fetch(`${proxy.url}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });

  test("forwards request to upstream with same path", async () => {
    upstreamRequests = [];
    await fetch(`${proxy.url}/api/v1/rooms/myroom/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "session.signal", payload: { signal: "Idle" } }),
    });
    // forward is async/fire-and-forget, give it a moment
    await Bun.sleep(50);
    expect(upstreamRequests.length).toBe(1);
    expect(upstreamRequests[0].path).toBe("/api/v1/rooms/myroom/events");
    expect(upstreamRequests[0].body).toEqual({ event_type: "session.signal", payload: { signal: "Idle" } });
  });

  test("returns hook-specific output for UserPromptSubmit", async () => {
    const res = await fetch(`${proxy.url}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "hook.UserPromptSubmit", payload: {} }),
    });
    const data = await res.json();
    expect(data.hookSpecificOutput).toEqual({
      hookEventName: "UserPromptSubmit",
      additionalContext: "End your response with an emoji.",
    });
  });

  test("returns empty JSON for other event types", async () => {
    const res = await fetch(`${proxy.url}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "session.signal", payload: {} }),
    });
    const data = await res.json();
    expect(data).toEqual({});
  });
});
