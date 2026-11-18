import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { db } from "./api";

const bucket = "survive9ja-avatars";
const avatarSize = 512;
const maxFileSize = 10 * 1024 * 1024;
const accepted = ["image/jpeg", "image/png", "image/webp"];

export type AvatarChange =
  | { kind: "keep" }
  | { kind: "remove" }
  | { kind: "replace"; blob: Blob; preview: string };

export async function uploadAvatar(accountId: string, blob: Blob) {
  if (!db) throw new Error("Photo upload requires a connected account.");
  const storage = db.storage.from(bucket);
  const path = accountId + "/" + crypto.randomUUID() + ".jpg";
  const { error } = await storage.upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "3600",
  });
  if (error) {
    throw new Error(
      /bucket not found/i.test(error.message)
        ? "Photo uploads are unavailable until the profile photo storage is set up."
        : "Couldn’t upload your photo. " + error.message,
    );
  }
  return storage.getPublicUrl(path).data.publicUrl;
}

type Crop = { zoom: number; horizontal: number; vertical: number };
const centered: Crop = { zoom: 1, horizontal: 50, vertical: 50 };

function draw(canvas: HTMLCanvasElement, image: HTMLImageElement, crop: Crop) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const scale =
    Math.max(
      avatarSize / image.naturalWidth,
      avatarSize / image.naturalHeight,
    ) * crop.zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const left = ((avatarSize - width) * crop.horizontal) / 100;
  const top = ((avatarSize - height) * crop.vertical) / 100;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, avatarSize, avatarSize);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, left, top, width, height);
}

export function AvatarEditor({
  existing,
  value,
  onChange,
  onPending,
  disabled = false,
}: {
  existing?: string | null;
  value: AvatarChange;
  onChange: (value: AvatarChange) => void;
  onPending: (pending: boolean) => void;
  disabled?: boolean;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState(centered);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const selection = useRef(0);
  const shown =
    value.kind === "replace"
      ? value.preview
      : value.kind === "keep"
        ? existing
        : null;

  useEffect(() => {
    if (canvas.current && image) draw(canvas.current, image, crop);
  }, [image, crop]);

  async function choose(file: File) {
    const request = ++selection.current;
    setError("");
    if (!accepted.includes(file.type)) {
      setError("Choose a JPG, PNG or WebP photo.");
      return;
    }
    if (file.size > maxFileSize) {
      setError("Choose a photo smaller than 10 MB.");
      return;
    }
    onPending(true);
    setBusy(true);
    const url = URL.createObjectURL(file);
    const source = new Image();
    try {
      source.src = url;
      await source.decode();
      if (request !== selection.current) return;
      setCrop(centered);
      setImage(source);
    } catch {
      if (request === selection.current) {
        setError("This photo couldn’t be opened. Try another image.");
        onPending(Boolean(image));
      }
    } finally {
      URL.revokeObjectURL(url);
      if (request === selection.current) setBusy(false);
    }
  }

  function apply() {
    const frame = canvas.current;
    if (!frame || !image) return;
    draw(frame, image, crop);
    const preview = frame.toDataURL("image/jpeg", 0.86);
    setBusy(true);
    frame.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) {
          setError("Couldn’t prepare the crop. Try a different photo.");
          return;
        }
        onChange({
          kind: "replace",
          blob,
          preview,
        });
        setImage(null);
        onPending(false);
      },
      "image/jpeg",
      0.86,
    );
  }

  return (
    <fieldset className="avatar-editor" disabled={disabled}>
      <legend>Profile photo · optional</legend>
      <p>Your photo is public and appears in a circular frame.</p>
      {!image && shown && (
        <img
          className="avatar-crop-preview"
          src={shown}
          alt="Profile photo preview"
          referrerPolicy="no-referrer"
        />
      )}
      <label className="avatar-picker">
        <span>
          <ImagePlus size={18} /> Choose an image
        </span>
        <input
          type="file"
          accept={accepted.join(",")}
          disabled={busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void choose(file);
          }}
        />
      </label>
      <small>JPG, PNG or WebP, up to 10 MB.</small>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {image && (
        <div className="avatar-crop">
          <canvas
            ref={canvas}
            className="avatar-crop-preview"
            width={avatarSize}
            height={avatarSize}
            role="img"
            aria-label="Circular profile photo crop preview"
          />
          <label>
            Zoom
            <input
              type="range"
              disabled={busy}
              min={1}
              max={3}
              step={0.05}
              value={crop.zoom}
              onChange={(event) =>
                setCrop({ ...crop, zoom: event.target.valueAsNumber })
              }
            />
          </label>
          <label>
            Horizontal position
            <input
              type="range"
              disabled={busy}
              min={0}
              max={100}
              value={crop.horizontal}
              onChange={(event) =>
                setCrop({ ...crop, horizontal: event.target.valueAsNumber })
              }
            />
          </label>
          <label>
            Vertical position
            <input
              type="range"
              disabled={busy}
              min={0}
              max={100}
              value={crop.vertical}
              onChange={(event) =>
                setCrop({ ...crop, vertical: event.target.valueAsNumber })
              }
            />
          </label>
          <div className="item-actions">
            <button
              className="button primary"
              type="button"
              disabled={busy}
              onClick={apply}
            >
              Use this crop
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                setImage(null);
                setError("");
                onPending(false);
              }}
            >
              Cancel crop
            </button>
          </div>
        </div>
      )}
      {!image && shown && (
        <button
          className="button secondary"
          type="button"
          disabled={busy}
          onClick={() => onChange({ kind: "remove" })}
        >
          Remove photo
        </button>
      )}
      {value.kind === "replace" && !image && (
        <small>Crop ready. Save your profile to upload it.</small>
      )}
    </fieldset>
  );
}
