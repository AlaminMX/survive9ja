import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
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
  const query = params.get("q") ?? "";
  const profile = direction && username ? "/u/" + username : "/";
  const back = state?.fromProfile === "/profile" && username === viewer.username ? "/profile" : profile;
  const title = direction ? direction === "followers" ? "Followers" : "Following" : "Search people";
  const key = JSON.stringify([query, username, direction, viewer.username, viewer.canFollow]);
  return (
    <section className="narrow">
      <Link className="back" to={back}>← {direction ? "Back to profile" : "The Square"}</Link>
      <h1>{title}</h1>
      {!direction && (
        <form className="form circle-search" key={query} onSubmit={(event) => {
          event.preventDefault();
          const term = String(new FormData(event.currentTarget).get("q") ?? "").trim();
          setParams(term ? { q: term } : {});
        }}>
          <label>Display name or username<input name="q" type="search" maxLength={60} defaultValue={query} placeholder="e.g. @survive9ja" /></label>
          <button className="button primary">Search</button>
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
  useEffect(() => {
    let active = true;
    if (db) void rpc<Person[]>("browse_people", { p_query: query, p_username: username ?? null, p_direction: direction ?? null }).then(
      (data) => { if (active) { setRows(data.slice(0, 20)); setMore(data.length > 20); } },
      (reason) => { if (active) setError(message(reason)); },
    ).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, username, direction]);
  if (!db) return <p className="notice">People search and following require the community database.</p>;
  return (
    <>
      {error && <p className="notice error" role="alert">{error}</p>}
      {loading && <p role="status">Loading people…</p>}
      {!loading && !error && rows.length === 0 && <p className="muted">{direction ? "No members in this list yet." : "No matching members."}</p>}
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
