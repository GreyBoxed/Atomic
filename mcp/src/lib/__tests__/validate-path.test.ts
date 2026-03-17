import { describe, it, expect, afterAll } from "vitest";
import { validatePath } from "../git.js";
import { createTempRepo, type TempRepo } from "./helpers/git-repo.js";

let repo: TempRepo;

// Use a single repo for all tests (validatePath is read-only)
const repoPromise = createTempRepo().then((r) => {
  repo = r;
  return r;
});

afterAll(async () => {
  const r = await repoPromise;
  await r.cleanup();
});

describe("validatePath", () => {
  it("accepts valid relative path within repo", async () => {
    await repoPromise;
    await expect(validatePath("README.md", repo.dir)).resolves.toBeUndefined();
  });

  it("accepts non-existent file (ENOENT allowed)", async () => {
    await repoPromise;
    await expect(
      validatePath("does-not-exist.ts", repo.dir)
    ).resolves.toBeUndefined();
  });

  it("rejects path with .. traversal", async () => {
    await repoPromise;
    await expect(validatePath("../etc/passwd", repo.dir)).rejects.toThrow(
      "path traversal rejected"
    );
  });

  it("rejects absolute path", async () => {
    await repoPromise;
    await expect(validatePath("/etc/passwd", repo.dir)).rejects.toThrow(
      "path traversal rejected"
    );
  });

  it("rejects path with null byte", async () => {
    await repoPromise;
    await expect(validatePath("file\x00.ts", repo.dir)).rejects.toThrow(
      "path traversal rejected"
    );
  });

  it("rejects hyphen-prefixed path (flag injection)", async () => {
    await repoPromise;
    await expect(validatePath("-rf", repo.dir)).rejects.toThrow(
      "path traversal rejected"
    );
  });
});
