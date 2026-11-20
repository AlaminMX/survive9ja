import { useId, useRef, useState } from "react";
import { Share2 } from "lucide-react";

export function ShareConversation({ path, title }: { path: string; title: string }) {
  const heading = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState("");
  const url = new URL(path, window.location.origin).href;
  const whatsapp = "https://wa.me/?text=" + encodeURIComponent(title + "\n" + url);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      input.current?.focus();
      input.current?.select();
      setStatus("Link selected. Copy it using your device’s copy command.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title, url });
      dialog.current?.close();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setStatus("Device sharing is unavailable. You can still copy the link or use WhatsApp.");
      }
    }
  }

  return (
    <>
      <button
        type="button"
        ref={trigger}
        className="text-button share-trigger"
        aria-haspopup="dialog"
        aria-label={`Share: ${title}`}
        onClick={() => {
          setStatus("");
          dialog.current?.showModal();
        }}
      >
        <Share2 size={16} aria-hidden="true" /> Share
      </button>
      <dialog
        ref={dialog}
        className="share-dialog"
        aria-labelledby={heading}
        onClose={() => trigger.current?.focus()}
      >
        <h2 id={heading}>Share this conversation</h2>
        <label>
          Conversation link
          <input ref={input} value={url} readOnly />
        </label>
        <div className="share-actions">
          <button className="button primary" type="button" onClick={() => void copy()}>
            Copy link
          </button>
          <a className="button secondary" href={whatsapp} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          {typeof navigator.share === "function" && (
            <button className="button secondary" type="button" onClick={() => void share()}>
              More options
            </button>
          )}
          <button className="text-button" type="button" onClick={() => dialog.current?.close()}>
            Close
          </button>
        </div>
        <p className="muted share-status" role="status">{status}</p>
      </dialog>
    </>
  );
}
