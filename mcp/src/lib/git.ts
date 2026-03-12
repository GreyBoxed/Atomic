import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";

export interface GitResult {
  stdout: string;
  stderr: string;
}

export function git(args: string[], cwd: string): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      { cwd, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(`git ${args[0]} failed: ${stderr || error.message}`)
          );
          return;
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

/**
 * Parse `git status --short` output into a set of changed file paths.
 * Handles renames (A -> B) by extracting the destination path.
 */
export function parseStatusFiles(statusOutput: string): Set<string> {
  const files = new Set<string>();
  const lines = statusOutput.trim().split("\n").filter(Boolean);
  for (const line of lines) {
    const filePart = line.slice(3).trim();
    if (filePart.includes(" -> ")) {
      files.add(filePart.split(" -> ")[1].trim());
    } else {
      files.add(filePart);
    }
  }
  return files;
}

/**
 * Validate that a user-supplied file path doesn't escape the repository.
 */
export async function validatePath(filePath: string, cwd: string): Promise<void> {
  if (
    filePath.includes("..") ||
    filePath.startsWith("/") ||
    filePath.includes("\x00") ||
    filePath.startsWith("-")
  ) {
    throw new Error(`Invalid file path (path traversal rejected): ${filePath}`);
  }
  try {
    const absolute = resolve(cwd, filePath);
    const real = await realpath(absolute);
    const toplevel = (
      await git(["rev-parse", "--show-toplevel"], cwd)
    ).stdout.trim();
    if (!real.startsWith(toplevel + "/") && real !== toplevel) {
      throw new Error(`Path escapes repository: ${filePath}`);
    }
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw err;
  }
}
