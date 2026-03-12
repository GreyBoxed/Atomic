# Atomic

A Claude Code plugin that turns messy working trees into clean, atomic git commits.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

<!-- TODO: Add terminal recording (GIF or asciinema) showing /atomic:commit in action -->

## Why

After an hour of heads-down coding, your working tree is a tangle of bug fixes, refactors, and new features across dozens of files. Manually grouping these into clean commits is tedious — you end up with either one giant "WIP" commit or spending 20 minutes on `git add -p`.

atomic analyzes your diff, groups changes by logical concern, stages them independently — down to individual diff hunks — and writes [Conventional Commits](https://www.conventionalcommits.org/) messages. Each commit does exactly one thing.

## Quick start

Install the plugin:

```
claude plugin marketplace add GreyBoxed/atomic
claude plugin install atomic
```

Then run it on any dirty working tree:

```
/atomic:commit
```

What happens:

1. Reads your full diff and `git status`
2. Groups files by logical concern (one feature per group, one fix per group)
3. Stages each group's files independently (never `git add -A`)
4. Writes a Conventional Commits message for each group
5. Commits them in order

Output looks like:

```
Committing 3 groups:

Group 1 — feat(auth): add session token validation  (4 files)
Group 2 — fix(api): handle null response from /users  (2 files)
Group 3 — refactor: extract database connection pool  (3 files)

a1b2c3d feat(auth): add session token validation
d4e5f6g fix(api): handle null response from /users
h7i8j9k refactor: extract database connection pool
```

## Commands

| Command | What it does |
|---------|-------------|
| `/atomic:commit` | Analyze changes, group by concern, create atomic commits |
| `/atomic:init` | Set up a project with git hooks, .gitignore, and commit conventions |
| `/atomic:review` | Review recent commits for quality, atomicity, and convention adherence |
| `/atomic:rollback` | Undo recent commits with `git reset --soft` (preserves changes as staged) |
| `/atomic:revert` | Create revert commits — safe for pushed/shared history |
| `/atomic:cherrypick` | Apply commits from other branches with conflict guidance |
| `/atomic:recover` | Diagnose and repair repository health (corrupt objects, broken refs, submodules) |

### `/atomic:commit`

Analyzes all changed files, groups them into logical atomic commits (one concern per commit), and executes each with a Conventional Commits message. Scans for secrets before staging. Supports hunk-level staging — if one file has changes belonging to two different features, it splits the file across commits.

```
/atomic:commit
```

### `/atomic:review`

Reviews committed changes for quality, convention compliance, and code issues. Defaults to reviewing the last `/atomic:commit` batch, or accepts an explicit range.

```
/atomic:review
/atomic:review main..HEAD
/atomic:review HEAD~5
```

### `/atomic:rollback`

Undoes recent commits while **preserving all changes as staged files**. Uses `git reset --soft` — nothing is lost. Shows safety warnings for pushed commits and dirty working trees.

```
/atomic:rollback 3
/atomic:rollback abc1234
```

### `/atomic:revert`

Creates **new commits** that undo specific past changes. Safe for pushed/shared branches — adds history rather than rewriting it. Handles conflicts with guided resolution.

```
/atomic:revert abc1234
/atomic:revert abc1234..def5678
/atomic:revert last 3
```

### `/atomic:cherrypick`

Selectively applies commits from other branches. Previews impact, detects potential conflicts, and guides resolution.

```
/atomic:cherrypick abc1234
/atomic:cherrypick feature/auth
```

### `/atomic:recover`

Runs a tiered diagnostic on your repository — integrity checks, submodule sync, stale branches, orphaned worktrees, large files. Proposes repairs grouped by risk level and waits for approval before executing.

```
/atomic:recover
/atomic:recover submodules
```

### `/atomic:init`

Detects your project type (Ruby, Node, Python, Rust, Go, etc.) and sets up git best practices:

| Feature | Minimal | Standard | Strict |
|---------|---------|----------|--------|
| `.gitignore` (language-tailored) | Yes | Yes | Yes |
| `CLAUDE.md` with commit conventions | Yes | Yes | Yes |
| `.githooks/commit-msg` (CC validation) | — | Yes | Yes |
| `.githooks/pre-commit` (secret scan) | — | Yes | Yes |
| `.githooks/pre-commit` (lint check) | — | — | Yes |
| `core.hooksPath` configured | — | Yes | Yes |

```
/atomic:init
/atomic:init standard
```

Hooks are POSIX `sh` — no bash-isms, works on macOS and Linux.

## How it works

The plugin ships a TypeScript MCP server with 8 tools. When you run `/atomic:commit`, the agent calls `git_state` to read your working tree, `file_hunks` to parse individual diff hunks, `dry_run` to validate the grouping, then `atomic_commit` to stage and commit each group.

The `atomic_commit` tool supports both whole-file staging and **hunk-level staging** — it writes a temporary patch file to `.git/`, applies it with `git apply --cached`, then cleans up. This lets it split a single file across multiple commits when different hunks belong to different concerns.

After committing, the server stores the pre-commit HEAD in memory, so `undo_commits` can roll back the entire batch with one call.

## Secret scanning

Secrets are caught at two independent layers:

**MCP layer** (always active): Every `atomic_commit` and `dry_run` call scans files before staging. If a secret is found, the commit is blocked and the tool returns structured findings so the agent can suggest a fix. Checks filenames (`.env`, `*.pem`, `id_rsa`, `credentials.json`) and content patterns (`API_KEY=`, `PASSWORD=`, `TOKEN=`, private key headers). Values are masked in output — you see `API_KEY=***REDACTED***`, not the actual key.

**Git hook layer** (opt-in via `/atomic:init`): A `.githooks/pre-commit` hook runs the same checks on staged files during `git commit`. Catches secrets even when committing outside the plugin.

Both layers block by default. Pass `scanSecrets: "skip"` to the MCP tool if you need to override.

## MCP tools

For programmatic use or building custom workflows:

| Tool | Description |
|------|-------------|
| `scan_secrets` | Scan files for secrets. Returns structured `{file, line, pattern}` findings. |
| `atomic_commit` | Create atomic commits with whole-file or hunk-level staging. Secret scanning on by default. |
| `dry_run` | Validate commit groups without executing. Checks paths and cross-group conflicts. |
| `git_state` | Get repository status, diffs, staged changes, and recent log. |
| `file_hunks` | Parse unstaged changes into individual diff hunks for sub-file staging. |
| `undo_commits` | Roll back last `atomic_commit` batch with `git reset --soft`. |
| `generate_changelog` | Generate changelog from conventional commits between two refs. |
| `review_commits` | Gather structured commit and diff data for review. |

## Why not just...

**...do it manually?**
Works fine for 3-5 changed files. Breaks down when you have 20+ files across multiple concerns and need to stage specific hunks from files that touch multiple features. atomic handles the tedious grouping and hunk-level staging.

**...use commitizen or git-cz?**
Those are commit message formatters — they prompt you through type/scope/description fields. They don't analyze your diff, don't group files, and don't stage anything. atomic does the grouping and staging; the message is a side effect.

**...use commitlint?**
commitlint validates that your message *format* follows Conventional Commits. atomic creates the commits. They're complementary — `/atomic:init` generates a commit-msg hook that does the same format validation.

**...just write good commit messages?**
You should. The value here is in the grouping and staging, not the message. If the generated message isn't right, the commit is there to amend.

## Architecture

- **Single MCP server** in TypeScript, bundled into one file with esbuild. Zero runtime `npm install` needed.
- **`execFile` for all git operations** — never `exec`, preventing shell injection.
- **Path traversal protection** on every user-supplied file path: rejects `..`, absolute paths, null bytes, and leading dashes. Symlinks are resolved and checked against the repo root.
- **Conventional Commits v1.0.0 spec** embedded as an MCP resource — no external fetch.
- **Submodule-aware** across all commands: detects dirty submodules, warns about pointer changes, handles recursive operations.

## Customization

Add a `## Commit conventions` section to your project's `CLAUDE.md` to give Claude domain context:

```markdown
## Commit conventions

**Scopes**: api, web, db, cli
**Domain vocabulary**: tenant, workspace, billing cycle
```

## Development

```bash
cd mcp
npm install
npm run build
```

Project structure:

```
mcp/src/
  index.ts              # Server entry, registers all tools
  tools/                # 8 MCP tools
  lib/                  # git helpers, hunk parser, secret scanner
  resources/            # Embedded Conventional Commits spec
  prompts/              # Structured agent workflows
plugins/atomic/
  commands/             # 7 slash commands
  .mcp.json             # MCP server config
.githooks/              # POSIX sh hooks (generated by /atomic:init)
```

## License

GPL-3.0. See [LICENSE](LICENSE) for details.
