# Safety notes

Operating constraints for this project — what the add-on does and does not
do, and what the working process must not touch.

> **Licensed under MIT.** This is an independent community prototype; not an
> official DeepSeek project and not an upstream PR.

## Behavior properties (the plugin)

- **No auto-send.** The transcript is inserted into the composer draft only
  (`setDraft()`); the user always reviews and sends manually.
- **Local-only STT engine.** Audio goes to `127.0.0.1` (a local engine;
  faster-whisper in the current implementation). No cloud STT, no
  third-party endpoints.
- **Same-origin proxy.** The browser talks to its own origin
  (`/voice-proxy/transcribe`); the node half is the only component that
  reaches the engine. No cross-origin requests, no new CORS surface.
- **Bounded payload.** The base64 payload is capped at about 22 million
  characters (approximately 16 MB of decoded audio), with a 180 s upstream
  timeout.
- **Engine-down behavior — code-backed, still needs direct testing.** If the
  engine is unreachable, the proxy is designed to return HTTP 502 with a
  clear error and leave the rest of the Harness unaffected. This path exists
  in the code, but a direct engine-down test is still outstanding (ROADMAP,
  phase 5) before it is treated as proven.

## Working-process constraints (repo/prototype work)

- **No destructive commands.** No deletion of runtime files, presets,
  engine files, or session data; changes are additive, and config edits are
  backed up first.
- **No editing tracked Harness source.** The DeepSeek Harness checkout stays
  `git status`-clean; the add-on lives entirely in user config + local
  packages.
- **Nothing private or heavy in the repo.** No private `~/.dsh` files,
  credentials, logs, `node_modules`, `venv`s, model files, or large binaries
  ever enter the repo; see `docs/REPO_PLAN.md` for the mechanism that
  enforces this and `.gitignore` for the file-level rules.
- **Harness stability first.** Standard sessions do not mount voice code by
  default; the add-on mounts only when a session explicitly opts in.
