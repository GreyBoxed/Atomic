import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ANALYZE_PROMPT = `Analyze the current git working tree and propose a set of atomic commits. Follow these steps:

1. **Inspect changes** — Call \`git_state\` to get the full picture of staged, unstaged, and untracked files.

2. **Read the conventions** — Retrieve the \`atomic-commit://conventions\` resource to review the Conventional Commits specification.

3. **Inspect hunks (if needed)** — For files with multiple unrelated changes, call \`file_hunks\` to see individual diff hunks. This enables splitting a single file across multiple commits.

4. **Validate first** — Call \`dry_run\` with your proposed groups to check for issues before committing.

5. **Group files by logical concern** — Cluster related changes together. Each group = one logical change:
   - Files in the same module or package often belong together.
   - Test files should be grouped with the source files they test.
   - Configuration changes may warrant their own commit.
   - Documentation changes should be separate from code changes.
   - If a file has hunks belonging to different concerns, use hunk-level staging.

6. **Write conventional commit messages** — For each group:
   - Choose the correct type (feat, fix, docs, refactor, test, chore, etc.).
   - Add a scope if it clarifies the change.
   - Write a concise, imperative description.

7. **Execute the commits** — Call \`atomic_commit\` with the ordered list of commit groups. Order commits so foundational changes come first (e.g., library code before the feature that uses it).

Present your analysis before executing, showing each proposed group with its files and commit message. Then proceed with the atomic_commit call.

If the result is unsatisfactory, use \`undo_commits\` to roll back and try again.`;

export function registerAnalyzeChanges(server: McpServer): void {
  server.prompt("analyze-changes", {}, () => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: ANALYZE_PROMPT,
        },
      },
    ],
  }));
}
