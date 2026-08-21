// @local/voice-dictation — node half (TEMPORARY PERSISTENCE TEST).
// Registers a same-origin POST route /voice-proxy/transcribe that forwards
// base64 audio to the local LionGate voice engine (127.0.0.1:8768) and returns
// { ok, text, language }. Process-level refcount so multiple Voice Mode sessions
// share one route registration. This node_modules copy is a runtime install
// location only — NOT the source of truth.
const ENGINE_URL = 'http://127.0.0.1:8768/transcribe';
const ROUTE = '/voice-proxy/transcribe';
const MAX_B64_CHARS = 22000000; // ~16 MB audio cap (base64 chars)

let refs = 0;
let registered = false;
let disposer = undefined;

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function handler(req, res) {
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
    const resp = await fetch(ENGINE_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(180000) });
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

const plugin = {
  name: 'voice-dictation',
  apply(ctx) {
    refs += 1;
    const webServer = ctx.get('webServer');
    if (webServer !== undefined && !registered) {
      try {
        disposer = webServer.register({ kind: 'exact', path: ROUTE, handler });
        registered = true;
      } catch (error) {
        registered = true;
        disposer = undefined;
      }
    }
    return () => {
      refs = Math.max(0, refs - 1);
      if (refs === 0 && registered) {
        registered = false;
        if (disposer !== undefined) {
          try { disposer(); } catch (error) {}
        }
        disposer = undefined;
      }
    };
  },
};

export default plugin;
