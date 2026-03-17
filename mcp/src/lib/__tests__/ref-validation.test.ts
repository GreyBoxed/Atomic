import { describe, it, expect } from "vitest";
import { validateRange } from "../ref-validation.js";

describe("validateRange", () => {
  describe("valid single refs", () => {
    it.each([
      "HEAD",
      "HEAD~3",
      "HEAD^2",
      "v1.0.0",
      "feature/branch",
      "abc1234",
      "main",
      "refs/heads/main",
      "v1.2.3~1",
    ])("accepts %s", (ref) => {
      const result = validateRange(ref);
      expect(result).toEqual({ kind: "single", ref });
    });
  });

  describe("valid two-dot ranges", () => {
    it("parses main..HEAD", () => {
      expect(validateRange("main..HEAD")).toEqual({
        kind: "range",
        from: "main",
        to: "HEAD",
      });
    });

    it("parses v1.0.0..v2.0.0", () => {
      expect(validateRange("v1.0.0..v2.0.0")).toEqual({
        kind: "range",
        from: "v1.0.0",
        to: "v2.0.0",
      });
    });

    it("parses abc1234..def5678", () => {
      expect(validateRange("abc1234..def5678")).toEqual({
        kind: "range",
        from: "abc1234",
        to: "def5678",
      });
    });
  });

  describe("rejects three-dot ranges", () => {
    it("throws for main...HEAD", () => {
      expect(() => validateRange("main...HEAD")).toThrow(
        "Three-dot ranges are not supported"
      );
    });
  });

  describe("rejects empty range sides", () => {
    it("throws for ..HEAD", () => {
      expect(() => validateRange("..HEAD")).toThrow(
        "both sides of '..'"
      );
    });

    it("throws for main..", () => {
      expect(() => validateRange("main..")).toThrow(
        "both sides of '..'"
      );
    });
  });

  describe("rejects flag injection", () => {
    it("throws for -all", () => {
      expect(() => validateRange("-all")).toThrow("Invalid ref");
    });

    it("throws for --all", () => {
      expect(() => validateRange("--all")).toThrow("Invalid ref");
    });

    it("throws for hyphen-prefixed ref in range left side", () => {
      expect(() => validateRange("-bad..HEAD")).toThrow(
        "Invalid ref on left side"
      );
    });

    it("throws for hyphen-prefixed ref in range right side", () => {
      expect(() => validateRange("main..-bad")).toThrow(
        "Invalid ref on right side"
      );
    });
  });

  describe("rejects unsafe characters", () => {
    it("throws for ref with spaces", () => {
      expect(() => validateRange("bad ref")).toThrow("Invalid ref");
    });

    it("throws for ref with null byte", () => {
      expect(() => validateRange("bad\x00ref")).toThrow("Invalid ref");
    });

    it("throws for empty string", () => {
      expect(() => validateRange("")).toThrow("Invalid ref");
    });
  });
});
