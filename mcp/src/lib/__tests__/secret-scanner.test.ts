import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanFiles } from "../secret-scanner.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "scanner-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("scanFiles", () => {
  describe("sensitive filename detection", () => {
    it("detects .env file", async () => {
      await writeFile(join(tempDir, ".env"), "SAFE_VAR=hello\n");
      const findings = await scanFiles([".env"], tempDir);
      expect(findings).toContainEqual(
        expect.objectContaining({ file: ".env", type: "filename", pattern: ".env" })
      );
    });

    it("detects credentials.json", async () => {
      await writeFile(join(tempDir, "credentials.json"), "{}");
      const findings = await scanFiles(["credentials.json"], tempDir);
      expect(findings).toContainEqual(
        expect.objectContaining({ file: "credentials.json", type: "filename" })
      );
    });

    it("detects id_rsa", async () => {
      await writeFile(join(tempDir, "id_rsa"), "key content");
      const findings = await scanFiles(["id_rsa"], tempDir);
      expect(findings).toContainEqual(
        expect.objectContaining({ file: "id_rsa", type: "filename" })
      );
    });

    it("detects id_ed25519", async () => {
      await writeFile(join(tempDir, "id_ed25519"), "key content");
      const findings = await scanFiles(["id_ed25519"], tempDir);
      expect(findings).toContainEqual(
        expect.objectContaining({ file: "id_ed25519", type: "filename" })
      );
    });

    it("detects .pem extension", async () => {
      await writeFile(join(tempDir, "cert.pem"), "cert content");
      const findings = await scanFiles(["cert.pem"], tempDir);
      expect(findings).toContainEqual(
        expect.objectContaining({ type: "filename", pattern: "*.pem" })
      );
    });

    it("detects .env.production prefix", async () => {
      await writeFile(join(tempDir, ".env.production"), "VAR=val");
      const findings = await scanFiles([".env.production"], tempDir);
      expect(findings).toContainEqual(
        expect.objectContaining({ type: "filename", pattern: ".env.*" })
      );
    });
  });

  describe("content pattern detection", () => {
    it("detects API_KEY assignment", async () => {
      await writeFile(join(tempDir, "config.ts"), "const API_KEY = 'secret123';\n");
      const findings = await scanFiles(["config.ts"], tempDir);
      expect(findings).toContainEqual(
        expect.objectContaining({
          file: "config.ts",
          type: "content",
          pattern: "secret assignment",
          line: 1,
        })
      );
    });

    it("detects PASSWORD assignment", async () => {
      await writeFile(join(tempDir, "config.ts"), "PASSWORD = hunter2\n");
      const findings = await scanFiles(["config.ts"], tempDir);
      expect(findings.some((f) => f.type === "content")).toBe(true);
    });

    it("detects private key header", async () => {
      await writeFile(
        join(tempDir, "key.txt"),
        "-----BEGIN RSA PRIVATE KEY-----\ndata\n-----END RSA PRIVATE KEY-----\n"
      );
      const findings = await scanFiles(["key.txt"], tempDir);
      expect(findings).toContainEqual(
        expect.objectContaining({
          type: "content",
          pattern: "private key header",
        })
      );
    });

    it("redacts secret values in match field", async () => {
      await writeFile(join(tempDir, "config.ts"), "API_KEY=supersecret\n");
      const findings = await scanFiles(["config.ts"], tempDir);
      const contentFinding = findings.find((f) => f.type === "content");
      expect(contentFinding?.match).toContain("API_KEY=");
      expect(contentFinding?.match).toContain("***REDACTED***");
      expect(contentFinding?.match).not.toContain("supersecret");
    });
  });

  describe("skipping behavior", () => {
    it("skips binary extensions", async () => {
      await writeFile(join(tempDir, "image.png"), "API_KEY=secret");
      const findings = await scanFiles(["image.png"], tempDir);
      // Should only get filename check, not content scan
      expect(findings.every((f) => f.type === "filename")).toBe(true);
    });

    it("skips files exceeding size limit", async () => {
      const bigContent = "API_KEY=x\n".repeat(200000); // >1MB
      await writeFile(join(tempDir, "big.ts"), bigContent);
      const findings = await scanFiles(["big.ts"], tempDir);
      expect(findings.filter((f) => f.type === "content")).toHaveLength(0);
    });

    it("skips unreadable files gracefully", async () => {
      const findings = await scanFiles(["nonexistent.ts"], tempDir);
      expect(findings).toHaveLength(0);
    });
  });

  describe("clean files", () => {
    it("returns empty findings for clean file", async () => {
      await writeFile(join(tempDir, "clean.ts"), "const x = 1;\n");
      const findings = await scanFiles(["clean.ts"], tempDir);
      expect(findings).toHaveLength(0);
    });
  });
});
