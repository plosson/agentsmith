import { describe, expect, it } from "bun:test";
import { createTestContext } from "./test-utils";

describe("Health check", () => {
  it("GET /health returns 200 with status ok", async () => {
    const { app } = createTestContext();
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({ status: "ok" });
  });
});
