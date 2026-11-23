import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { db, message, rpc } from "./api";

type FollowState = { following: boolean; follows_you: boolean };
type Person = FollowState & { username: string; display_name: string; avatar_url: string | null };
type Counts = FollowState & { followers: number; following_count: number };
type Viewer = { username?: string; canFollow: boolean };

function Follow({ person, viewer, updated }: {
  person: FollowState & { username: string };
  viewer: Viewer;
  updated: (following: boolean) => void;
}) {
  const { pathname, search } = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (viewer.username === person.username) return null;
  const label = person.following ? "Following" : person.follows_you ? "Follow back" : "Follow";
  if (!viewer.canFollow) return <Link className="button secondary" to="/auth" state={{ next: pathname + search }}>Follow</Link>;
  return (
    <div>
      <button type="button" className="button secondary" aria-pressed={person.following} disabled={busy} onClick={async () => {
        setBusy(true);
        setError("");
        try {
          await rpc("set_profile_follow", { p_username: person.username, p_follow: !person.following });
          updated(!person.following);
        } catch (reason) {
          setError(message(reason));
        } finally {
          setBusy(false);
        }
      }}>{label}</button>
      {error && <p className="notice error" role="alert">{error}</p>}
    </div>
  );
}

export function ProfileConnections({ username, source, viewer }: { username: string; source: string; viewer: Viewer }) {
  const [state, setState] = useState<Counts>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (db) void rpc<Counts>("profile_follow_counts", { p_username: username }).then(
      (value) => { if (active) setState(value); },
      (reason) => { if (active) setError(message(reason)); },
    );
    return () => { active = false; };
  }, [username, viewer.username, viewer.canFollow]);
  if (error) return <p className="muted" role="status">Couldn’t load followers.</p>;
  if (!state) return null;
  const path = "/u/" + username;
  return (
    <div className="item-actions profile-connections">
      <Link className="text-button" to={path + "/followers"} state={{ fromProfile: source }}><strong>{state.followers}</strong> Followers</Link>
      <Link className="text-button" to={path + "/following"} state={{ fromProfile: source }}><strong>{state.following_count}</strong> Following</Link>
      <Follow person={{ ...state, username }} viewer={viewer} updated={(following) => {
        setState((current) => current && { ...current, following, followers: current.followers + (following ? 1 : -1) });
      }} />
    </div>
  );
}

export function People({ viewer, direction }: { viewer: Viewer; direction?: "followers" | "following" }) {
  const { username } = useParams();
  const [params, setParams] = useSearchParams();
  const { state } = useLocation();
  const input = params.get("q") ?? "";
  const query = input.trim();
  function updateSearch(value: string) {
    setParams(value ? { q: value } : {}, { replace: true, preventScrollReset: true });
  }
  const profile = direction && username ? "/u/" + username : "/";
  const back = state?.fromProfile === "/profile" && username === viewer.username ? "/profile" : profile;
  const title = direction ? direction === "followers" ? "Followers" : "Following" : "Search people";
  const key = JSON.stringify([query, username, direction, viewer.username, viewer.canFollow]);
  return (
    <section className="narrow">
      <Link className="back" to={back}>← {direction ? "Back to profile" : "The Square"}</Link>
      <h1>{title}</h1>
      {!direction && (
        <form className="form live-people-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="people-query">Display name or username</label>
          <div className="people-query-field">
            <Search size={19} aria-hidden="true" />
            <input
              id="people-query"
              type="search"
              value={input}
              onChange={(event) => updateSearch(event.currentTarget.value)}
              maxLength={60}
              placeholder="e.g. @survive9ja"
              autoComplete="off"
              spellCheck={false}
            />
            {input && (
              <button className="icon people-clear" type="button" aria-label="Clear search" onClick={(event) => {
                event.currentTarget.parentElement?.querySelector("input")?.focus();
                updateSearch("");
              }}><X size={18} aria-hidden="true" /></button>
            )}
          </div>
        </form>
      )}
      {!direction && query.replace(/^@+/, "").length < 2 ? (
        <p className="muted">Enter at least two characters to find a member.</p>
      ) : (
        <PeopleList key={key} query={query} username={username} direction={direction} viewer={viewer} />
      )}
    </section>
  );
}

function PeopleList({ query, username, direction, viewer }: { query: string; username?: string; direction?: string; viewer: Viewer }) {
  const [rows, setRows] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!db) return;
      void rpc<Person[]>("browse_people", { p_query: query, p_username: username ?? null, p_direction: direction ?? null }).then(
        (data) => { if (active) { setRows(data.slice(0, 20)); setMore(data.length > 20); } },
        (reason) => { if (active) setError(message(reason)); },
      ).finally(() => { if (active) setLoading(false); });
    }, direction ? 0 : 240);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, username, direction, retry]);
  if (!db) return <p className="notice">People search and following require the community database.</p>;
  return (
    <>
      {error && (
        <div className="notice error">
          <p role="alert">{error}</p>
          {!rows.length && <button className="button secondary" type="button" onClick={() => {
            setError("");
            setLoading(true);
            setRetry((value) => value + 1);
          }}>Try again</button>}
        </div>
      )}
      {loading && <p role="status">{direction ? "Loading people…" : "Finding people…"}</p>}
      {!loading && !error && rows.length === 0 && <p className="muted">{direction ? "No members in this list yet." : "No matching members."}</p>}
      {!loading && !error && !direction && rows.length > 0 && <p className="sr-only" role="status">{rows.length} matching {rows.length === 1 ? "person" : "people"}</p>}
      <ul className="people-list">
        {rows.map((person) => (
          <li key={person.username} className="people-row">
            <Link to={"/u/" + person.username} className="person-identity">
              <span className="avatar" aria-hidden="true">
                {person.avatar_url ? <img src={person.avatar_url} alt="" referrerPolicy="no-referrer" /> : person.display_name[0]?.toUpperCase()}
              </span>
              <span><strong>{person.display_name}</strong><small>@{person.username}</small></span>
            </Link>
            <Follow person={person} viewer={viewer} updated={(following) => {
              setRows((previous) => previous.map((row) => row.username === person.username ? { ...row, following } : row));
            }} />
          </li>
        ))}
      </ul>
      {more && <button className="button secondary" disabled={loading} onClick={async () => {
        setLoading(true);
        setError("");
        try {
          const data = await rpc<Person[]>("browse_people", {
            p_query: query, p_username: username ?? null, p_direction: direction ?? null,
            p_after: rows.at(-1)?.username,
          });
          setRows((previous) => [...previous, ...data.slice(0, 20)]);
          setMore(data.length > 20);
        } catch (reason) {
          setError(message(reason));
        } finally {
          setLoading(false);
        }
      }}>Load more people</button>}
    </>
  );
}
