---
name: atomic:recover
description: Diagnose and repair git repository health — submodules, corrupt objects, broken refs, stale tracking
argument-hint: "[optional: specific issue like 'submodules' or 'detached HEAD']"
allowed-tools: Bash(git fsck:*), Bash(git status:*), Bash(git submodule:*), Bash(git reflog:*), Bash(git remote:*), Bash(git branch:*), Bash(git config:*), Bash(git worktree:*), Bash(git gc:*), Bash(git prune:*), Bash(git stash:*), Bash(git checkout:*), Bash(git rev-parse:*), Bash(cat .gitmodules:*), Bash(ls:*), Bash(test:*), Bash(cp:*), Bash(mkdir:*)
---

## Context

- Repository root: !`git rev-parse --show-toplevel`
- Working tree status: !`git status --short`
- Current branch: !`git branch --show-current`
- Submodule status: !`git submodule status --recursive`
- Repository integrity (quick): !`git fsck --no-full --connectivity-only`
- Stale worktrees: !`git worktree list`
- Remote tracking: !`git remote -v`

## Your task

Diagnose and repair this git repository. Use a **tiered approach** — start with the least destructive checks and only escalate if needed. Always explain what you find and what you're about to do before doing it.

### Tier 1 — Diagnose (always run, never destructive)

Run these checks and report findings:

1. **Repository integrity**: `git fsck --full` — check for corrupt objects, dangling refs, missing trees
2. **Submodule health** (if submodules exist):
   - Check `.gitmodules` vs `.git/config` vs `.git/modules/` for sync issues
   - Detect detached HEAD states in submodules
   - Detect missing submodule directories (forgot `--recursive` on clone)
   - Detect URL mismatches between `.gitmodules` and `.git/config`
3. **Branch health**: stale remote-tracking branches, orphaned local branches
4. **Worktree health**: stale or broken worktree entries
5. **Large file detection**: files > 10MB that shouldn't be tracked
6. **Stash health**: check for stale or orphaned stashes

Present a health report like this:

```
Repository Health Report
========================

Overall: [HEALTHY | NEEDS ATTENTION | CRITICAL]

  Integrity:    [OK | N issues found]
  Submodules:   [OK | N issues found | N/A]
  Branches:     [OK | N stale tracking branches]
  Worktrees:    [OK | N stale entries]
  Large files:  [OK | N files > 10MB]
  Stashes:      [OK | N stashes (oldest: date)]

Issues Found:
  1. [description of issue]
  2. [description of issue]
  ...
```

If no issues are found, report the clean bill of health and stop.

### Tier 2 — Propose repairs (only if issues found)

For each issue, propose a specific fix with the exact commands that will be run. Group fixes by risk level:

```
Proposed Repairs
================

Safe (auto-fixable):
  1. [description] — [command]
  2. [description] — [command]

Requires confirmation:
  3. [description] — [command] — Risk: [what could go wrong]
  4. [description] — [command] — Risk: [what could go wrong]
```

**Wait for the user's approval before executing any repairs.**

### Tier 3 — Execute repairs (after approval)

Execute approved repairs in order of safety (safest first). After each repair, verify it worked.

For submodule recovery specifically, follow this escalation:

1. **Light**: `git submodule sync --recursive && git submodule update --init --recursive`
2. **Medium**: `git submodule deinit <name> && git submodule update --init <name>`
3. **Nuclear** (only with explicit user approval):
   - Back up `.git/modules/<name>` to a temp location first
   - Remove `.git/modules/<name>`, the submodule directory, entries from `.gitmodules` and `.git/config`
   - Re-add the submodule fresh

After all repairs, re-run the Tier 1 diagnosis to confirm everything is clean.

### Safety rules

- **Never delete data without backing it up first** — copy to `.git/recover-backup/` before removing
- **Never force-push or rewrite shared history**
- **Never run `git gc --prune=now` without user confirmation** — it permanently removes unreachable objects
- **Always show the exact command before running it**
- **If unsure about a fix, explain the options and let the user decide**
