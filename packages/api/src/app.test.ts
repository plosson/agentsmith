import { describe, expect, it } from "bun:test";
import app from "./app";

describe("Health check", () => {
  it("GET /health returns 200 with status ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({ status: "ok" });
  });
});
