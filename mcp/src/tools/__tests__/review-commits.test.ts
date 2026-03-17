import { describe, it, expect } from "vitest";
import { parseNumstat, parseDiffs } from "../review-commits.js";

describe("parseNumstat", () => {
  it("parses numstat output for known SHAs", () => {
    const output = `commit aaa111
1\t2\tfile1.ts
3\t0\tfile2.ts

commit bbb222
0\t5\tfile3.ts
`;
    const result = parseNumstat(output, ["aaa111", "bbb222"]);
    expect(result.get("aaa111")).toEqual({
      files: ["file1.ts", "file2.ts"],
      ins: 4,
      del: 2,
    });
    expect(result.get("bbb222")).toEqual({
      files: ["file3.ts"],
      ins: 0,
      del: 5,
    });
  });

  it("handles binary files (- markers)", () => {
    const output = `commit aaa111
-\t-\timage.png
`;
    const result = parseNumstat(output, ["aaa111"]);
    expect(result.get("aaa111")).toEqual({
      files: ["image.png"],
      ins: 0,
      del: 0,
    });
  });

  it("ignores unknown SHAs", () => {
    const output = `commit unknown123
1\t1\tfile.ts
`;
    const result = parseNumstat(output, ["aaa111"]);
    expect(result.size).toBe(0);
  });

  it("handles empty input", () => {
    const result = parseNumstat("", []);
    expect(result.size).toBe(0);
  });
});

describe("parseDiffs", () => {
  it("extracts per-commit diffs for known SHAs", () => {
    const sha = "a".repeat(40);
    const output = `commit ${sha}
Author: Test <test@test.com>
Date: Mon Jan 1 00:00:00 2026

    feat: add thing

diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-old
+new
`;
    const result = parseDiffs(output, [sha]);
    const diff = result.get(sha);
    expect(diff).toBeDefined();
    expect(diff).toContain("diff --git a/file.ts b/file.ts");
    expect(diff).toContain("+new");
  });

  it("returns empty string for commit with no diff", () => {
    const sha = "b".repeat(40);
    const output = `commit ${sha}
Author: Test <test@test.com>
Date: Mon Jan 1 00:00:00 2026

    docs: update readme

`;
    const result = parseDiffs(output, [sha]);
    expect(result.get(sha)).toBe("");
  });

  it("ignores unknown SHAs", () => {
    const sha = "c".repeat(40);
    const output = `commit ${sha}
Author: Test
Date: now

    msg
`;
    const result = parseDiffs(output, ["other"]);
    expect(result.size).toBe(0);
  });
});
