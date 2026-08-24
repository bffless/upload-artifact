import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { walkDirectory } from "../src/files";

function touch(root: string, rel: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, rel);
}

describe("walkDirectory", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "files-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  async function relPaths(): Promise<string[]> {
    const files = await walkDirectory(tempDir, "dist");
    return files.map((f) => f.relativePath).sort();
  }

  it("keeps the .bffless directory a bundle ships (skills, workflows)", async () => {
    touch(tempDir, "index.html");
    touch(tempDir, ".bffless/workflows/index.json");
    touch(tempDir, ".bffless/skills/demo/SKILL.md");

    expect(await relPaths()).toEqual([
      "dist/.bffless/skills/demo/SKILL.md",
      "dist/.bffless/workflows/index.json",
      "dist/index.html",
    ]);
  });

  it("still skips every other dot entry, including dotfiles inside .bffless", async () => {
    touch(tempDir, "index.html");
    touch(tempDir, ".DS_Store");
    touch(tempDir, ".git/HEAD");
    touch(tempDir, "assets/.hidden.png");
    touch(tempDir, ".bffless/.DS_Store");
    touch(tempDir, ".bffless/workflows/index.json");

    expect(await relPaths()).toEqual([
      "dist/.bffless/workflows/index.json",
      "dist/index.html",
    ]);
  });

  it("keeps a .bffless directory below the root too (base-path re-keys bundles)", async () => {
    touch(tempDir, "apps/site/dist/.bffless/workflows/index.json");
    touch(tempDir, "apps/site/dist/index.html");

    expect(await relPaths()).toEqual([
      "dist/apps/site/dist/.bffless/workflows/index.json",
      "dist/apps/site/dist/index.html",
    ]);
  });

  it("uploads a bundle that is only .bffless (an implementation bundle)", async () => {
    touch(tempDir, ".bffless/workflows/index.json");
    touch(tempDir, ".bffless/workflows/hello.workflow.yaml");

    expect((await relPaths()).length).toBe(2);
  });
});
