# Roadmap — local voice dictation add-on

_Draft — 2026-08-20._

> **Licensed under MIT.** This is an independent community prototype; not an
> official DeepSeek project and not an upstream PR.

## Phase 1 — Stabilize dictation (current)

Goal: dictation works reliably, and the host Harness is stable even without
the add-on.

- [x] End-to-end round-trip demonstrated (record → proxy → engine → draft)
- [x] No auto-send; transcript always lands in the draft
- [x] Plugin source preserved in a real source folder (this repository),
      outside `node_modules`
- [x] Host Harness left stable: standard sessions do not mount voice code by
      default; the voice engine is untouched and healthy

**Exit criteria:** a fresh standard session never mounts voice code by
default; an explicitly opted-in voice session can dictate.

## Phase 2 — Proper add-on packaging

Goal: the add-on is a small, self-contained package mounted by one row —
not a copied full preset.

- Confirm the best-supported lightweight mounting pattern with the DeepSeek
  Harness maintainers/community (preset row vs profile patch vs
  Profile-level plugin)
- Finalize the package name and repo structure (see `docs/REPO_PLAN.md`)
- Retire the full "Voice Mode" preset locally (keep for reference only)
- Optional: `/voice-proxy/health` passthrough so the UI can hide the
  Dictate button when the engine is down

**Exit criteria:** mounting/unmounting the add-on is a one-row change; no
preset duplication exists.

## Phase 3 — Reproducible install docs

Goal: anyone can install the add-on from the repo with no hand-copying.

- Validate the install method (see INSTALL.md, "Intended direction"): a real
  package link or a documented local file link
- Smoke test: engine `/health` + one `/voice-proxy/transcribe` round-trip
- Document the runtime layout so it is obvious which copies are source and
  which are disposable runtime artifacts

**Exit criteria:** a clean machine can install and dictate following the
docs alone.

## Phase 4 — Optional Kokoro TTS (not started)

Goal: assistant output can be spoken locally. **Kokoro TTS work has not
started yet.**

- Validate the engine's TTS path **directly first**, outside the Harness
- Decide the browser playback format (confirm the browser plays the engine's
  audio output, or convert at the proxy)
- Add a small "speak" action as its own add-on row, reusing the same
  mounting pattern

**Exit criteria:** a local, engine-down-safe TTS path that shares the
dictation architecture.

## Phase 5 — Broader testing

Goal: confidence before publication.

- Multiple/concurrent voice sessions (refcounted route behavior)
- Engine-down and slow-engine paths (502 / timeout behavior — the 502 path
  is code-backed but still needs a direct test)
- Long recordings (base64 payload cap ≈ 22M characters / ~16 MB decoded) and
  multiple languages
- Different browsers (mic permission, codec support)
- Re-test across DeepSeek Harness version bumps (developer-preview API
  drift)

**Exit criteria:** a test list with pass/fail notes that can ship as repo
docs.
