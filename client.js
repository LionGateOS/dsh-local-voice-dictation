window.__ModuleLoader__.load({
  id: "@local/voice-dictation",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    let react = require("react");
    const E = react.createElement;

    // One active composer at a time; the button wires the current composer.
    const voice = { phase: "idle", seconds: 0, toast: null, input: null, inputActions: null };
    const updaters = new Set();
    function notify() { updaters.forEach((fn) => { try { fn(); } catch (err) { console.error("[voice-dictation]", err); } }); }
    let toastDisposer = null;
    function setToast(kind, text) {
      voice.toast = { kind: kind, text: text };
      notify();
      if (toastDisposer !== null) toastDisposer();
      toastDisposer = setTimeout(() => { toastDisposer = null; voice.toast = null; notify(); }, 4500);
    }
    function setPhase(p) { voice.phase = p; notify(); }

    let recorder = null;
    let mediaStream = null;
    let pendingChunks = [];
    let secDisposer = null;
    let capDisposer = null;
    let commitToken = 0;

    function stopMedia() {
      if (capDisposer !== null) { clearTimeout(capDisposer); capDisposer = null; }
      if (secDisposer !== null) { clearInterval(secDisposer); secDisposer = null; }
      if (recorder !== null) { try { recorder.onstop = null; recorder.stop(); } catch (err) {} recorder = null; }
      if (mediaStream !== null) { mediaStream.getTracks().forEach((t) => { try { t.stop(); } catch (err) {} }); mediaStream = null; }
    }

    function insertDraft(text) {
      const state = voice.input;
      const actions = voice.inputActions;
      if (actions === null || state === null || typeof state.draft !== "string") {
        setToast("error", "The composer is not available right now. Open a session and try again.");
        return;
      }
      const draft = state.draft;
      const next = draft.length === 0 ? text : (/\s$/.test(draft) ? draft + text : draft + " " + text);
      actions.setDraft(next);
    }

    async function beginTranscription(blob) {
      const win = typeof window !== "undefined" ? window : undefined;
      if (blob === null || blob.size === 0 || win === undefined) {
        setPhase("idle");
        setToast("info", "No audio was captured — the microphone produced no signal.");
        return;
      }
      let b64;
      try {
        b64 = await new Promise((resolve, reject) => {
          const fr = new win.FileReader();
          fr.onload = () => { const s = String(fr.result || ""); const i = s.indexOf("base64,"); resolve(i >= 0 ? s.slice(i + 7) : s); };
          fr.onerror = () => reject(fr.error);
          fr.readAsDataURL(blob);
        });
      } catch (err) {
        setPhase("idle");
        setToast("error", "Could not read the recorded audio: " + (err && err.message ? err.message : "unknown error"));
        return;
      }
      try {
        const resp = await fetch("/voice-proxy/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ b64: b64, mime: blob.type, durationSec: voice.seconds }),
        });
        if (!resp.ok) throw new Error("http " + resp.status);
        const result = await resp.json();
        if (result !== null && typeof result === "object" && result.ok === true) {
          const text = (typeof result.text === "string" ? result.text : "").trim();
          if (text === "") setToast("info", "No speech detected — nothing was added to the message.");
          else insertDraft(text);
        } else if (result !== null && typeof result === "object" && result.ok === false) {
          setToast("error", result.error || "Transcription failed.");
        } else {
          setToast("error", "Transcription failed: no response from the local voice engine.");
        }
      } catch (err) {
        setToast("error", "Could not reach the local voice engine (127.0.0.1:8768): " + (err && err.message ? err.message : "unknown error"));
      } finally {
        setPhase("idle");
      }
    }

    function stopRecording() {
      if (voice.phase !== "recording") return;
      setPhase("transcribing");
      const rec = recorder;
      const token = ++commitToken;
      const doCommit = () => {
        if (commitToken !== token) return;
        commitToken = 0;
        const win = typeof window !== "undefined" ? window : undefined;
        const blob = win !== undefined ? new win.Blob(pendingChunks, { type: (rec !== null && rec.mimeType) || "audio/webm" }) : null;
        pendingChunks = [];
        beginTranscription(blob);
      };
      if (rec !== null) { try { rec.onstop = doCommit; rec.stop(); } catch (err) { doCommit(); } }
      stopMedia();
      setTimeout(doCommit, 2500);
    }

    function start() {
      if (voice.phase !== "idle") return;
      const win = typeof window !== "undefined" ? window : undefined;
      if (win === undefined || typeof win.MediaRecorder !== "function") {
        setToast("error", "Audio recording is not supported in this browser. Use Chrome or Edge.");
        return;
      }
      const nav = win.navigator;
      const mediaDevices = nav ? nav.mediaDevices : undefined;
      const gum = mediaDevices ? mediaDevices.getUserMedia : undefined;
      if (typeof gum !== "function") {
        setToast("error", "Microphone capture is not available (getUserMedia missing). Open this page at http://127.0.0.1 in Chrome or Edge.");
        return;
      }
      gum.call(mediaDevices, { audio: true }).then((stream) => {
        if (voice.phase !== "idle") { stream.getTracks().forEach((t) => t.stop()); return; }
        mediaStream = stream;
        pendingChunks = [];
        const mime = win.MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
        const rec = new win.MediaRecorder(stream, { mimeType: mime });
        rec.ondataavailable = (e) => { if (e && e.data && e.data.size > 0) pendingChunks.push(e.data); };
        rec.onerror = () => {
          if (voice.phase === "recording") { setPhase("idle"); stopMedia(); setToast("error", "The microphone stopped unexpectedly. Check the device and try again."); }
        };
        recorder = rec;
        try { rec.start(250); } catch (err) { stopMedia(); setToast("error", "Could not start recording: " + (err && err.message ? err.message : "unknown error")); return; }
        voice.seconds = 0;
        setPhase("recording");
        secDisposer = setInterval(() => { voice.seconds += 1; notify(); }, 1000);
        capDisposer = setTimeout(() => { if (voice.phase === "recording") stopRecording(); }, 120000);
      }).catch((err) => {
        const name = err && err.name ? String(err.name) : "";
        let text;
        if (name === "NotAllowedError" || name === "SecurityError") text = "Microphone access was denied. Allow this page to use the microphone, then try again.";
        else if (name === "NotFoundError" || name === "OverconstrainedError") text = "No usable microphone was found. Check your input device and try again.";
        else text = "Could not open the microphone: " + (err && err.message ? err.message : "unknown error");
        setToast("error", text);
      });
    }

    function useVoiceState() {
      const [, bump] = react.useState(0);
      react.useEffect(() => {
        const fn = () => bump((n) => n + 1);
        updaters.add(fn);
        return () => updaters.delete(fn);
      }, []);
      return voice;
    }

    function MicIcon() {
      return E("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", focusable: "false" },
        E("path", { d: "M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" }));
    }

    function MicButton(props) {
      const state = useVoiceState();
      voice.input = props ? props.input : null;
      voice.inputActions = props ? props.inputActions : null;
      const phase = state.phase;
      const listening = phase === "recording";
      const busy = phase === "transcribing";
      return E("button", {
        type: "button",
        className: "vd-mic" + (listening ? " vd-mic-listening" : "") + (busy ? " vd-mic-busy" : ""),
        title: listening ? "Stop recording" : "Dictate: speak, then the transcript is inserted into the message via the local voice engine",
        "aria-label": listening ? "Stop dictation" : "Start dictation",
        disabled: busy,
        onClick: () => { if (listening) stopRecording(); else start(); },
      },
        listening ? E("span", { className: "vd-dot", "aria-hidden": "true" }) : busy ? E("span", { className: "vd-dot vd-dot-busy", "aria-hidden": "true" }) : MicIcon(),
        E("span", null, listening ? "Stop" : (busy ? "…" : "Dictate")));
    }


    // Global state for managing audio playback
    let activeAudio = null;
    let activeGenerationToken = null;

    function AssistantSpeakButton(props) {
      const nodes = props.useSession((session) => session.nodes);
      const messageId = props.messageId;

      // Track state per message ID
      const [buttonState, setButtonState] = react.useState('idle'); // 'idle', 'generating', 'playing'
      const [audioElement, setAudioElement] = react.useState(null);

      const handleSpeak = async () => {
        // Prevent duplicate clicks while generating.
        if (buttonState === 'generating') {
          return;
        }

        // While playing, the same button acts as Stop.
        if (buttonState === 'playing') {
          if (activeAudio) {
            activeAudio.pause();
            activeAudio.currentTime = 0;
            activeAudio = null;
          }
          activeGenerationToken = null;
          setAudioElement(null);
          setButtonState('idle');
          return;
        }

        // Stop any currently playing audio
        if (activeAudio) {
          activeAudio.pause();
          activeAudio = null;
        }

        // Update button state to generating
        setButtonState('generating');

        const node = nodes.find((item) =>
          item &&
          item.kind === "assistant" &&
          item.messageId &&
          String(item.messageId) === String(messageId)
        );

        if (!node || !Array.isArray(node.blocks)) {
          setToast("error", "Could not find this assistant message.");
          setButtonState('idle');
          return;
        }

        const text = node.blocks
          .filter((block) =>
            block &&
            block.kind === "text" &&
            typeof block.text === "string"
          )
          .map((block) => block.text)
          .join("\n")
          .trim();

        if (!text) {
          setToast("info", "This assistant message has no text to speak.");
          setButtonState('idle');
          return;
        }

        // Create a generation token to prevent stale requests
        const generationToken = Symbol('generation');
        activeGenerationToken = generationToken;

        try {
          const resp = await fetch("/voice-proxy/speech", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text.slice(0, 1000) }),
          });

          // Check if this is still the latest request
          if (activeGenerationToken !== generationToken) {
            setButtonState('idle');
            return;
          }

          if (!resp.ok) throw new Error("http " + resp.status);

          const audioBlob = await resp.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);

          // Set audio element to state for cleanup
          setAudioElement(audio);

          // Update button state to playing
          setButtonState('playing');

          // Set active audio reference
          activeAudio = audio;

          // Clean up when audio finishes
          audio.onended = () => {
            // Check if this is still the active audio
            if (activeAudio === audio) {
              activeAudio = null;
              URL.revokeObjectURL(audioUrl);
              setAudioElement(null);
              setButtonState('idle');
            }
          };

          // Handle audio errors
          audio.onerror = () => {
            // Check if this is still the active audio
            if (activeAudio === audio) {
              activeAudio = null;
              URL.revokeObjectURL(audioUrl);
              setAudioElement(null);
              setButtonState('idle');
              setToast(
                "error",
                "Speech playback failed"
              );
            }
          };

          await audio.play();
        } catch (err) {
          // Check if this is still the active audio
          if (activeAudio === audioElement) {
            activeAudio = null;
          }
          setAudioElement(null);
          setButtonState('idle');
          setToast(
            "error",
            "Speak failed: " +
              (err && err.message ? err.message : "unknown error")
          );
        }
      };

      // Cleanup effect
      react.useEffect(() => {
        return () => {
          if (audioElement) {
            audioElement.pause();
            if (audioElement.src) {
              URL.revokeObjectURL(audioElement.src);
            }
          }
        };
      }, [audioElement]);

      // Render based on current state
      const isGenerating = buttonState === 'generating';
      const isPlaying = buttonState === 'playing';

      return E("button", {
        type: "button",
        className: "vd-assistant-speak" + (isGenerating ? " vd-assistant-speak-generating" : "") + (isPlaying ? " vd-assistant-speak-playing" : ""),
        title: isGenerating ? "Generating speech..." : isPlaying ? "Stop speaking" : "Read this response aloud",
        "aria-label": isGenerating ? "Generating speech..." : isPlaying ? "Stop speaking" : "Read this response aloud",
        disabled: isGenerating,
        onClick: handleSpeak,
      },
        isGenerating ? "Generating..." : isPlaying ? "⏹️" : "🔊");
    }

    function LiveStrip() {
      const state = useVoiceState();
      if (state.phase === "recording") return E("div", { className: "vd-strip", role: "status" },
        E("span", { className: "vd-dot", "aria-hidden": "true" }),
        E("span", null, "Recording… " + state.seconds + "s — click Stop when finished"));
      if (state.phase === "transcribing") return E("div", { className: "vd-strip", role: "status" },
        E("span", { className: "vd-dot vd-dot-busy", "aria-hidden": "true" }),
        E("span", null, "Transcribing with the local voice engine…"));
      return null;
    }

    function Toast() {
      const state = useVoiceState();
      if (state.toast === null) return null;
      return E("div", { className: "vd-toast" + (state.toast.kind === "error" ? " vd-toast-error" : ""), role: "alert" },
        E("span", null, state.toast.text));
    }

    function apply(ctx) {
      ctx.effect(() => {
        const el = document.createElement("style");
        el.setAttribute("data-plugin", "@local/voice-dictation");
        el.textContent = [
          ".vd-mic { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.3)); border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary, rgba(230,230,230,0.7)); font: inherit; font-size: 11px; line-height: 1; cursor: pointer; white-space: nowrap; }",
          ".vd-mic:hover:not(:disabled) { color: var(--dsw-alias-label-primary, #e6e66e); border-color: var(--dsw-alias-border-l2, rgba(128,128,128,0.5)); }",
          ".vd-mic:disabled { opacity: 0.6; cursor: default; }",
          ".vd-mic-listening, .vd-mic-listening:hover:not(:disabled) { color: var(--dsw-alias-state-error-primary, #ff5b5b); border-color: var(--dsw-alias-state-error-primary, #ff5b5b); }",
          ".vd-mic-busy, .vd-mic-busy:hover:not(:disabled) { color: var(--dsw-alias-brand-primary, #6ea8fe); border-color: var(--dsw-alias-brand-primary, #6ea8fe); }",
          ".vd-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-state-error-primary, #ff5b5b); display: inline-block; animation: vd-pulse 1.1s ease-in-out infinite; }",
          ".vd-dot-busy { background: var(--dsw-alias-brand-primary, #6ea8fe); }",
          "@keyframes vd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }",
          ".vd-strip { display: flex; align-items: center; gap: 8px; padding: 3px 10px; font-size: 12px; color: var(--dsw-alias-label-secondary, rgba(230,230,230,0.7)); }",
          ".vd-strip > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
          ".vd-toast { position: fixed; bottom: 110px; left: 50%; transform: translateX(-50%); z-index: 2147483000; display: flex; align-items: center; max-width: min(480px, calc(100vw - 48px)); padding: 9px 14px; border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.5)); border-radius: 8px; background: var(--dsw-alias-bg-overlay, rgba(20,20,24,0.95)); color: var(--dsw-alias-label-primary, #e6e6e6); font-size: 12.5px; line-height: 1.4; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28); pointer-events: none; }",
          ".vd-toast-error { border-color: var(--dsw-alias-state-error-primary, #ff5b5b); }",
          ".vd-assistant-speak { border: 0; background: transparent; color: inherit; cursor: pointer; padding: 2px 4px; font: inherit; opacity: 0.7; }",
          ".vd-assistant-speak:hover { opacity: 1; }",
          ".vd-assistant-speak-generating { opacity: 0.5; }",
          ".vd-assistant-speak-playing { opacity: 1; }",
        ].join("\n");
        document.head.appendChild(el);
        return () => { if (el.parentNode) el.parentNode.removeChild(el); };
      }, "voice-dictation: styles");

      const slots = ctx.get("slots");
      if (slots !== undefined) {
        slots.inject("conversation.input.right", () => {
          slots.register({ name: "conversation.input.right", id: "vd-mic", order: 10, label: "Voice dictation" }, MicButton);
        });
        slots.inject("conversation.chat.assistant-actions", () => {
          slots.register({
            name: "conversation.chat.assistant-actions",
            id: "vd-assistant-speak",
            order: 20,
            label: "Speak response"
          }, AssistantSpeakButton);
        });
        slots.inject("conversation.input.dock", () => {
          slots.register({ name: "conversation.input.dock", id: "vd-live", order: 10, label: "Voice live transcript" }, LiveStrip);
        });
        slots.inject("shell.overlay", () => {
          slots.register({ name: "shell.overlay", id: "vd-toast", order: 999, label: "Voice dictation notice" }, Toast);
        });
      }

      ctx.effect(() => () => {
        stopMedia();
        if (toastDisposer !== null) clearTimeout(toastDisposer);
        // Cleanup active audio when plugin unloads
        if (activeAudio) {
          activeAudio.pause();
          activeAudio = null;
        }
      }, "voice-dictation: cleanup");
    }

    exports.apply = apply;
    return module.exports;
  }
});
