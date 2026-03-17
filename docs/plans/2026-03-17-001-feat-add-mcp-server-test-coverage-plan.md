---
title: "feat: Add MCP server test coverage"
type: feat
status: active
date: 2026-03-17
---

# feat: Add MCP server test coverage

## Overview

Add comprehensive test coverage to the MCP server (`mcp/src/`) to prevent regressions. The project currently has **zero tests** — no test framework, no test files, no test scripts. This plan establishes the testing foundation and prioritizes tests by risk and value.

## Problem Statement / Motivation

The recent `fix(plugin): remove shell operator chaining` commit touched 7 command files with no automated way to verify correctness. The MCP server contains security-critical code (path validation, secret scanning, ref validation) and complex parsers (hunk parser, status parser) that are prime regression targets. As the project grows, manual testing won't scale.

## Proposed Solution

Add **vitest** as the test framework (ESM-native, TypeScript-native, zero-config for this stack) with a tiered test strategy:

- **Tier 1 — Pure function unit tests** (lib/ parsers and validators)
- **Tier 2 — I/O-dependent unit tests** (secret scanner, path validation)
- **Tier 3 — Integration tests** (tool handlers against temp git repos)

## Technical Considerations

### Framework choice: vitest

The project uses ESM (`"type": "module"`), TypeScript with Node16 module resolution, and esbuild bundling. Source imports use `.js` extensions (e.g., `from "../lib/git.js"`). Vitest handles all of this natively without extra transforms. Jest would require significant ESM configuration.

### ESM import resolution

Source files import with `.js` extensions (`import { git } from "../lib/git.js"`). Vitest resolves these to `.ts` files automatically when configured with `resolve.extensions` or when using its default TypeScript support. Verify this works in the vitest config.

### `process.cwd()` in tool handlers

Every tool handler reads `process.cwd()` inline. For integration tests, use `vi.spyOn(process, 'cwd').mockReturnValue(tempDir)` rather than actually calling `process.chdir()` (which is unsafe in parallel execution).

### Test parallelism

- **Unit tests** (Tier 1-2): run in parallel (no shared state)
- **Integration tests** (Tier 3): run sequentially via `describe.sequential` or `vitest.workspace` config, since they share module-level state (`batch-info.ts`) and mock `process.cwd()`

### Build isolation

Add `__tests__` to tsconfig `exclude` so test files are not included in the esbuild production bundle. Alternatively, use a `tsconfig.test.json` that extends the base config.

### Duplicated `validatePath` in `file-hunks.ts`

`mcp/src/tools/file-hunks.ts:8-32` contains a copy of `validatePath` from `mcp/src/lib/git.ts`. **Consolidate before testing** — import from lib instead of maintaining two copies. This is a prerequisite refactor.

### Private pure functions in tool files

Several tool files contain private pure functions with complex logic:
- `extractSha()` in `atomic-commit.ts`
- `parseCommitLine()`, `groupByType()`, `toMarkdown()`, `toJson()` in `generate-changelog.ts`
- `parseNumstat()`, `parseDiffs()` in `review-commits.ts`

**Export these for direct unit testing.** The alternative (testing only through integration) leaves complex parsing logic inadequately covered. These are internal modules, not public API — widening exports is low-risk.

### Git config in test fixtures

Tests that run `git commit` need `user.name` and `user.email`. Set these per-repo in the fixture helper (`git config user.name "test"`) — CI environments cannot be assumed to have global git config.

## Acceptance Criteria

- [ ] vitest installed as devDependency with `"test"` and `"test:watch"` scripts in `mcp/package.json`
- [ ] Tier 1 unit tests for all lib/ pure functions (target: 90%+ coverage on lib/)
- [ ] Tier 2 unit tests for secret-scanner and validatePath
- [ ] Tier 3 integration tests for atomic-commit, undo-commits, and dry-run tool handlers
- [ ] Duplicated `validatePath` in file-hunks.ts consolidated to import from lib
- [ ] Private pure functions in tool files exported and unit-tested
- [ ] `__tests__` excluded from production build
- [ ] All tests pass in CI-like environment (no reliance on global git config)

## Implementation Plan

### Phase 1: Foundation

**Prerequisite refactors:**
- Consolidate `validatePath` duplicate in `file-hunks.ts` → import from `lib/git.ts`
- Export private pure functions from tool files (`extractSha`, `parseCommitLine`, `groupByType`, `toMarkdown`, `toJson`, `parseNumstat`, `parseDiffs`)

**Test infrastructure:**
- Install vitest: `npm install -D vitest`
- Add scripts to `mcp/package.json`:
  ```json
  "test": "vitest run",
  "test:watch": "vitest"
  ```
- Create `mcp/vitest.config.ts` (if needed for ESM resolution)
- Add `"__tests__"` to tsconfig exclude
- Create shared test helper: `mcp/src/lib/__tests__/helpers/git-repo.ts`
  - `createTempRepo()` — init repo, set user config, optional initial commit
  - `cleanup()` — remove temp directory
  - Git config: `user.name "Test"`, `user.email "test@test.com"`

**Files:**
- `mcp/package.json` (modify)
- `mcp/tsconfig.json` (modify)
- `mcp/vitest.config.ts` (new, if needed)
- `mcp/src/lib/__tests__/helpers/git-repo.ts` (new)

### Phase 2: Tier 1 — Pure function unit tests

Priority order by risk and value:

**2a. `ref-validation.test.ts`** — Security boundary, smallest module, fast to write
- Valid single refs: `HEAD`, `HEAD~3`, `v1.0.0`, `feature/branch`, `abc1234`
- Valid two-dot range: `main..HEAD`
- Reject three-dot range: `main...HEAD`
- Reject empty sides: `..HEAD`, `main..`
- Reject hyphen-prefixed refs (flag injection): `-all`, `--all`
- Reject null bytes and unsafe characters
- Allow carets, tildes, slashes, dots

**2b. `hunk-parser.test.ts`** — Most complex pure logic, highest regression risk
- `parseDiff()`:
  - Empty/whitespace input → `[]`
  - Single-file single-hunk diff
  - Single-file multi-hunk diff
  - Multi-file diff
  - Diff with rename (`a/old` → `b/new`)
  - Hunk header with omitted count (`@@ -1 +1 @@`)
  - `No newline at end of file` marker handling
  - Binary file marker (no hunks)
  - File paths containing spaces
  - Content lines starting with `@@` or `diff --git` (false boundaries)
- `buildPartialPatch()`:
  - Select subset of hunks
  - Select all hunks (same as full patch)
  - No valid indices → empty string
  - Out-of-bounds and negative indices filtered
  - Duplicate indices
  - Header lines (---/+++) preserved
  - Output always ends with newline

**2c. `git.test.ts` — `parseStatusFiles()`**
- Standard status codes: `M`, `A`, `D`, `??`, `R`
- Rename with ` -> ` separator
- Empty input
- Quoted paths (special characters)
- Mixed status types

**2d. Exported pure functions from tool files:**
- `extractSha()`: parse `[branch sha]` from git commit output
- `parseCommitLine()`: parse conventional commit messages
- `groupByType()`: group commits by type
- `toMarkdown()` / `toJson()`: changelog output formats
- `parseNumstat()` / `parseDiffs()`: review data parsing

**Files:**
- `mcp/src/lib/__tests__/ref-validation.test.ts` (new)
- `mcp/src/lib/__tests__/hunk-parser.test.ts` (new)
- `mcp/src/lib/__tests__/git.test.ts` (new)
- `mcp/src/tools/__tests__/generate-changelog.test.ts` (new)
- `mcp/src/tools/__tests__/review-commits.test.ts` (new)
- `mcp/src/tools/__tests__/atomic-commit.test.ts` (new, unit portion only)

### Phase 3: Tier 2 — I/O-dependent unit tests

**3a. `secret-scanner.test.ts`**
- Uses temp directory with fixture files
- Sensitive filenames: `.env`, `credentials.json`, `id_rsa`, `id_ed25519`
- Sensitive extensions: `.pem`
- Sensitive prefixes: `.env.production`, `.env.local`
- Content patterns: `API_KEY=`, `SECRET=`, `PASSWORD=`, `TOKEN=`, `PRIVATE_KEY=`
- Private key headers: `-----BEGIN ... PRIVATE KEY-----`
- Binary extension skipping (`.png`, `.jpg`)
- File size limit (>1 MB skipped)
- Unreadable files skipped gracefully
- `maskMatch()` redaction behavior
- Clean files → empty findings

**3b. `git.test.ts` — `validatePath()`**
- Mock `git rev-parse --show-toplevel` and `realpath`
- Reject `..` traversal
- Reject absolute paths starting with `/`
- Reject null bytes
- Reject hyphen-prefixed paths
- Accept valid relative paths within repo
- Accept non-existent files (ENOENT allowed)
- Reject symlinks resolving outside repo

**Files:**
- `mcp/src/lib/__tests__/secret-scanner.test.ts` (new)
- `mcp/src/lib/__tests__/git.test.ts` (extend with validatePath tests)

### Phase 4: Tier 3 — Integration tests for tool handlers

Uses `createTempRepo()` helper. Run sequentially.

**4a. `atomic-commit` tool**
- Single group, whole-file staging, successful commit
- Multiple groups, sequential commits, batch info stored
- Hunk-level staging via patch apply
- Secret scan blocks commit (verify `committed_before_block` in response)
- Path validation rejection
- Git reset rollback on commit failure
- Temp patch file cleanup (even on failure)

**4b. `undo-commits` tool**
- Undo all commits from batch
- Undo partial count
- No batch info → error
- Count exceeds batch commitCount → error

**4c. `dry-run` tool**
- Valid groups pass
- File not in git status → warning
- Cross-group file conflict detected
- Path traversal rejected
- Secret scan findings attributed to correct groups

**Files:**
- `mcp/src/tools/__tests__/atomic-commit.integration.test.ts` (new)
- `mcp/src/tools/__tests__/undo-commits.integration.test.ts` (new)
- `mcp/src/tools/__tests__/dry-run.integration.test.ts` (new)

## Out of Scope

- Prompts (`prompts/analyze-changes.ts`, `prompts/review-changes.ts`) — simple registration, low regression risk
- Resources (`resources/commit-conventions.ts`) — static content
- Plugin command markdown files (`plugins/atomic/commands/*.md`) — not TypeScript, tested via manual invocation
- Coverage thresholds in CI — can be added later once baseline is established
- Remaining tool handlers (git-state, file-hunks, review-commits, generate-changelog, scan-secrets) — defer to a follow-up after Tier 3 core handlers are covered

## Success Metrics

- All lib/ modules have unit tests covering happy path + edge cases (90%+ line coverage)
- Security boundaries (validatePath, ref-validation, secret-scanner) have explicit negative test cases
- Core tool handlers (atomic-commit, undo-commits, dry-run) have integration tests
- `npm test` completes in under 30 seconds
- No test depends on global git config or host-specific state

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| ESM import resolution issues with `.js` extensions | Vitest handles natively; verify in config setup |
| Flaky tests from git I/O in integration tests | Use isolated temp repos, sequential execution, explicit git config |
| Parallel test interference via `batch-info.ts` module state | Sequential execution for integration tests; consider state reset helper |
| Temp directory cleanup failure | Use `afterAll` with `fs.rm(dir, { recursive: true, force: true })` |
| Tool handler coupling to `process.cwd()` | Mock via `vi.spyOn`; document pattern for future tests |

## Sources & References

- Similar patterns: vitest ESM + TypeScript setup is well-documented
- Security test patterns: OWASP path traversal test cases
- `mcp/src/lib/git.ts` — parseStatusFiles, validatePath, git wrapper
- `mcp/src/lib/hunk-parser.ts` — parseDiff, buildPartialPatch
- `mcp/src/lib/ref-validation.ts` — validateRange
- `mcp/src/lib/secret-scanner.ts` — scanFiles
- `mcp/src/lib/batch-info.ts` — setBatchInfo, getBatchInfo
- `mcp/src/tools/file-hunks.ts:8-32` — duplicated validatePath to consolidate
