import { describe, it, expect } from "vitest";
import {
  parseCommitLine,
  groupByType,
  toMarkdown,
  toJson,
} from "../generate-changelog.js";

describe("parseCommitLine", () => {
  it("parses conventional commit with type and subject", () => {
    const result = parseCommitLine("abc1234|feat: add login");
    expect(result).toEqual({
      hash: "abc1234",
      type: "feat",
      scope: null,
      subject: "add login",
    });
  });

  it("parses conventional commit with scope", () => {
    const result = parseCommitLine("abc1234|fix(auth): repair token refresh");
    expect(result).toEqual({
      hash: "abc1234",
      type: "fix",
      scope: "auth",
      subject: "repair token refresh",
    });
  });

  it("parses breaking change with !", () => {
    const result = parseCommitLine("abc1234|feat!: drop Node 6 support");
    expect(result).toEqual({
      hash: "abc1234",
      type: "feat",
      scope: null,
      subject: "drop Node 6 support",
    });
  });

  it("handles non-conventional commit as type other", () => {
    const result = parseCommitLine("abc1234|just a plain message");
    expect(result).toEqual({
      hash: "abc1234",
      type: "other",
      scope: null,
      subject: "just a plain message",
    });
  });

  it("handles pipe in subject (rejoins correctly)", () => {
    const result = parseCommitLine("abc1234|feat: support a|b syntax");
    expect(result).toEqual({
      hash: "abc1234",
      type: "feat",
      scope: null,
      subject: "support a|b syntax",
    });
  });
});

describe("groupByType", () => {
  it("groups commits by their type", () => {
    const commits = [
      { hash: "aaa", type: "feat", scope: null, subject: "add A" },
      { hash: "bbb", type: "fix", scope: null, subject: "fix B" },
      { hash: "ccc", type: "feat", scope: null, subject: "add C" },
    ];
    const groups = groupByType(commits);
    expect(groups.get("feat")).toHaveLength(2);
    expect(groups.get("fix")).toHaveLength(1);
  });

  it("handles empty input", () => {
    const groups = groupByType([]);
    expect(groups.size).toBe(0);
  });
});

describe("toMarkdown", () => {
  it("generates markdown with type labels", () => {
    const groups = new Map([
      [
        "feat",
        [{ hash: "abc1234567", type: "feat", scope: null, subject: "add login" }],
      ],
    ]);
    const md = toMarkdown(groups);
    expect(md).toContain("# Changelog");
    expect(md).toContain("## Features");
    expect(md).toContain("- add login (`abc1234`)");
  });

  it("includes scope in bold", () => {
    const groups = new Map([
      [
        "fix",
        [
          {
            hash: "abc1234567",
            type: "fix",
            scope: "auth",
            subject: "repair token",
          },
        ],
      ],
    ]);
    const md = toMarkdown(groups);
    expect(md).toContain("**auth:**");
  });

  it("uses raw type name for unknown types", () => {
    const groups = new Map([
      [
        "other",
        [{ hash: "abc1234567", type: "other", scope: null, subject: "misc" }],
      ],
    ]);
    const md = toMarkdown(groups);
    expect(md).toContain("## other");
  });
});

describe("toJson", () => {
  it("produces valid JSON grouped by type", () => {
    const groups = new Map([
      [
        "feat",
        [{ hash: "aaa", type: "feat", scope: "api", subject: "add endpoint" }],
      ],
    ]);
    const json = JSON.parse(toJson(groups));
    expect(json.feat).toHaveLength(1);
    expect(json.feat[0]).toEqual({
      hash: "aaa",
      scope: "api",
      subject: "add endpoint",
    });
  });
});
