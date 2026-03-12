import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { git } from "../lib/git.js";
import { getBatchInfo, setBatchInfo } from "../lib/batch-info.js";

export function registerUndoCommits(server: McpServer): void {
  server.tool(
    "undo_commits",
    "Undo commits from the last atomic_commit call using git reset --soft, preserving all changes as staged.",
    {
      count: z
        .number()
        .int()
        .positive()
        .max(20)
        .optional()
        .describe(
          "Number of commits to undo (max 20). Defaults to all commits from the last atomic_commit call."
        ),
    },
    {
      title: "Undo commits",
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ count }) => {
      const cwd = process.cwd();
      const batchInfo = getBatchInfo();

      if (!batchInfo) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: No undo information available. Run atomic_commit first.",
            },
          ],
          isError: true,
        };
      }

      const undoCount = count ?? batchInfo.commitCount;

      if (undoCount > batchInfo.commitCount) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Cannot undo ${undoCount} commits. Only ${batchInfo.commitCount} commits were made in the last atomic_commit call.`,
            },
          ],
          isError: true,
        };
      }

      try {
        await git(["reset", "--soft", `HEAD~${undoCount}`], cwd);

        const newHead = (
          await git(["rev-parse", "--short", "HEAD"], cwd)
        ).stdout.trim();

        const remaining = batchInfo.commitCount - undoCount;
        if (remaining === 0) {
          setBatchInfo(null);
        } else {
          setBatchInfo({
            headBefore: batchInfo.headBefore,
            commitCount: remaining,
            repoToplevel: batchInfo.repoToplevel,
          });
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  undone: undoCount,
                  new_head: newHead,
                  message: `Successfully undid ${undoCount} commit${undoCount > 1 ? "s" : ""}. Changes preserved as staged.`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error during undo: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
