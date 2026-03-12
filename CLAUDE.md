# atomic-commit

A Claude Code plugin + MCP server for atomic git workflows — commits, recovery, and project initialization — following Conventional Commits v1.0.0.

## Project structure

- `mcp/` — TypeScript MCP server source (6 tools, 1 resource, 1 prompt)
- `plugins/atomic/` — Plugin distribution directory (commands, .mcp.json, plugin.json)
- `.claude-plugin/` — Marketplace metadata (marketplace.json)
- `docs/plans/` — Feature plans
- `docs/brainstorms/` — Design exploration documents

## Development

```bash
cd mcp && npm install && npm run build
```

## Conventions

- MCP server uses `execFile` (never `exec`) for all git operations
- Path validation required on all user-supplied file paths
- Commit messages follow Conventional Commits v1.0.0 (full spec embedded in `mcp/src/resources/commit-conventions.ts`, no external dependency)
- Plugin lives in `plugins/atomic/` — commands are real files, no symlinks
- MCP tool names (`mcp__atomic__*`) are public API — renaming is a breaking change
- Plugin ships a single MCP server by design — see `docs/brainstorms/2026-03-12-plugin-mcp-composability-brainstorm.md` for rationale

## Naming

- Slash command is `/atomic:commit` (colon namespace). MCP tools are `mcp__atomic__*`. These are independent naming layers — the colon namespace groups user-facing commands, while MCP tool names are internal identifiers resolved via `.mcp.json`.

## Commit conventions

This project uses Conventional Commits v1.0.0.

Run `/atomic:commit` to auto-group and commit changes.

**Scopes** (based on project structure):
- `mcp`: MCP server source (tools, resources, prompts)
- `plugin`: Plugin distribution (commands, .mcp.json, plugin.json)
- `docs`: Plans, brainstorms, and documentation

**Domain vocabulary**:
- atomic commit: a single commit representing one cohesive concern
- hunk-level staging: staging specific diff hunks within a file
- conventional commits: the commit message format specification (feat, fix, refactor, etc.)
