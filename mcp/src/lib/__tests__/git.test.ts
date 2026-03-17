import { describe, it, expect } from "vitest";
import { parseStatusFiles } from "../git.js";

describe("parseStatusFiles", () => {
  it("parses modified files", () => {
    const output = " M src/file.ts\n M src/other.ts\n";
    const result = parseStatusFiles(output);
    expect(result).toEqual(new Set(["src/file.ts", "src/other.ts"]));
  });

  it("parses added files", () => {
    const output = "A  new-file.ts\n";
    const result = parseStatusFiles(output);
    expect(result).toEqual(new Set(["new-file.ts"]));
  });

  it("parses deleted files", () => {
    const output = " D removed.ts\n";
    const result = parseStatusFiles(output);
    expect(result).toEqual(new Set(["removed.ts"]));
  });

  it("parses untracked files", () => {
    const output = "?? untracked.ts\n";
    const result = parseStatusFiles(output);
    expect(result).toEqual(new Set(["untracked.ts"]));
  });

  it("parses renamed files (extracts destination)", () => {
    const output = "R  old-name.ts -> new-name.ts\n";
    const result = parseStatusFiles(output);
    expect(result).toEqual(new Set(["new-name.ts"]));
  });

  it("returns empty set for empty input", () => {
    expect(parseStatusFiles("")).toEqual(new Set());
    expect(parseStatusFiles("   ")).toEqual(new Set());
  });

  it("handles mixed status types", () => {
    const output = ` M modified.ts
A  added.ts
 D deleted.ts
?? untracked.ts
R  old.ts -> renamed.ts
`;
    const result = parseStatusFiles(output);
    expect(result).toEqual(
      new Set([
        "modified.ts",
        "added.ts",
        "deleted.ts",
        "untracked.ts",
        "renamed.ts",
      ])
    );
  });
});
