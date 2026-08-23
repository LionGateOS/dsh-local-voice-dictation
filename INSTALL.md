# Installation

> **Local installation.** The plugin is working, but it is not yet distributed
> as a registry package. The current setup installs it into the Harness web
> profile as a linked local dependency.

> **Licensed under MIT.** This is an independent community plugin; not an
> official DeepSeek project and not an upstream PR.

## Current installation

Install the plugin into the Harness web profile as a linked local dependency:

```sh
cd <deepseek-harness-checkout>
pnpm dsh plugin --profile web add /absolute/path/to/dsh-local-voice-dictation
```

DSH forwards this to `pnpm` inside the selected profile and records the plugin
as a linked dependency. The profile then resolves `@local/voice-dictation`
directly from the source checkout instead of from a manually copied package.

The plugin currently installs as a plain dependency rather than a `dsh.bundle`
profile layer. That is expected for this architecture: mount it separately in
the active agent composition or profile patch:

```yaml
- name: '@local/voice-dictation'
```

### Verify the link

From the web profile directory:

```sh
cd ~/.dsh/profiles/web
node -p "require.resolve('@local/voice-dictation/package.json')"
readlink -f node_modules/@local/voice-dictation
```

Both commands should resolve to the plugin source checkout.

The plugin provides both local dictation and assistant-response speech.
Dictation requires the local `/transcribe` engine endpoint. Speak requires the
Kokoro-compatible `/v1/audio/speech` endpoint used by the Harness
`/voice-proxy/speech` route.
