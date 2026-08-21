# dsh-local-voice-dictation

Created by LionGateOS

Author: Antonio Vidal <antoniovidaljr@gmail.com>


> **Experimental prototype.** A local voice dictation add-on for DeepSeek
> Harness. The source here works, but packaging and installation are still
> being finalized.

Independent community prototype; not an official DeepSeek project and not an
upstream PR. Licensed under MIT.

## What it does

Local voice dictation for DeepSeek Harness web sessions — no cloud STT, no
auto-send:

1. A **Dictate** button in the composer records microphone audio in the
   browser (WebRTC `getUserMedia`).
2. The audio is sent to the **same-origin** proxy route
   `POST /voice-proxy/transcribe` (base64 JSON payload, capped at about
   22 million base64 characters, approximately 16 MB of decoded audio).
3. The proxy forwards the audio to a **local STT engine** on the same
   machine and receives the transcript back.
4. The transcript is **inserted into the composer draft**.

**It never auto-sends messages.** The transcript always lands in the draft;
you review it and send it yourself.

## Speak

Each finalized assistant response gets a speaker control.

The Speak flow uses local Kokoro text-to-speech:

1. Click the speaker attached to an assistant response.
2. The button immediately shows `Generating...`.
3. The response text is sent through the same-origin route
   `POST /voice-proxy/speech`.
4. The proxy forwards the text to the local Kokoro-compatible voice engine.
5. When playback starts, the control becomes `Stop speaking`.
6. Only one generated audio stream is allowed at a time, preventing delayed
   duplicate clicks from producing overlapping voices.

The currently tested Kokoro endpoint is:

`POST http://127.0.0.1:8768/v1/audio/speech`

The assistant action is mounted using DeepSeek Harness's
`conversation.chat.assistant-actions` slot.

## The local flow

```
Dictate:
browser mic  →  same-origin /voice-proxy/transcribe  →  local engine (127.0.0.1)  →  transcript  →  composer draft

Speak:
assistant response  →  same-origin /voice-proxy/speech  →  local Kokoro TTS  →  WAV  →  browser playback
```

## How it's built

Two halves in one small package (~330 lines of JS):

| File | Role |
|---|---|
| `index.js` | Node half — registers the same-origin `POST /voice-proxy/transcribe` route (refcounted so multiple sessions share one registration) |
| `client.js` | Browser half — Dictate button, mic capture, transcript insertion into the draft via `setDraft()` |
| `package.json` | Manifest: `@local/voice-dictation`, ESM, node `main` + `./client` export |

## Required engine interface

The add-on is engine-agnostic: it works with any local engine that exposes

- `GET /health` — a status check, and
- `POST /transcribe` — a multipart audio upload returning JSON with a
  `text` field and an optional `language` field.

The current local **LionGate Voice Engine** (faster-whisper STT) is one
compatible local engine implementation; the prototype's proxy is pointed at
its `/transcribe` endpoint.

## Mounting (working prototype pattern)

The working prototype pattern is a single plugin row in an existing agent
composition (or a profile patch) — the intended lightweight add-on pattern,
*not* a copied full agent preset:

```yaml
- id: voice-dictation
  name: '@local/voice-dictation'
```

This is the pattern currently in use. It has not yet been confirmed as the
best-supported approach, and that confirmation is an open question with the
DeepSeek Harness community (see ROADMAP.md, phase 2).

> Note: an earlier prototype packaged this as a full copied "Voice Mode"
> agent preset. That approach turned out to be unstable (default-preset
> drift, source living only in gitignored `node_modules`) and is **not
> recommended**.

## Requirements

- A DeepSeek Harness web UI (developer preview)
- A local STT engine reachable on `127.0.0.1` (see "Required engine
  interface" above)
- Browser microphone permission

If the engine is down, the proxy returns HTTP 502 with a clear error and the
rest of Harness is unaffected — this behavior is code-backed, and a direct
engine-down test is still on the roadmap (needs direct testing to be fully
validated).

## Status

- ✅ Dictation round-trip demonstrated: record → proxy → engine → draft
- ✅ No auto-send; transcript always lands in the draft
- ✅ Assistant-response Speak button
- ✅ Local Kokoro TTS through `/voice-proxy/speech`
- ✅ Visible `Generating...` state while speech is being prepared
- ✅ Duplicate generation clicks are blocked
- ✅ Only one plugin-generated audio stream plays at a time
- ✅ `Stop speaking` immediately stops active playback
- ⚠️ Installation is manual for now (see INSTALL.md)
