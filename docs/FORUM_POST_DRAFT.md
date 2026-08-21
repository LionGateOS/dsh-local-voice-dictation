# [Prototype] Local voice dictation add-on for DSH — seeking architecture feedback

Hi all —

I've been prototyping a **local voice dictation add-on** for the DeepSeek
Harness web UI and I'd like feedback on the architecture before investing
further. This is a prototype and **not an upstream PR** — I'd rather align
on the right pattern first. I also know DSH is in developer preview and the
plugin/preset APIs may evolve, so if there's already a better-supported path
for what I'm describing, that's exactly what I'd like to learn.

The prototype was tested against **DeepSeek Harness 0.1.0-rc.7** (a local
checkout based on that release).

[GitHub repo link to be added after publication]

## What it does (currently working)

A small plugin package with two halves:

- A **browser client** that adds a Dictate button to the composer, records
  microphone audio, and inserts the transcript into the draft — it
  **never auto-sends** the message.
- A **node half** that registers a same-origin route,
  `POST /voice-proxy/transcribe`, which forwards base64 audio to a local
  STT engine at `127.0.0.1` (faster-whisper in my setup) and returns the
  transcript.

End-to-end dictation has worked: speak → transcript appears in the composer
draft → I review it and send it myself. If the engine is down, the proxy is
designed to return a 502 and leave the rest of Harness unaffected (that
specific path still needs a direct test on my side).

## What went wrong with my first packaging

My first attempt copied the entire `cordis` agent preset into a new "Voice
Mode" preset and appended the single plugin row. That produced confusing,
unstable session behavior:

- the copied preset became the **default** preset, so ordinary sessions
  silently inherited the experiment;
- the plugin existed only as manual copies in gitignored `node_modules`, so
  the preset depended on a fragile runtime install location;
- duplicating the whole composition created a second thing to keep in sync
  with the shipped preset.

The lesson I've drawn: **a capability add-on should be one plugin + one
mount row, not a copied full preset.**

## Questions

1. What is the best-supported way to mount a small local add-on like this —
   one row in an existing preset, a profile patch (like
   `~/.dsh/profiles/web/*.patch.yml`), a Profile-level plugin, or something
   else?
2. Is registering a same-origin HTTP route from a node-side plugin (my
   `/voice-proxy/transcribe` proxy) an accepted pattern, or is there a
   supported service/proxy mechanism I should be using instead?
3. For a client (browser) plugin, what's the canonical way to ship and load
   it today — and how stable is the client-side extension surface I used
   (composer draft API, button injection)?
4. Anything I should avoid to keep the add-on upgrade-safe as DSH evolves
   past the developer preview?

The source is small (~330 lines of JS plus a manifest).

Thanks in advance!
