# Installation

> **Installation is not finalized.** This document describes the current
> prototype setup and the intended direction. Follow the "current" section
> only if you are reproducing this exact prototype.

> **Licensed under MIT.** This is an independent community prototype; not an
> official DeepSeek project and not an upstream PR.

## Current state (prototype)

Installation today is manual: the three source files are copied into the
`node_modules` of the runtime that resolves the plugin. Those copies are
**runtime artifacts, not the source of truth**:

- They live in gitignored `node_modules` directories.
- `pnpm install` or a prune can remove or reorganize them.
- They are not tracked by any package manifest or lockfile.

This repository is the source of truth. To update a local runtime, re-copy
`package.json`, `index.js`, and `client.js` into the runtime's
`node_modules/@local/voice-dictation/` directory.

### Prototype-only steps (not recommended as practice)

The steps below touch a DSH runtime's local files directly. They are
**prototype-only and not recommended** as a general pattern; the intended
direction (below) makes them unnecessary.

```sh
# Prototype-only: create the plugin's runtime install location, then copy
# the three source files into it (adjust the checkout path as needed).
mkdir -p <dsh-checkout>/node_modules/@local/voice-dictation
cp package.json index.js client.js <dsh-checkout>/node_modules/@local/voice-dictation/
```

The prototype-era mount point was a single row appended to an agent preset
composition (editing a `~/.dsh` preset file directly — prototype-only, not
recommended):

```yaml
- id: voice-dictation
  name: '@local/voice-dictation'
```

Every step above is an **additive copy of three small files**. This document
contains no destructive commands.

## Intended direction (not yet solved)

Goal: install from a real repo/package with no hand-copying and one
canonical source. Options under consideration (in preference order):

1. **Proper local dependency** — reference the plugin as a real package
   (e.g., a pnpm `file:` / workspace link to a local checkout) so the
   package name resolves from this repository.
2. **Documented local file link** — a small, documented link procedure that
   makes the runtime resolve the plugin from a real source directory.
3. **Documented copy procedure (fallback)** — a small script that copies the
   three files into the exact runtime location and verifies checksums.
   Explicit and reproducible, and honest that it is a copy.

The preferred option will be confirmed with the DeepSeek Harness community
(see ROADMAP.md, phase 2). Until then, treat any `node_modules` copy as
disposable and this repository as the source of record.
