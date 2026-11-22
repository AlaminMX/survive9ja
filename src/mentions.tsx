import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { db, rpc } from "./api";

type Member = { username: string; display_name: string };
type Token = { start: number; end: number; prefix: string };

function tokenAtCaret(field: HTMLTextAreaElement): Token | null {
  if (field.selectionStart !== field.selectionEnd) return null;
  const caret = field.selectionStart;
  const match = field.value.slice(0, caret).match(/(?:^|[\s([{"“‘])@([a-z0-9_]{2,20})$/i);
  if (!match) return null;
  const tail = field.value.slice(caret).match(/^[a-z0-9_]*/i)?.[0] ?? "";
  return { start: caret - match[1].length - 1, end: caret + tail.length, prefix: match[1].toLowerCase() };
}

export function MentionText({ text }: { text: string }) {
  const parts = text.split(/(?<![^\s([{"“‘])(@[a-z0-9_]{3,20})(?![\p{L}\p{N}_@])/giu);
  return <>{parts.map((part, index) =>
    index % 2 === 0 ? part : (
      <Link className="mention-link" to={"/u/" + part.slice(1).toLowerCase()} key={index}>
        {part}
      </Link>
    )
  )}</>;
}

export function MentionField({
  label,
  accessory,
  id,
  ...props
}: Omit<ComponentProps<"textarea">, "ref"> & { label: string; accessory?: ReactNode }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const field = useRef<HTMLTextAreaElement>(null);
  const [token, setToken] = useState<Token | null>(null);
  const prefix = token?.prefix;
  const [result, setResult] = useState<{ prefix: string; members: Member[] }>();
  const [selected, setSelected] = useState<number | null>(null);
  const members = token && result && result.prefix === prefix ? result.members : [];
  const suggestionsId = fieldId + "-mentions";

  useEffect(() => {
    if (!db || !prefix) return;
    let current = true;
    const timer = window.setTimeout(() => {
      void rpc<Member[]>("search_mention_members", { p_prefix: prefix }).then(
        (members) => { if (current) setResult({ prefix, members }); },
        () => { if (current) setResult({ prefix, members: [] }); },
      );
    }, 180);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [prefix]);

  function updateToken() {
    if (!field.current) return;
    setToken(tokenAtCaret(field.current));
    setSelected(null);
  }

  function insert(member: Member) {
    const input = field.current;
    if (!token || !input) return;
    const suffix = input.value.slice(token.end);
    const replacement = "@" + member.username + (!suffix || /^[\p{L}\p{N}_@]/u.test(suffix) ? " " : "");
    if (input.maxLength >= 0 && input.value.length - (token.end - token.start) + replacement.length > input.maxLength) return;
    input.focus();
    input.setRangeText(replacement, token.start, token.end, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    setToken(null);
    setSelected(null);
  }

  return (
    <div className="mention-field" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setToken(null);
    }}>
      <label htmlFor={fieldId}>{label}</label>
      <div className={accessory ? "mention-surface has-accessory" : "mention-surface"}>
        <textarea
          {...props}
          id={fieldId}
          ref={field}
          aria-describedby={fieldId + "-hint"}
          aria-controls={members.length ? suggestionsId : undefined}
          onChange={(event) => { if (!(event.nativeEvent instanceof InputEvent && event.nativeEvent.isComposing)) updateToken(); }}
          onCompositionEnd={updateToken}
          onClick={updateToken}
          onKeyUp={(event) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) updateToken();
          }}
          onKeyDown={(event) => {
            if (!members.length || event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              event.preventDefault();
              setToken(null);
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setSelected((value) => ((value ?? (step > 0 ? -1 : 0)) + step + members.length) % members.length);
            } else if (event.key === "Enter" && selected !== null && members[selected]) {
              event.preventDefault();
              insert(members[selected]);
            }
          }}
        />
        {accessory}
      </div>
      <small className="muted" id={fieldId + "-hint"}>Type @ and two letters of a username to mention someone.</small>
      {members.length > 0 && (
        <>
          <span className="sr-only" role="status">
            {selected === null
              ? `${members.length} suggestions. Use the arrow keys to choose or Tab to browse.`
              : `${members[selected]?.display_name}, @${members[selected]?.username}`}
          </span>
          <ul className="mention-suggestions" id={suggestionsId} aria-label="Suggested members">
            {members.map((member, index) => (
              <li key={member.username}>
                <button
                  className="text-button mention-option"
                  type="button"
                  data-selected={index === selected}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insert(member)}
                >
                  <strong>{member.display_name}</strong>
                  <span>@{member.username}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
