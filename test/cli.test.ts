import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runCli(args: string[]): Promise<CliResult> {
  try {
    const result = await execFileAsync(
      process.execPath,
      ["--import", "tsx", "src/index.ts", ...args],
      { cwd: root },
    );
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      code: failure.code ?? 1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
    };
  }
}

describe("pimpt CLI", () => {
  it("prints the version from package.json", async () => {
    const { code, stdout } = await runCli(["--version"]);

    expect(code).toBe(0);
    expect(stdout.trim()).toBe(`pimpt ${pkg.version}`);
  });

  it("prints help", async () => {
    const { code, stdout } = await runCli(["--help"]);

    expect(code).toBe(0);
    expect(stdout).toContain("Usage");
    expect(stdout).toContain("pimpt");
    expect(stdout).toContain("--version");
  });

  it("rejects unknown options", async () => {
    const { code, stderr } = await runCli(["--nope"]);

    expect(code).toBe(1);
    expect(stderr).toContain("Unknown option: --nope");
  });
});
