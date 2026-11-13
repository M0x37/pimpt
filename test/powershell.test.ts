import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: mocks.execFileSync,
}));

import { addTreeListingToPowerShellProfile } from "../src/powershell";

function decodeProfileBlock(script: string): string {
  const encodedBlocks = Array.from(
    script.matchAll(/FromBase64String\('([^']+)'\)/g),
    (match) => match[1],
  );
  const encodedBlock = encodedBlocks.at(-1);
  if (!encodedBlock) throw new Error("PowerShell profile block was not encoded.");
  return Buffer.from(encodedBlock, "base64").toString("utf16le");
}

describe("addTreeListingToPowerShellProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes the built-in ls alias before defining the tree command", () => {
    vi.stubGlobal("process", { platform: "win32" });
    try {
      addTreeListingToPowerShellProfile();
    } finally {
      vi.unstubAllGlobals();
    }

    const scripts = mocks.execFileSync.mock.calls.map(
      (call) => call[1][4] as string,
    );
    const aliasBlock = scripts[0]
      ? decodeProfileBlock(scripts[0])
      : undefined;
    const treeBlock = scripts[1]
      ? decodeProfileBlock(scripts[1])
      : undefined;

    expect(aliasBlock).toContain("Remove-Item Alias:ls");
    expect(treeBlock).toContain("function ls {");
    expect(treeBlock).toContain("[int]$Limit = 50");
    expect(treeBlock).toContain("[switch]$All");
    expect(treeBlock).toContain("output capped at");
    expect(treeBlock).toContain("├── ");
    expect(treeBlock).toContain("└── ");
  });
});
