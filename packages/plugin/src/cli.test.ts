import { describe, expect, it } from "bun:test";

describe("CLI", () => {
  it("prints version", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "version"], {
      cwd: `${import.meta.dir}/..`,
      stdout: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output.trim()).toBe("agentsmith 0.1.0");
    expect(proc.exitCode).toBe(0);
  });

  it("exits 1 on unknown command", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "bogus"], {
      cwd: `${import.meta.dir}/..`,
      stderr: "pipe",
    });
    await proc.exited;
    expect(proc.exitCode).toBe(1);
  });

  it("handles hook command with --event", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "hook", "--event", "PreToolUse"], {
      cwd: `${import.meta.dir}/..`,
      stdout: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output.trim()).toContain("hook: PreToolUse");
    expect(proc.exitCode).toBe(0);
  });
});
