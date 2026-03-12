---
title: Plugin MCP Composability — Context7 vs Atomic-Commit
date: 2026-03-12
status: complete
---

# Plugin MCP Composability: Should atomic-commit bundle Context7?

## What We're Exploring

Whether the atomic-commit plugin should add Context7 (a docs-lookup MCP server) alongside or instead of its own MCP server, and more broadly, how Claude Code plugins should compose with MCP servers.

## Context

- **atomic-commit MCP**: 6 tools focused on atomic git workflows (commit grouping, hunk-level staging, undo, changelog). Purpose-built, single concern.
- **Context7 MCP**: 2 tools for resolving library IDs and querying up-to-date documentation. General-purpose docs lookup.
- These serve fundamentally different concerns — atomic-commit operates on git state, context7 fetches external documentation. No shared inputs or outputs.
- The plugin is built for both personal use and public distribution.

## Approaches Considered

### 1. Keep them separate (Chosen)

Single-purpose plugins. Users compose by installing both independently.

**Pros:**
- Clean separation of concerns
- Users install only what they need
- No coupling between git workflows and docs lookup
- Easier to maintain, version, and reason about
- Follows Unix philosophy — do one thing well

**Cons:**
- Users need two installs if they want both

### 2. Bundle Context7 into the plugin

Ship context7 as a second MCP server in `.mcp.json`.

**Rejected because:**
- Creates version coupling — context7 breaks, your plugin breaks
- Users who already have context7 installed get duplicate tools
- Bloats plugin scope and dilutes its identity
- No tight workflow dependency to justify bundling

### 3. Make slash commands context7-aware

Reference context7 tools in `allowed-tools` as optional enrichment.

**Deferred because:**
- Good idea in principle but adds complexity without clear user demand
- Worth revisiting if a specific workflow emerges

**Revisit trigger:** A user reports wanting library-aware commit messages (e.g., "this commit updates the API to match library X's v2 migration guide"). Until then, no action.

## Key Decisions

1. **1 plugin = 1 MCP server** — plugins should stay single-purpose. Composability comes from users installing multiple plugins, not from plugins bundling unrelated servers.
2. **Don't bundle dependencies you don't control** — depending on context7's availability/updates creates fragility.
3. **No integration point exists today** — if one emerges, Approach 3's revisit trigger defines when to reconsider.

## Next Steps

- No code changes needed. Current architecture is correct.

