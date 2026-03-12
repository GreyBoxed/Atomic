---
title: "fix: Plugin atomic not found in marketplace atomic"
type: fix
status: active
date: 2026-03-12
---

# fix: Plugin atomic not found in marketplace atomic

## Problem Statement

After flattening the repo so the root IS the plugin, `/reload-plugins` fails with:

```
Plugin atomic not found in marketplace atomic
```

**Root cause:** Claude Code's marketplace system does not support `source: "."` in `marketplace.json`. Every working marketplace (claude-plugins-official, every-marketplace) uses a subdirectory path like `source: "./plugins/<name>"`. The plugin and marketplace cannot share the same `.claude-plugin/` directory.

### Evidence

- `claude-plugins-official`: 30+ plugins, all use `source: "./plugins/<name>"` or `source: "./external_plugins/<name>"`
- `every-marketplace`: uses `source: "compound-engineering"` with `pluginRoot: "plugins"`
- Zero working examples of `source: "."` anywhere in the plugin ecosystem

## Proposed Solution

Restore a thin `plugins/atomic/` directory as the plugin root, keeping source code at the repo root for development.

### Directory Structure (after fix)

```
.claude-plugin/
  marketplace.json         # source: "./plugins/atomic"
  plugin.json              # marketplace-level metadata (optional, can remove)
plugins/
  atomic/
    .claude-plugin/
      plugin.json          # plugin metadata
    .mcp.json              # references ../../mcp/build/index.js via ${CLAUDE_PLUGIN_ROOT}
    commands/              # real files (not symlinks)
      atomic-commit.md
      atomic-cherrypick.md
      atomic-init.md
      atomic-recover.md
      atomic-revert.md
      atomic-rollback.md
mcp/                       # source code stays at root for development
  src/
  build/
  package.json
docs/
CLAUDE.md
```

### Key details

1. **`plugins/atomic/.mcp.json`** references `${CLAUDE_PLUGIN_ROOT}/../../mcp/build/index.js` — works because `${CLAUDE_PLUGIN_ROOT}` resolves to `plugins/atomic/`, and the MCP build lives at the repo root's `mcp/build/`
2. **Commands are real files** in `plugins/atomic/commands/` — no symlinks. Single source of truth (remove root `commands/` directory)
3. **`marketplace.json`** uses `source: "./plugins/atomic"` matching the proven pattern
4. **`~/.claude/settings.json`** keeps `atomic@atomic` — the marketplace name stays `atomic`

### Settings.json update

Revert marketplace name back to match:
```json
{
  "enabledPlugins": { "atomic@atomic": true },
  "extraKnownMarketplaces": {
    "atomic": {
      "source": { "source": "directory", "path": "/Users/capitalmind/Documents/atomic-commit" }
    }
  }
}
```

## Acceptance Criteria

- [ ] `/reload-plugins` shows 0 errors
- [ ] `/doctor` shows no plugin errors
- [ ] MCP tools (`mcp__atomic__git_state`, etc.) are available after reload
- [ ] Slash commands (`/atomic:commit`, etc.) are available after reload
- [x] `npm run build` in `mcp/` still works
- [x] No symlinks in the repo

## Context

The flatten-to-root approach (commit `8261296`) was motivated by simpler distribution. The marketplace system's subdirectory requirement means a thin wrapper is unavoidable for local marketplace registration. For `github:` distribution, the same structure works because the entire repo is cloned.

## MVP

### plugins/atomic/.mcp.json

```json
{
  "mcpServers": {
    "atomic": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/../../mcp/build/index.js"]
    }
  }
}
```

### plugins/atomic/.claude-plugin/plugin.json

```json
{
  "name": "atomic",
  "version": "1.0.0",
  "description": "Group changes into logical atomic commits following Conventional Commits v1.0.0",
  "author": {
    "name": "greyboxed dev"
  }
}
```

### .claude-plugin/marketplace.json

```json
{
  "name": "atomic",
  "owner": {
    "name": "greyboxed dev"
  },
  "metadata": {
    "description": "Atomic git workflows — commits, recovery, and project initialization",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "atomic",
      "description": "Atomic commits following Conventional Commits v1.0.0",
      "source": "./plugins/atomic"
    }
  ]
}
```

## Sources

- Working marketplace patterns: `~/.claude/plugins/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json`
- Working marketplace patterns: `~/.claude/plugins/marketplaces/every-marketplace/.cursor-plugin/marketplace.json`
- Settings registration: `~/.claude/settings.json`
