import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: mocks.execFileSync,
}));

import {
  addCrossDriveCdToPowerShellProfile,
  addLazyGitToPowerShellProfile,
  addTreeListingToPowerShellProfile,
  readPowerShellProfileFeatures,
} from "../src/powershell";

function decodeProfileBlock(script: string): string {
  const encodedBlocks = Array.from(
    script.matchAll(/FromBase64String\('([^']+)'\)/g),
    (match) => match[1],
  );
  const encodedBlock = encodedBlocks.at(-1);
  if (!encodedBlock) throw new Error("PowerShell profile block was not encoded.");
  return Buffer.from(encodedBlock, "base64").toString("utf16le");
}

describe("addLazyGitToPowerShellProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds a custom lg TUI and Git tab completion without importing modules", () => {
    vi.stubGlobal("process", { platform: "win32" });
    try {
      addLazyGitToPowerShellProfile();
    } finally {
      vi.unstubAllGlobals();
    }

    const scripts = mocks.execFileSync.mock.calls.map(
      (call) => call[1][4] as string,
    );
    const lazyGitBlock = scripts[0]
      ? decodeProfileBlock(scripts[0])
      : undefined;
    const completionBlock = scripts[1]
      ? decodeProfileBlock(scripts[1])
      : undefined;

    expect(lazyGitBlock).toContain("# >>> pimpt lazy git >>>");
    expect(lazyGitBlock).toContain("function lg {");
    expect(lazyGitBlock).toContain("Staged");
    expect(lazyGitBlock).toContain("git commit -m");
    expect(lazyGitBlock).not.toContain("Import-Module");
    expect(completionBlock).toContain("# >>> pimpt git completion >>>");
    expect(completionBlock).toContain("Register-ArgumentCompleter -Native -CommandName git");
  });
});

describe("addCrossDriveCdToPowerShellProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes the cd alias and installs zoxide-style frecency jumping", () => {
    vi.stubGlobal("process", { platform: "win32" });
    try {
      addCrossDriveCdToPowerShellProfile();
    } finally {
      vi.unstubAllGlobals();
    }

    const scripts = mocks.execFileSync.mock.calls.map(
      (call) => call[1][4] as string,
    );
    const aliasBlock = scripts[0]
      ? decodeProfileBlock(scripts[0])
      : undefined;
    const cdBlock = scripts[1] ? decodeProfileBlock(scripts[1]) : undefined;

    expect(aliasBlock).toContain("Remove-Item Alias:cd");
    expect(cdBlock).toContain("# >>> pimpt cross-drive cd v3 >>>");
    expect(cdBlock).toContain("function cd {");
    expect(cdBlock).toContain("function cdi {");
    expect(cdBlock).toContain("__pimpt_cd_frecency");
    expect(cdBlock).toContain("__pimpt_cd_query");
    expect(cdBlock).toContain("cd-db.json");
    expect(cdBlock).toContain("^[A-Za-z]:?$");
    expect(cdBlock).toContain("drive {0}: is not available");
    expect(cdBlock).toContain("no match for");
  });
});

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
    expect(treeBlock).toContain("ls: cannot access");
    expect(treeBlock).toContain("[cannot read:");
    expect(treeBlock).toContain("|-- ");
    expect(treeBlock).toContain("|-- ");
  });
});

describe("readPowerShellProfileFeatures", () => {
  it("detects enabled features from their managed profile blocks", () => {
    const profile = [
      "# >>> pimpt terminal icons >>>",
      "Import-Module Terminal-Icons",
      "# <<< pimpt terminal icons <<<",
      "# >>> pimpt command history preview >>>",
      "Set-PSReadLineOption -PredictionViewStyle ListView",
      "# <<< pimpt command history preview <<<",
      "# >>> pimpt lazy git >>>",
      "function lg {}",
      "# <<< pimpt lazy git <<<",
      "# >>> pimpt cross-drive cd v3 >>>",
      "function cd {}",
      "# <<< pimpt cross-drive cd v3 <<<",
      "# >>> pimpt tree-style ls v2 >>>",
      "function ls {}",
      "# <<< pimpt tree-style ls v2 <<<",
    ].join("\r\n");
    mocks.execFileSync.mockReturnValue(
      Buffer.from(profile, "utf16le").toString("base64"),
    );
    vi.stubGlobal("process", { platform: "win32" });
    try {
      expect(readPowerShellProfileFeatures()).toEqual({
        terminalIcons: true,
        historyPreview: true,
        lazyGit: true,
        crossDriveCd: true,
        treeListing: true,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
