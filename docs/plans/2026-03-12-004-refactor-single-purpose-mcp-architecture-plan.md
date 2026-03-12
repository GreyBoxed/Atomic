---
title: "refactor: Keep atomic-commit as single-purpose MCP plugin"
type: refactor
status: completed
date: 2026-03-12
origin: docs/brainstorms/2026-03-12-plugin-mcp-composability-brainstorm.md
---

# Keep atomic-commit as Single-Purpose MCP Plugin

This is an architectural decision record (ADR). The outcome is **no code changes** — the current architecture is correct. This plan documents the decision and one minor discoverability improvement.

## Decision

**1 plugin = 1 MCP server.** Do not bundle Context7 (or any unrelated MCP server) into the atomic-commit plugin. Composability comes from users installing multiple plugins independently. (see brainstorm: `docs/brainstorms/2026-03-12-plugin-mcp-composability-brainstorm.md`)

### Why

- atomic-commit operates on git state; Context7 fetches external docs — no shared inputs or outputs
- Bundling creates version coupling — Context7 breaks, your plugin breaks
- Users who already have Context7 get duplicate tools
- No user demand for cross-plugin integration exists today

### Revisit Trigger

A user reports wanting library-aware commit messages. When that happens, evaluate Approach 3: adding `mcp__context7__*` tools to `atomic:commit`'s `allowed-tools` as an optional soft dependency. Only `atomic:commit` is a candidate — it's the only command generating semantic content that could benefit from library context.

## Acceptance Criteria

- [x] Add one-line reference in CLAUDE.md under Conventions: "Plugin ships a single MCP server by design — see brainstorm for rationale"
- [x] No changes to `.mcp.json`, slash commands, or MCP server source

## Context

### Current Architecture (Correct — No Changes)

- `.mcp.json` declares one server key (`"atomic"`) → tools prefixed `mcp__atomic-commit__*`
- 6 slash commands reference only `mcp__atomic-commit__*` tools and `Bash(git ...)` patterns
- No cross-plugin tool references exist anywhere

### What Cross-Plugin References Would Look Like (Deferred)

If Approach 3 were triggered, `commands/atomic-commit.md` would add `mcp__context7__resolve-library-id, mcp__context7__query-docs` to its `allowed-tools` frontmatter. The command would degrade gracefully if Context7 is not installed — Claude Code silently ignores unavailable tools in `allowed-tools`.

### SpecFlow Gaps (Documented, Not Actioned)

1. **Naming collision risk** — If two plugins declare the same `.mcp.json` key, behavior is undefined. Low probability, deferred.
2. **No formal bundling criteria** — The "1 plugin = 1 MCP" rule is conditional: don't bundle servers with no shared inputs/outputs. A tightly-coupled git+GitHub API server *might* justify bundling.

## Sources

- **Origin brainstorm:** [docs/brainstorms/2026-03-12-plugin-mcp-composability-brainstorm.md](docs/brainstorms/2026-03-12-plugin-mcp-composability-brainstorm.md) — Key decisions: single-purpose plugin, no bundling, deferred cross-plugin tool references
- MCP config: `plugins/atomic-commit/.mcp.json`
- Slash commands: `commands/atomic-commit.md` (only command that would gain Context7 access)
