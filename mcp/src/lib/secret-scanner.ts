import { readFile, stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { z } from "zod";

export const ScanSecretsMode = z
  .enum(["block", "skip"])
  .default("block")
  .describe(
    "Secret scanning mode: 'block' (default) rejects if secrets found, 'skip' disables scanning"
  );

export interface SecretFinding {
  file: string;
  type: "filename" | "content";
  pattern: string;
  line?: number;
  match?: string;
}

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".gif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
]);

const SENSITIVE_FILENAMES = [
  ".env",
  "credentials.json",
  "id_rsa",
  "id_ed25519",
];

const SENSITIVE_EXTENSIONS = [".pem"];

const SENSITIVE_PREFIXES = [".env."];

const CONTENT_PATTERNS: Array<{ regex: RegExp; name: string }> = [
  {
    regex: /(API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY)\s*=/,
    name: "secret assignment",
  },
  {
    regex: /-----BEGIN[^-]{0,50}PRIVATE KEY-----/,
    name: "private key header",
  },
];

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB

function isSensitiveFilename(filePath: string): string | null {
  const name = basename(filePath);
  const ext = extname(filePath);

  if (SENSITIVE_FILENAMES.includes(name)) return name;
  if (SENSITIVE_EXTENSIONS.includes(ext)) return `*${ext}`;
  for (const prefix of SENSITIVE_PREFIXES) {
    if (name.startsWith(prefix)) return `${prefix}*`;
  }
  return null;
}

function isBinaryExtension(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function maskMatch(line: string): string {
  // Show the key name but redact the value
  const eqIndex = line.indexOf("=");
  if (eqIndex !== -1 && eqIndex < 60) {
    return line.slice(0, eqIndex + 1) + "***REDACTED***";
  }
  // For private key headers, just return the header
  if (line.includes("-----BEGIN")) {
    return line.replace(/-----BEGIN[^-]{0,50}PRIVATE KEY-----.*/, "-----BEGIN PRIVATE KEY-----");
  }
  return line.slice(0, 30) + "...";
}

/**
 * Scan files for secrets. Caller is responsible for path validation
 * when calling from tools that already validate (atomic_commit, dry_run).
 * The standalone scan_secrets tool validates before calling this.
 */
export async function scanFiles(
  files: string[],
  cwd: string
): Promise<SecretFinding[]> {
  const findings: SecretFinding[] = [];

  for (const file of files) {
    // Check filename patterns
    const sensitivePattern = isSensitiveFilename(file);
    if (sensitivePattern) {
      findings.push({
        file,
        type: "filename",
        pattern: sensitivePattern,
      });
    }

    // Skip binary files
    if (isBinaryExtension(file)) continue;

    const absolute = resolve(cwd, file);

    // Skip files that exceed size limit
    try {
      const fileStat = await stat(absolute);
      if (fileStat.size > MAX_FILE_SIZE) continue;
    } catch {
      // File doesn't exist or can't be stat'd — skip
      continue;
    }

    // Read and scan content
    let content: string;
    try {
      content = await readFile(absolute, "utf-8");
    } catch {
      // Can't read — skip silently
      continue;
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of CONTENT_PATTERNS) {
        if (pattern.regex.test(line)) {
          findings.push({
            file,
            type: "content",
            pattern: pattern.name,
            line: i + 1,
            match: maskMatch(line.trim()),
          });
        }
      }
    }
  }

  return findings;
}
