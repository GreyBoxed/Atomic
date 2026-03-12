---
title: "feat: Add scan_secrets MCP tool with atomic_commit and dry_run integration"
type: feat
status: completed
date: 2026-03-12
origin: docs/brainstorms/2026-03-12-mcp-secret-scanning-brainstorm.md
---

# feat: Add scan_secrets MCP tool with atomic_commit and dry_run integration

## Overview

Add a `scan_secrets` MCP tool that detects secrets in files before they're committed, providing defense in depth beyond the opt-in `.githooks/pre-commit` hook. The tool is independently callable (composable) and integrated into `atomic_commit` (pre-staging check) and `dry_run` (validation). Returns structured `{file, line, pattern}` findings the agent can act on. (see brainstorm: `docs/brainstorms/2026-03-12-mcp-secret-scanning-brainstorm.md`)

## Problem Statement / Motivation

Secret scanning currently exists only in `.githooks/pre-commit` — an opt-in layer requiring `/atomic:init`. If hooks aren't configured, or if a user calls `mcp__atomic__atomic_commit` directly, there's no protection. The hook also returns raw stderr text, not structured data — the agent can't easily parse which files have issues or suggest fixes.

## Proposed Solution

Three changes:

### 1. New `mcp/src/tools/scan-secrets.ts` — standalone tool

A new `scan_secrets` tool that accepts file paths and returns findings.

**Parameters:**
```typescript
{
  files: z.array(z.string()).min(1).describe("File paths to scan for secrets")
}
```

**Response (success, no findings):**
```json
{
  "scanned": 5,
  "findings": [],
  "clean": true
}
```

**Response (findings detected):**
```json
{
  "scanned": 5,
  "findings": [
    { "file": ".env", "type": "filename", "pattern": ".env" },
    { "file": "src/config.ts", "type": "content", "line": 12, "pattern": "API_KEY=", "match": "API_KEY=sk-..." }
  ],
  "clean": false
}
```

**Implementation:**
- Validate each path with `validatePath(file, cwd)`
- Check filename against sensitive patterns: `.env`, `.env.*`, `credentials.json`, `*.pem`, `id_rsa`, `id_ed25519`
- Skip binary files by extension: `.png`, `.jpg`, `.gif`, `.ico`, `.woff`, `.woff2`, `.ttf`, `.eot`, `.zip`, `.gz`, `.tar`, `.pdf`
- Read file contents via `fs.readFile` (full file, not diff)
- Scan line-by-line for content patterns: `(API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY)\s*=` and `-----BEGIN.*PRIVATE KEY-----`
- Return structured findings with file, line number, pattern name, and matching text (truncated to 80 chars to avoid leaking full secrets)

**Tool annotations:**
```typescript
{
  title: "Scan files for secrets",
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
}
```

### 2. Integrate into `mcp/src/tools/atomic-commit.ts`

Add a `scanSecrets` parameter to the `atomic_commit` tool:

```typescript
scanSecrets: z.enum(["block", "warn", "skip"]).default("block")
  .describe("Secret scanning mode: 'block' (default) rejects commits with secrets, 'warn' includes warnings, 'skip' disables")
```

**Integration point:** Before staging each group's files (before `git add`), call the scan function on the group's file paths.

- `"block"`: If findings exist, return `isError: true` with the findings. Do not stage or commit. Reset index.
- `"warn"`: If findings exist, include a `warnings` array in the success response. Proceed with staging and commit.
- `"skip"`: No scanning.

**Important:** Scan runs per-group, before that group's files are staged. If group 1 commits cleanly but group 2 has secrets, group 1's commit is preserved (already committed), group 2 is blocked, and remaining groups are skipped.

### 3. Integrate into `mcp/src/tools/dry-run.ts`

Add the same `scanSecrets` parameter. During validation, after path validation and before the cross-group conflict check, scan each group's files. Secret findings appear as errors in the group's result, and set `valid: false`.

### 4. Shared scanning logic — `mcp/src/lib/secret-scanner.ts`

Extract the scanning logic into a shared module so `scan_secrets`, `atomic_commit`, and `dry_run` all use the same code:

```typescript
// mcp/src/lib/secret-scanner.ts

export interface SecretFinding {
  file: string;
  type: "filename" | "content";
  pattern: string;
  line?: number;
  match?: string;
}

export async function scanFiles(
  files: string[],
  cwd: string
): Promise<SecretFinding[]>
```

**Filename patterns** (from `.githooks/pre-commit`):
- `.env`, `.env.*`
- `credentials.json`
- `*.pem`
- `id_rsa`, `id_ed25519`

**Content patterns** (line-by-line regex):
- `/(API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY)\s*=/`
- `/-----BEGIN.*PRIVATE KEY-----/`

**Binary skip extensions:**
- `.png`, `.jpg`, `.jpeg`, `.gif`, `.ico`, `.svg`
- `.woff`, `.woff2`, `.ttf`, `.eot`
- `.zip`, `.gz`, `.tar`, `.pdf`, `.bin`

### 5. Register in `mcp/src/index.ts`

```typescript
import { registerScanSecrets } from "./tools/scan-secrets.js";
// ...
registerScanSecrets(server);
```

### 6. Update `plugins/atomic/commands/atomic-commit.md`

Add `mcp__atomic__scan_secrets` to the `allowed-tools` frontmatter so the slash command can use it.

## Technical Considerations

- **Performance:** `fs.readFile` on every file in a group adds I/O. For typical commits (5-20 files), this is negligible. For large commits, the binary skip list avoids reading media files.
- **Path security:** All file paths go through `validatePath()` — no path traversal, no absolute paths, no flag injection.
- **Match truncation:** Content matches are truncated to 80 chars in the response to avoid leaking full secret values in MCP responses.
- **Encoding:** `fs.readFile` with `utf-8` encoding. Binary files that slip past the extension filter will produce garbled text but won't crash — pattern matching will likely not match, which is safe.
- **No external dependencies:** Pure TypeScript with `fs.readFile` and regex. No `gitleaks`, `truffleHog`, or other binaries required.

## System-Wide Impact

- **Interaction graph:** `scan_secrets` tool → called by `atomic_commit` (before staging) and `dry_run` (during validation). Also callable independently by the agent. The `.githooks/pre-commit` hook still runs as a separate layer during `git commit`.
- **Error propagation:** When `scanSecrets: "block"`, findings cause `isError: true` response from `atomic_commit`. The agent sees structured findings and can suggest removing secrets. When the hook also fires, the agent may see both MCP-level and hook-level errors for the same secret — this is redundant but safe.
- **State lifecycle risks:** If `atomic_commit` is processing multiple groups and group N fails the scan, groups 1 through N-1 are already committed. The undo mechanism (`setUndoInfo`) still records the pre-commit HEAD, so `/atomic:rollback` can undo all groups.
- **API surface parity:** The `scan_secrets` tool is a new public API endpoint: `mcp__atomic__scan_secrets`. The `scanSecrets` parameter on `atomic_commit` and `dry_run` is additive (defaults to `"block"`, existing callers unaffected).

## Acceptance Criteria

- [x] New `scan_secrets` tool registered and callable via `mcp__atomic__scan_secrets`
- [x] Detects filename-based secrets (`.env`, `*.pem`, `id_rsa`, `credentials.json`, `id_ed25519`)
- [x] Detects content-based secrets (`API_KEY=`, `SECRET=`, `PASSWORD=`, `TOKEN=`, `PRIVATE_KEY=`, `-----BEGIN PRIVATE KEY`)
- [x] Returns structured `{file, type, pattern, line?, match?}` findings
- [x] `atomic_commit` blocks by default when secrets are found (`scanSecrets: "block"`)
- [x] `atomic_commit` warns but proceeds with `scanSecrets: "warn"` — **dropped per review: YAGNI, use block/skip only**
- [x] `atomic_commit` skips scanning with `scanSecrets: "skip"`
- [x] `dry_run` includes secret scan results in validation output
- [x] All file paths validated via `validatePath()` before scanning
- [x] Binary files skipped by extension
- [x] Match text truncated to 80 chars in responses — **improved: values masked with `***REDACTED***` per security review**
- [x] `mcp__atomic__scan_secrets` added to `atomic-commit.md` allowed-tools
- [x] `mcp/src/lib/secret-scanner.ts` contains shared scanning logic
- [x] MCP server builds cleanly (`npm run build`)

## File Manifest

| File | Action | Description |
|------|--------|-------------|
| `mcp/src/lib/secret-scanner.ts` | Create | Shared scanning logic: `scanFiles()`, patterns, `SecretFinding` type |
| `mcp/src/tools/scan-secrets.ts` | Create | New `scan_secrets` MCP tool |
| `mcp/src/tools/atomic-commit.ts` | Edit | Add `scanSecrets` param, call `scanFiles()` before staging each group |
| `mcp/src/tools/dry-run.ts` | Edit | Add `scanSecrets` param, call `scanFiles()` during validation |
| `mcp/src/index.ts` | Edit | Import and register `registerScanSecrets` |
| `plugins/atomic/commands/atomic-commit.md` | Edit | Add `mcp__atomic__scan_secrets` to `allowed-tools` |

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-03-12-mcp-secret-scanning-brainstorm.md](docs/brainstorms/2026-03-12-mcp-secret-scanning-brainstorm.md) — Key decisions: Approach B (new tool + integration), scan before staging, configurable block/warn/skip, hardcoded patterns, full file scan
- **Pattern reference:** `.githooks/pre-commit` — filename and content patterns to replicate
- **Tool pattern reference:** `mcp/src/tools/git-state.ts` (simple tool), `mcp/src/tools/dry-run.ts` (validation tool)
- **Path validation:** `mcp/src/lib/git.ts:validatePath()` — security boundary for all file access
- **CLAUDE.md conventions:** `execFile` for all git ops, path validation on all user-supplied paths, MCP tool names are public API
