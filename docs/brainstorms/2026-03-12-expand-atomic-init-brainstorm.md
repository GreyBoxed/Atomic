# Brainstorm: Expand `/atomic:init` with Advanced Capabilities

**Date:** 2026-03-12
**Status:** Draft

## What We're Building

Expand the existing `/atomic:init` command with four new capability areas, progressively unlocked by preset tier:

1. **`.gitattributes` generation** — language-aware defaults (diff drivers, text normalization, binary detection)
2. **Commit signing setup** — detect existing GPG/SSH keys and offer both options
3. **Performance config** — fsmonitor, sparse-checkout hints for large repos
4. **`.editorconfig` generation** — editor-agnostic formatting rules based on detected project conventions

## Why This Approach

The current `/atomic:init` covers the commit workflow essentials (hooks, .gitignore, CLAUDE.md) but stops short of the broader "project health" setup that teams expect. These four additions address gaps that developers typically configure manually — or forget entirely — leading to line-ending bugs, unsigned commits, slow `git status` in large repos, and inconsistent formatting.

### Progressive unlock over flat a la carte

Rather than offering all extras at every tier, features unlock progressively. This keeps "minimal" truly minimal and reserves advanced features for users who've opted into stricter workflows. Within each tier, the extras are still opt-in toggles.

## Key Decisions

1. **Progressive unlock by tier** — Extras are gated by preset:

   | Extra | Minimal | Standard | Strict |
   |-------|---------|----------|--------|
   | `.editorconfig` | Yes | Yes | Yes |
   | `.gitattributes` | — | Yes | Yes |
   | Commit signing | — | — | Yes |
   | Performance config | — | — | Yes |

   Within an unlocked tier, each extra is a toggle the user can enable/disable.

2. **Commit signing: detect & offer both** — At init time, check for existing GPG keys (`gpg --list-secret-keys`) and SSH keys (`~/.ssh/*.pub`). Present what's available and let the user choose. If neither exists, explain how to generate each.

3. **`.gitattributes`: language-aware defaults** — Detect project type (same detection logic already in `/atomic:init`) and generate patterns:
   - Universal: `* text=auto`, `*.png binary`, `*.jpg binary`
   - Ruby: `*.rb diff=ruby`
   - JS/TS: `*.js diff=javascript`, `*.ts diff=typescript`
   - Python: `*.py diff=python`
   - Rust: `*.rs diff=rust`
   - Go: `*.go diff=golang`
   - Include LFS suggestions if large binaries detected (but don't auto-configure LFS)

4. **`.editorconfig`: detect conventions** — Scan existing files for indentation style/size, charset, and end-of-line, then generate `.editorconfig` matching what's already in use. Fall back to language community defaults.

5. **Performance config as opt-in toggle** — Listed alongside other a la carte options. When selected:
   - `core.fsmonitor=true` (Git 2.37+)
   - `core.untrackedCache=true`
   - `feature.manyFiles=true` (for repos with 10k+ files)
   - Warn if Git version doesn't support fsmonitor

6. **Detect, don't assume** — Consistent with existing `/atomic:init` philosophy. Never overwrite existing `.gitattributes`, `.editorconfig`, or signing config. Show what exists and offer to augment.

7. **Existing signing config: offer to override** — If `commit.gpgSign` is already set (globally or locally), show the current config and offer to switch key or method. Don't silently skip.

8. **Git version: show all with warnings** — Don't hide features based on Git version. Show all options available for the tier, but display a warning when the user's Git version doesn't support a feature (e.g., "fsmonitor requires Git 2.37+, you have 2.30").

## UX Flow

```
Step 1: Detect & Report (existing, expanded)
  ├── project type, git status, existing config
  ├── NEW: detect signing keys (GPG + SSH)
  ├── NEW: detect .gitattributes, .editorconfig
  └── NEW: detect Git version for feature compatibility

Step 2: Choose preset (existing)
  └── minimal / standard / strict

Step 3: Toggle extras for chosen tier (NEW)
  ├── minimal:  [ ] .editorconfig
  ├── standard: [ ] .editorconfig  [ ] .gitattributes
  └── strict:   [ ] .editorconfig  [ ] .gitattributes  [ ] signing  [ ] perf

Step 4: If signing selected → choose GPG or SSH (based on detected keys)

Step 5: Generate files (existing + new)

Step 6: Configure git (existing + signing + perf config if selected)

Step 7: Summary (existing, expanded)
```

## Resolved Questions

1. **Extras gated by tier, not fully independent.** "Minimal" stays truly minimal (.editorconfig only). Advanced features unlock at higher tiers. *(Decision: progressive unlock)*

2. **Existing signing config: offer to override.** Show current config and let user switch key or method. *(Decision: don't silently skip)*

3. **Git version: show all with warnings.** Don't hide options, but warn when Git version is insufficient. *(Decision: transparent warnings)*

4. **Commitlint out of scope for now.** The commit-msg hook handles Conventional Commits validation. Commitlint can be added later if demand warrants it.

## Out of Scope

- Bare repository setup
- Worktree configuration
- Submodule initialization
- Git LFS installation (suggest only, don't install)
- Husky/Lefthook integration (the committed `.githooks/` approach is preferred)
- Branch protection rules (server-side, not local)

## Sources

- [Git init documentation](https://git-scm.com/docs/git-init)
- [Git hooks guide](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- [Custom git templates](https://www.darrik.dev/writing/custom-git-template/)
- [Git hooks complete guide 2026](https://devtoolbox.dedyn.io/blog/git-hooks-complete-guide)
- [Lefthook vs Husky comparison](https://www.edopedia.com/blog/lefthook-vs-husky/)
- [Git security: signed commits & branch protection](https://hadess.io/git-security-signed-commits-secret-scanning-branch-protection/)
- [How core Git developers configure Git](https://blog.gitbutler.com/how-git-core-devs-configure-git)
- [Git reinitialize is idempotent](https://www.tutorialpedia.org/blog/does-running-git-init-twice-initialize-a-repository-or-reinitialize-an-existing-repo/)
