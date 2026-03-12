---
title: "feat: Auto-execute atomic commits without user approval step"
type: feat
status: completed
date: 2026-03-12
---

# feat: Auto-execute atomic commits without user approval step

Remove the Step 1 → approval → Step 2 flow from `/atomic-commit`. Instead, analyse groupings and execute all commits immediately, printing a brief group summary before each one for observability.

## Problem Statement

The current two-step flow interrupts every commit run with a required approval question. For a user who runs `/atomic-commit` intentionally and trusts the grouping logic, this is friction with no benefit — `git reset HEAD~N` is always available if a grouping is wrong.

## Proposed Solution

Collapse Step 1 and Step 2 into a single execution pass:

1. Analyse changed files and determine logical groupings (same logic as before)
2. Print a brief summary of the groups about to be committed (transparency, not a question)
3. Execute each group immediately — `git add <files>`, then `git commit`
4. Show final `git log --oneline -<N>` summary

The groupings display becomes informational output rather than an approval gate.

## Acceptance Criteria

- [x] `/atomic-commit` runs to completion without pausing for user input
- [x] A brief group listing is printed before commits begin (not a question — just a header like `Committing 3 groups:`)
- [x] Each commit uses `git add <specific files>` (never `git add -A` or `git add .`)
- [x] Final `git log --oneline -N` summary is shown after all commits
- [x] `commands/atomic-commit.md` removes the "Wait for the user's response before proceeding" instruction
- [x] Git safety rule "Never skip the user approval step between Step 1 and Step 2" is removed (no longer meaningful)
- [x] Plugin cache is synced (manually copied — `claude plugins update` treats same-version as no-op)

## Implementation

Two files need updating:

### `commands/atomic-commit.md`

**Remove:**
- The `### Step 1 — Propose groupings` approval flow (the block asking "Are the groupings correct? … Wait for the user's response before proceeding.")
- The git safety rule: `- Never skip the user approval step between Step 1 and Step 2`
- The step label `### Step 2 — Execute atomic commits (after approval)` → rename to `### Execute atomic commits`

**Add (before executing the first commit):**

```
Atomic commits to be made:

Group 1 — <short description>  (2 files)
Group 2 — <short description>  (1 file)
…

Proceeding with commits.
```

This keeps the "what am I doing" transparency without blocking on a response.

**Resulting structure:**

```markdown
## Your task

Analyse the changed files and group them into logical atomic commits.

Print a brief summary of the groups, then execute each commit immediately.

### Execute atomic commits

For each group, in order:

1. Use `git add <specific files>` to stage only the files in that group
2. Create a commit with a clear message following the Conventional Commits format below
3. After all commits, show a summary with `git log --oneline -<N>`

… (CC spec and examples unchanged)

### Git safety rules

- Never stage files that are unrelated to the group
- Never use `git add -A` or `git add .`
- Never amend previous commits
- If a file is both staged and unstaged, show the user and ask which version to commit
```

### Plugin cache sync

After editing the source, run:

```bash
claude plugins update
```

This syncs `~/.claude-personal/plugins/cache/atomic-commit/atomic-commit/1.0.0/commands/atomic-commit.md`.

## Files Modified

| File | Action |
|------|--------|
| `/Users/capitalmind/Documents/atomic-commit/commands/atomic-commit.md` | Edit — remove approval gate, update structure |
| `~/.claude-personal/plugins/cache/atomic-commit/atomic-commit/1.0.0/commands/atomic-commit.md` | Auto-updated via `claude plugins update` |

## Rollback

`git revert` the commit in the `atomic-commit` repo. Re-run `claude plugins update`.
