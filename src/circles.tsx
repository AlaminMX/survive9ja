import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, MessageCircle, Plus, UsersRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { db, message, rpc } from "./api";
import { categories, type Entry } from "./data";
import { MentionField } from "./mentions";

type Circle = {
  slug: string;
  name: string;
  description: string;
  starter: boolean;
  following: boolean;
  owned: boolean;
};
type CircleResult = { circle: Circle; posts: Entry[] };

function useCircles(following = false, query = "", revision = 0) {
  const [state, setState] = useState<{ rows?: Circle[]; error?: string }>({});
  useEffect(() => {
    if (!db) return;
    let active = true;
    void rpc<Circle[]>("circle_directory", {
      p_following: following,
      p_query: query,
    }).then(
      (rows) => {
        if (active) setState({ rows });
      },
      (error) => {
        if (active) setState({ error: message(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [following, query, revision]);
  return state;
}

function CircleShell({
  title,
  back = "/",
  children,
}: {
  title: string;
  back?: string;
  children: ReactNode;
}) {
  return (
    <section className="narrow circles-page">
      <Link className="back" to={back}>
        <ArrowLeft size={16} /> {back === "/" ? "The Gist" : "All Circles"}
      </Link>
      <h1>{title}</h1>
      {children}
    </section>
  );
}

export function CirclesDirectory({ member }: { member: boolean }) {
  const [query, setQuery] = useState("");
  const [following, setFollowing] = useState(false);
  const { rows, error } = useCircles(following && member, query);
  const [created, setCreated] = useState<{ rows?: Circle[]; error?: string }>({});
  useEffect(() => {
    if (!db || !member) return;
    let active = true;
    void rpc<Circle[]>("my_created_circles").then(
      (rows) => { if (active) setCreated({ rows }); },
      (reason) => { if (active) setCreated({ error: message(reason) }); },
    );
    return () => { active = false; };
  }, [member]);

  return (
    <CircleShell title="Circles">
      {member && (
        <section className="circle-created" aria-labelledby="created-circles">
          <h2 id="created-circles">Your Circles</h2>
          {created.error ? (
            <p className="notice error" role="alert">{created.error}</p>
          ) : !created.rows ? (
            <p role="status">Loading your Circles…</p>
          ) : created.rows.length === 0 ? (
            <p className="muted">Circles you create will appear here.</p>
          ) : (
            <ul>
              {created.rows.map((circle) => (
                <li key={circle.slug}><Link className="text-button" to={"/circles/" + circle.slug}>{circle.name} ↗</Link></li>
              ))}
            </ul>
          )}
        </section>
      )}
      <p>
        Find your people and come back to the conversations you care about.
        Browse any public Circle, or follow one to find it easily later.
      </p>
      <div className="item-actions">
        <Link className="button primary" to="/circles/new">
          <Plus size={18} /> Start a Circle
        </Link>
      </div>
      {member && (
        <div className="tabs" aria-label="Filter circles">
          <button aria-pressed={!following} onClick={() => setFollowing(false)}>
            Discover
          </button>
          <button aria-pressed={following} onClick={() => setFollowing(true)}>
            Following
          </button>
        </div>
      )}
      <form
        className="form circle-search"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(
            String(
              new FormData(event.currentTarget).get("search") || "",
            ).trim(),
          );
        }}
      >
        <label>
          Find a Circle
          <input
            type="search"
            name="search"
            maxLength={80}
            placeholder="Try campus, jobs or money"
          />
        </label>
        <button className="button secondary">Search</button>
      </form>
      {!db ? (
        <p className="notice">
          Connect the Circles database to browse communities.
        </p>
      ) : error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : !rows ? (
        <p role="status">Loading Circles…</p>
      ) : null}
      {rows?.length === 0 && (
        <p className="notice">
          {following
            ? "Circles you follow will appear here."
            : "No Circles match this search."}
        </p>
      )}
      <div className="circle-directory">
        {rows?.map((circle) => (
          <article
            className="community-call circle-directory-card"
            key={circle.slug}
          >
            <UsersRound size={23} aria-hidden="true" />
            <h2>
              <Link to={"/circles/" + circle.slug}>{circle.name}</Link>
            </h2>
            <p>{circle.description}</p>
            <Link className="button secondary" to={"/circles/" + circle.slug}>
              Open Circle <span aria-hidden="true">↗</span>
            </Link>
          </article>
        ))}
      </div>
    </CircleShell>
  );
}

export function CirclePage({
  member,
  renderPost,
}: {
  member: boolean;
  renderPost: (entry: Entry) => ReactNode;
}) {
  const { slug } = useParams();
  const [data, setData] = useState<CircleResult | null>();
  const [posts, setPosts] = useState<Entry[]>([]);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  useEffect(() => {
    if (!db || !slug) return;
    let active = true;
    void rpc<CircleResult | null>("circle_detail", { p_slug: slug })
      .then((result) => {
        if (!active) return;
        setData(result);
        setPosts(result?.posts.slice(0, 12) ?? []);
        setMore(Boolean(result && result.posts.length > 12));
      })
      .catch((reason) => {
        if (active) setError(message(reason));
      });
    return () => {
      active = false;
    };
  }, [slug, member]);
  async function follow() {
    if (!data || busy) return;
    setBusy(true);
    setError("");
    try {
      await rpc("follow_circle", {
        p_slug: slug,
        p_follow: !data.circle.following,
      });
      setData({
        ...data,
        circle: { ...data.circle, following: !data.circle.following },
      });
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  async function loadMore() {
    const last = posts.at(-1);
    if (!last || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await rpc<CircleResult | null>("circle_detail", {
        p_slug: slug,
        p_before_date: last.created_at,
        p_before_id: last.id,
      });
      if (!result) {
        setData(null);
        setPosts([]);
        setMore(false);
        return;
      }
      setPosts((previous) => [...previous, ...result.posts.slice(0, 12)]);
      setMore(result.posts.length > 12);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  const circle = data?.circle;
  return (
    <CircleShell title={circle?.name ?? "Circle"} back="/circles">
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="notice" role="status">
          {info}
        </p>
      )}
      {!circle && !error && (
        <p className="notice">
          {!db
            ? "Connect the Circles database to view this page."
            : data === null
              ? "This Circle is unavailable."
              : "Loading Circle…"}
        </p>
      )}
      {circle && (
        <>
          <p>{circle.description}</p>
          <div className="item-actions">
            <Link className="button primary" to={"/new?circle=" + circle.slug}>
              <MessageCircle size={18} /> Start a discussion
            </Link>
            {member ? (
              <button
                className="button secondary"
                onClick={() => void follow()}
                disabled={busy}
                aria-pressed={circle.following}
              >
                <Plus size={18} />
                {circle.following ? "Following" : "Follow Circle"}
              </button>
            ) : (
              <Link
                className="button secondary"
                to="/auth"
                state={{ next: "/circles/" + circle.slug }}
              >
                Sign in to follow
              </Link>
            )}
          </div>
          {member && circle.owned && (
            renaming ? (
              <form className="form" onSubmit={async (event) => {
                event.preventDefault();
                if (busy) return;
                const name = String(new FormData(event.currentTarget).get("name") || "").trim();
                setBusy(true);
                setError("");
                setInfo("");
                try {
                  const saved = await rpc<string>("rename_circle", { p_slug: circle.slug, p_name: name });
                  setData((current) => current ? { ...current, circle: { ...current.circle, name: saved } } : current);
                  setPosts((current) => current.map((post) =>
                    post.circle?.slug === circle.slug
                      ? { ...post, circle: { ...post.circle, name: saved } }
                      : post
                  ));
                  setRenaming(false);
                  setInfo("Circle renamed.");
                } catch (reason) {
                  setError(message(reason));
                } finally {
                  setBusy(false);
                }
              }}>
                <label>
                  Circle name
                  <input name="name" defaultValue={circle.name} required minLength={3} maxLength={60} />
                </label>
                <div className="item-actions">
                  <button className="button primary" disabled={busy}>Save name</button>
                  <button className="text-button" type="button" disabled={busy} onClick={() => setRenaming(false)}>Cancel</button>
                </div>
              </form>
            ) : (
              <button className="text-button" type="button" onClick={() => setRenaming(true)}>Rename Circle</button>
            )
          )}
          <h2>Discussions</h2>
          {posts.length === 0 && (
            <p className="notice">
              Start the next conversation in this Circle.
            </p>
          )}
          {posts.map(renderPost)}
          {more && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void loadMore()}
            >
              Load more discussions
            </button>
          )}
          {member && (
            <details className="circle-report">
              <summary>Report this Circle</summary>
              <form
                className="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const note = String(new FormData(form).get("note") || "");
                  setBusy(true);
                  setError("");
                  setInfo("");
                  void rpc("report_circle", {
                    p_slug: circle.slug,
                    p_note: note,
                  })
                    .then(() => {
                      form.reset();
                      setInfo("Your report was sent privately.");
                    })
                    .catch((reason) => setError(message(reason)))
                    .finally(() => setBusy(false));
                }}
              >
                <label>
                  What should moderators review?
                  <textarea
                    name="note"
                    required
                    minLength={5}
                    maxLength={500}
                    rows={3}
                  />
                </label>
                <button className="button secondary" disabled={busy}>
                  Send report
                </button>
              </form>
            </details>
          )}
        </>
      )}
    </CircleShell>
  );
}

export const newCircleDestination = "__new_circle";

export function CircleDestination({
  selected,
  onChange,
  draftName,
  draftDescription,
}: {
  selected: string;
  draftName?: string;
  draftDescription?: string;
  onChange: (value: string) => void;
}) {
  const { rows, error } = useCircles();
  return (
    <div className="gist-circle-picker">
      <label>
        Choose circle
        <select
          name="circle"
          value={selected}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Everyone</option>
          <option value={newCircleDestination}>+ Create a Circle</option>
          {selected && selected !== newCircleDestination && !rows?.some((circle) => circle.slug === selected) && (
            <option value={selected}>{selected.replaceAll("-", " ")}</option>
          )}
          {rows?.map((circle) => (
            <option value={circle.slug} key={circle.slug}>
              {circle.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="muted" role="status">Circles couldn’t load. You can still post to Everyone.</p>}
      {selected && selected !== newCircleDestination && <p className="muted">Your gist also appears in The Square.</p>}
      {selected === newCircleDestination && (
        <fieldset className="circle-destination">
          <legend>Create a Circle</legend>
          <p className="muted">Your gist will be the first post in this public Circle.</p>
          <CircleFields initialName={draftName} initialDescription={draftDescription} />
        </fieldset>
      )}
    </div>
  );
}

function CircleFields({ initialName, initialDescription }: { initialName?: string; initialDescription?: string }) {
  return (
    <>
        <label>
          Circle name
          <input
            name="name"
            defaultValue={initialName}
            placeholder="e.g. UNILAG Campus Life"
            required
            minLength={3}
            maxLength={60}
          />
        </label>
        <label>
          What’s this Circle about?
          <textarea
            name="description"
            defaultValue={initialDescription}
            required
            minLength={12}
            maxLength={280}
            rows={3}
          />
        </label>
    </>
  );
}

export function CreateCircle() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  return (
    <CircleShell title="Start a Circle" back="/circles">
      <p>
        Pick a topic people will want to come back to. Add one good question so
        they have a reason to join the conversation.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          const data = new FormData(event.currentTarget);
          const field = (name: string) => String(data.get(name) || "").trim();
          setBusy(true);
          setError("");
          void rpc<string>("create_circle", {
            p_name: field("name"),
            p_description: field("description"),
            p_title: field("title"),
            p_body: field("body"),
            p_category: field("category"),
          })
            .then((slug) => navigate("/circles/" + slug))
            .catch((reason) => setError(message(reason)))
            .finally(() => setBusy(false));
        }}
      >
        <CircleFields />
        <fieldset className="circle-destination">
          <legend>First conversation</legend>
          <label>
            Discussion title
            <input name="title" required maxLength={140} />
          </label>
          <label>
            Category
            <select name="category" required defaultValue="">
              <option value="">Choose one</option>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <MentionField label="What do you want to ask?" name="body" required maxLength={6000} rows={4} />
        </fieldset>
        <button className="button primary" disabled={busy}>
          {busy ? "Creating…" : "Create Circle and post"}
        </button>
      </form>
    </CircleShell>
  );
}

type CircleReview = Circle & { archived: boolean; reports: string[] };
export function CircleModeration() {
  const [rows, setRows] = useState<CircleReview[]>([]);
  const [error, setError] = useState("");
  const [revision, reload] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!db) return;
    let active = true;
    void rpc<CircleReview[]>("circle_moderation_queue")
      .then((result) => {
        if (active) setRows(result);
      })
      .catch((reason) => {
        if (active) setError(message(reason));
      });
    return () => {
      active = false;
    };
  }, [revision]);
  if (error === "Moderator access is required.") return null;
  return (
    <section className="narrow">
      <h2>Circle reports</h2>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!error && rows.length === 0 && <p>No Circle reports to review.</p>}
      {rows.map((circle) => (
        <article className="community-call" key={circle.slug}>
          <h3>{circle.name}</h3>
          <p>{circle.description}</p>
          {circle.reports.length > 0 && (
            <ul>
              {circle.reports.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          )}
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setError("");
              setBusy(true);
              void rpc("moderate_circle", {
                p_slug: circle.slug,
                p_decision: String(data.get("decision")),
                p_note: String(data.get("note")),
              })
                .then(() => reload((n) => n + 1))
                .catch((reason) => setError(message(reason)))
                .finally(() => setBusy(false));
            }}
          >
            <label>
              Decision
              <select name="decision" key={String(circle.archived)}>
                {circle.archived ? (
                  <option value="restore">Restore Circle</option>
                ) : (
                  <>
                    <option value="dismiss">Dismiss reports</option>
                    <option value="archive">Archive Circle</option>
                  </>
                )}
              </select>
            </label>
            <label>
              Reason
              <input name="note" required minLength={3} maxLength={500} />
            </label>
            <button className="button secondary" disabled={busy}>
              Save Circle decision
            </button>
          </form>
        </article>
      ))}
    </section>
  );
}
