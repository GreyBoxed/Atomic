import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { git } from "../lib/git.js";

export function registerGitState(server: McpServer): void {
  server.tool(
    "git_state",
    "Get current git repository state including status, diffs, staged changes, and recent log",
    {},
    {
      title: "Inspect git state",
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    async () => {
      const cwd = process.cwd();

      try {
        const [status, diffStat, stagedStat, recentLog] =
          await Promise.all([
            git(["status", "--short"], cwd),
            git(["diff", "--stat"], cwd),
            git(["diff", "--cached", "--stat"], cwd),
            git(["log", "--oneline", "-10"], cwd).catch(() => ({
              stdout: "(no commits yet)",
              stderr: "",
            })),
          ]);

        // Derive staged file names from --stat output
        const stagedFiles = stagedStat.stdout
          .trim()
          .split("\n")
          .filter((line) => line.includes("|"))
          .map((line) => line.split("|")[0].trim())
          .filter(Boolean);

        const result = {
          status: status.stdout,
          diff_stat: diffStat.stdout,
          staged_stat: stagedStat.stdout,
          staged_files: stagedFiles,
          recent_log: recentLog.stdout,
        };

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
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
