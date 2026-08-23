// @local/voice-dictation — node half (TEMPORARY PERSISTENCE TEST).
// Registers a same-origin POST route /voice-proxy/transcribe that forwards
// base64 audio to the local LionGate voice engine (127.0.0.1:8768) and returns
// { ok, text, language }. Process-level refcount so multiple Voice Mode sessions
// share one route registration. This node_modules copy is a runtime install
// location only — NOT the source of truth.
//
// Also registers /voice-proxy/speech for TTS functionality.
const ENGINE_URL_TRANSCRIBE = 'http://127.0.0.1:8768/transcribe';
const ROUTE_TRANSCRIBE = '/voice-proxy/transcribe';
const MAX_B64_CHARS = 22000000; // ~16 MB audio cap (base64 chars)

const ENGINE_URL_TTS = 'http://127.0.0.1:8768/v1/audio/speech';
const ROUTE_TTS = '/voice-proxy/speech';
const MAX_TEXT_LENGTH = 1000; // Conservative limit for text input

let refs = 0;
let registered = false;
let disposers = [];

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function transcribeHandler(req, res) {
  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { ok: false, error: 'method not allowed' });
  }
  let raw = '';
  try {
    for await (const chunk of req) raw += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
  } catch (error) {
    return jsonResponse(res, 400, { ok: false, error: 'could not read request body' });
  }
  let body;
  try {
    body = raw === '' ? {} : JSON.parse(raw);
  } catch (error) {
    return jsonResponse(res, 400, { ok: false, error: 'request body must be JSON' });
  }
  const b64 = body && typeof body.b64 === 'string' ? body.b64 : '';
  if (b64 === '') return jsonResponse(res, 400, { ok: false, error: 'missing audio payload (b64)' });
  if (b64.length > MAX_B64_CHARS) return jsonResponse(res, 413, { ok: false, error: 'audio payload too large' });
  const audio = Buffer.from(b64, 'base64');
  const form = new FormData();
  form.append('file', new Blob([audio], { type: 'audio/webm' }), 'voice.webm');
  try {
    const resp = await fetch(ENGINE_URL_TRANSCRIBE, { method: 'POST', body: form, signal: AbortSignal.timeout(180000) });
    if (!resp.ok) return jsonResponse(res, 502, { ok: false, error: 'voice engine returned http ' + resp.status });
    const result = await resp.json().catch(() => null);
    if (!result || typeof result.text !== 'string') {
      return jsonResponse(res, 502, { ok: false, error: 'voice engine returned an unexpected response' });
    }
    return jsonResponse(res, 200, { ok: true, text: result.text, language: result.language });
  } catch (error) {
    return jsonResponse(res, 502, { ok: false, error: 'voice engine unreachable: ' + (error && error.message ? error.message : 'unknown error') });
  }
}

async function ttsHandler(req, res) {
  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { ok: false, error: 'method not allowed' });
  }
  let raw = '';
  try {
    for await (const chunk of req) raw += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
  } catch (error) {
    return jsonResponse(res, 400, { ok: false, error: 'could not read request body' });
  }
  let body;
  try {
    body = raw === '' ? {} : JSON.parse(raw);
  } catch (error) {
    return jsonResponse(res, 400, { ok: false, error: 'request body must be JSON' });
  }

  const text = body && typeof body.text === 'string' ? body.text : '';
  if (text === '') return jsonResponse(res, 400, { ok: false, error: 'missing text payload' });
  if (text.length > MAX_TEXT_LENGTH) return jsonResponse(res, 413, { ok: false, error: 'text payload too long' });

  try {
    // Prepare the request body for the TTS engine
    const ttsBody = {
      model: "kokoro",
      voice: "af_heart",
      input: text,
      response_format: "wav"
    };

    const resp = await fetch(ENGINE_URL_TTS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ttsBody),
      signal: AbortSignal.timeout(180000)
    });

    if (!resp.ok) {
      return jsonResponse(res, 502, { ok: false, error: 'voice engine returned http ' + resp.status });
    }

    // Set the correct content type for WAV audio
    res.writeHead(200, {
      'content-type': 'audio/wav',
      'cache-control': 'no-store',
    });

    // Stream the audio data directly to the response
    for await (const chunk of resp.body) {
      res.write(chunk);
    }
    res.end();

  } catch (error) {
    return jsonResponse(res, 502, { ok: false, error: 'voice engine unreachable: ' + (error && error.message ? error.message : 'unknown error') });
  }
}

const plugin = {
  name: 'voice-dictation',
  inject: ['webServer'],
  apply(ctx) {
    refs += 1;
    const webServer = ctx.get('webServer');
    if (webServer !== undefined && !registered) {
      try {
        // Register both routes and keep both disposers for clean teardown.
        const transcribeDisposer = webServer.register({ kind: 'exact', path: ROUTE_TRANSCRIBE, handler: transcribeHandler });
        const ttsDisposer = webServer.register({ kind: 'exact', path: ROUTE_TTS, handler: ttsHandler });
        disposers = [transcribeDisposer, ttsDisposer].filter(Boolean);
        registered = true;
      } catch (error) {
        registered = true;
        disposers = [];
      }
    }
    return () => {
      refs = Math.max(0, refs - 1);
      if (refs === 0 && registered) {
        registered = false;
        for (const dispose of disposers) {
          try { dispose(); } catch (error) {}
        }
        disposers = [];
      }
    };
  },
};

export default plugin;
