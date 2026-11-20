import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Activity, ShieldCheck, UsersRound } from "lucide-react";
import { message, rpc } from "./api";

type AccountRow = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  verified: boolean;
  onboarded: boolean;
  admin: boolean;
  moderator: boolean;
  banned: boolean;
  has_session: boolean;
};
type HistoryRow = {
  id: number;
  actor: string | null;
  action: string;
  target_id: string;
  note: string;
  created_at: string;
};
const metrics = [
  ["accounts", "Created accounts"], ["new_week", "Signups in 7 days"],
  ["sessions", "Accounts with open sessions"], ["verified", "Verified emails"],
  ["onboarded", "Completed profiles"], ["moderators", "Moderators"],
  ["gists", "Visible gists"], ["diaries", "Visible diaries"], ["open_reports", "Open content reports"],
] as const;
type Stats = Record<(typeof metrics)[number][0], number>;
type Role = "admin" | "moderator" | null;
const pageSize = 25;
const stamp = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos",
});
const date = (value: string | null) => value ? stamp.format(new Date(value)) : "Never";

export function AdminDashboard({ token, moderation }: { token: string; moderation: ReactNode }) {
  const [role, setRole] = useState<Role>();
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"accounts" | "moderation" | "history">("accounts");
  useEffect(() => {
    let current = true;
    void rpc<Role>("admin_access").then(
      (value) => { if (current) setRole(value); },
      (reason) => { if (current) setError(message(reason)); },
    );
    return () => { current = false; };
  }, [token]);

  return (
    <div className="admin-dashboard narrow">
      <Link className="back" to="/">← The Square</Link>
      <header className="admin-heading">
        <ShieldCheck aria-hidden="true" size={29} />
        <h1>{role === "moderator" ? "Moderation dashboard" : "Admin dashboard"}</h1>
      </header>
      {error && <p className="notice error" role="alert">{error}</p>}
      {role === undefined && !error && <p role="status">Checking dashboard access…</p>}
      {role === null && <p className="notice">This dashboard requires an administrator or moderator account.</p>}
      {role === "moderator" && moderation}
      {role === "admin" && (
        <>
          <nav className="tabs" aria-label="Dashboard sections">
            <button aria-pressed={tab === "accounts"} onClick={() => setTab("accounts")}><UsersRound size={16} /> Accounts</button>
            <button aria-pressed={tab === "moderation"} onClick={() => setTab("moderation")}><ShieldCheck size={16} /> Moderation</button>
            <button aria-pressed={tab === "history"} onClick={() => setTab("history")}><Activity size={16} /> Audit log</button>
          </nav>
          {tab === "accounts" && <Accounts token={token} />}
          {tab === "moderation" && moderation}
          {tab === "history" && <AuditLog />}
        </>
      )}
    </div>
  );
}

function Accounts({ token }: { token: string }) {
  const [stats, setStats] = useState<Stats>();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<AccountRow | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let current = true;
    void rpc<Stats>("admin_account_stats").then(
      (data) => { if (current) setStats(data); },
      (reason) => { if (current) setError(message(reason)); },
    );
    return () => { current = false; };
  }, [revision]);
  useEffect(() => {
    let current = true;
    void rpc<AccountRow[]>("admin_accounts", { p_query: query, p_sessions_only: sessions }).then(
      (data) => {
        if (!current) return;
        setAccounts(data.slice(0, pageSize));
        setMore(data.length > pageSize);
        setLoading(false);
      },
      (reason) => {
        if (!current) return;
        setError(message(reason));
        setLoading(false);
      },
    );
    return () => { current = false; };
  }, [query, sessions, revision]);

  async function loadMore() {
    const last = accounts.at(-1);
    if (!last || busy) return;
    setBusy(true);
    setError("");
    try {
      const rows = await rpc<AccountRow[]>("admin_accounts", {
        p_query: query, p_sessions_only: sessions, p_before_date: last.created_at, p_before_id: last.id,
      });
      setAccounts((previous) => [...previous, ...rows.slice(0, pageSize)]);
      setMore(rows.length > pageSize);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  async function updateRole(row: AccountRow) {
    if (busy) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await rpc("admin_set_moderator", { p_target: row.id, p_grant: !row.moderator });
      setInfo(row.moderator ? "Moderator access removed." : "Moderator access granted.");
      setRevision((value) => value + 1);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  const [deleteError, setDeleteError] = useState("");
  async function remove(form: HTMLFormElement) {
    if (busy || !target) return;
    const fields = new FormData(form);
    if (fields.get("confirm") !== "DELETE") {
      setDeleteError("Type DELETE to confirm.");
      return;
    }
    setBusy(true);
    setDeleteError("");
    setInfo("");
    try {
      const response = await fetch("/api/admin/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          target: target.id,
          note: String(fields.get("note") || "").trim(),
          confirmation: fields.get("confirm"),
        }),
      });
      const result = await response.json().catch(() => null) as { deleted?: boolean; error?: string } | null;
      if (!response.ok || !result?.deleted) throw Error(result?.error || "Account deletion is unavailable. Try again.");
      setAccounts((rows) => rows.filter((row) => row.id !== target.id));
      setInfo("Account deleted.");
      dialog.current?.close();
      setRevision((value) => value + 1);
    } catch (reason) {
      setDeleteError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Platform overview</h2>
      {stats && (
        <dl className="admin-stats">
          {metrics.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{stats[key].toLocaleString("en-NG")}</dd></div>)}
        </dl>
      )}
      <section aria-labelledby="admin-accounts-title">
        <h2 id="admin-accounts-title" tabIndex={-1}>Accounts</h2>
        <p className="muted">Open sessions are Supabase sign-ins with a session record that has no expiry timestamp or expires in the future. People with an open session may be offline.</p>
        <form className="form admin-search" onSubmit={(event) => {
          event.preventDefault();
          const next = String(new FormData(event.currentTarget).get("account-query") || "").trim();
          if (next === query) return;
          setError("");
          setLoading(true);
          setQuery(next);
        }}>
          <label>Search by email, name or username
            <input name="account-query" type="search" maxLength={254} />
          </label>
          <button className="button secondary" disabled={busy || loading}>Search</button>
        </form>
        <div className="tabs" aria-label="Account filter">
          {([false, true] as const).map((filter) => (
            <button key={String(filter)} aria-pressed={sessions === filter} disabled={busy || loading} onClick={() => {
              if (sessions === filter) return;
              setError("");
              setLoading(true);
              setSessions(filter);
            }}>{filter ? "Open sessions" : "All created accounts"}</button>
          ))}
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        {info && <p className="notice" role="status">{info}</p>}
        {loading ? <p role="status">Loading accounts…</p> : accounts.length === 0 ? <p>No accounts match this view.</p> : (
          <ul className="admin-account-list">
            {accounts.map((row) => (
              <li key={row.id} className="admin-account">
                <div>
                  <h3>{row.display_name || row.username || "Profile setup incomplete"}</h3>
                  {row.username && <Link to={"/u/" + row.username}>@{row.username}</Link>}
                  <p>{row.email || "No email saved"}</p>
                  <p className="muted">
                    {row.admin ? "Administrator" : row.moderator ? "Moderator" : "Member"} · {row.verified ? "Email verified" : "Email unverified"} · {row.onboarded ? "Profile complete" : "Onboarding incomplete"}
                    {row.banned ? " · Banned" : ""}{row.has_session ? " · Open session" : ""}
                  </p>
                </div>
                <dl className="admin-account-dates">
                  <div><dt>Created</dt><dd>{date(row.created_at)}</dd></div>
                  <div><dt>Last sign-in</dt><dd>{date(row.last_sign_in_at)}</dd></div>
                </dl>
                {!row.admin && (
                  <div className="item-actions">
                    {(row.moderator || (row.verified && row.onboarded)) && (
                      <button className="button secondary" disabled={busy} onClick={() => void updateRole(row)}>
                        {row.moderator ? "Remove moderator" : "Make moderator"}
                      </button>
                    )}
                    <button className="button secondary admin-danger" disabled={busy} onClick={(event) => {
                      trigger.current = event.currentTarget;
                      setTarget(row);
                      setDeleteError("");
                      dialog.current?.showModal();
                    }}>Delete account</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {!loading && more && <button className="button secondary" disabled={busy} onClick={() => void loadMore()}>Load more accounts</button>}
      </section>
      <dialog ref={dialog} aria-labelledby="admin-delete-title" onCancel={(event) => {
        if (busy) event.preventDefault();
      }} onClose={() => {
        setTarget(null);
        if (trigger.current?.isConnected) trigger.current.focus();
        else document.getElementById("admin-accounts-title")?.focus();
      }}>
        <h2 id="admin-delete-title">Permanently delete account?</h2>
        {target && (
          <form key={target.id} className="form" onSubmit={(event) => {
            event.preventDefault();
            void remove(event.currentTarget);
          }}>
            <p>{target.email || target.username || "This account"} will lose access. Its profile, posts, attached replies, and owned content will be removed. This cannot be undone.</p>
            {deleteError && <p className="notice error" role="alert">{deleteError}</p>}
            <label>Reason for deletion<textarea name="note" rows={3} required minLength={3} maxLength={500} /></label>
            <label>Type DELETE to confirm<input name="confirm" required autoComplete="off" /></label>
            <div className="item-actions">
              <button type="button" className="button secondary" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button>
              <button className="button primary" disabled={busy}>{busy ? "Deleting…" : "Permanently delete"}</button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

function AuditLog() {
  const [rows, setRows] = useState<HistoryRow[]>();
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    void rpc<HistoryRow[]>("admin_account_history").then(
      (data) => { if (current) setRows(data); },
      (reason) => { if (current) setError(message(reason)); },
    );
    return () => { current = false; };
  }, []);
  const actions: Record<string, string> = {
    grant_moderator: "Granted moderator access",
    remove_moderator: "Removed moderator access",
    delete_account: "Deleted account",
  };
  return (
    <section aria-labelledby="admin-audit-title">
      <h2 id="admin-audit-title">Recent account actions</h2>
      {error && <p className="notice error" role="alert">{error}</p>}
      {!rows && !error && <p role="status">Loading audit log…</p>}
      {rows?.length === 0 && <p>No account actions recorded yet.</p>}
      <ul className="admin-account-list">
        {rows?.map((row) => (
          <li className="admin-account" key={row.id}>
            <strong>{actions[row.action] || row.action}</strong>
            <p>{row.note}</p>
            <p className="muted">{date(row.created_at)} · {row.actor ? "@" + row.actor : "Administrator"}</p>
            <code>{row.target_id}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}
