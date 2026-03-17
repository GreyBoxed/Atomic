---
name: atomic:init
description: Initialize a project with git conventions — hooks, gitignore, commit standards, and CLAUDE.md
argument-hint: "[optional: preset 'minimal', 'standard', or 'strict']"
allowed-tools: Bash(pwd:*), Bash(git init:*), Bash(git config:*), Bash(git log:*), Bash(git status:*), Bash(git rev-parse:*), Bash(git add:*), Bash(git commit:*), Bash(git version:*), Bash(ls:*), Bash(cat:*), Bash(mkdir:*), Bash(chmod:*), Bash(test:*), Bash(echo:*), Read, Write, Glob, Grep
---

## Context

- Current directory: !`pwd`
- Is git repo: !`git rev-parse --is-inside-work-tree`
- Existing .gitignore: !`test -f .gitignore`
- Existing CLAUDE.md: !`test -f CLAUDE.md`
- Existing .editorconfig: !`test -f .editorconfig`
- Existing .gitattributes: !`test -f .gitattributes`
- Existing hooks directory: !`ls .githooks/`
- Project type detection: !`ls *.gemspec Gemfile Cargo.toml package.json pyproject.toml go.mod pom.xml build.gradle mix.exs`
- Existing commits: !`git log --oneline -3`
- Git version: !`git version`

## Your task

Set up this project with git best practices for atomic, conventional commits. Detect the project type and apply sensible defaults with minimal user input.

### Step 1 — Detect & Report

Analyze the project and present what you've found:

```
Project Analysis
================

  Type:        [Ruby/Node/Python/Rust/Go/Java/Elixir/Unknown]
  Framework:   [Rails/Next.js/Django/etc. or N/A]
  Git status:  [Initialized | Not initialized]
  Git version: [X.Y.Z]
  Existing:    [list what already exists — .gitignore, hooks, CLAUDE.md, .editorconfig, .gitattributes, etc.]

Recommended preset: [minimal | standard | strict]
```

**Presets:**

| Feature | Minimal | Standard | Strict |
|---------|---------|----------|--------|
| `.gitignore` (language-tailored) | Yes | Yes | Yes |
| `CLAUDE.md` with commit conventions | Yes | Yes | Yes |
| `.editorconfig` (language defaults) | Yes | Yes | Yes |
| `.githooks/commit-msg` (CC validation) | No | Yes | Yes |
| `.githooks/pre-commit` (secret scan) | No | Yes | Yes |
| `.gitattributes` (language-aware) | No | Yes | Yes |
| `.githooks/pre-commit` (lint check) | No | No | Yes |
| `core.hooksPath` configured | No | Yes | Yes |
| Branch naming convention doc | No | No | Yes |
| Performance config (fsmonitor, caches) | No | No | Yes |

If the user specified a preset in their argument, use it. Otherwise, recommend one and ask.

### Step 2 — Generate files (after user confirms preset)

Generate each file, showing what you're creating. **Never overwrite existing files without asking** — if a `.gitignore` or `CLAUDE.md` already exists, show the diff of what you'd add and ask permission. For `.editorconfig` and `.gitattributes`, skip if they already exist and note it.

#### .gitignore

Generate a `.gitignore` tailored to the detected language/framework. Include:
- Language-specific build artifacts and dependency directories
- Editor/IDE files (`.vscode/`, `.idea/`, `*.swp`)
- OS files (`.DS_Store`, `Thumbs.db`)
- Environment files (`.env`, `.env.local`, `.env.*.local`)
- Never ignore lock files that should be committed (`Gemfile.lock`, `package-lock.json`, etc.)

#### CLAUDE.md

Generate or update `CLAUDE.md` with a `## Commit conventions` section:

```markdown
## Commit conventions

This project uses Conventional Commits v1.0.0.

Run `/atomic:commit` to auto-group and commit changes.

**Scopes** (based on project structure):
- `scope1`: description
- `scope2`: description

**Domain vocabulary**:
- [detected from project files]
```

Derive scopes from the project's directory structure (e.g., `api`, `web`, `db`, `cli`). Derive domain vocabulary from README, existing code, or package description.

#### .editorconfig (all presets)

**SKIP if `.editorconfig` already exists** — note "Existing .editorconfig preserved" in the summary.

Generate an `.editorconfig` using the detected project type. Use these language defaults:

- **Go**: `indent_style = tab` (leave `indent_size` unset for reader preference)
- **Python, Rust, Java**: `indent_style = space`, `indent_size = 4`
- **Everything else** (Ruby, JS/TS, Elixir, etc.): `indent_style = space`, `indent_size = 2`

All sections use: `charset = utf-8`, `end_of_line = lf`, `trim_trailing_whitespace = true`, `insert_final_newline = true`. Do not set `tab_width` (defaults to `indent_size`).

Start with `root = true` and a `[*]` section for the primary language. Add language-specific override sections only if the project is polyglot (e.g., a Ruby project with Python files detected gets an additional `[*.py]` section with 4-space indent).

#### .githooks/commit-msg (standard + strict)

A POSIX shell script that validates commit messages against Conventional Commits format:
- Must match `^(feat|fix|refactor|test|docs|chore|perf|ci|build|revert)(\(.+\))?\!?: .+`
- Reject empty messages, messages starting with uppercase after the colon, WIP commits
- Print a helpful error message on failure showing the expected format

#### .githooks/pre-commit (standard + strict)

A POSIX shell script that scans staged files for potential secrets:
- Check for patterns: `API_KEY=`, `SECRET=`, `PASSWORD=`, `TOKEN=`, private key headers (`-----BEGIN`)
- Check for common secret files: `.env`, `credentials.json`, `*.pem`, `id_rsa`
- Allow overriding with `SKIP_SECRET_SCAN=1 git commit`
- Print which file and line triggered the warning

#### .gitattributes (standard + strict)

**SKIP if `.gitattributes` already exists** — note "Existing .gitattributes preserved" in the summary.

Generate a `.gitattributes` with:

1. **Universal rules:**
   ```
   # Auto-detect text files and normalize line endings
   * text=auto

   # Binary files
   *.png binary
   *.jpg binary
   *.jpeg binary
   *.gif binary
   *.ico binary
   *.zip binary
   *.gz binary
   *.tar binary
   *.pdf binary
   *.woff binary
   *.woff2 binary
   *.ttf binary
   *.eot binary
   ```

2. **Language-aware diff drivers** based on detected project type:
   - Ruby: `*.rb diff=ruby`, `*.erb diff=html`
   - JS/TS: `*.js diff=javascript`, `*.ts diff=typescript`, `*.jsx diff=javascript`, `*.tsx diff=typescript`
   - Python: `*.py diff=python`
   - Rust: `*.rs diff=rust`
   - Go: `*.go diff=golang`

#### .githooks/pre-commit lint addition (strict only)

Add to the pre-commit hook:
- Run the project's linter on staged files only (detect: `rubocop`, `eslint`, `ruff`, `clippy`, `golangci-lint`)
- Only lint files that are actually staged, not the whole project
- Exit 0 if no linter is detected (don't block commits in unknown projects)

### Step 3 — Configure git

After generating files:

1. **If not a git repo**: `git init` and set default branch to `main`
2. **If hooks generated**: `git config core.hooksPath .githooks` and `chmod +x .githooks/*`
3. **Verify**: Run `git config core.hooksPath` to confirm
4. **Performance config (strict only)**: Parse the Git version from context. Apply these settings:
   - If Git >= 2.37: `git config --local core.fsmonitor true`
   - If Git < 2.37: skip fsmonitor and note "fsmonitor requires Git 2.37+ — skipped"
   - Always: `git config --local core.untrackedCache true`
   - Always: `git config --local feature.manyFiles true`

### Step 4 — Summary

Show what was created:

```
Setup Complete
==============

  Created:
    - .gitignore (tailored for [language])
    - CLAUDE.md (commit conventions + scopes)
    - .editorconfig ([indent style] for [language])
    - .gitattributes (text normalization + [language] diff driver)
    - .githooks/commit-msg (CC validation)
    - .githooks/pre-commit (secret scanning)

  Configured:
    - core.hooksPath → .githooks/
    - core.fsmonitor → true (or: skipped — Git < 2.37)
    - core.untrackedCache → true
    - feature.manyFiles → true

  Skipped:
    - [any files that already existed]

  Notes:
    - [if custom hooks in .git/hooks/] ⚠ core.hooksPath is set to .githooks/ — existing hooks in .git/hooks/ are bypassed.
    - [if on Linux] fsmonitor on Linux may require Watchman — see git-scm.com/docs/git-fsmonitor--daemon

  To disable performance settings:
    git config --unset core.fsmonitor
    git config --unset core.untrackedCache
    git config --unset feature.manyFiles

  Next steps:
    - Review generated files and adjust to your preferences
    - Run /atomic:commit to make your first conventional commit
    - Share .githooks/ with your team (committed to repo, auto-applied via core.hooksPath)
```

Only include sections relevant to the chosen preset. For minimal, omit hooks, .gitattributes, performance config, and their related sections. For standard, omit performance config.

After presenting the summary, mention that the newly created files are not yet committed and suggest running `/atomic:commit` to create the initial setup commit. Do not commit the files yourself — suggest the command so the user gets the full atomic grouping workflow.

### Rules

- **Detect, don't assume** — always check what exists before generating
- **Never overwrite without asking** — existing files might have custom content; for `.editorconfig` and `.gitattributes`, skip silently if they exist
- **Hooks must be POSIX sh** — no bash-isms, work on macOS and Linux
- **Hooks must be fast** — no network calls, no heavy computation
- **Keep it simple** — a working minimal setup beats a complex one that breaks
- **Never configure `core.fsmonitor` on Git versions below 2.37** — on older Git, this value is interpreted as an executable path, not a boolean
