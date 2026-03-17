import { z } from "zod";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { git, validatePath } from "../lib/git.js";
import { buildPartialPatch } from "../lib/hunk-parser.js";
import { setBatchInfo } from "../lib/batch-info.js";
import { scanFiles, ScanSecretsMode } from "../lib/secret-scanner.js";

const fileEntrySchema = z.union([
  z.string().describe("File path to stage entirely"),
  z.object({
    path: z.string().describe("File path"),
    hunks: z
      .array(z.number())
      .describe("Hunk indices to stage (from file_hunks output)"),
  }),
]);

const GroupSchema = z.object({
  files: z
    .array(fileEntrySchema)
    .min(1)
    .describe(
      "Files to include. String = whole file. Object with path+hunks = specific hunks only."
    ),
  message: z.string().min(1).max(2000).describe("Conventional commit message"),
});

export function extractSha(commitOutput: string): string {
  const match = commitOutput.match(/\[.+\s+([0-9a-f]+)\]/);
  return match ? match[1] : "unknown";
}

export function registerAtomicCommit(server: McpServer): void {
  server.tool(
    "atomic_commit",
    "Create one or more atomic git commits. Supports whole-file staging or hunk-level staging for sub-file commits. Records undo information for rollback.",
    {
      groups: z
        .array(GroupSchema)
        .min(1)
        .describe("Ordered list of commit groups to execute"),
      scanSecrets: ScanSecretsMode,
    },
    {
      title: "Execute atomic commits",
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ groups, scanSecrets }) => {
      const cwd = process.cwd();
      const commits: Array<{
        sha: string;
        message: string;
        files: string[];
      }> = [];

      try {
        // Record HEAD before any commits for undo support
        const headBefore = (
          await git(["rev-parse", "HEAD"], cwd).catch(() => ({
            stdout: "",
            stderr: "",
          }))
        ).stdout.trim();

        for (const group of groups) {
          const filesInCommit: string[] = [];

          try {
            // Reset index before staging this group
            await git(["reset"], cwd).catch(() => {});

            // Separate whole-file entries from hunk-level entries
            const wholeFiles: string[] = [];
            const hunkEntries: Array<{ path: string; hunks: number[] }> = [];
            for (const entry of group.files) {
              if (typeof entry === "string") {
                await validatePath(entry, cwd);
                wholeFiles.push(entry);
              } else {
                await validatePath(entry.path, cwd);
                hunkEntries.push(entry);
              }
            }

            // Scan for secrets before staging
            if (scanSecrets === "block") {
              const allPaths = [
                ...wholeFiles,
                ...hunkEntries.map((e) => e.path),
              ];
              const findings = await scanFiles(allPaths, cwd);
              if (findings.length > 0) {
                return {
                  content: [
                    {
                      type: "text" as const,
                      text: JSON.stringify(
                        {
                          blocked: true,
                          group: group.message,
                          findings,
                          committed_before_block: commits,
                        },
                        null,
                        2
                      ),
                    },
                  ],
                  isError: true,
                };
              }
            }

            // Batch stage whole-file entries in a single git add call
            if (wholeFiles.length > 0) {
              await git(["add", "--", ...wholeFiles], cwd);
              filesInCommit.push(...wholeFiles);
            }

            // Process hunk-level entries individually
            for (const entry of hunkEntries) {
              const diffResult = await git(
                ["diff", "--", entry.path],
                cwd
              );
              if (!diffResult.stdout.trim()) {
                console.error(
                  `No unstaged changes for ${entry.path}, skipping`
                );
                continue;
              }

              const patch = buildPartialPatch(
                diffResult.stdout,
                entry.hunks
              );
              if (!patch) {
                console.error(
                  `No valid hunks selected for ${entry.path}, skipping`
                );
                continue;
              }

              // Write temp patch to .git/ dir with restrictive permissions
              const gitDir = (
                await git(["rev-parse", "--git-dir"], cwd)
              ).stdout.trim();
              const tempPath = join(
                cwd,
                gitDir,
                `atomic-commit-${randomUUID()}.patch`
              );
              try {
                await writeFile(tempPath, patch, {
                  mode: 0o600,
                  flag: "wx",
                });
                await git(["apply", "--cached", tempPath], cwd);
                filesInCommit.push(
                  `${entry.path} (hunks: ${entry.hunks.join(",")})`
                );
              } finally {
                await unlink(tempPath).catch(() => {});
              }
            }

            if (filesInCommit.length === 0) {
              throw new Error("No files were staged");
            }

            const commitResult = await git(
              ["commit", "-m", group.message],
              cwd
            );
            const sha = extractSha(commitResult.stdout);

            commits.push({
              sha,
              message: group.message,
              files: filesInCommit,
            });
          } catch (error) {
            // Rollback staged files on failure
            console.error(
              `Commit failed for group "${group.message}", rolling back`
            );
            try {
              await git(["reset"], cwd);
            } catch {
              // reset itself failed
            }
            throw error;
          }
        }

        // Store batch information for undo and review
        if (headBefore) {
          const toplevel = (
            await git(["rev-parse", "--show-toplevel"], cwd)
          ).stdout.trim();
          setBatchInfo({
            headBefore,
            commitCount: commits.length,
            repoToplevel: toplevel,
          });
        }

        // Get summary log
        const log = await git(
          ["log", "--oneline", `-${commits.length}`],
          cwd
        );

        const result = {
          commits,
          summary: log.stdout.trim(),
          undo_available: !!headBefore,
          next_actions: ["review_commits"],
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
