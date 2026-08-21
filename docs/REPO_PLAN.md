# Repo Plan — local voice dictation add-on for DeepSeek Harness

_Draft — 2026-08-20. The repo has not been created or published yet; this is
the plan it is being built to._

## Repo name (chosen for this draft)

**`dsh-local-voice-dictation`**

This is the chosen name for the local draft repository; the final published
name will be confirmed at publication time. The `dsh-` prefix follows the
DeepSeek Harness naming convention (`@deepseek-ai/dsh-*`) so the add-on is
discoverable as DSH tooling, and "local" signals the local-engine-first
design.

## Repo scope

A single, small, self-contained package that adds **local voice dictation**
to a DeepSeek Harness web session:

- a browser client — Dictate button: mic capture → transcript into the
  composer draft, **never auto-sends**; and
- a node-side same-origin proxy route (`POST /voice-proxy/transcribe`) that
  forwards audio to a **local STT engine** on `127.0.0.1` (the local
  LionGate Voice Engine in the current implementation).

Scope is dictation only. It does **not** include the voice engine itself,
TTS, any full agent preset, or any changes to DeepSeek Harness core.

## Planned repo contents

```
dsh-local-voice-dictation/
  package.json        (plugin manifest)
  index.js            (node half)
  client.js           (browser half)
  README.md
  INSTALL.md
  ROADMAP.md
  SAFETY_NOTES.md
  LICENSE             (placeholder — license not selected yet)
  .gitignore
  docs/
    REPO_PLAN.md      (this file)
    FORUM_POST_DRAFT.md
```

The mount example ships as a snippet in README.md (one-line preset row /
profile patch), not as a preset file.

## What should NOT be included

- `node_modules/` in any form (runtime install artifacts).
- Any `~/.dsh` content: `settings.yaml`, `.credentials.yaml`, agent preset
  directories, session/storage data, profiles.
- The full "Voice Mode" copied preset (historical artifact; the approach is
  deprecated — at most *reference* it in docs, never ship it as recommended
  config).
- Model files: kokoro ONNX + voice bins, whisper model weights, GGUF files.
- Engine `venv/`, `__pycache__/`, or temp directories.
- Logs, or absolute private paths (`/home/<user>/...`) in code — use
  placeholders.

## Avoiding private/secret commits

1. **Repo root = plugin only.** Keep the repo root at the plugin directory
   (the current `github-ready/` contents), never at the home directory or
   the DSH data directory — then `~/.dsh` and the model directories are
   structurally outside the repo.
2. **`.gitignore` up front:** see the repo's `.gitignore` — it covers
   `node_modules/`, python `venv/`/`__pycache__/`, model files (`.gguf`,
   `.onnx`, `.bin`), logs, env/secret files (`.env*`, `credentials*`,
   `*.key`, `*.pem`), and DSH user data (`.dsh/`).
3. **No copying, only creating.** Files enter the repo by being written
   into it, never by `cp -r` of a tree that contains `.dsh` or
   `node_modules`.
4. **Path hygiene.** In docs and code, use `127.0.0.1:8768` (or a generic
   `127.0.0.1`), `$DSH_HOME` (default `~/.dsh`), and relative paths; scrub
   real home paths before pushing.
5. **Pre-push review.** `git status` + full `git diff` review, plus a sanity
   filter like `git ls-files | grep -Ei 'credential|secret|onnx|gguf|\.log$'`;
   optionally a secret scanner.
6. **The runtime contract holds no secrets.** The plugin only needs the
   engine URL (localhost) — no API keys anywhere in the code path, so there
   is nothing secret to leak in the first place.
