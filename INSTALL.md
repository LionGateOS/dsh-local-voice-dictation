# Installation

> **Local installation.** The plugin is working, but it is not yet distributed
> as a registry package. Installation is currently manual.

> **Licensed under MIT.** This is an independent community plugin; not an
> official DeepSeek project and not an upstream PR.

## Requirements

You need:

- a DeepSeek Harness checkout
- the local voice engine running on `127.0.0.1:8768`
- Whisper available through `/transcribe`
- Kokoro-compatible TTS available through `/v1/audio/speech`

## Current tested installation

Set paths for your Harness checkout and plugin source:

```sh
HARNESS=/absolute/path/to/deepseek-harness
PLUGIN=/absolute/path/to/dsh-local-voice-dictation
```

Create the runtime package directories:

```sh
mkdir -p "$HARNESS/node_modules/@local/voice-dictation"
mkdir -p "$HOME/.dsh/profiles/node_modules/@local/voice-dictation"
```

Copy the runtime files into both locations:

```sh
cp "$PLUGIN/package.json" "$PLUGIN/index.js" "$PLUGIN/client.js" "$HARNESS/node_modules/@local/voice-dictation/"
cp "$PLUGIN/package.json" "$PLUGIN/index.js" "$PLUGIN/client.js" "$HOME/.dsh/profiles/node_modules/@local/voice-dictation/"
```

## Mount the plugin in the web browser roster

The plugin must be mounted in the DeepSeek Harness **web browser roster**, not inside an agent preset.

Edit:

```text
packages/bundle/web-app/cordis.patch.yml
```

Inside the browser plugin roster, add:

```yaml
- id: voice-dictation
  name: '@local/voice-dictation'
```

For example, it can sit next to the conversation UI row:

```yaml
- id: ui-conversation
  name: '@deepseek-ai/dsh-client-ui-conversation'

- id: voice-dictation
  name: '@local/voice-dictation'
```

The plugin declares its required `webServer` injection itself. This lets its node half register:

- `/voice-proxy/transcribe`
- `/voice-proxy/speech`

Do not mount the plugin only in an agent preset. Agent presets do not place the plugin into the web browser boot graph.

## Restart Harness

```sh
cd "$HARNESS"
pnpm dsh web
```

Then reload the Harness page.

## Verify

Check the local voice engine:

```sh
curl http://127.0.0.1:8768/health
```

A healthy engine should report Whisper loaded and Kokoro ready.

Check the Harness transcribe route:

```sh
curl -i -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3080/voice-proxy/transcribe
```

An empty test request should return HTTP `400` with `missing audio payload (b64)`. That confirms the route is active. HTTP `405` means the voice proxy route was not registered.

Check TTS:

```sh
curl -i -X POST -H 'content-type: application/json' --data '{"text":"voice test"}' http://127.0.0.1:3080/voice-proxy/speech -o /tmp/voice-proxy-test.out
```

A working route returns HTTP `200` with `content-type: audio/wav`.

Finally verify in the browser:

- **Dictate** records and inserts the transcript into the composer without sending.
- **Speak** generates and plays assistant-response audio.
- **Stop speaking** immediately stops active playback.

## Updating the plugin

Until a packaged installation method is available, update both runtime copies after changing or pulling the plugin source, then restart `pnpm dsh web`.

```sh
cp "$PLUGIN/package.json" "$PLUGIN/index.js" "$PLUGIN/client.js" "$HARNESS/node_modules/@local/voice-dictation/"
cp "$PLUGIN/package.json" "$PLUGIN/index.js" "$PLUGIN/client.js" "$HOME/.dsh/profiles/node_modules/@local/voice-dictation/"
```
