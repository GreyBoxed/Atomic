---
title: "fix: Guard atomic-commit context commands against non-git directories"
type: fix
status: completed
date: 2026-03-12
---

# fix: Guard atomic-commit context commands against non-git directories

## Enhancement Summary

**Deepened on:** 2026-03-12
**Sections enhanced:** 3 (Proposed Solution, Acceptance Criteria, new Research Insights section)
**Review agents used:** Pattern Recognition, Code Simplicity, Agent-Native, Security Sentinel, Skills Research

### Key Improvements
1. Added pre-flight check instruction in command body — the agent needs prompt-level guidance to handle the non-git case, not just shell-level fallbacks
2. Fixed fallback message on line 12: `"(nothing staged)"` → `"(no staged changes)"` to match the `"(no <noun>)"` convention used across all sibling commands
3. Confirmed line 11 simplification is correct — the original `|| git diff --cached` fallback was semantically broken (never triggered in real repos, also crashed in non-repos)

### New Considerations Discovered
- `!` backtick context commands execute at template-time before `allowed-tools` restrictions apply — this is expected but worth documenting
- The MCP server's stderr warning (`"Warning: atomic-commit MCP server started outside a git repository"`) is invisible to the agent — only the context fallback strings provide visibility
- 5 commands across sibling files use `2>/dev/null` with pipes but no `|| echo` fallback (lower severity — no crash, just empty output)

## Overview

`/atomic:commit` crashes on load when invoked outside a git repository. The `!` backtick context commands in `atomic-commit.md` execute before Claude sees any prompt, and three of the five git commands lack `2>/dev/null` error suppression or `|| echo` fallbacks. When git detects no `.git` directory, it falls back to `--no-index` mode where flags like `--cached` are invalid, producing a fatal error that blocks command loading.

### Research Insights

**Agent-Native Architecture:** The crash fix alone is necessary but not sufficient. Defensive fallback strings prevent the shell-level crash, but the agent also needs **prompt-level instructions** to detect the non-git state and choose the right action (suggest `/atomic:init`, stop). Without this, the agent receives vague fallback strings like "(not a git repo)" but has no decision path — a "context starvation" anti-pattern.

**Security:** All proposed changes are safe. The `|| echo` fallback strings are static with no variable interpolation — zero injection risk. Suppressing stderr with `2>/dev/null` on read-only local git commands does not hide exploitable warnings. The most relevant suppressed warning (dubious-ownership from CVE-2022-24765) still causes the command to fail safely, triggering the fallback.

**Claude Code Command Spec:** The `!` backtick syntax runs shell commands unconditionally at invocation time. There is no mechanism to short-circuit or abort based on context output. Therefore: context sections gather data defensively, command bodies handle the logic.

## Problem Statement

The error trace from the user's session:

```
Error: Bash command failed for pattern "!`git diff --cached --name-only`": [stderr]
error: unknown option `cached'
usage: git diff --no-index [<options>] <path> <path>
```

**Root cause:** `plugins/atomic/commands/atomic-commit.md` lines 10-12 have three unguarded context commands:

```markdown
- Working directory status: !`git status --short`                              # line 10 — no fallback
- All changed files with full diff: !`git diff 2>/dev/null || git diff --cached` # line 11 — fallback is ALSO broken (--cached fails in --no-index mode)
- Currently staged changes: !`git diff --cached --name-only`                   # line 12 — no fallback ← CRASH
```

Lines 13-14 already have proper guards. Every other command file (`atomic-revert.md`, `atomic-recover.md`, `atomic-rollback.md`, `atomic-cherrypick.md`, `atomic-init.md`) uses `2>/dev/null || echo "(fallback)"` on all context commands.

### Research Insights

**Pattern Recognition:** The claim that sibling commands "ALL use `2>/dev/null || echo` consistently" is slightly overstated. Five commands across siblings use `2>/dev/null` with pipes but no `|| echo` fallback (e.g., `atomic-rollback.md` line 11: `git status --short 2>/dev/null | head -20`). These won't crash (stderr is suppressed), but produce empty output rather than informative fallback text. This is a separate, lower-severity inconsistency that could be cleaned up as a follow-up.

**Code Simplicity:** Line 11's original fallback `git diff 2>/dev/null || git diff --cached` was semantically broken in two ways: (1) `git diff` returns exit code 0 even with empty output, so the `||` branch never triggers in a real repo; (2) outside a repo, `git diff --cached` also crashes. The fallback only ever functioned as a broken error handler, never as intended "show cached if no unstaged" logic. Replacing it with an explicit echo is more correct.

## Proposed Solution

Two changes: (1) add `2>/dev/null || echo "(fallback)"` guards to three unguarded context lines, and (2) add a pre-flight check in the command body.

### Change 1: Context section guards — `plugins/atomic/commands/atomic-commit.md`

**Before:**

```markdown
- Working directory status: !`git status --short`
- All changed files with full diff: !`git diff 2>/dev/null || git diff --cached`
- Currently staged changes: !`git diff --cached --name-only`
```

**After:**

```markdown
- Working directory status: !`git status --short 2>/dev/null || echo "(not a git repo)"`
- All changed files with full diff: !`git diff 2>/dev/null || echo "(no changes)"`
- Currently staged changes: !`git diff --cached --name-only 2>/dev/null || echo "(no staged changes)"`
```

### Change 2: Pre-flight check — `plugins/atomic/commands/atomic-commit.md`

Add a prerequisite check at the top of "Your task", before the analysis instructions:

```markdown
### Pre-flight check

If the context above shows "(not a git repo)" for working directory status, STOP immediately and tell the user:

> This directory is not a git repository. Run `/atomic:init` to initialize one, or navigate to an existing repo before running `/atomic:commit`.

Do not attempt to analyse files or create commits.
```

### Research Insights

**Agent-Native Review (Critical):** The pre-flight check is the most important part of the fix and was missing from the original plan. Without it, the agent receives fallback strings but has no instructions on what to do — it may attempt `git add` and `git commit` (which will fail), or hallucinate a plan. The pre-flight block gives the agent the same recovery-path awareness a human user would have. It references `/atomic:init` which is the correct cross-command recovery path.

**Agent-Native Review (Scope):** The `allowed-tools` list should NOT be expanded for the non-git case. The agent should tell the user to run `/atomic:init`, not attempt initialization itself. Keeping tools narrowly scoped per command is the right primitive design.

**Code Simplicity:** The 3-line context fix + pre-flight block is the minimum viable fix. An early-abort mechanism in the shell layer would be overengineering — the context section cannot abort execution by design. The agent is the decision-maker, not the shell.

**Pattern Recognition (line 12 wording):** Changed `"(nothing staged)"` to `"(no staged changes)"` to match the `"(no <noun>)"` convention used everywhere: `"(no commits)"`, `"(no submodules)"`, `"(no remotes)"`, `"(no upstream)"`.

## Acceptance Criteria

- [x] `/atomic:commit` loads without error when invoked outside a git repository (shows fallback text in context section)
- [x] `/atomic:commit` continues to work normally inside a git repository (shows real git output)
- [x] All five context lines in `atomic-commit.md` have `2>/dev/null` guards
- [x] Fallback messages match the `"(no <noun>)"` style used in sibling command files
- [x] Pre-flight check block exists in the command body, referencing `/atomic:init` as the recovery path
- [x] Agent stops cleanly when context shows "(not a git repo)" — no attempted git operations

## Context

- **Affected file:** `plugins/atomic/commands/atomic-commit.md:10-12` (context section) and after line 16 (task body)
- **Pattern reference:** `plugins/atomic/commands/atomic-rollback.md:10-15` (all lines guarded)
- **Convention from CLAUDE.md:** "Plugin lives in `plugins/atomic/` — commands are real files, no symlinks"
- **Convention from CLAUDE.md:** "MCP tool names (`mcp__atomic__*`) are public API — renaming is a breaking change"

## Sources

- Error trace from user session invoking `/atomic:commit` in a non-git directory
- Existing pattern in sibling commands: `atomic-rollback.md`, `atomic-recover.md`, `atomic-revert.md`, `atomic-cherrypick.md`, `atomic-init.md`
- Agent-Native Reviewer: pre-flight check pattern, context starvation anti-pattern
- Pattern Recognition Specialist: `"(no <noun>)"` convention, sibling command audit
- Code Simplicity Reviewer: line 11 fallback was semantically broken, fix is correct
- Security Sentinel: no injection risk, stderr suppression safe for read-only local commands
- Skills Research (create-agent-skills): `!` backtick commands cannot abort — context gathers, body decides
