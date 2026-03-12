---
title: "feat: Atomic commit review"
type: feat
status: completed
date: 2026-03-12
origin: docs/brainstorms/2026-03-12-atomic-review-brainstorm.md
---

# feat: Atomic Commit Review

## Enhancement Summary

**Deepened on:** 2026-03-12
**Sections enhanced:** All
**Review agents used:** TypeScript reviewer, pattern recognition, performance oracle, security sentinel, code simplicity, architecture strategist, agent-native reviewer, MCP best practices researcher

### Key Improvements
1. Simplified output interface from 7 top-level fields to 4 (YAGNI cleanup)
2. Collapsed N+1 `git show` calls into a single `git log -p --stat` call (performance)
3. Simplified range resolution from 3-level cascade to 2 paths: batch info or explicit (simplicity)
4. Added structural range parsing with `..`/`...` handling and commit count cap (security)
5. Added `review-changes` MCP prompt for agent parity
6. Resolved `mcp__atomic-commit__` vs `mcp__atomic__` naming — must verify at runtime before implementation

### New Considerations Discovered
- Store `repoToplevel` in BatchInfo to prevent cross-repo state leakage
- Use NUL-delimited `--format` strings instead of pipe delimiters (pipes appear in commit messages)
- Add `.max(256)` to Zod range schema and cap at 50 commits max
- Convention checking belongs in Claude (slash command), not in MCP tool — removes duplicated concern

---

## Overview

Add a `/atomic:review` command backed by a lean `review_commits` MCP tool that provides PR-style review of committed changes. After `/atomic:commit` completes, users are prompted to run `/atomic:review` for a structured quality report with interactive discussion.

(see brainstorm: docs/brainstorms/2026-03-12-atomic-review-brainstorm.md)

## Problem Statement

The plugin covers the full commit lifecycle (commit, undo, revert, cherry-pick, recover, init) but has no way to review committed work. Users who want to audit their commits for quality, convention compliance, or code issues must do so manually or use external tools. A review command that leverages the plugin's own tooling closes this gap.

## Proposed Solution

A lean MCP tool (`review_commits`) that gathers structured commit and diff data for a given range, paired with a rich slash command (`/atomic:review`) that orchestrates the tool call and has Claude produce a structured report. A `review-changes` MCP prompt provides the same orchestration for agent callers. The `/atomic:commit` command gets a one-line addition suggesting review after commits are created.

## Technical Approach

### Architecture

```
/atomic:review [range]          review-changes prompt (agents)
        │                               │
        ▼                               ▼
  review_commits MCP tool (shared data layer)
   ├─ resolve range (batch info or explicit)
   └─ single git log -p --stat call
        │
        ▼
  Claude analysis (in command/prompt)
   ├─ Summary
   ├─ Commit Quality (convention check done here, not in tool)
   ├─ Code Review
   └─ Suggestions
        │
        ▼
  Interactive discussion
```

### Research Insights: Architecture

**Lean tool + rich command split is validated.** The architecture strategist confirmed this follows the established pattern (`atomic_commit` + `analyze-changes` + `/atomic:commit`). Convention checking belongs in the Claude analysis layer because it is subjective analysis, not deterministic data gathering. The code simplicity reviewer concurred: Claude already has the Conventional Commits spec and can assess message clarity, body completeness, and scope appropriateness — things a regex cannot.

**Agent parity requires a prompt.** The `analyze-changes` prompt orchestrates the commit workflow for MCP-only callers. The review workflow needs the same: a `review-changes` prompt that instructs agents to call `review_commits`, then produce the structured report. Without it, agents get raw data but no guidance on how to produce a review.

### Range Resolution Algorithm

```
1. If explicit range provided:
   a. Structural validation (see Security section below)
   b. If contains ".." → split, validate each ref, use as-is
   c. If "last-batch" → go to step 2
   d. If single ref → interpret as "<ref>..HEAD"

2. If "last-batch" or no range provided:
   a. Call getBatchInfo()
   b. If present, verify repoToplevel matches current repo
   c. Validate headBefore is ancestor of HEAD
      (git merge-base --is-ancestor headBefore HEAD)
   d. If valid → use "headBefore..HEAD"
   e. If stale, null, or wrong repo → error with guidance

3. Error: "No batch info available. Specify a range explicitly
   (e.g., main..HEAD, HEAD~5, or abc123..def456)."
```

### Research Insights: Range Resolution

**Simplified from 3-level to 2-level cascade.** The code simplicity reviewer identified the branch-vs-base fallback as YAGNI — the primary use case is reviewing commits just made with `/atomic:commit` (which always sets batch info), and the secondary use case is an explicit range. The middle layer (guessing main/master, probing origin) solves an ambiguous problem with ambiguous results. Two paths: batch info or explicit. If neither is available, return a clear error telling the user to specify a range.

**Structural range parsing (security).** Instead of a single regex for the range parameter, parse structurally: reject `...` (three-dot symmetric difference), split on `..`, validate each side independently with `SAFE_REF`. This prevents unexpected git behavior from crafted range strings.

### Implementation Phases

#### Phase 1: Extract Shared State + Validation (refactor)

Extract the in-memory `UndoInfo` from `undo-commits.ts` into a shared module, and extract the ref validation pattern from `generate-changelog.ts`.

**Files:**

- **Create `mcp/src/lib/batch-info.ts`**
  ```typescript
  // Single-connection assumption: module-level state is safe because
  // MCP stdio servers are one-process-per-client-session.
  interface BatchInfo {
    headBefore: string;
    commitCount: number;
    repoToplevel: string;  // from git rev-parse --show-toplevel
  }

  setBatchInfo(info: BatchInfo | null): void
  getBatchInfo(): BatchInfo | null
  ```
  Two exports only. `setBatchInfo(null)` replaces a separate `clearBatchInfo()`.

- **Create `mcp/src/lib/ref-validation.ts`**
  ```typescript
  const SAFE_SINGLE_REF = /^[a-zA-Z0-9._\/][a-zA-Z0-9._\/~^0-9-]*$/;

  function validateRange(range: string): { from: string; to: string } | { single: string }
  // Rejects "...", splits on "..", validates each side independently
  ```
  Shared by `generate-changelog.ts` and `review-commits.ts`.

- **Modify `mcp/src/tools/undo-commits.ts`**
  - Remove `UndoInfo` interface and `lastUndoInfo` variable
  - Remove `setUndoInfo` export
  - Import `getBatchInfo`, `setBatchInfo` from `../lib/batch-info.js`
  - Replace internal reads with `getBatchInfo()`
  - After full undo: `setBatchInfo(null)`. After partial undo: `setBatchInfo` with updated count.

- **Modify `mcp/src/tools/atomic-commit.ts`**
  - Replace `import { setUndoInfo } from "./undo-commits.js"` with `import { setBatchInfo } from "../lib/batch-info.js"`
  - Replace `setUndoInfo(...)` call with `setBatchInfo(...)` including `repoToplevel`

**Success criteria:** All existing tests pass. `undo_commits` behavior unchanged. No new public API.

### Research Insights: Phase 1

**`repoToplevel` prevents cross-repo state leakage (security).** If a user runs `/atomic:commit` in repo A then `/atomic:review` in repo B, the stored `headBefore` SHA would be meaningless. Storing the repo path and checking it on read catches this cleanly.

**Two exports, not three (simplicity).** `setBatchInfo(null)` is clearer than a separate `clearBatchInfo()` function. Fewer exports, same capability.

**Ref validation extraction prevents duplication.** Both `generate-changelog.ts` and `review-commits.ts` need ref validation. A shared `lib/ref-validation.ts` follows the same principle that motivates the `batch-info.ts` extraction.

#### Phase 2: `review_commits` MCP Tool

**Create `mcp/src/tools/review-commits.ts`**

```
registerReviewCommits(server: McpServer): void

Tool name: "review_commits"
Description: "Gather structured commit and diff data for review.
  Returns commits with messages and per-commit diffs for a given range."

Input schema:
  range: z.string().max(256).optional()
    .describe("Commit range: SHA..SHA, branch name, HEAD~N, or 'last-batch'. Defaults to last atomic batch.")

Annotations:
  title: "Review Commits"
  readOnlyHint: true
  destructiveHint: false
  idempotentHint: true
  openWorldHint: false

Handler:
  1. Validate range input (structural parsing via lib/ref-validation)
  2. Resolve range (algorithm above)
  3. Count commits: git rev-list --count <range> --no-merges
     → if > MAX_REVIEW_COMMITS (50), return error
  4. Single call: git log -p --stat --no-merges
       --format="COMMIT_START%x00%H%x00%s%x00%b" <range>
     → Parse output by splitting on COMMIT_START delimiter
     → NUL (%x00) separates fields within each commit
  5. Return structured JSON
```

**Output structure (simplified):**

```typescript
interface ReviewResult {
  range: string;                    // "abc123..def456"
  range_description: string;        // "5 commits from last atomic batch"
  range_resolution: string;         // "batch-info" | "explicit"
  commits: Array<{
    sha: string;
    message: string;                // Full message (subject + body)
    files_changed: string[];
    insertions: number;
    deletions: number;
    diff: string;                   // Per-commit diff content
  }>;
  diff_stat: string;                // Raw git diff --stat output
}
```

### Research Insights: Phase 2

**Single git call replaces N+1 (performance).** The performance oracle identified that N `git show` calls for N commits is the dominant bottleneck. A single `git log -p --stat --format=<delimiter>` call collapses all data gathering into one process spawn. For 50 commits, this saves ~1.5-2.5 seconds of spawn overhead.

**NUL-delimited format, not pipes (TypeScript review).** The pipe `|` character appears in commit messages. The existing `generate-changelog.ts` has a latent bug where `rest.join("|")` attempts to recover from split commit messages. Using `%x00` (NUL byte) as the field separator eliminates this class of parsing bugs.

**Simplified interface (simplicity review).** Removed 4 fields:
- `convention_check` — Claude does this better from raw messages (richer analysis: clarity, body completeness, scope)
- `file_summary` (parsed arrays) — replaced with raw `diff_stat` string. Claude can read `--stat` output directly.
- `merge_commits_excluded` — `--no-merges` is sufficient without counting. If zero commits result, the "no commits found" message covers it.
- `truncated` boolean + truncation logic — replaced with a max commit count cap (50). Simpler, catches the problem earlier.

**Dropped `author` and `date` per commit (simplicity).** In the primary use case (reviewing your own recent commits), you know who wrote them and when. The SHA is sufficient for identification. If needed, the slash command has `Bash(git show:*)`.

**Added `range_resolution` metadata (agent-native).** Agents can't see the slash command's context section. This field tells them which resolution path was taken.

**Commit count cap of 50 (security).** Prevents DoS from very large ranges. Applied via `git rev-list --count` before processing. Matches the `.max(20)` pattern in `undo_commits` but higher for review scope.

**Max 256 chars on range string (security).** No legitimate ref needs to be longer. One-line Zod constraint.

**Edge cases:**

| Case | Behavior |
|------|----------|
| Zero commits in range | Return empty `commits` array, `range_description` says "No commits found" (not an error) |
| Detached HEAD, no batch info | Error: "No batch info available. Specify a range (e.g., HEAD~5)." |
| Invalid/nonexistent ref | Error: "Ref '<ref>' not found." + list available branches via `git branch --format=%(refname:short)` |
| Range > 50 commits | Error: "Range contains N commits (max 50). Narrow the range." |
| `...` three-dot range | Error: "Three-dot ranges not supported. Use SHA1..SHA2." |
| Merge commits | Excluded silently via `--no-merges` |
| Binary files | Included in `files_changed`, diff shows git's default "[binary]" marker |

**Error format:** All errors follow the established pattern:
```typescript
{ content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true }
```

**Modify `mcp/src/index.ts`:**
- Add `import { registerReviewCommits } from "./tools/review-commits.js";`
- Add `registerReviewCommits(server);` in the Tools section

#### Phase 2.5: `review-changes` MCP Prompt (agent parity)

**Create `mcp/src/prompts/review-changes.ts`**

Following the `analyze-changes` prompt pattern, this prompt orchestrates the review workflow for MCP-only callers (agents without slash command access).

```typescript
const PROMPT_TEXT = `
You are reviewing committed changes for quality.

1. Call review_commits with the provided range (or no range for last batch).
2. Analyze the output and produce a structured report:

   ## Summary
   - Commits, files changed, insertions/deletions

   ## Commit Quality
   - Conventional Commits compliance (assess each message against the spec)
   - Message clarity and atomic scoping

   ## Code Review
   - Per-file: bugs, style, security, missing tests
   - Reference specific diff lines

   ## Suggestions
   - Actionable next steps with commit SHAs

3. Offer to discuss specific findings.
`;
```

**Register in `mcp/src/index.ts`:**
- Add `import { registerReviewChanges } from "./prompts/review-changes.js";`
- Add `registerReviewChanges(server);` in the Prompts section

#### Phase 3: `/atomic:review` Slash Command

**Create `plugins/atomic/commands/atomic-review.md`**

> **IMPORTANT:** The `allowed-tools` prefix must be verified before implementation.
> The `.mcp.json` server key is `"atomic"` which should produce `mcp__atomic__*`,
> but existing commands use `mcp__atomic-commit__*`. Test which prefix actually
> resolves at runtime and use that consistently.

```yaml
---
name: atomic:review
description: Review committed changes — commit quality, code review, and suggestions
argument-hint: "[range: last-batch | HEAD~N | branch | SHA..SHA]"
allowed-tools: mcp__atomic-commit__review_commits, mcp__atomic-commit__git_state, Bash(git log:*), Bash(git show:*), Bash(git diff:*)
---
```

**Context section:**

```markdown
## Context

- Branch: !`git branch --show-current 2>/dev/null || echo "(detached HEAD)"`
- Recent commits: !`git log --oneline -10 2>/dev/null || echo "(no commits)"`
- Status: !`git status --short 2>/dev/null || echo "(not a git repo)"`
```

**Task section:**

```markdown
## Your task

Review committed changes and produce a structured quality report.

### Step 1: Gather review data

Call the `review_commits` MCP tool with the user's range argument (if provided).
If no argument, call with no range (smart default).

### Step 2: Produce structured report

Analyze the tool output and produce:

#### Summary
- Number of commits, files changed, insertions/deletions
- Range description and scope

#### Commit Quality
- Convention compliance: assess each commit message against Conventional Commits v1.0.0
  (type, optional scope, description, optional body/footer, breaking change markers)
- Message clarity (vague subjects, missing bodies for complex changes)
- Atomic scoping (does each commit represent a single logical change?)
  - For single-commit reviews, skip scoping assessment

#### Code Review
- Per-file observations: bugs, style issues, security concerns, missing tests
- Focus on substantive issues, not nitpicks
- Reference specific lines from the diffs

#### Suggestions
- Actionable next steps (amend messages, split commits, fix issues)
- Reference specific commits by short SHA

### Step 3: Offer discussion

After the report, ask: "Would you like to discuss any of these findings?"

If the user asks about a specific finding, use git show/diff to provide deeper context.

### Rules
- This is a read-only review. Never modify commits, stage files, or make changes.
- For non-Conventional-Commits messages, report as observations, not errors.
- If zero commits were returned, inform the user and suggest specifying a range.
```

#### Phase 4: Post-Commit Integration

**Modify `plugins/atomic/commands/atomic-commit.md`**

Add to the end of the task instructions (after the commit results display):

```markdown
### After commits

After displaying commit results, add:

> Run `/atomic:review` to review these changes.
```

This is a command-level change only — no modification to the `atomic_commit` MCP tool's return value.

**Modify `mcp/src/tools/atomic-commit.ts` (agent discoverability)**

Add a `next_actions` field to the tool's JSON response:

```typescript
const result = {
  commits: created,
  summary: `Created ${created.length} commit(s)`,
  undo_available: !!headBefore,
  next_actions: ["review_commits"],  // NEW: agent discoverability
};
```

This tells MCP-only callers (agents) that `review_commits` is a natural next step, without forcing them to call it.

## Acceptance Criteria

- [x] `mcp/src/lib/batch-info.ts` — shared batch state with `repoToplevel`, get/set only
- [x] `mcp/src/lib/ref-validation.ts` — structural range parsing, shared SAFE_REF
- [x] `mcp/src/tools/undo-commits.ts` — uses `batch-info.ts` instead of internal state
- [x] `mcp/src/tools/atomic-commit.ts` — uses `batch-info.ts`, adds `next_actions` to output
- [x] `mcp/src/tools/review-commits.ts` — new read-only tool, 2-call strategy (metadata+numstat, diffs)
- [x] `mcp/src/prompts/review-changes.ts` — MCP prompt for agent-driven review
- [x] `mcp/src/index.ts` — registers `review_commits` tool and `review-changes` prompt
- [x] `plugins/atomic/commands/atomic-review.md` — new slash command
- [x] `plugins/atomic/commands/atomic-commit.md` — post-commit suggestion added
- [x] Range resolution: batch info → explicit → error (2 paths, no branch-vs-base guessing)
- [x] Structural range parsing: reject `...`, validate each side of `..`, SAFE_REF with `~^`
- [x] Commit count capped at 50 with clear error message
- [x] Range string capped at 256 chars via Zod `.max(256)`
- [x] Refs validated with `git rev-parse --verify` before use
- [x] Invalid refs produce error messages listing available branches
- [x] `allowed-tools` prefix verified against runtime resolution (uses `mcp__atomic-commit__*`)
- [x] `npm run build` succeeds with no errors

## System-Wide Impact

- **Shared state change:** `UndoInfo` moves to `lib/batch-info.ts` as `BatchInfo` with added `repoToplevel` field. Internal refactor — no public API change.
- **New shared lib:** `lib/ref-validation.ts` for structural range parsing. `generate-changelog.ts` should migrate to use it.
- **New MCP tool:** `review_commits` becomes public API. Renaming is a breaking change per CLAUDE.md.
- **New MCP prompt:** `review-changes` for agent parity.
- **`atomic_commit` output change:** Adds `next_actions` field. Additive — does not break existing consumers.
- **Slash command addition:** `/atomic:review` added. No existing commands change behavior.
- **`atomic-commit.md` modification:** One line suggesting review. No behavioral change.
- **Naming caveat:** The `mcp__atomic-commit__` vs `mcp__atomic__` prefix discrepancy in existing commands must be resolved before this plan ships. See Phase 3 note.

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Large ranges (>50 commits) | Hard cap at 50 with descriptive error |
| BatchInfo stale after manual git ops | `git merge-base --is-ancestor` validation |
| BatchInfo from wrong repo | `repoToplevel` check on read |
| Crafted range strings | Structural parsing, reject `...`, validate each ref, `.max(256)` |
| N+1 git process spawns | Single `git log -p --stat` call |
| Pipe delimiter in commit messages | NUL-delimited `--format` with `%x00` |
| `mcp__` naming prefix mismatch | Must verify at runtime before implementation |
| Convention check drift (if in tool) | Kept in Claude layer only — no regex duplication |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-12-atomic-review-brainstorm.md](docs/brainstorms/2026-03-12-atomic-review-brainstorm.md) — Key decisions carried forward: lean MCP tool + rich command, smart default range via UndoInfo, structured report + interactive discussion.

### Internal References

- Existing tool pattern: `mcp/src/tools/git-state.ts` (simplest read-only tool, Promise.all for parallel git calls)
- Undo state: `mcp/src/tools/undo-commits.ts:1-14` (UndoInfo interface and state)
- Convention regex: `mcp/src/tools/generate-changelog.ts:12` (CONVENTIONAL_RE), `:112` (SAFE_REF)
- Git helper: `mcp/src/lib/git.ts` (git(), validatePath(), parseStatusFiles(), 10MB maxBuffer)
- Diff parser: `mcp/src/lib/hunk-parser.ts` (parseDiff(), buildPartialPatch())
- Command template: `plugins/atomic/commands/atomic-commit.md` (frontmatter and structure pattern)
- Prompt pattern: `mcp/src/prompts/analyze-changes.ts` (orchestration example for agent parity)
- Plugin config: `plugins/atomic/.mcp.json` (server key "atomic" — naming prefix source)

### External References

- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — tool annotations, error handling, structuredContent
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — `registerTool` with `outputSchema` support in v2
- [MCP Tool Annotations](https://blog.marcnuri.com/mcp-tool-annotations-introduction) — readOnlyHint, destructiveHint defaults
