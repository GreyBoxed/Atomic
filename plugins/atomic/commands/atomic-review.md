---
name: atomic:review
description: Review recent atomic commits for quality, correctness, and convention adherence
argument-hint: "[optional: range like main..HEAD or HEAD~5]"
allowed-tools: mcp__atomic-commit__review_commits, mcp__atomic-commit__undo_commits
---

## Context

- Recent commits: !`git log --oneline -10 2>/dev/null || echo "(no commits yet)"`
- Current branch: !`git branch --show-current 2>/dev/null || echo "(detached HEAD)"`

## Your task

### Pre-flight check

If the context above shows "(no commits yet)", STOP immediately and tell the user:

> No commits found. Run `/atomic:commit` first to create commits, then use `/atomic:review` to review them.

### Review commits

1. Call `review_commits` to gather structured commit and diff data. If no range argument was provided, it will automatically use the last `/atomic:commit` batch. If a range was given as an argument, pass it through.

2. For each commit, evaluate:
   - **Message quality** — Does it follow Conventional Commits v1.0.0? Correct type, clear scope, imperative description?
   - **Atomicity** — Is this a single logical change? Are unrelated changes bundled together?
   - **Code quality** — Look for bugs, security issues, missing error handling, or style problems in the diffs.
   - **Test coverage** — Are new features or fixes accompanied by tests?

3. Present your review:

```
Review: N commits, M files changed

Commit 1 — <sha short> <message>
  [feedback with specific file:line references from diffs]

Commit 2 — <sha short> <message>
  [feedback]

Overall: [summary assessment]
```

4. If issues are found, suggest whether to:
   - Use `/atomic:rollback` to undo and re-commit with fixes
   - Proceed as-is if issues are minor

Be specific and constructive. Reference file paths and line numbers from the diffs.
