import { describe, expect, it } from "bun:test";
import { generateUlid } from "./ulid";

describe("generateUlid", () => {
  it("returns a 26-character string", () => {
    const id = generateUlid();
    expect(id).toHaveLength(26);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateUlid()));
    expect(ids.size).toBe(100);
  });

  it("is lexicographically sortable by time", () => {
    const id1 = generateUlid();
    const id2 = generateUlid();
    expect(id2 >= id1).toBe(true);
  });
});
