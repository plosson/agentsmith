import { describe, expect, it } from "bun:test";
import { createTestContext } from "./test-utils";

describe("Health check", () => {
  it("GET /health returns 200 with status ok", async () => {
    const { app } = createTestContext();
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, unknown>;
    expect(json.status).toBe("ok");
    expect(json.uptime_seconds).toBeNumber();
    expect(json.auth).toBe("enabled");
  });
});
