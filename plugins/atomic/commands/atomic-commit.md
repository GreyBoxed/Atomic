---
name: atomic:commit
description: Group changes by feature and create atomic commits following Conventional Commits v1.0.0
argument-hint: "[optional: specific instructions]"
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git diff:*), Bash(git commit:*), Bash(git reset:*), Bash(git log:*), Bash(git submodule:*), mcp__atomic-commit__git_state, mcp__atomic-commit__atomic_commit, mcp__atomic-commit__dry_run, mcp__atomic-commit__file_hunks, mcp__atomic-commit__undo_commits, mcp__atomic-commit__generate_changelog, mcp__atomic-commit__scan_secrets
---

## Context

- Working directory status: !`git status --short`
- All changed files with full diff: !`git diff`
- Currently staged changes: !`git diff --cached --name-only`
- Recent commits (for style reference): !`git log --oneline -5`
- Submodule status: !`git submodule status --recursive`

## Your task

### Pre-flight check

If the context above shows "(not a git repo)" for working directory status, STOP immediately and tell the user:

> This directory is not a git repository. Run `/atomic:init` to initialize one, or navigate to an existing repo before running `/atomic:commit`.

Do not attempt to analyse files or create commits.

### Analyse and commit

Analyse the changed files and group them into **logical atomic commits** — each commit should represent a single cohesive concern (e.g. one feature, one bugfix, one refactor, one migration, one test suite).

Print a brief group summary, then execute all commits immediately without waiting for approval.

### Execute atomic commits

Print the planned groups before starting:

```
Committing N groups:

Group 1 — <short description>  (<N> files)
Group 2 — <short description>  (<N> files)
…
```

Then, for each group in order:

1. Use `git add <specific files>` to stage only the files in that group (never `git add -A` or `git add .`)
2. Create a commit with a clear message following the Conventional Commits format below
3. After all commits, show a summary with `git log --oneline -<N>` where N is the number of commits just made
4. After the summary, suggest: "Run `/atomic:review` to review these commits for quality and convention adherence."

### Conventional Commits v1.0.0 — Commit message format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types table**

| Type | Description | SemVer impact |
|------|-------------|---------------|
| `feat` | A new feature | MINOR |
| `fix` | A bug fix | PATCH |
| `refactor` | Code change that neither fixes a bug nor adds a feature | — |
| `test` | Adding missing tests or correcting existing tests | — |
| `docs` | Documentation only changes | — |
| `chore` | Changes to build process, dependencies, or auxiliary tools | — |
| `perf` | A code change that improves performance | PATCH |
| `ci` | Changes to CI configuration files and scripts | — |
| `build` | Changes that affect the build system or external dependencies | — |
| `revert` | Reverts a previous commit | — |

Append `!` after type/scope to indicate a BREAKING CHANGE (MAJOR SemVer impact):
```
feat!: drop support for Node 6
refactor(api)!: rename endpoint /users to /accounts
```

### Conventional Commits v1.0.0 — Specification

1. Commits MUST be prefixed with a type, which consists of a noun (`feat`, `fix`, etc.), followed by the optional scope, optional `!`, and required terminal colon and space.
2. The type `feat` MUST be used when a commit adds a new feature to your application or library.
3. The type `fix` MUST be used when a commit represents a bug fix for your application.
4. An optional scope MAY be provided after a type. A scope MUST consist of a noun describing a section of the codebase surrounded by parenthesis, e.g., `fix(parser):`.
5. A description MUST immediately follow the colon and space after the type/scope prefix. The description is a short summary of the code changes, e.g., `fix: array parsing issue when multiple spaces were contained in string`.
6. A longer commit body MAY be provided after the short description, providing additional contextual information about the code changes. The body MUST begin one blank line after the description.
7. A commit body is free-form and MAY consist of any number of newline separated paragraphs.
8. One or more footers MAY be provided one blank line after the body. Each footer MUST consist of a word token, followed by either a `:<space>` or `<space>#` separator, followed by a string value (this is inspired by the git trailer convention).
9. A footer's token MUST use `-` in place of whitespace characters, e.g., `Acked-by` (this helps differentiate the footer section from a multi-paragraph body). An exception is made for `BREAKING CHANGE`, which MAY also be used as a token.
10. A footer's value MAY contain spaces and newlines, and parsing MUST terminate when the next valid footer token/separator pair is observed.
11. Breaking changes MUST be indicated in the footer portion of a commit, by including the text `BREAKING CHANGE:`, followed by a colon, space, and description, e.g., `BREAKING CHANGE: environment variables now take precedence over config files`.
12. If included as a footer, a breaking change MUST consist of the uppercase text `BREAKING CHANGE`, followed by a colon, space, and description, e.g., `BREAKING CHANGE: environment variables now take precedence over config files`.
13. If included in the type/scope prefix, breaking changes MUST be indicated by a `!` immediately before the `:`. If `!` is used, `BREAKING CHANGE:` MAY be omitted from the footer section, and the commit description SHALL be used to describe the breaking change.
14. Types other than `feat` and `fix` MAY be used in your commit messages, e.g., `docs: update ref docs`.
15. The units of information that make up Conventional Commits MUST NOT be treated as case sensitive by implementors, with the exception of `BREAKING CHANGE` which MUST be uppercase.
16. `BREAKING-CHANGE` MUST be synonymous with `BREAKING CHANGE` when used as a token in a footer.

### Examples

```
feat: allow provided config object to extend other configs

feat(api)!: send an email to the customer when a product is shipped

fix: prevent racing of requests

Introduce a request id and a reference to latest request. Dismiss
incoming responses other than from latest request.

docs: correct spelling of CHANGELOG

feat(lang): add Polish language

fix: correct minor typos in code

see the issue for details

on typo fixes.

Reviewed-by: Z
Refs #123
```

### Submodule awareness

- Check `git submodule status` for dirty or modified submodules (lines starting with `+` or having `(modified content)`)
- Submodule pointer changes (the commit hash a submodule points to) should be grouped with the feature they support, not lumped into a generic "chore" commit
- If a submodule has uncommitted changes inside it, warn the user:
  ```
  Warning: Submodule 'lib/foo' has uncommitted changes inside it.
  Commit inside the submodule first, then the pointer update in the parent.
  ```
- Stage submodule pointer updates with `git add <submodule-path>` like any other file
- Never use `git add -A` in a repo with submodules — it can stage unintended submodule pointer changes

### Git safety rules

- Never stage files that are unrelated to the group
- Never use `git add -A` or `git add .`
- Never amend previous commits
- If a file is both staged and unstaged, show the user and ask which version to commit
