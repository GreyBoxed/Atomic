import { describe, it, expect } from "vitest";
import { parseDiff, buildPartialPatch } from "../hunk-parser.js";

describe("parseDiff", () => {
  it("returns empty array for empty input", () => {
    expect(parseDiff("")).toEqual([]);
    expect(parseDiff("   \n  ")).toEqual([]);
  });

  it("parses single-file single-hunk diff", () => {
    const diff = `diff --git a/file.ts b/file.ts
index abc1234..def5678 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line1
+added line
 line2
 line3
`;
    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("file.ts");
    expect(result[0].hunks).toHaveLength(1);
    expect(result[0].hunks[0].oldStart).toBe(1);
    expect(result[0].hunks[0].oldCount).toBe(3);
    expect(result[0].hunks[0].newStart).toBe(1);
    expect(result[0].hunks[0].newCount).toBe(4);
    expect(result[0].hunks[0].lines).toContain("+added line");
  });

  it("parses single-file multi-hunk diff", () => {
    const diff = `diff --git a/file.ts b/file.ts
index abc1234..def5678 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line1
+added
 line2
 line3
@@ -10,3 +11,4 @@
 line10
+another
 line11
 line12
`;
    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].hunks).toHaveLength(2);
    expect(result[0].hunks[0].oldStart).toBe(1);
    expect(result[0].hunks[1].oldStart).toBe(10);
  });

  it("parses multi-file diff", () => {
    const diff = `diff --git a/a.ts b/a.ts
index 1111111..2222222 100644
--- a/a.ts
+++ b/a.ts
@@ -1,2 +1,3 @@
 a1
+a2
 a3
diff --git a/b.ts b/b.ts
index 3333333..4444444 100644
--- a/b.ts
+++ b/b.ts
@@ -1,2 +1,3 @@
 b1
+b2
 b3
`;
    const result = parseDiff(diff);
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("a.ts");
    expect(result[1].path).toBe("b.ts");
  });

  it("parses diff with rename", () => {
    const diff = `diff --git a/old.ts b/new.ts
similarity index 90%
rename from old.ts
rename to new.ts
index abc1234..def5678 100644
--- a/old.ts
+++ b/new.ts
@@ -1,3 +1,3 @@
 line1
-old
+new
 line3
`;
    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("new.ts");
  });

  it("handles hunk header with omitted count (defaults to 1)", () => {
    const diff = `diff --git a/file.ts b/file.ts
index abc1234..def5678 100644
--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-old
+new
`;
    const result = parseDiff(diff);
    expect(result[0].hunks[0].oldCount).toBe(1);
    expect(result[0].hunks[0].newCount).toBe(1);
  });

  it("captures hunk context string", () => {
    const diff = `diff --git a/file.ts b/file.ts
index abc1234..def5678 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@ function doSomething() {
 line1
+added
 line2
 line3
`;
    const result = parseDiff(diff);
    expect(result[0].hunks[0].context).toBe("function doSomething() {");
  });

  it("handles binary file marker (no hunks)", () => {
    const diff = `diff --git a/image.png b/image.png
index abc1234..def5678 100644
Binary files a/image.png and b/image.png differ
`;
    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("image.png");
    expect(result[0].hunks).toHaveLength(0);
  });

  it("handles file paths with spaces", () => {
    const diff = `diff --git a/my file.ts b/my file.ts
index abc1234..def5678 100644
--- a/my file.ts
+++ b/my file.ts
@@ -1,2 +1,3 @@
 line1
+added
 line2
`;
    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("my file.ts");
  });
});

describe("buildPartialPatch", () => {
  const fullDiff = `diff --git a/file.ts b/file.ts
index abc1234..def5678 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line1
+hunk0
 line2
 line3
@@ -10,3 +11,4 @@
 line10
+hunk1
 line11
 line12
@@ -20,3 +22,4 @@
 line20
+hunk2
 line21
 line22
`;

  it("selects a subset of hunks", () => {
    const patch = buildPartialPatch(fullDiff, [1]);
    expect(patch).toContain("+hunk1");
    expect(patch).not.toContain("+hunk0");
    expect(patch).not.toContain("+hunk2");
  });

  it("selects all hunks", () => {
    const patch = buildPartialPatch(fullDiff, [0, 1, 2]);
    expect(patch).toContain("+hunk0");
    expect(patch).toContain("+hunk1");
    expect(patch).toContain("+hunk2");
  });

  it("returns empty string for no valid indices", () => {
    expect(buildPartialPatch(fullDiff, [])).toBe("");
  });

  it("filters out-of-bounds indices", () => {
    const patch = buildPartialPatch(fullDiff, [0, 99]);
    expect(patch).toContain("+hunk0");
    expect(patch).not.toContain("+hunk1");
  });

  it("filters negative indices", () => {
    const patch = buildPartialPatch(fullDiff, [-1, 0]);
    expect(patch).toContain("+hunk0");
  });

  it("preserves header lines", () => {
    const patch = buildPartialPatch(fullDiff, [0]);
    expect(patch).toContain("diff --git");
    expect(patch).toContain("--- a/file.ts");
    expect(patch).toContain("+++ b/file.ts");
  });

  it("ends with newline", () => {
    const patch = buildPartialPatch(fullDiff, [0]);
    expect(patch.endsWith("\n")).toBe(true);
  });

  it("returns empty string for empty diff", () => {
    expect(buildPartialPatch("", [0])).toBe("");
  });
});
