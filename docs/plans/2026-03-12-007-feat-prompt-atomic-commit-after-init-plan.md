---
title: "feat: Prompt to run /atomic:commit after /atomic:init completes"
type: feat
status: completed
date: 2026-03-12
---

# feat: Prompt to run /atomic:commit after /atomic:init completes

## Enhancement Summary

**Deepened on:** 2026-03-12
**Sections enhanced:** 2 (Proposed Solution revised, new Research Insights)
**Review agents used:** Agent-Native, Code Simplicity, Pattern Recognition

### Key Improvements
1. Revised approach from "add Step 5" to "refine existing Step 4 summary" — eliminates redundancy
2. Replaced scripted dialogue ("Ready to commit?") with behavioral instruction for the agent
3. Added explicit constraint: agent must not commit itself (it has `Bash(git commit:*)` in `allowed-tools`)

### New Considerations Discovered
- The `init → commit` cross-reference already exists in 2 places (line 74 in CLAUDE.md template, line 135 in Step 4 summary)
- `git status --short` after init has a predetermined outcome (there will always be new files) — conditional check adds dead logic
- The agent-native approach: instruct the agent *what to assess*, not *what to say*

## Overview

After `/atomic:init` finishes, the agent should suggest running `/atomic:commit` to commit the newly created setup files. The existing Step 4 summary already mentions this at line 135, but it's a passive bullet point buried in a formatted code block. The improvement replaces the passive mention with a behavioral instruction that tells the agent to actively suggest the next step.

## Problem Statement / Motivation

When `/atomic:init` generates files (`.gitignore`, `CLAUDE.md`, `.githooks/*`), they're immediately uncommitted. The Step 4 summary lists "Run /atomic:commit to make your first conventional commit" as one of three bullets — but this is static template text inside a code fence, not an instruction to the agent. The agent renders the summary and moves on without actually recommending the action.

### Research Insights

**Code Simplicity Review:** Adding a full Step 5 with `git status` check and canned prompt text is overengineering. After init, there will *always* be uncommitted changes (the files it just created). A conditional branch with a predetermined outcome is dead logic. The file's own rules section says: "Keep it simple — a working minimal setup beats a complex one that breaks."

**Pattern Recognition:** The `init → commit` cross-reference already exists in two places: line 74 (CLAUDE.md template says "Run `/atomic:commit` to auto-group and commit changes") and line 135 (Step 4 summary bullet). The bidirectional relationship with `atomic-commit.md`'s pre-flight check (suggesting `/atomic:init` when not in a repo) is already fully established.

**Agent-Native Review:** "Ready to commit?" is a UI prompt — it assumes a human reading a dialog box. In an agent-native context, the agent should be told *what to assess and suggest*, not given exact copy to parrot. Command files should provide behavioral instructions, not scripted dialogue.

## Proposed Solution (Revised)

**Approach: Enhance Step 4, not add Step 5.** Replace the passive `/atomic:commit` bullet in the Step 4 summary with a behavioral instruction to the agent.

### `plugins/atomic/commands/atomic-init.md`

**Change the Step 4 section** (lines 116-137). After the summary code block, add a behavioral instruction:

**Current** (line 134-136 inside the summary code block):
```
  Next steps:
    - Review generated files and adjust to your preferences
    - Run /atomic:commit to make your first conventional commit
    - Share .githooks/ with your team (committed to repo, auto-applied via core.hooksPath)
```

**After** — keep the summary as-is, but add an instruction after the code block:

```markdown
After presenting the summary, mention that the newly created files are not yet committed and suggest running `/atomic:commit` to create the initial setup commit. Do not commit the files yourself — suggest the command so the user gets the full atomic grouping workflow.
```

This is a ~2-line addition after the existing Step 4 code block. No new Step 5. No `git status` check. No canned prompt text.

## Acceptance Criteria

- [x] After `/atomic:init` completes its Step 4 summary, the agent actively suggests running `/atomic:commit`
- [x] The suggestion is a behavioral instruction (agent phrases it naturally), not scripted text
- [x] The agent does NOT commit files itself — it suggests `/atomic:commit` only
- [x] No `git status` check added (unnecessary — init always creates files)

## Context

- **Affected file:** `plugins/atomic/commands/atomic-init.md` (add ~2 lines after the Step 4 summary code block, around line 137)
- **Cross-command references already exist:** line 74 (CLAUDE.md template), line 135 (Step 4 summary bullet)
- **Bidirectional pair:** `atomic-commit.md:20-24` suggests `/atomic:init` in pre-flight; `atomic-init.md:135` suggests `/atomic:commit` in summary
- **Convention from CLAUDE.md:** Commands are real files in `plugins/atomic/commands/`, no symlinks
- **Agent constraint:** `allowed-tools` includes `Bash(git commit:*)` — the instruction must explicitly tell the agent not to commit itself

## Sources

- `plugins/atomic/commands/atomic-init.md:134-137` — existing Step 4 summary with passive `/atomic:commit` mention
- `plugins/atomic/commands/atomic-init.md:74` — CLAUDE.md template also mentions `/atomic:commit`
- `plugins/atomic/commands/atomic-commit.md:18-24` — bidirectional pre-flight check suggesting `/atomic:init`
- `plugins/atomic/commands/atomic-cherrypick.md:187` — explicit rule: "keep commands interconnected"
- Code Simplicity Reviewer: existing mention is nearly sufficient; adding a full Step 5 is YAGNI
- Agent-Native Reviewer: behavioral instructions over scripted dialogue; keep commands independent
- Pattern Recognition Specialist: 9 cross-command references exist across the plugin; the `init ↔ commit` pair is already bidirectional
