import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildEnvelope,
  dequeueMessage,
  enqueueMessages,
  forwardLocal,
  getQueueDir,
  type ProxyServer,
  readConfig,
  resolveConfig,
  startProxy,
  updateConfigKey,
  writeConfig,
} from "./proxy";

// --- buildEnvelope tests ---

describe("buildEnvelope", () => {
  test("builds envelope from raw hook payload and config", () => {
    const payload = { hook_event_name: "PreToolUse", session_id: "sess-1", tool_name: "Bash" };
    const config = { AGENTSMITH_ROOM: "room-1", AGENTSMITH_USER: "alice@co" };
    const envelope = buildEnvelope(payload, config);
    expect(envelope).toEqual({
      room_id: "room-1",
      type: "hook.PreToolUse",
      format: "claude_code_v27",
      sender: { user_id: "alice@co", session_id: "sess-1" },
      payload,
    });
  });

  test("defaults to hook.unknown when hook_event_name missing", () => {
    const envelope = buildEnvelope({}, { AGENTSMITH_ROOM: "r", AGENTSMITH_USER: "u" });
    expect(envelope.type).toBe("hook.unknown");
  });

  test("defaults session_id to empty string when missing", () => {
    const envelope = buildEnvelope(
      { hook_event_name: "Stop" },
      { AGENTSMITH_ROOM: "r", AGENTSMITH_USER: "u" },
    );
    expect((envelope.sender as Record<string, string>).session_id).toBe("");
  });
});

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

// --- resolveConfig tests ---

describe("resolveConfig", () => {
  const dir = mkdtempSync(join(tmpdir(), "proxy-test-resolve-"));
  const configPath = join(dir, "config");

  test("env vars override config file values", () => {
    writeFileSync(
      configPath,
      "AGENTSMITH_SERVER_URL=http://from-file\nAGENTSMITH_ROOM=file-room\n",
    );
    const saved = process.env.AGENTSMITH_SERVER_URL;
    try {
      process.env.AGENTSMITH_SERVER_URL = "http://from-env";
      const config = resolveConfig(configPath);
      expect(config.AGENTSMITH_SERVER_URL).toBe("http://from-env");
      expect(config.AGENTSMITH_ROOM).toBe("file-room");
    } finally {
      if (saved === undefined) delete process.env.AGENTSMITH_SERVER_URL;
      else process.env.AGENTSMITH_SERVER_URL = saved;
    }
  });

  test("env vars add keys not in config file", () => {
    writeFileSync(configPath, "AGENTSMITH_ROOM=my-room\n");
    const saved = process.env.AGENTSMITH_KEY;
    try {
      process.env.AGENTSMITH_KEY = "secret-key";
      const config = resolveConfig(configPath);
      expect(config.AGENTSMITH_ROOM).toBe("my-room");
      expect(config.AGENTSMITH_KEY).toBe("secret-key");
    } finally {
      if (saved === undefined) delete process.env.AGENTSMITH_KEY;
      else process.env.AGENTSMITH_KEY = saved;
    }
  });

  test("file values used when no env var set", () => {
    writeFileSync(configPath, "AGENTSMITH_ROOM=from-file\n");
    const saved = process.env.AGENTSMITH_ROOM;
    try {
      delete process.env.AGENTSMITH_ROOM;
      const config = resolveConfig(configPath);
      expect(config.AGENTSMITH_ROOM).toBe("from-file");
    } finally {
      if (saved === undefined) delete process.env.AGENTSMITH_ROOM;
      else process.env.AGENTSMITH_ROOM = saved;
    }
  });

  test("env var AGENTSMITH_SERVER_MODE overrides config", () => {
    writeFileSync(configPath, "AGENTSMITH_SERVER_MODE=remote\n");
    const saved = process.env.AGENTSMITH_SERVER_MODE;
    try {
      process.env.AGENTSMITH_SERVER_MODE = "local";
      const config = resolveConfig(configPath);
      expect(config.AGENTSMITH_SERVER_MODE).toBe("local");
    } finally {
      if (saved === undefined) delete process.env.AGENTSMITH_SERVER_MODE;
      else process.env.AGENTSMITH_SERVER_MODE = saved;
    }
  });
});

// --- proxy server tests (remote mode) ---

describe("proxy server", () => {
  const dir = mkdtempSync(join(tmpdir(), "proxy-test-"));
  const configPath = join(dir, "config");
  const queueBaseDir = join(dir, "queue");

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
        return Response.json({ success: true });
      },
    });

    writeFileSync(
      configPath,
      `AGENTSMITH_SERVER_URL=http://localhost:${upstream.port}\nAGENTSMITH_ROOM=myroom\nAGENTSMITH_USER=alice@co\nAGENTSMITH_KEY=tok\n`,
    );
    proxy = startProxy("remote", `http://localhost:${upstream.port}`, configPath, queueBaseDir);
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
    const res = await fetch(`${proxy.url}/api/v1/rooms/myroom/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hook_event_name: "PreToolUse", session_id: "s1", tool_name: "Bash" }),
    });
    expect(res.status).toBe(200);
  });

  test("returns 400 for invalid JSON", async () => {
    const res = await fetch(`${proxy.url}/api/v1/rooms/myroom/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });

  test("builds envelope and forwards to upstream", async () => {
    upstreamRequests = [];
    await fetch(`${proxy.url}/api/v1/rooms/myroom/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hook_event_name: "Stop", session_id: "s1" }),
    });
    await Bun.sleep(50);
    expect(upstreamRequests.length).toBe(1);
    expect(upstreamRequests[0].path).toBe("/api/v1/rooms/myroom/events");
    expect(upstreamRequests[0].body).toEqual({
      room_id: "myroom",
      type: "hook.Stop",
      format: "claude_code_v27",
      sender: { user_id: "alice@co", session_id: "s1" },
      payload: { hook_event_name: "Stop", session_id: "s1" },
    });
  });
});

// --- message queue tests ---

describe("message queue", () => {
  const dir = mkdtempSync(join(tmpdir(), "queue-test-"));

  test("getQueueDir creates directory if it does not exist", () => {
    const queueDir = getQueueDir("myroom", dir);
    expect(queueDir).toBe(join(dir, "myroom"));
    // Directory should exist (no error reading it)
    expect(readdirSync(queueDir)).toEqual([]);
  });

  test("enqueueMessages writes N files to queue dir", () => {
    enqueueMessages("myroom", [{ a: 1 }, { b: 2 }, { c: 3 }], dir);
    const files = readdirSync(join(dir, "myroom")).sort();
    expect(files.length).toBe(3);
    for (const f of files) {
      expect(f).toMatch(/^\d+-\d+\.json$/);
    }
  });

  test("dequeueMessage returns oldest message first (FIFO)", () => {
    const msg = dequeueMessage("myroom", dir);
    expect(msg).toEqual({ a: 1 });
  });

  test("dequeueMessage deletes file after reading", () => {
    const files = readdirSync(join(dir, "myroom"));
    expect(files.length).toBe(2);
  });

  test("dequeueMessage drains remaining messages in order", () => {
    expect(dequeueMessage("myroom", dir)).toEqual({ b: 2 });
    expect(dequeueMessage("myroom", dir)).toEqual({ c: 3 });
  });

  test("dequeueMessage returns null when queue is empty", () => {
    expect(dequeueMessage("myroom", dir)).toBeNull();
  });
});

// --- forwardLocal tests ---

describe("forwardLocal", () => {
  const dir = mkdtempSync(join(tmpdir(), "local-test-"));

  test("enqueues nothing for non-UserPromptSubmit events", () => {
    forwardLocal("/api/v1/rooms/room1/events", { type: "hook.PreToolUse" }, dir);
    expect(dequeueMessage("room1", dir)).toBeNull();
  });

  test("enqueues UserPromptSubmit-compatible message", () => {
    forwardLocal("/api/v1/rooms/room1/events", { type: "hook.UserPromptSubmit" }, dir);
    const msg = dequeueMessage("room1", dir);
    expect(msg).toEqual({
      systemMessage: "[AgentSmith] UserPromptSubmit",
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "End your response with FIVE emojis at least.",
      },
    });
  });

  test("does not enqueue when path has no room", () => {
    forwardLocal("/test", { type: "hook.UserPromptSubmit" }, dir);
    // No room extracted, so nothing should be queued anywhere
    expect(readdirSync(dir)).toEqual(["room1"]);
  });
});

// --- local mode proxy server tests ---

describe("proxy server (local mode)", () => {
  const dir = mkdtempSync(join(tmpdir(), "proxy-local-test-"));
  const configPath = join(dir, "config");
  const queueBaseDir = join(dir, "queue");

  let proxy: ProxyServer;

  beforeAll(() => {
    writeFileSync(configPath, "AGENTSMITH_SERVER_MODE=local\nAGENTSMITH_ROOM=localroom\nAGENTSMITH_USER=bob@co\n");
    proxy = startProxy("local", "", configPath, queueBaseDir);
  });

  afterAll(() => {
    proxy.server.stop();
  });

  test("returns queued UserPromptSubmit response in local mode", async () => {
    const res = await fetch(`${proxy.url}/api/v1/rooms/localroom/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hook_event_name: "UserPromptSubmit", session_id: "s1" }),
    });
    const data = await res.json();
    expect(data).toEqual({
      systemMessage: "[AgentSmith] UserPromptSubmit",
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "End your response with FIVE emojis at least.",
      },
    });
  });

  test("returns default systemMessage for other events in local mode", async () => {
    const res = await fetch(`${proxy.url}/api/v1/rooms/localroom/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hook_event_name: "PreToolUse", session_id: "s1" }),
    });
    const data = await res.json();
    expect(data).toEqual({ systemMessage: "[AgentSmith] PreToolUse" });
  });

  test("does not contact any upstream server", async () => {
    const res = await fetch(`${proxy.url}/api/v1/rooms/localroom/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hook_event_name: "Stop", session_id: "s1" }),
    });
    expect(res.status).toBe(200);
  });
});
