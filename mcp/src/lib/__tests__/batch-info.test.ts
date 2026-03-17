import { describe, it, expect, beforeEach } from "vitest";
import { setBatchInfo, getBatchInfo } from "../batch-info.js";

describe("batch-info", () => {
  beforeEach(() => {
    setBatchInfo(null);
  });

  it("returns null when no batch info is set", () => {
    expect(getBatchInfo()).toBeNull();
  });

  it("stores and retrieves batch info", () => {
    const info = {
      headBefore: "abc1234",
      commitCount: 3,
      repoToplevel: "/tmp/repo",
    };
    setBatchInfo(info);
    expect(getBatchInfo()).toEqual(info);
  });

  it("clears batch info when set to null", () => {
    setBatchInfo({
      headBefore: "abc1234",
      commitCount: 1,
      repoToplevel: "/tmp/repo",
    });
    setBatchInfo(null);
    expect(getBatchInfo()).toBeNull();
  });

  it("overwrites existing batch info", () => {
    setBatchInfo({
      headBefore: "first",
      commitCount: 1,
      repoToplevel: "/tmp/repo1",
    });
    const second = {
      headBefore: "second",
      commitCount: 2,
      repoToplevel: "/tmp/repo2",
    };
    setBatchInfo(second);
    expect(getBatchInfo()).toEqual(second);
  });
});
