---
name: atomic:rollback
description: Undo recent commits while preserving changes — soft reset with safety checks
argument-hint: "[number of commits to undo, or commit hash to roll back to]"
allowed-tools: Bash(git log:*), Bash(git status:*), Bash(git diff:*), Bash(git reset:*), Bash(git rev-parse:*), Bash(git stash:*), Bash(git branch:*), Bash(git reflog:*), Bash(git submodule:*), Bash(git show:*), mcp__atomic-commit__undo_commits
---

## Context

- Current branch: !`git branch --show-current`
- Working tree status: !`git status --short`
- Recent commits: !`git log --oneline -10`
- Uncommitted changes: !`git diff --stat`
- Staged changes: !`git diff --cached --stat`
- Submodule status: !`git submodule status --recursive`

## Your task

Safely undo recent commits while **preserving all changes as staged files**. This is a non-destructive operation — no code is lost.

### Step 1 — Understand what to undo

If the user specified a number (e.g., `/atomic:rollback 3`), undo that many commits.
If the user specified a commit hash, undo all commits after that hash.
If no argument, show recent commits and ask which ones to undo:

```
Recent commits on [branch]:

  1. abc1234  feat(api): add user endpoint        (2 files, +45/-3)
  2. def5678  fix(db): connection pool leak         (1 file, +8/-2)
  3. 789abcd  refactor: extract validation module   (4 files, +120/-85)
  4. ...

How many commits to undo? (changes will be preserved as staged)
```

### Step 2 — Safety checks (before any reset)

Before undoing, verify:

1. **No uncommitted changes exist** — if there are unstaged or staged changes, warn the user:
   ```
   Warning: You have uncommitted changes. Rolling back will mix them with
   the undone commit changes. Options:
     a) Stash first, rollback, then pop stash
     b) Commit current changes first, then rollback
     c) Proceed anyway (changes will merge in staging area)
   ```
2. **Commits haven't been pushed** — check if the commits exist on the remote:
   ```bash
   git log --oneline origin/<branch>..HEAD
   ```
   If they've been pushed, warn:
   ```
   Warning: These commits have been pushed to origin/<branch>.
   Rolling back locally won't remove them from the remote.
   You'll need to force-push or use /atomic:revert instead.
   ```
3. **Show exactly what will be undone** — list files and changes:
   ```bash
   git diff --stat HEAD~N..HEAD
   ```

### Step 3 — Execute rollback (after confirmation)

```bash
git reset --soft HEAD~N
```

This moves HEAD back N commits while keeping all changes staged. Nothing is lost.

After the reset, show the result:

```
Rolled back N commits. All changes preserved as staged.

Before:  abc1234  feat(api): add user endpoint
After:   789abcd  refactor: extract validation module  (HEAD)

Staged files (ready to re-commit):
  M  src/api/users.ts
  M  src/db/pool.ts
  A  src/lib/validation.ts
  ...

Next steps:
  - /atomic:commit to re-group and commit differently
  - git reset HEAD <file> to unstage specific files
  - git checkout -- <file> to discard changes to a file
```

### Step 4 — Recovery info

Always show the reflog escape hatch:

```
To undo this rollback:
  git reset --soft abc1234
```

### Submodule awareness

When rolling back commits that touched submodules:

- **Detect submodule pointer changes** in the commits being undone — check `git show --stat <hash>` for submodule paths
- **Warn if submodules were added/removed** in the rolled-back range:
  ```
  Warning: Commit abc1234 added submodule 'lib/foo'.
  After rollback, the submodule directory and .git/modules/foo will remain
  on disk but won't be referenced by .gitmodules.

  Options:
    a) Roll back and clean up submodule artifacts (deinit + remove)
    b) Roll back pointer only (keep submodule files on disk)
  ```
- After rollback, run `git submodule update --init --recursive` if any submodule pointers changed, to sync working tree state
- Show submodule pointer changes in the "Staged files" summary

### Rules

- **Always use `--soft` reset** — never `--hard` or `--mixed` unless the user explicitly asks
- **Never rollback on a detached HEAD** — warn and abort
- **Never rollback merge commits without warning** — they require special handling
- **Cap at 20 commits** — if the user asks for more, confirm this is intentional
- **Show the reflog recovery command** after every rollback
