---
topic: MCP-level secret scanning for atomic commits
date: 2026-03-12
status: complete
---

# MCP-Level Secret Scanning for Atomic Commits

## What We're Building

A `scan_secrets` MCP tool that detects secrets in files before they're committed, integrated into the `atomic_commit` tool as a pre-staging check. This provides defense in depth (works even without git hooks installed) and better agent UX (structured error responses the agent can act on).

## Why This Approach

**Problem:** Currently, secret scanning only exists in the `.githooks/pre-commit` hook — an opt-in layer that requires `/atomic:init` to install. If hooks aren't configured, or if a user calls `mcp__atomic-commit__atomic_commit` directly, there's no protection.

**Chosen approach: New `scan_secrets` tool + `atomic_commit` integration (Approach B)**

- **Composable:** `scan_secrets` is independently callable — the agent can scan files without committing
- **Defense in depth:** `atomic_commit` calls `scan_secrets` before staging each group, regardless of hook config
- **Structured errors:** Returns `{file, line, pattern}` objects the agent can present and act on (suggest removing the secret, excluding the file, etc.)
- **Configurable:** `atomic_commit` gets a `scanSecrets` parameter: `"block"` (default), `"warn"`, or `"skip"`

**Rejected alternatives:**
- **Approach A (inline in atomic_commit):** Mixes commit and scanning logic. Not independently testable or composable.
- **Approach C (slash command only):** No defense in depth for direct MCP callers. Agent might miss things.

## Key Decisions

1. **Scan point:** Before staging (before `git add`), not after. Secrets never touch the index.
2. **Behavior:** Configurable via `scanSecrets` param — `"block"` (default, returns `isError: true`), `"warn"` (commit proceeds, warnings in response), `"skip"` (no scan).
3. **Pattern parity:** Use the same patterns as `.githooks/pre-commit` — filename matches (`.env`, `*.pem`, `id_rsa`, etc.) and content patterns (`API_KEY=`, `SECRET=`, `PASSWORD=`, `TOKEN=`, `PRIVATE_KEY=`, `-----BEGIN.*PRIVATE KEY-----`).
4. **New tool:** `scan_secrets` is the 7th MCP tool. Tool name: `scan_secrets`. Public API: `mcp__atomic__scan_secrets`.
5. **Architecture:** `scan_secrets` reads file contents via `fs.readFile` (not git diff) since we're scanning before staging. The tool validates paths using the same `validatePath()` function.

## Resolved Questions

1. **Scan scope:** Full file contents (not just changed hunks). Simpler, catches pre-existing secrets, no diff computation needed.
2. **Pattern configuration:** Hardcoded patterns matching the hook. YAGNI — add custom patterns later if needed.
3. **Dry run integration:** Yes — `dry_run` will also call `scan_secrets`, catching issues during validation before the agent attempts `atomic_commit`.

## Scope

- **In scope:** `scan_secrets` tool, `atomic_commit` integration, pattern matching for common secrets
- **Out of scope:** Custom pattern configuration (can be added later), integration with external secret scanners (e.g., gitleaks, truffleHog), scanning git history for existing secrets
