import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerGitState } from "./tools/git-state.js";
import { registerAtomicCommit } from "./tools/atomic-commit.js";
import { registerDryRun } from "./tools/dry-run.js";
import { registerUndoCommits } from "./tools/undo-commits.js";
import { registerFileHunks } from "./tools/file-hunks.js";
import { registerGenerateChangelog } from "./tools/generate-changelog.js";
import { registerReviewCommits } from "./tools/review-commits.js";
import { registerScanSecrets } from "./tools/scan-secrets.js";
import { registerCommitConventions } from "./resources/commit-conventions.js";
import { registerAnalyzeChanges } from "./prompts/analyze-changes.js";
import { registerReviewChanges } from "./prompts/review-changes.js";

const server = new McpServer({
  name: "atomic",
  version: "1.0.0",
});

// Tools
registerGitState(server);
registerAtomicCommit(server);
registerDryRun(server);
registerUndoCommits(server);
registerFileHunks(server);
registerGenerateChangelog(server);
registerReviewCommits(server);
registerScanSecrets(server);

// Resources
registerCommitConventions(server);

// Prompts
registerAnalyzeChanges(server);
registerReviewChanges(server);

async function main(): Promise<void> {
  // Validate we're in a git repository
  const { execFileSync } = await import("node:child_process");
  try {
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
  } catch {
    console.error(
      "Warning: atomic-commit MCP server started outside a git repository"
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("atomic-commit MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
