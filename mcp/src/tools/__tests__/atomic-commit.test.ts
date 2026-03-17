import { describe, it, expect } from "vitest";
import { extractSha } from "../atomic-commit.js";

describe("extractSha", () => {
  it("extracts SHA from standard commit output", () => {
    expect(extractSha("[main abc1234] feat: add thing")).toBe("abc1234");
  });

  it("extracts SHA from branch with slash", () => {
    expect(extractSha("[feat/login abc1234] feat: add login")).toBe("abc1234");
  });

  it("returns unknown for non-matching output", () => {
    expect(extractSha("no match here")).toBe("unknown");
  });

  it("extracts full short SHA", () => {
    expect(extractSha("[main abcdef1] fix: something")).toBe("abcdef1");
  });
});
