import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircleMore, Send } from "lucide-react";
import { db, message, rpc } from "./api";

type Thread = {
  id: string; username: string; name: string; avatar_url: string | null;
  status: "accepted" | "pending" | "declined"; incoming: boolean; blocked: boolean;
  blocked_by_me: boolean; unread: boolean; activity_at: string; latest: string;
};
type Message = { id: number; body: string; created_at: string; mine: boolean };
type ThreadData = { thread: Thread; messages: Message[] };
const clock = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});
const formatTime = (value: string) => clock.format(new Date(value));

function useMessageUpdates(member?: string) {
  const topic = useId();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!member || !db) return;
    const client = db;
    const refresh = () => setRevision((value) => value + 1);
    const channel = client.channel("dm-" + topic)
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_changes", filter: "member=eq." + member }, refresh)
      .subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });
    const poll = window.setInterval(() => { if (!document.hidden) refresh(); }, 20000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      void client.removeChannel(channel);
    };
  }, [member, topic]);
  return revision;
}

export function useMessageUnread(member?: string) {
  const revision = useMessageUpdates(member);
  const [count, setCount] = useState<{ member: string; unread: number }>();
  useEffect(() => {
    let active = true;
    if (member && db) void rpc<number>("dm_unread_count").then(
      (value) => { if (active) setCount({ member, unread: value }); },
      () => {},
    );
    return () => { active = false; };
  }, [member, revision]);
  return member && count?.member === member ? count.unread : 0;
}

export function MessagesLink({ unread, mobile = false }: { unread: number; mobile?: boolean }) {
  return (
    <NavLink
      className={mobile ? "messages-tab" : "icon messages-link"}
      aria-label={unread ? `Messages, ${unread} unread conversations` : "Messages"}
      to="/messages"
    >
      <span className="messages-icon">
        <MessageCircleMore size={24} strokeWidth={2.4} aria-hidden="true" />
        {unread > 0 && <span className="messages-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
      </span>
      {mobile && "Messages"}
    </NavLink>
  );
}

export function Messages({ member }: { member: string }) {
  const { id, username } = useParams();
  const [tab, setTab] = useState<"chats" | "requests">("chats");
  const revision = useMessageUpdates(member);
  const [rows, setRows] = useState<Thread[]>();
  const [more, setMore] = useState(false);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void rpc<Thread[]>("dm_inbox").then(
      (data) => {
        if (!active) return;
        setRows((previous) => {
          const top = data.slice(0, 30);
          const bottom = previous?.[29];
          const older = (previous ?? []).filter((row) => bottom &&
            (row.activity_at < bottom.activity_at || (row.activity_at === bottom.activity_at && row.id < bottom.id)));
          return [...top, ...older.filter((row) => !top.some((fresh) => fresh.id === row.id))];
        });
        setMore(data.length > 30);
        setLoadError("");
      },
      (reason) => { if (active) setLoadError(message(reason)); },
    );
    return () => { active = false; };
  }, [revision, retry]);

  async function moreRows() {
    const last = rows?.at(-1);
    if (!last || paging) return;
    setPaging(true);
    try {
      const data = await rpc<Thread[]>("dm_inbox", { p_before: last.activity_at, p_before_id: last.id });
      setRows((previous) => [...(previous || []), ...data.slice(0, 30).filter((row) => !previous?.some((old) => old.id === row.id))]);
      setMore(data.length > 30);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setPaging(false);
    }
  }

  const activeThread = Boolean(id || username);
  const visibleRows = rows?.filter((row) => tab === "chats" ? row.status === "accepted" : row.status === "pending");
  return (
    <section className="messages-layout" data-thread={activeThread} aria-label="Messages">
      <aside className="messages-inbox" aria-label="Inbox">
        <h1>Messages</h1>
        <Link className="text-button" to="/search">Find someone to message</Link>
        <div className="tabs" aria-label="Inbox filters">
          <button type="button" aria-pressed={tab === "chats"} onClick={() => setTab("chats")}>Chats</button>
          <button type="button" aria-pressed={tab === "requests"} onClick={() => setTab("requests")}>Requests</button>
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        {loadError && <ReadFailure error={loadError} retry={() => {
          setLoadError("");
          setRetry((value) => value + 1);
        }} />}
        {!rows && !loadError && <p role="status">Loading messages…</p>}
        {visibleRows?.length === 0 && <p className="muted">{tab === "chats" ? "No conversations yet." : "No message requests."}</p>}
        <ul className="dm-list">
          {visibleRows?.map((row) => (
            <li key={row.id}>
              <Link className="dm-inbox-link" aria-current={id === row.id ? "page" : undefined} to={"/messages/" + row.id}>
                <span className="avatar" aria-hidden="true">{row.avatar_url ? <img src={row.avatar_url} alt="" referrerPolicy="no-referrer" /> : row.name[0]}</span>
                <span className="dm-inbox-copy">
                  <strong>{row.name}{row.unread && <span className="dm-unread"> · Unread</span>}</strong>
                  <small>{row.status === "pending" && !row.incoming ? "Request sent · " : ""}{row.latest}</small>
                  <time dateTime={row.activity_at}>{formatTime(row.activity_at)}</time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {more && <button className="button secondary" type="button" disabled={paging} onClick={() => void moreRows()}>Load more conversations</button>}
      </aside>
      <div className="messages-content">
        {id ? <Conversation key={id} id={id} revision={revision} /> : username
          ? <NewConversation key={username} username={username} revision={revision} />
          : <p className="muted dm-prompt">Choose a conversation or find someone to message.</p>}
      </div>
    </section>
  );
}

function NewConversation({ username, revision }: { username: string; revision: number }) {
  const [person, setPerson] = useState<{ name: string; can_start: boolean; direct: boolean }>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    void rpc<{ id: string | null; name: string; can_start: boolean; direct: boolean }>("dm_open", { p_username: username }).then(
      (data) => {
        if (!active) return;
        setError("");
        if (data.id) navigate("/messages/" + data.id, { replace: true });
        else setPerson(data);
      },
      (reason) => { if (active) setError(message(reason)); },
    );
    return () => { active = false; };
  }, [navigate, revision, retry, username]);
  return (
    <section className="dm-thread">
      <Link className="back" to="/messages"><ArrowLeft size={16} /> Inbox</Link>
      <h1>{person?.name ?? "New message"}</h1>
      {error && <ReadFailure error={error} retry={() => {
        setError("");
        setRetry((value) => value + 1);
      }} />}
      {!person && !error && <p role="status">Opening conversation…</p>}
      {person && (person.can_start ? (
        <>
          {!person.direct && <p className="muted">You can send one request. They’ll need to accept before you can send another message.</p>}
          <MessageForm username={username} request={!person.direct} sent={(id) => navigate("/messages/" + id, { replace: true })} />
        </>
      ) : <p><Link to={"/u/" + username}>Follow @{username}</Link> before messaging.</p>)}
    </section>
  );
}

function MessageForm({ username, request, sent }: { username: string; request?: boolean; sent: (id: string) => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ body: string; nonce: string }>(undefined);
  return (
    <form className="form dm-compose" onSubmit={async (event) => {
      event.preventDefault();
      const text = body.trim();
      if (!text || busy) return;
      setBusy(true);
      setError("");
      if (attempt.current?.body !== text) attempt.current = { body: text, nonce: crypto.randomUUID() };
      try {
        const id = await rpc<string>("dm_send", { p_username: username, p_body: text, p_nonce: attempt.current.nonce });
        attempt.current = undefined;
        setBody("");
        sent(id);
      } catch (reason) {
        setError(message(reason));
      } finally {
        setBusy(false);
      }
    }}>
      {error && <p className="notice error" role="alert">{error}</p>}
      <label>Message<textarea value={body} onChange={(event) => setBody(event.target.value)} disabled={busy} maxLength={2000} rows={2} required /></label>
      <button className="button primary" disabled={busy || !body.trim()}><Send size={17} aria-hidden="true" /> {busy ? "Sending…" : request ? "Send request" : "Send"}</button>
    </form>
  );
}

function Conversation({ id, revision }: { id: string; revision: number }) {
  const [data, setData] = useState<ThreadData>();
  const [older, setOlder] = useState<Message[]>([]);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [marked, setMarked] = useState(0);
  const scroller = useRef<HTMLOListElement>(null);
  const last = data?.messages.at(-1)?.id;
  const thread = data?.thread;
  useEffect(() => {
    let active = true;
    void rpc<ThreadData>("dm_read", { p_id: id }).then(
      (value) => {
        if (!active) return;
        setLoadError("");
        setData({ ...value, messages: value.messages.slice(-40) });
        setMore(value.messages.length > 40);
      },
      (reason) => { if (active) setLoadError(message(reason)); },
    );
    return () => { active = false; };
  }, [id, revision, refresh]);

  useEffect(() => {
    if (!last) return;
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [last]);

  useEffect(() => {
    if (!thread?.unread || !last || last === marked || document.hidden) return;
    let active = true;
    void rpc("dm_mark_read", { p_id: id, p_seen: last }).then(
      () => { if (active) setMarked(last); },
      () => {},
    );
    return () => { active = false; };
  }, [id, last, marked, thread?.unread, revision]);

  async function act(action: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await rpc("dm_action", { p_id: id, p_action: action });
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  async function previous() {
    const before = (older[0] ?? data?.messages[0])?.id;
    if (!before || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await rpc<ThreadData>("dm_read", { p_id: id, p_before: before });
      setOlder((value) => [...result.messages.slice(-40), ...value]);
      setMore(result.messages.length > 40);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dm-thread">
      <Link className="back" to="/messages"><ArrowLeft size={16} /> Inbox</Link>
      {error && <p className="notice error" role="alert">{error}</p>}
      {loadError && <ReadFailure error={loadError} retry={() => {
        setLoadError("");
        setRefresh((value) => value + 1);
      }} />}
      {!thread ? (!loadError && <p role="status">Loading conversation…</p>) : (
        <>
          <h1>{thread.name}</h1>
          <div className="item-actions">
            <Link className="text-button" to={"/u/" + thread.username}>@{thread.username}</Link>
            <button className="text-button" type="button" disabled={busy} onClick={() => void act(thread.blocked_by_me ? "unblock" : "block")}>
              {thread.blocked_by_me ? "Unblock" : "Block"}
            </button>
          </div>
          {more && <button className="button secondary" type="button" disabled={busy} onClick={() => void previous()}>Load earlier messages</button>}
          <ol className="dm-messages" ref={scroller} aria-label="Conversation messages">
            {[...older, ...(data?.messages ?? [])].filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index)
              .sort((a, b) => a.id - b.id).map((item) => (
                <li key={item.id} data-mine={item.mine}>
                  <p className="dm-bubble">{item.body}</p>
                  <time dateTime={item.created_at}>{formatTime(item.created_at)}</time>
                  {!item.mine && <MessageReport id={item.id} />}
                </li>
              ))}
          </ol>
          {thread.blocked ? <p className="notice">Messaging is blocked in this conversation.</p> : thread.status === "accepted" ? (
            <MessageForm username={thread.username} sent={() => setRefresh((value) => value + 1)} />
          ) : thread.status === "declined" ? <p className="notice">This request was declined.</p> : thread.incoming ? (
            <div className="item-actions">
              <button className="button primary" disabled={busy} onClick={() => void act("accept")}>Accept request</button>
              <button className="button secondary" disabled={busy} onClick={() => void act("decline")}>Decline</button>
            </div>
          ) : <p className="notice">Request sent. Wait for them to accept.</p>}
        </>
      )}
    </section>
  );
}

function ReadFailure({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="notice error">
      <p role="alert">{error}</p>
      <button className="button secondary" type="button" onClick={retry}>Try again</button>
    </div>
  );
}

function MessageReport({ id }: { id: number }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details className="dm-report">
      <summary>Report message</summary>
      <form className="form" onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const reason = String(new FormData(event.currentTarget).get("reason") || "");
        setBusy(true);
        setStatus("");
        try {
          await rpc("dm_report", { p_message: id, p_reason: reason });
          setStatus("Report sent to moderators.");
        } catch (error) {
          setStatus(message(error));
        } finally {
          setBusy(false);
        }
      }}>
        <label>Reason<textarea name="reason" required minLength={3} maxLength={500} rows={2} /></label>
        <button className="button secondary" disabled={busy}>Send report</button>
        {status && <p role="status">{status}</p>}
      </form>
    </details>
  );
}

type Reported = { message_id: number; reporter: string; reason: string; created_at: string; body: string; sender: string };
export function MessageModeration() {
  const [rows, setRows] = useState<Reported[]>();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    void rpc<Reported[]>("dm_report_queue").then(
      (value) => { if (active) setRows(value); },
      (reason) => { if (active) setStatus(message(reason)); },
    );
    return () => { active = false; };
  }, [refresh]);
  return (
    <section className="narrow">
      <h2>Message reports</h2>
      {status && <p className="notice" role="status">{status}</p>}
      {!rows && !status && <p role="status">Loading message reports…</p>}
      {rows?.length === 0 && <p>No open message reports.</p>}
      {rows?.map((row) => (
        <article className="review" key={row.message_id + ":" + row.reporter}>
          <h3>Message from @{row.sender}</h3>
          <p className="prose-body">{row.body}</p>
          <p className="muted">{row.reason} · {formatTime(row.created_at)}</p>
          <form className="form" onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const form = new FormData(event.currentTarget);
            setBusy(true);
            setStatus("");
            try {
              await rpc("dm_resolve_report", { p_message: row.message_id, p_reporter: row.reporter, p_note: String(form.get("note")) });
              setStatus("Moderation action recorded.");
              setRefresh((value) => value + 1);
            } catch (reason) {
              setStatus(message(reason));
            } finally {
              setBusy(false);
            }
          }}>
            <label>Moderation note<textarea name="note" minLength={3} maxLength={500} required rows={2} /></label>
            <div className="item-actions">
              <button className="button secondary" disabled={busy}>Resolve</button>
            </div>
          </form>
        </article>
      ))}
    </section>
  );
}
