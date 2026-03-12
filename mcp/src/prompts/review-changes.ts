import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const REVIEW_PROMPT = `Review the commits from the last atomic_commit call (or a specified range) for quality, correctness, and adherence to conventions. Follow these steps:

1. **Gather commit data** — Call \`review_commits\` to get structured commit and diff data. If no batch info is available, specify a range (e.g., main..HEAD, HEAD~5).

2. **Read the conventions** — Retrieve the \`atomic-commit://conventions\` resource to review the Conventional Commits specification.

3. **Review each commit** for:
   - **Message quality** — Correct type (feat, fix, refactor, etc.), clear scope, imperative description.
   - **Atomicity** — Each commit is a single logical change. No unrelated changes bundled together.
   - **Code quality** — Look for bugs, security issues, missing error handling, or style problems in the diffs.
   - **Test coverage** — Are new features or fixes accompanied by tests?

4. **Present your review** with:
   - A summary of the overall batch (number of commits, files changed, scope).
   - Per-commit feedback: what looks good, what could be improved.
   - Any actionable suggestions (reword a message, split a commit, fix a bug).

5. **If issues are found** — Suggest whether to:
   - \`undo_commits\` to roll back and re-commit with fixes.
   - Proceed as-is if issues are minor.

Be specific and constructive. Reference file paths and line numbers from the diffs when pointing out issues.`;

export function registerReviewChanges(server: McpServer): void {
  server.prompt("review-changes", {}, () => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: REVIEW_PROMPT,
        },
      },
    ],
  }));
}
