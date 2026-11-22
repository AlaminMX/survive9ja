import { useEffect, useId, useRef, useState } from "react";
import { Mic, Upload } from "lucide-react";
import { db, message } from "./api";

export const voiceBucket = "gist-voice-notes";
const maxSeconds = 60;
const maxBytes = 2 * 1024 * 1024;
const types = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/aac", "audio/x-m4a"];
const extensionTypes: Record<string, string> = {
  webm: "audio/webm", mp4: "audio/mp4", m4a: "audio/mp4", ogg: "audio/ogg", opus: "audio/ogg",
  mp3: "audio/mpeg", wav: "audio/wav", aac: "audio/aac",
};
const recordingTypes = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];

function checkSize(clip: Blob) {
  if (!clip.size) throw Error("The audio clip is empty.");
  if (clip.size > maxBytes) throw Error("Choose an audio clip under 2 MB.");
}

async function checkUpload(file: File) {
  checkSize(file);
  const type = extensionTypes[file.name.split(".").at(-1)?.toLowerCase() || ""] || file.type;
  if (!types.includes(type)) throw Error("Choose an MP3, M4A, WAV, WebM, Ogg or AAC audio file.");
  const clip = file.slice(0, file.size, type);
  const audio = new Audio();
  const url = URL.createObjectURL(clip);
  try {
    await new Promise<void>((resolve, reject) => {
      function finish(error?: Error) {
        window.clearTimeout(timeout);
        audio.onloadedmetadata = null;
        audio.onerror = null;
        if (error) reject(error);
        else resolve();
      }
      const timeout = window.setTimeout(() => finish(Error("This browser couldn’t read the audio. Try an MP3 or M4A file.")), 8000);
      audio.onloadedmetadata = () => {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0)
          finish(Error("This clip needs a readable duration. Try an MP3 or M4A file."));
        else if (audio.duration > maxSeconds)
          finish(Error("Choose a clip that lasts one minute or less."));
        else finish();
      };
      audio.onerror = () => finish(Error("This browser couldn’t play the file. Try an MP3 or M4A file."));
      audio.preload = "metadata";
      audio.src = url;
    });
    return clip;
  } finally {
    audio.removeAttribute("src");
    audio.load();
    URL.revokeObjectURL(url);
  }
}

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
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const microphone = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number>(undefined);
  const mounted = useRef(false);
  const [state, setState] = useState<"idle" | "starting" | "recording" | "checking">("idle");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const canRecord = typeof navigator.mediaDevices?.getUserMedia === "function" && typeof MediaRecorder !== "undefined";

  function release() {
    window.clearInterval(timer.current);
    microphone.current?.getTracks().forEach((track) => track.stop());
    microphone.current = null;
    recorder.current = null;
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      microphone.current = stream;
      const mimeType = recordingTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const capture = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 48000 });
      recorder.current = capture;
      const chunks: Blob[] = [];
      capture.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
      capture.onerror = () => {
        capture.onstop = null;
        release();
        setError("The recording stopped unexpectedly. Try recording again or upload a clip.");
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
          if (!types.includes(type)) throw Error("This browser’s recording format is unsupported. Upload an audio file instead.");
          const recorded = new Blob(chunks, { type });
          checkSize(recorded);
          onChange(recorded);
        } catch (reason) {
          setError(message(reason));
        }
      };
      capture.start();
      setSeconds(0);
      setState("recording");
      timer.current = window.setInterval(() => {
        const elapsed = Math.min(maxSeconds, Math.floor((performance.now() - started) / 1000));
        setSeconds(elapsed);
        if (elapsed >= maxSeconds && capture.state === "recording") capture.stop();
      }, 250);
    } catch {
      release();
      if (!mounted.current) return;
      setError("Couldn’t start the microphone. Check browser permissions or upload a clip.");
      setState("idle");
      onBusy(false);
    }
  }

  async function upload(file: File) {
    setState("checking");
    onBusy(true);
    setError("");
    try {
      const validated = await checkUpload(file);
      if (mounted.current) onChange(validated);
    } catch (reason) {
      if (mounted.current) setError(message(reason));
    } finally {
      if (mounted.current) {
        setState("idle");
        onBusy(false);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        className="voice-trigger"
        aria-label={clip ? "Manage attached voice note" : "Add voice note"}
        aria-expanded={open}
        aria-controls={panelId}
        title={clip ? "Voice note attached" : "Add voice note"}
        data-attached={Boolean(clip)}
        disabled={disabled || state !== "idle"}
        onClick={() => setOpen(!open)}
      >
        <Mic size={19} aria-hidden="true" />
      </button>
      <fieldset className="voice-composer" id={panelId} hidden={!open}>
      <legend>Voice note</legend>
      <p className="muted">Up to 1 minute and 2 MB. Add a written summary if you like.</p>
      {error && <p className="notice error" role="alert">{error}</p>}
      {state === "idle" && clip && <LocalAudio clip={clip} label="Preview your voice note" />}
      <div className="item-actions">
        {state === "recording" ? (
          <button type="button" className="button secondary" onClick={() => {
            if (recorder.current?.state === "recording") recorder.current.stop();
          }}>Stop recording · {seconds}s</button>
        ) : (
          <>
            {canRecord && (
              <button type="button" className="button secondary" disabled={disabled || state !== "idle"} onClick={() => void record()}>
                <Mic size={16} aria-hidden="true" /> {state === "starting" ? "Opening microphone…" : "Record"}
              </button>
            )}
            <label className="voice-upload button secondary">
              <Upload size={16} aria-hidden="true" /> {state === "checking" ? "Checking audio…" : "Upload audio"}
              <input type="file" accept="audio/*,.m4a,.webm,.mp3,.opus" disabled={disabled || state !== "idle"} onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void upload(file);
              }} />
            </label>
            {clip && (
              <button type="button" className="text-button" disabled={disabled || state !== "idle"} onClick={() => {
                setError("");
                onChange(null);
              }}>Remove audio</button>
            )}
          </>
        )}
      </div>
      </fieldset>
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
