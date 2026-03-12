---
title: "feat: Expand /atomic:init with gitattributes, signing, perf config, and editorconfig"
type: feat
status: completed
date: 2026-03-12
origin: docs/brainstorms/2026-03-12-expand-atomic-init-brainstorm.md
deepened: 2026-03-12
---

# feat: Expand `/atomic:init` with gitattributes, signing, perf config, and editorconfig

## Enhancement Summary

**Deepened on:** 2026-03-12
**Review agents used:** security-sentinel, architecture-strategist, code-simplicity-reviewer, agent-native-reviewer, pattern-recognition-specialist
**Web research:** editorconfig defaults, gitattributes best practices, SSH/GPG signing automation, fsmonitor performance

### Key Improvements from Deepening

1. **Narrowed `allowed-tools`** — `Bash(gpg:*)` restricted to `Bash(gpg --list-secret-keys:*)`, `Bash(ssh-keygen:*)` removed entirely (Security, Architecture, Pattern, Agent-Native — unanimous)
2. **Replaced toggle UX with natural language confirmation** — faux-GUI checkbox notation replaced with sentence-based opt-out pattern that LLMs reliably produce (Simplicity, Agent-Native)
3. **Deferred signing to a separate plan** — signing has a blocking dependency on MCP commit tool support; shipping half a signing workflow creates a failure mode (Simplicity, Security)
4. **Simplified .editorconfig** — removed file sampling; use language defaults from detected project type (Simplicity, Agent-Native)
5. **Simplified .gitattributes** — create-or-skip, no merge strategy for existing files (Simplicity)
6. **Fixed step numbering** — aligned with actual current `atomic-init.md` structure (Pattern)
7. **fsmonitor: skip on Git < 2.37** — not just warn; `core.fsmonitor=true` behaves as executable path on older Git (Security: CVE-2022-39253 class)
8. **Collapsed 8 phases to 4** — eliminated toggle phase, signing phase, hooks migration phase; reduced prompt complexity ~40% (Simplicity)

### New Considerations Discovered

- `core.fsmonitor=true` on Git < 2.37 is interpreted as executable path, not boolean — a security concern, not just "unsupported"
- Hooks migration (`.git/hooks/` → `.githooks/`) can promote malicious scripts to tracked directory — replaced with one-line warning
- EditorConfig spec recommends leaving unspecified properties blank rather than guessing; `tab_width` defaults to `indent_size`
- SSH signing keys lack expiration dates (unlike GPG) — relevant for future signing plan
- fsmonitor performance gains are dramatic (85s → <1s for `git status` in large repos) but Linux requires third-party Watchman

---

## Overview

Expand the existing `/atomic:init` slash command with three new capability areas — `.editorconfig` generation, `.gitattributes` generation, and performance config — baked into the preset tier system. This transforms `/atomic:init` from a commit-workflow bootstrapper into a comprehensive project-health initializer.

**Scope change from brainstorm:** Commit signing is deferred to a separate plan (see "Deferred: Commit Signing" section below).

*(see brainstorm: docs/brainstorms/2026-03-12-expand-atomic-init-brainstorm.md)*

## Problem Statement / Motivation

The current `/atomic:init` covers commit workflow essentials (hooks, `.gitignore`, `CLAUDE.md`) but stops short of the broader "project health" setup that teams expect. Developers manually configure `.gitattributes` (leading to line-ending bugs), ignore performance settings (slow `git status` in large repos), and have inconsistent formatting (no `.editorconfig`). These are preventable with opinionated defaults at init time.

## Proposed Solution

Bake three new features directly into the preset tiers — no toggle UX, no extra interaction points. Pick a tier, get those features. Users who want to customize can say "skip X" in natural language.

| Feature | Minimal | Standard | Strict |
|---------|---------|----------|--------|
| `.gitignore` (language-tailored) | Yes | Yes | Yes |
| `CLAUDE.md` with commit conventions | Yes | Yes | Yes |
| **`.editorconfig` (language defaults)** | **Yes** | **Yes** | **Yes** |
| `.githooks/commit-msg` (CC validation) | No | Yes | Yes |
| `.githooks/pre-commit` (secret scan) | No | Yes | Yes |
| **`.gitattributes` (language-aware)** | **No** | **Yes** | **Yes** |
| `.githooks/pre-commit` (lint check) | No | No | Yes |
| `core.hooksPath` configured | No | Yes | Yes |
| Branch naming convention doc | No | No | Yes |
| **Performance config** | **No** | **No** | **Yes** |

No toggle column. No "Default ON/OFF" states. Pick a tier, get those features.

### Research Insights

**Why no toggle UX (Simplicity + Agent-Native reviewers):**
This is a prompt file executed by an LLM, not application code. Every conditional branch is an instruction the LLM must interpret. A faux-GUI toggle widget (`[1] ✓ .editorconfig`) is fragile — the LLM renders it inconsistently across sessions, and parsing freeform responses ("skip 3,4" vs "disable signing") is error-prone. Natural language handles customization better: users say "skip the editorconfig" and Claude understands. This eliminates one interaction point and the most fragile prompt instructions.

**Why features baked into tiers (Architecture reviewer):**
The progressive tier model is architecturally sound because each tier is a strict superset. Toggles partially undermine this by making tiers "default sets" instead of contracts. Baking features in maintains the monotonically additive property and keeps the prompt simple.

## Technical Considerations

### Architecture

The command remains a pure slash command (no MCP tool). All new capabilities are implemented as prompt instructions to Claude, consistent with the existing "command-as-prompt" pattern. No changes to the MCP server.

### Research Insights

**Prompt complexity budget (Architecture reviewer):** The existing `atomic-init.md` is ~148 lines. This plan should keep the addition under ~80 lines of new prompt instructions. Each new file generator section should start with an explicit `### SKIP IF` guard so the LLM can prune irrelevant branches early:

```
### .gitattributes (SKIP if preset is minimal)
### Performance config (SKIP if preset is minimal or standard)
```

**No MCP tools needed (Architecture reviewer, confirmed):** The new features are idempotent filesystem writes and git-config reads/writes. They don't need the transactional guarantees the MCP commit tool provides. If `.editorconfig` convention detection later proves unreliable via prompt, it could become an MCP tool — but start with prompt-based detection.

### Interaction Budget

Remains at **2 interaction points** (same as current):
1. **Preset selection** (existing) — or skip if passed as argument
2. **Conflict resolution** (conditional) — batched prompt if any target files already exist

No new interaction points added. Features are baked into tiers. If a user passes a preset as argument (`/atomic:init strict`), the flow can complete with just 1 interaction (conflict resolution, if applicable) or 0 (fresh project).

### Step Numbering (Corrected)

The current `atomic-init.md` structure is:
- Step 1: Detect & Report (includes preset recommendation/confirmation)
- Step 2: Generate files
- Step 3: Configure git
- Step 4: Summary

The expanded structure:
- **Step 1: Detect & Report** (expanded — also detect `.gitattributes`, `.editorconfig`, Git version)
- **Step 2: Generate files** (expanded — also generate `.editorconfig`, `.gitattributes` based on tier)
- **Step 3: Configure git** (expanded — also apply perf config for strict tier)
- **Step 4: Summary** (expanded — show new files + perf config reversal commands)

No new steps. The tier determines what gets generated within the existing steps.

### allowed-tools Expansion

**Narrowed based on security review (unanimous across 4 reviewers):**

```
Bash(gpg --list-secret-keys:*)   # DEFERRED — only needed when signing plan ships
Bash(git version:*)               # NEW — for Git version detection
```

**Removed:**
- ~~`Bash(gpg:*)`~~ — too broad; permits `gpg --export-secret-keys`, `gpg --delete-key`, `gpg --encrypt` (Security: HIGH finding)
- ~~`Bash(ssh-keygen:*)`~~ — unnecessary; SSH key detection uses `ls ~/.ssh/*.pub` already covered by `Bash(ls:*)` (Security: HIGH finding, Agent-Native: confirmed)

**For this plan (no signing), only one addition needed:**
```
Bash(git version:*)
```

### Research Insights: Security

**`Bash(gpg --list-secret-keys:*)` vs `Bash(gpg:*)`** (Security sentinel):
GPG is a powerful tool with destructive operations — `gpg --export-secret-keys` exfiltrates private keys, `gpg --delete-secret-keys` destroys them. The plan only needs read-only listing. In a prompt-based system, an overly broad pattern gives the LLM room to "helpfully" try key generation if detection errors occur.

**fsmonitor CVE-2022-39253 class** (Security sentinel):
`core.fsmonitor` accepts either a boolean (`true` for built-in daemon) or a path to an executable. On Git < 2.37, setting it to `true` causes git to attempt executing a file literally named `true` from `$PATH`. While typically harmless (`/usr/bin/true`), this is version-dependent and surprising. Enabling fsmonitor also increases attack surface on repos cloned from untrusted sources.

### Existing Files Handling

**Create-or-skip for `.editorconfig` and `.gitattributes`** (Simplicity reviewer):
If the file already exists, skip it with a note. Do not attempt to merge, diff, or augment. The user already has opinions about their config. This eliminates the fragile merge strategy and reduces prompt complexity.

Exception: `.gitignore` and `CLAUDE.md` retain the existing "detect and augment" behavior since they are core to the atomic-commit workflow.

### Existing Hooks Warning

When `.git/hooks/` contains custom hooks (non-`.sample`) and `core.hooksPath` will be set to `.githooks/`, include a one-line warning in the summary:

```
⚠ Note: core.hooksPath is set to .githooks/ — existing hooks in .git/hooks/ are bypassed.
```

No migration flow. No extra prompt. One line in the summary. (Simplicity reviewer: "A user running `/atomic:init` on a project that already has custom hooks in `.git/hooks/` is an edge case of an edge case.")

### Research Insights: Hooks Migration Security

**Why no automatic migration** (Security sentinel): Copying executables from `.git/hooks/` (untracked) into `.githooks/` (committable) could promote malicious scripts to a tracked directory where they'd be shared with other developers.

### Performance Config Details

**When strict tier is selected, apply unconditionally:**
- `git config --local core.fsmonitor true` — **only if Git >= 2.37** (skip with warning otherwise)
- `git config --local core.untrackedCache true`
- `git config --local feature.manyFiles true`

**Simplification from original plan:** No file-count threshold for `feature.manyFiles`. The setting is harmless on small repos and the detection logic adds complexity for no benefit. Apply all three unconditionally (except fsmonitor version gate).

### Research Insights: Performance

**fsmonitor impact** ([GitHub Blog](https://github.blog/engineering/infrastructure/improve-git-monorepo-performance-with-a-file-system-monitor/)): Commands that took 17-85 seconds without fsmonitor took <1 second with it enabled. The untracked-cache feature works well in conjunction, caching untracked search results.

**Platform notes:**
- macOS and Windows: built-in `fsmonitor--daemon` works natively
- Linux: requires third-party Watchman; built-in daemon not available on all distros
- Network-mounted repos: fsmonitor refuses by default (`fsmonitor.allowRemote=true` is experimental)

**`feature.manyFiles`** ([Git Tower](https://www.git-tower.com/blog/git-performance)): Enables config options that optimize for repos with many files. Safe on small repos — settings are simply no-ops when not beneficial.

### Performance Config Reversibility

Include explicit reversal commands in the summary:

```
To disable performance settings:
  git config --unset core.fsmonitor
  git config --unset core.untrackedCache
  git config --unset feature.manyFiles
```

## Deferred: Commit Signing

**Decision:** Signing is deferred to a separate plan. (Simplicity reviewer, confirmed by Security and Architecture reviewers.)

**Rationale:**
1. **Blocking dependency:** Signing requires the MCP commit tool (`mcp/src/tools/atomic-commit.ts`) to handle `commit.gpgSign=true`. The `git()` helper in `mcp/src/lib/git.ts` uses `execFile` with no timeout — if GPG/SSH agent prompts for a passphrase, the process hangs indefinitely. Shipping signing in init without MCP support creates a trap: `/atomic:init strict` enables signing → `/atomic:commit` fails.
2. **Complexity cost:** Signing alone requires GPG detection, SSH key detection, key selection prompts, version checking (Git 2.34+), instructional fallbacks, existing config override flow. This is ~40% of the original plan's complexity.
3. **Allowed-tools risk:** Requires `Bash(gpg --list-secret-keys:*)` at minimum, expanding the security surface.

**When to revisit:** After a separate plan adds signing-readiness checks to the MCP commit tool (timeout on `execFile`, pre-flight GPG/SSH agent check). The brainstorm decisions about signing (detect both GPG/SSH, offer choice, `--local` scope, skip when no keys) remain valid and should be carried forward to that plan.

**Silent downgrade risk** (Security sentinel): When a future signing plan ships, if a user selects strict but has no keys, signing should not silently skip. Consider writing `git config --local atomic.signingRequested true` as a marker so future runs can remind the user.

## System-Wide Impact

- **Interaction graph**: `/atomic:init` generates files and config → `/atomic:commit` reads CLAUDE.md for context → commit hooks fire on commit. Perf config affects all git operations (status, diff, add). No signing impact in this plan.
- **Error propagation**: Minimal — `.editorconfig` and `.gitattributes` are passive files. Performance config can be reversed with explicit unset commands.
- **State lifecycle risks**: Partial failure during multi-file generation could leave project in inconsistent state (e.g., `.editorconfig` created but `.gitattributes` not). Mitigation: generate all files before configuring git; summary shows what was actually created.
- **API surface parity**: No MCP tool changes. Only the slash command prompt is modified.

## Acceptance Criteria

### Phase 1: Context Detection Expansion

- [x] Detect Git version via `git version 2>/dev/null || echo "(unknown)"` and parse major.minor
- [x] Detect existing `.gitattributes` via `test -f .gitattributes && echo "exists" || echo "missing"`
- [x] Detect existing `.editorconfig` via `test -f .editorconfig && echo "exists" || echo "missing"`
- [x] Add `Bash(git version:*)` to `allowed-tools` in `atomic-init.md`
- [x] Add expanded detection to the Step 1 report output (under existing report format with `===` underlines)
- [x] Update the `### Rules` section at the end of `atomic-init.md` with new rules for extras

### Phase 2: .editorconfig Generation

- [x] **SKIP if** `.editorconfig` already exists (note in summary: "Existing .editorconfig preserved")
- [x] Use detected project type (already available from Step 1) to select indent defaults from this table:

| Rule | Languages | Indent | Size |
|------|-----------|--------|------|
| Go | `*.go` | tabs | (unset — reader preference per [EditorConfig spec](https://editorconfig.org/)) |
| 4-space | `*.py`, `*.rs`, `*.java` | spaces | 4 |
| 2-space | everything else | spaces | 2 |

All sections: `charset = utf-8`, `end_of_line = lf`, `trim_trailing_whitespace = true`, `insert_final_newline = true`. Leave `tab_width` unspecified (defaults to `indent_size` per spec).

- [x] Generate with `root = true` at top
- [x] Include a `[*]` section with the primary language defaults, plus language-specific overrides only when the project is polyglot (e.g., a Ruby project with JS assets gets both `[*.rb]` 2-space and `[*.py]` 4-space sections only if Python files are detected)

### Research Insights: EditorConfig

**EditorConfig spec recommendation** ([editorconfig.org](https://editorconfig.org/)): "It is acceptable and often preferred to leave certain EditorConfig properties unspecified." For example, `tab_width` need not be specified unless it differs from `indent_size`. For Go, leave `indent_size` unspecified so readers view tabs at their preferred width.

### Phase 3: .gitattributes Generation

- [x] **SKIP if** `.gitattributes` already exists (note in summary: "Existing .gitattributes preserved")
- [x] Generate universal rules:
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
- [x] Generate language-aware diff drivers based on detected project type:
  - Ruby: `*.rb diff=ruby`, `*.erb diff=html`
  - JS/TS: `*.js diff=javascript`, `*.ts diff=typescript`, `*.jsx diff=javascript`, `*.tsx diff=typescript`
  - Python: `*.py diff=python`
  - Rust: `*.rs diff=rust`
  - Go: `*.go diff=golang`
- [x] If large binary files detected in working tree (>.5MB), add LFS suggestion as comment: `# Consider Git LFS for large binaries: git lfs track "*.psd"`

### Research Insights: gitattributes

**Minimum viable config** ([rehansaeed.com](https://rehansaeed.com/gitattributes-best-practices/)): `* text=auto` is the single most important line — it prevents line-ending bugs across platforms. React's repo uses just this one line.

**Diff drivers are built-in** ([git-scm.com](https://git-scm.com/docs/gitattributes)): Git ships with diff drivers for most languages. Setting `*.rb diff=ruby` activates Ruby-aware function name detection in diffs — no configuration beyond the attribute needed.

### Phase 4: Performance Config (Strict Tier Only)

- [x] **SKIP if** preset is not strict
- [x] Check Git version (parsed in Phase 1)
- [x] If Git >= 2.37: apply `git config --local core.fsmonitor true`
- [x] If Git < 2.37: **skip** fsmonitor with warning: "fsmonitor requires Git 2.37+ (you have X.Y) — skipped. Upgrade Git to enable."
- [x] Apply unconditionally: `git config --local core.untrackedCache true`
- [x] Apply unconditionally: `git config --local feature.manyFiles true`
- [x] Include reversal commands in summary output
- [x] Note in summary if on Linux: "fsmonitor on Linux may require Watchman — see git-scm.com/docs/git-fsmonitor--daemon"

### Cross-Cutting

- [x] All new context detection commands use `2>/dev/null || echo "(fallback)"` guard pattern (matching existing `atomic-init.md` convention)
- [x] All generated files respect "detect, don't assume" — skip if file already exists
- [x] Hooks remain POSIX sh, no network calls
- [x] Summary output expanded with existing `===` underline format to show all new files/config with reversal instructions
- [x] Final step (suggest `/atomic:commit`) unchanged — init still does NOT commit
- [x] Update the `### Rules` section in `atomic-init.md` with: "Never configure `core.fsmonitor` on Git versions below 2.37"

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| fsmonitor on Git < 2.37 interpreted as executable path | Low | High | Skip fsmonitor (not just warn) when Git < 2.37 |
| fsmonitor bugs on specific OS/filesystem combos | Low | Medium | Include unset commands in summary; note Linux/Watchman requirement |
| Prompt complexity exceeds reliable LLM execution | Medium | Medium | Use SKIP guards, keep additions under ~80 lines, 4 phases not 8 |
| `.editorconfig` defaults don't match project conventions | Medium | Low | Language defaults are community-standard; existing file is preserved |
| Network-mounted repo + fsmonitor | Low | Low | Note in summary that `fsmonitor.allowRemote` is experimental |

## Success Metrics

- `/atomic:init strict` on a fresh project produces a fully configured repo (hooks, .gitignore, CLAUDE.md, .editorconfig, .gitattributes, perf config) in ≤2 user interactions
- Re-running `/atomic:init` on an already-initialized project is non-destructive (skips existing files with notes)
- Generated `.editorconfig` uses correct language defaults for the detected project type
- Generated `.gitattributes` includes `* text=auto` and language-appropriate diff drivers
- Prompt addition stays under ~80 lines of new instructions

## Future Work

1. **Commit signing plan** — Requires: MCP commit tool signing-readiness check (timeout on `execFile`, pre-flight GPG/SSH agent verification), `Bash(gpg --list-secret-keys:*)` in allowed-tools. Carry forward brainstorm decisions: detect both GPG/SSH, offer choice, `--local` scope, `atomic.signingRequested` marker.
2. **Convention detection MCP tool** — If `.editorconfig` language defaults prove insufficient, build a `detect_project_conventions` MCP tool that samples files and returns structured JSON.
3. **`git()` timeout** — Add a timeout parameter to the `git()` helper in `mcp/src/lib/git.ts` to prevent indefinite hangs (pre-existing debt, becomes load-bearing with signing).

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-12-expand-atomic-init-brainstorm.md](docs/brainstorms/2026-03-12-expand-atomic-init-brainstorm.md) — Key decisions carried forward: progressive tier unlock, language-aware gitattributes, editorconfig generation. Signing deferred (see "Deferred: Commit Signing" section).

### Internal References

- Current init command: `plugins/atomic/commands/atomic-init.md`
- Commit command (handoff target): `plugins/atomic/commands/atomic-commit.md`
- MCP commit tool (future signing impact): `mcp/src/tools/atomic-commit.ts`
- Git utilities (future timeout need): `mcp/src/lib/git.ts`

### External References

- [EditorConfig specification](https://editorconfig.org/)
- [gitattributes best practices](https://rehansaeed.com/gitattributes-best-practices/)
- [Git init documentation](https://git-scm.com/docs/git-init)
- [Git hooks guide](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- [Improve Git monorepo performance with fsmonitor](https://github.blog/engineering/infrastructure/improve-git-monorepo-performance-with-a-file-system-monitor/)
- [Git performance optimization](https://www.git-tower.com/blog/git-performance)
- [Git security: signed commits](https://hadess.io/git-security-signed-commits-secret-scanning-branch-protection/)
- [How core Git developers configure Git](https://blog.gitbutler.com/how-git-core-devs-configure-git)
- [Comparing GitHub commit signing options](https://www.kenmuse.com/blog/comparing-github-commit-signing-options/)
- [Git hooks complete guide 2026](https://devtoolbox.dedyn.io/blog/git-hooks-complete-guide)

### Review Agents

- **Security Sentinel:** Narrowed allowed-tools (HIGH x2), fsmonitor version gate (MEDIUM), hooks migration risk (LOW)
- **Architecture Strategist:** Validated no-MCP approach, flagged prompt complexity limit, recommended SKIP guards
- **Code Simplicity Reviewer:** Deferred signing, eliminated toggles, collapsed 8→4 phases (~40% reduction)
- **Agent-Native Reviewer:** Confirmed natural language > checkbox notation, flagged convention detection as MCP candidate
- **Pattern Recognition Specialist:** Fixed step numbering, caught missing `2>/dev/null` guards, validated cross-reference patterns
