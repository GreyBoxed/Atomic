# Brainstorm: Atomic Commit Review

**Date:** 2026-03-12
**Status:** Draft

## What We're Building

A new `/atomic:review` command backed by a lean `review_commits` MCP tool that provides PR-style review of committed changes. After running `/atomic:commit`, users are prompted to run `/atomic:review` for a structured quality review of their changes.

**The flow:**
1. User runs `/atomic:commit` — commits are created
2. Post-commit message suggests: "Run `/atomic:review` to review these changes"
3. User runs `/atomic:review` (optionally with a range argument)
4. `review_commits` MCP tool gathers commit data for the range
5. Claude analyzes the data and produces a structured report
6. User can interactively discuss specific findings

## Why This Approach

**Lean MCP tool + rich command** was chosen over prompt-driven reuse because:

- Existing tools (`git_state`, `generate_changelog`) aren't optimized for commit-range review context
- A dedicated tool provides clean, structured data without stretching existing tools beyond their intent
- Consistent with the project's architecture: MCP tools handle data, commands handle orchestration
- The `review_commits` tool becomes reusable by other commands

## Key Decisions

1. **Standalone command, suggested post-commit** — `/atomic:review` works independently but is surfaced after `/atomic:commit` completes
2. **Smart default range** — defaults to last atomic batch if available (reuses the in-memory `UndoInfo` pattern from `undo_commits`), falls back to branch-vs-base diff, allows user override (SHA, branch, `HEAD~N`)
3. **Lean MCP tool** — `review_commits` gathers and structures data (commit list, diffs, file summary, convention checks); does not perform analysis
4. **Structured report + interactive discussion** — report covers: summary, commit quality (convention compliance, atomic scoping), code quality (bugs, style, security), and suggestions. Then offers to discuss findings
5. **Architecture: new MCP tool + new slash command** — `mcp/src/tools/review-commits.ts` + `plugins/atomic/commands/atomic-review.md`

## Scope

### In Scope
- `review_commits` MCP tool: accepts range input, returns structured commit + diff data
- `/atomic:review` slash command: orchestrates tool call, produces structured review, offers discussion
- Post-commit hook in `/atomic:commit` command: suggest running review
- Convention compliance checking (Conventional Commits v1.0.0)
- Code quality observations (bugs, style, security, test gaps)
- Commit scoping analysis (are commits properly atomic?)

### Out of Scope
- Auto-fixing issues (that's a separate feature)
- GitHub/GitLab PR integration (review is local-only)
- Persistent review history or scoring
- CI/CD integration

## MCP Tool Design: `review_commits`

**Batch tracking:** When `range` is `"last-batch"` or omitted, the tool reads the same in-memory `UndoInfo` (`headBefore` + `commitCount`) that `undo_commits` uses. This means `review_commits` must import `getUndoInfo()` from `undo-commits.ts` (a new getter, mirroring the existing `setUndoInfo`). If no batch info exists, falls back to branch-vs-base diff.

**Input parameters:**
- `range` (optional string) — commit range: `"last-batch"`, branch name, SHA, `HEAD~N`, or `SHA1..SHA2`. Defaults to `"last-batch"`
- `repo_path` (optional string) — repository path, defaults to cwd

**Output structure:**
- `range_description` — human-readable description of what's being reviewed
- `commits[]` — list of commits with: SHA, message, author, date, files changed
- `diffs[]` — per-commit or combined diff content
- `file_summary` — files added/modified/deleted with change counts
- `convention_check` — per-commit Conventional Commits compliance (valid/invalid + reason)

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`

## Slash Command Design: `/atomic:review`

**Argument:** optional range (e.g., `/atomic:review HEAD~3`, `/atomic:review feature-branch`)

**Report sections:**
1. **Summary** — what changed, how many commits, scope
2. **Commit Quality** — convention compliance, message clarity, atomic scoping assessment
3. **Code Review** — per-file observations on bugs, style, security, missing tests
4. **Suggestions** — actionable next steps (amend messages, split commits, fix issues)

**Post-report:** "Would you like to discuss any of these findings?"

## Open Questions

_None — all key decisions resolved during brainstorming._

## Resolved Questions

1. **What kind of review?** — PR-style review of committed changes, not pre-commit linting
2. **Review focus?** — Both commit quality and code quality in one pass
3. **Output format?** — Structured report followed by interactive discussion
4. **Architecture?** — Lean MCP tool for data gathering + rich slash command for analysis
5. **Default range?** — Smart default using existing `UndoInfo` pattern, with fallback and override
