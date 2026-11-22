import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { db, message } from "./api";

export const voiceBucket = "gist-voice-notes";
const maxSeconds = 60;
const maxBytes = 2 * 1024 * 1024;
const recordingTypes = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];
const flatWave = "M0 16 H100";

function LocalAudio({ clip, label, playOnLoad = false, onError }: {
  clip: Blob;
  label: string;
  playOnLoad?: boolean;
  onError?: () => void;
}) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const source = URL.createObjectURL(clip);
    setUrl(source);
    return () => URL.revokeObjectURL(source);
  }, [clip]);
  return url ? <audio className="voice-audio" aria-label={label} controls preload="metadata" src={url} autoPlay={playOnLoad} onError={onError} /> : null;
}

export function VoiceComposer({ clip, onChange, disabled, onBusy }: {
  clip: Blob | null;
  onChange: (clip: Blob | null) => void;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const microphone = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const waveform = useRef<SVGPathElement>(null);
  const timer = useRef<number>(undefined);
  const mounted = useRef(false);
  const [state, setState] = useState<"idle" | "starting" | "recording">("idle");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const canRecord = typeof navigator.mediaDevices?.getUserMedia === "function" && typeof MediaRecorder !== "undefined";

  function release() {
    window.clearInterval(timer.current);
    microphone.current?.getTracks().forEach((track) => track.stop());
    microphone.current = null;
    recorder.current = null;
    if (audioContext.current) void audioContext.current.close().catch(() => {});
    audioContext.current = null;
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current) {
        recorder.current.onstop = null;
        recorder.current.onerror = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      release();
    };
  }, []);

  async function record() {
    if (!canRecord || state !== "idle") return;
    setError("");
    setState("starting");
    onBusy(true);
    try {
      if (typeof AudioContext !== "undefined" && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        try {
          audioContext.current = new AudioContext();
          void audioContext.current.resume().catch(() => {});
        } catch {
          // The recorder can run without a waveform.
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      microphone.current = stream;
      const mimeType = recordingTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const capture = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 48000 });
      recorder.current = capture;

      let analyser: AnalyserNode | undefined;
      try {
        const context = audioContext.current;
        if (context) {
          analyser = context.createAnalyser();
          analyser.fftSize = 256;
          context.createMediaStreamSource(stream).connect(analyser);
        }
      } catch {
        analyser = undefined;
      }
      const samples = new Uint8Array(256);
      const chunks: Blob[] = [];
      capture.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
      capture.onerror = () => {
        capture.onstop = null;
        release();
        setError("The recording stopped unexpectedly. Try recording again.");
        setState("idle");
        onBusy(false);
      };
      const started = performance.now();
      capture.onstop = () => {
        release();
        setState("idle");
        onBusy(false);
        try {
          if (performance.now() - started > (maxSeconds + 1) * 1000)
            throw Error("The recording ran over one minute. Try a shorter clip.");
          const type = (capture.mimeType || chunks[0]?.type || "").split(";")[0];
          if (!["audio/webm", "audio/mp4", "audio/ogg"].includes(type))
            throw Error("This browser’s recording format is unsupported.");
          const recorded = new Blob(chunks, { type });
          if (!recorded.size) throw Error("The recording is empty. Try again.");
          if (recorded.size > maxBytes) throw Error("The recording exceeds 2 MB. Try a shorter one.");
          onChange(recorded);
        } catch (reason) {
          setError(message(reason));
        }
      };
      capture.start();
      setSeconds(0);
      setState("recording");
      timer.current = window.setInterval(() => {
        const elapsed = Math.floor((performance.now() - started) / 1000);
        setSeconds(Math.min(maxSeconds, elapsed));
        if (elapsed >= maxSeconds && capture.state === "recording") {
          capture.stop();
          return;
        }
        if (analyser && waveform.current) {
          analyser.getByteTimeDomainData(samples);
          let path = "M0 16";
          for (let point = 1; point < 25; point += 1) {
            const level = (samples[point * 10] - 128) / 128;
            const spike = Math.min(13, Math.abs(level) * 68);
            path += ` L${point * 4} ${(16 + (point % 2 ? -spike : spike)).toFixed(1)}`;
          }
          waveform.current.setAttribute("d", path + " L100 16");
        }
      }, 80);
    } catch {
      release();
      if (!mounted.current) return;
      setError("Couldn’t start the microphone. Check your browser’s microphone permissions and try again.");
      setState("idle");
      onBusy(false);
    }
  }

  const recording = state === "recording";
  const label = recording ? "Stop recording" : state === "starting"
    ? "Opening microphone" : clip ? "Record a new voice note" : "Record a voice note";

  return (
    <>
      {recording && (
        <div className="voice-live">
          <span className="sr-only" role="status">Recording voice note</span>
          <svg viewBox="0 0 100 32" aria-hidden="true">
            <path ref={waveform} d={flatWave} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <span aria-hidden="true">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
        </div>
      )}
      <button
        type="button"
        className="voice-trigger"
        aria-label={label}
        title={label}
        data-recording={recording}
        disabled={disabled || state === "starting" || !canRecord}
        onClick={() => {
          if (recorder.current?.state === "recording") recorder.current.stop();
          else void record();
        }}
      >
        {recording ? <Square size={16} fill="currentColor" aria-hidden="true" /> : <Mic size={19} aria-hidden="true" />}
      </button>
      {state === "starting" && <small className="muted" role="status">Opening microphone…</small>}
      {!canRecord && <small className="muted">Voice recording is unavailable in this browser.</small>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {state === "idle" && clip && (
        <div className="voice-preview">
          <LocalAudio clip={clip} label="Preview your voice note" />
          <button type="button" className="text-button" disabled={disabled} onClick={() => {
            setError("");
            onChange(null);
          }}>Remove audio</button>
        </div>
      )}
    </>
  );
}

export function VoicePlayer({ path }: { path: string }) {
  const [clip, setClip] = useState<Blob>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="voice-player">
      {clip ? <LocalAudio clip={clip} label="Voice note" playOnLoad onError={() => {
        setClip(undefined);
        setError("This browser couldn’t play the voice note.");
      }} /> : (
        <button type="button" className="button secondary" disabled={busy} onClick={async () => {
          if (!db || busy) return;
          setBusy(true);
          setError("");
          try {
            const { data, error } = await db.storage.from(voiceBucket).download(path, {}, { cache: "no-store" });
            if (error) throw error;
            setClip(data);
          } catch {
            setError("This voice note couldn’t load. Try again.");
          } finally {
            setBusy(false);
          }
        }}>
          <Mic size={16} aria-hidden="true" /> {busy ? "Loading voice note…" : "Listen to voice note"}
        </button>
      )}
      {error && <p className="notice error" role="alert">{error}</p>}
    </div>
  );
}
