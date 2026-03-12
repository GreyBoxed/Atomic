---
title: "docs: Update README to reflect GPL-3.0 license"
type: fix
status: completed
date: 2026-03-12
---

# docs: Update README to reflect GPL-3.0 license

The README incorrectly states the project is MIT-licensed in two places, but the actual `LICENSE` file is GNU General Public License v3.0.

## Changes Required

Two edits in `README.md`:

1. **Line 5 — Badge**: Replace the MIT shield badge with a GPL-3.0 badge:
   ```markdown
   # Before
   [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

   # After
   [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
   ```

2. **Line 230 — Footer**: Replace `MIT` with `GPL-3.0`:
   ```markdown
   # Before
   ## License

   MIT

   # After
   ## License

   GPL-3.0. See [LICENSE](LICENSE) for details.
   ```

## Acceptance Criteria

- [x] README badge links to `LICENSE` and displays "GPL v3"
- [x] README footer says GPL-3.0, not MIT
- [x] No other files reference an incorrect license

## Context

- `LICENSE` file contains the full GPL-3.0 text (verified)
- No `license` field exists in `package.json`, `plugin.json`, or `marketplace.json` — no other files need updating
