---
name: atomic:revert
description: Create new commits that undo specific changes — safe for shared/pushed history
argument-hint: "[commit hash, range like abc..def, or 'last N']"
allowed-tools: Bash(git log:*), Bash(git status:*), Bash(git diff:*), Bash(git revert:*), Bash(git rev-parse:*), Bash(git show:*), Bash(git branch:*), Bash(git cherry-pick:*), Bash(git reset:*), Bash(git add:*), Bash(git commit:*), Bash(git merge-base:*), Bash(git submodule:*)
---

## Context

- Current branch: !`git branch --show-current 2>/dev/null || echo "(detached HEAD)"`
- Working tree clean: !`git status --short 2>/dev/null | head -5`
- Recent commits: !`git log --oneline -10 2>/dev/null || echo "(no commits)"`
- Remote tracking: !`git rev-parse --abbrev-ref @{upstream} 2>/dev/null || echo "(no upstream)"`
- Submodule status: !`git submodule status --recursive 2>/dev/null || echo "(no submodules)"`

## Your task

Create **new commits** that undo the effect of specific past commits. Unlike rollback (which rewrites history), revert is safe for pushed/shared branches because it adds history rather than removing it.

### Step 1 — Identify commits to revert

Parse the user's argument:
- **Single hash** (`abc1234`): revert that one commit
- **Range** (`abc..def`): revert all commits in that range
- **"last N"** or just a number (`3`): revert the last N commits
- **No argument**: show recent commits and ask which to revert

```
Recent commits on [branch]:

  1. abc1234  feat(api): add user endpoint        (2 files, +45/-3)
  2. def5678  fix(db): connection pool leak         (1 file, +8/-2)
  3. 789abcd  refactor: extract validation module   (4 files, +120/-85)

Which commits to revert? (enter numbers, hash, or range)
```

### Step 2 — Analyze impact

For each commit to be reverted, show:

```
Revert Analysis
===============

Commit: abc1234 — feat(api): add user endpoint
Files affected:
  M  src/api/users.ts         (+45/-3)
  M  src/routes/index.ts      (+2/-0)

Potential conflicts: [none | list files modified by later commits]
```

Check for **downstream dependencies** — if later commits modified the same files, warn about potential conflicts:

```
Warning: src/api/users.ts was also modified in:
  - def5678  fix(db): connection pool leak
  - ghi9012  feat(api): add pagination

Reverting abc1234 may conflict with these changes.
Options:
  a) Revert in reverse chronological order (safest)
  b) Revert just abc1234 and resolve conflicts manually
  c) Revert all related commits together
```

### Step 3 — Execute reverts (after confirmation)

**For a single commit:**
```bash
git revert <hash> --no-edit
```

**For multiple commits (reverse chronological order):**
```bash
git revert <newest>..<oldest> --no-edit
```

Or if the user wants a single combined revert commit:
```bash
git revert --no-commit <hash1>
git revert --no-commit <hash2>
git commit -m "revert: undo <description of what was reverted>"
```

**If conflicts arise during revert:**

1. Show the conflicted files and the conflict markers
2. Explain what each side represents (original vs revert)
3. Ask the user how to resolve:
   - Accept the revert (remove the original change)
   - Keep the original (skip this file's revert)
   - Manual resolution (let the user edit)
4. After resolution: `git add <resolved files> && git revert --continue`

### Step 4 — Summary

After all reverts complete:

```
Revert Complete
===============

Created N revert commits:

  fed4321  revert: undo "feat(api): add user endpoint"
  cba8765  revert: undo "fix(db): connection pool leak"

These commits are safe to push — they add history, not rewrite it.

To undo these reverts:
  git revert fed4321 cba8765
```

### Revert commit message format

Follow Conventional Commits — revert type:

```
revert: undo "<original commit subject>"

This reverts commit <full hash>.

<optional: reason for reverting>
```

### Submodule awareness

When reverting commits that touched submodules:

- **Detect submodule changes** in the commit being reverted — check `git show --stat <hash>` for submodule paths listed in `.gitmodules`
- **If reverting a commit that added a submodule**, warn:
  ```
  Warning: Commit abc1234 added submodule 'lib/foo'.
  Reverting will remove it from .gitmodules but NOT clean up:
    - .git/modules/foo/
    - The submodule working directory

  After revert, run:
    git submodule deinit lib/foo
    rm -rf .git/modules/foo
    rm -rf lib/foo
  Or use /atomic:recover to clean up.
  ```
- **If reverting a commit that changed a submodule pointer**, run `git submodule update --init --recursive` after the revert to sync the working tree
- **If reverting a commit that removed a submodule**, the revert will re-add the `.gitmodules` entry but NOT restore `.git/modules/` — advise running `git submodule update --init`

### Rules

- **Working tree must be clean** before starting — if dirty, ask user to commit or stash first
- **Never use `--no-edit` if there are conflicts** — resolve them properly
- **Revert in reverse chronological order** by default (newest first) to minimize conflicts
- **For merge commits**, always specify `-m 1` (mainline parent) unless user says otherwise, and explain what this means
- **Never force-push after revert** — the whole point of revert is that it's push-safe
