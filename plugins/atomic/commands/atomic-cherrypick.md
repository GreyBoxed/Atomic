---
name: atomic:cherrypick
description: Selectively apply commits from other branches with conflict resolution guidance
argument-hint: "[commit hash, range, or branch name]"
allowed-tools: Bash(git log:*), Bash(git status:*), Bash(git diff:*), Bash(git cherry-pick:*), Bash(git rev-parse:*), Bash(git show:*), Bash(git branch:*), Bash(git add:*), Bash(git commit:*), Bash(git merge-base:*), Bash(git reset:*), Bash(git stash:*), Bash(git submodule:*)
---

## Context

- Current branch: !`git branch --show-current 2>/dev/null || echo "(detached HEAD)"`
- Working tree clean: !`git status --short 2>/dev/null | head -5`
- All branches: !`git branch --all --format='%(refname:short)' 2>/dev/null | head -15`
- Recent commits on current branch: !`git log --oneline -5 2>/dev/null`
- Submodule status: !`git submodule status --recursive 2>/dev/null || echo "(no submodules)"`

## Your task

Apply specific commits from other branches onto the current branch. Guide the user through selection, preview the impact, and handle conflicts gracefully.

### Step 1 — Identify commits to cherry-pick

Parse the user's argument:
- **Single hash** (`abc1234`): pick that one commit
- **Range** (`abc1234..def5678`): pick all commits in that range
- **Branch name** (`feature/foo`): show commits unique to that branch and let user select

If a branch name is given, show commits that exist on that branch but not on the current branch:

```
Commits on [source branch] not on [current branch]:

  1. abc1234  feat(api): add user endpoint          (2 files)
  2. def5678  fix(db): connection pool leak           (1 file)
  3. 789abcd  refactor: extract validation module     (4 files)
  4. ghi0123  docs: update API reference              (1 file)

Pick which commits to apply (numbers, ranges like 1-3, or 'all'):
```

If no argument, list branches and ask which to pick from.

### Step 2 — Preview impact

For each commit to be cherry-picked, show:

```
Cherry-pick Preview
===================

Commit: abc1234 — feat(api): add user endpoint
Author: Jane Doe <jane@example.com>
Date:   2026-03-10

Files:
  A  src/api/users.ts         (+45 lines)
  M  src/routes/index.ts      (+2/-0)

Overlap with current branch: [none | list files that differ]
```

Check for potential conflicts by comparing the commit's changed files against changes on the current branch since the common ancestor:

```bash
git merge-base HEAD <source-branch>
git diff --name-only <merge-base>..HEAD
```

If overlapping files exist, warn:

```
Warning: These files were modified on both branches:
  - src/routes/index.ts (modified on current branch in commit xyz789)

Conflicts are likely. Cherry-pick will pause for manual resolution.
```

### Step 3 — Execute cherry-picks (after confirmation)

**Pre-flight check:**
- Working tree must be clean (if not, offer to stash)
- Not in a detached HEAD state (warn and offer to create a branch)

**For a single commit:**
```bash
git cherry-pick <hash>
```

**For multiple commits (in chronological order):**
```bash
git cherry-pick <oldest> <next> <newest>
```

**If conflicts arise:**

1. Show which files conflict:
   ```bash
   git diff --name-only --diff-filter=U
   ```

2. For each conflicted file, show the conflict with context:
   ```bash
   git diff <file>
   ```

3. Explain each conflict:
   ```
   Conflict in src/routes/index.ts:

   <<<<<<< HEAD (your current branch)
   [your version]
   =======
   [cherry-picked version]
   >>>>>>> abc1234 (commit being applied)

   The cherry-picked commit adds a user route, but your branch
   has reorganized the route definitions.
   ```

4. Ask the user how to resolve each conflict:
   - **Keep ours**: use the current branch version
   - **Keep theirs**: use the cherry-picked version
   - **Manual**: let the user specify the resolution

5. After resolution:
   ```bash
   git add <resolved files>
   git cherry-pick --continue
   ```

6. If the user wants to bail out:
   ```bash
   git cherry-pick --abort
   ```

### Step 4 — Summary

```
Cherry-pick Complete
====================

Applied N commits to [current branch]:

  new1234  feat(api): add user endpoint          (from abc1234)
  new5678  fix(db): connection pool leak           (from def5678)

Note: Cherry-picked commits get new hashes. The original
commits on [source branch] are unchanged.

To undo these cherry-picks:
  git reset --soft HEAD~N
  (or /atomic:rollback N)
```

### Submodule awareness

When cherry-picking commits that touch submodules:

- **Detect submodule changes** in the commit — check `git show --stat <hash>` for paths listed in `.gitmodules`
- **If the commit modifies submodule pointers**, warn:
  ```
  Warning: Commit abc1234 updates submodule pointer for 'lib/foo'.
  The submodule will point to a different commit after cherry-pick.

  After cherry-pick, run:
    git submodule update --init --recursive
  to sync the submodule working directory.
  ```
- **If the commit adds a new submodule** (changes `.gitmodules`), the cherry-pick will add the entry but NOT clone the submodule. After cherry-pick:
  ```bash
  git submodule update --init --recursive
  ```
- **If the source and target branches have different submodule URLs** for the same path, flag this as a conflict requiring manual resolution
- **Show submodule changes distinctly** in the preview — don't just show them as a one-line file change, explain it's a pointer update:
  ```
  Submodule changes:
    lib/foo: abc1234 → def5678 (3 commits ahead)
  ```

### Rules

- **Working tree must be clean** before starting — offer to stash if dirty
- **Cherry-pick in chronological order** (oldest first) to preserve logical sequence
- **Never use `--force`** or `-X theirs`/`-X ours` without explicit user choice
- **Always show the new commit hashes** alongside the original ones
- **For merge commits**, explain the `-m` flag and ask which parent to use
- **If cherry-picking creates an empty commit** (already applied), warn and offer to skip
- **Show `/atomic:rollback` as the undo path** — keep commands interconnected
