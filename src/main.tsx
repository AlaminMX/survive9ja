import {
  StrictMode,
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
  type FormEvent,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  Navigate,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Feather,
  Flag,
  Flame,
  Heart,
  House,
  MapPin,
  MessageCircle,
  Moon,
  Plus,
  Sun,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import {
  age,
  categories,
  reactionsFor,
  reasons,
  states,
  tags,
  type Entry,
  type Kind,
  type Profile,
} from "./data";
import { db, message, preview, rpc } from "./api";
import { examples } from "./examples";
import "./style.css";

const settings = "/settings/profile";
const entryPath = (entry: Entry) =>
  `/${entry.kind === "diary" ? "diary" : "post"}/${entry.id}`;
const Account = createContext<{
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  error: string;
}>({
  session: null,
  profile: null,
  loading: true,
  refresh: async () => {},
  error: "",
});
function useAccount() {
  return useContext(Account);
}
function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(db));
  const [error, setError] = useState("");
  async function refresh() {
    setError("");
    try {
      setProfile(await rpc<Profile | null>("my_profile"));
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    if (!db) return;
    const client = db;
    let active = true,
      sequence = 0;
    const { data } = client.auth.onAuthStateChange((event, value) => {
      if (event === "PASSWORD_RECOVERY")
        sessionStorage.setItem("recovery", "1");
      setSession(value);
      if (event === "TOKEN_REFRESHED") return;
      const current = ++sequence;
      setError("");
      if (!value) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setTimeout(() => {
        if (!active || current !== sequence) return;
        void rpc<Profile | null>("my_profile")
          .then((p) => {
            if (active && current === sequence) {
              setError("");
              setProfile(p);
            }
          })
          .catch((e) => {
            if (active && current === sequence) setError(message(e));
          })
          .finally(() => {
            if (active && current === sequence) setLoading(false);
          });
      }, 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <Account.Provider value={{ session, profile, loading, refresh, error }}>
      {children}
    </Account.Provider>
  );
}
function Logo() {
  return (
    <Link className="logo" to="/" aria-label="Survive9ja home">
      <span className="logomark">
        <MessageCircle size={22} strokeWidth={2.25} />
        <i />
        <b />
      </span>
      <span>
        Survive<span className="logonine">9ja</span>
      </span>
    </Link>
  );
}
function Shell() {
  const { profile } = useAccount();
  const location = useLocation();
  const [theme, setTheme] = useState(
    () => localStorage.getItem("survive-theme") || "system",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("survive-theme", theme);
  }, [theme]);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [location.pathname]);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="header">
        <div className="header-inner">
          <Logo />
          <nav aria-label="Main navigation" className="main-nav">
            <NavLink to="/" end>
              <MessageCircle size={17} /> The Square
            </NavLink>
            <NavLink to="/diaries">
              <BookOpen size={17} /> The Diaries
            </NavLink>
            <NavLink to="/community">
              <UsersRound size={17} /> Community
            </NavLink>
          </nav>
          <div className="head-actions">
            <button
              className="icon theme"
              aria-label={`Theme: ${theme}. Switch theme`}
              onClick={() =>
                setTheme(
                  theme === "system"
                    ? "light"
                    : theme === "light"
                      ? "dark"
                      : "system",
                )
              }
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <Link
              className="signin"
              to={profile?.completed_at ? settings : "/auth"}
            >
              {profile?.completed_at ? "My profile" : "Sign in"}
            </Link>
            <Link className="button primary head-new" to="/new">
              <Plus size={18} /> New post
            </Link>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Feed key="square" kind="square" />} />
          <Route path="/diaries" element={<Feed key="diary" kind="diary" />} />
          <Route
            path="/post/:id"
            element={<Detail key="post" kind="square" />}
          />
          <Route
            path="/diary/:id"
            element={<Detail key="diary" kind="diary" />}
          />
          <Route path="/new" element={<Compose key="square" kind="square" />} />
          <Route
            path="/diaries/new"
            element={<Compose key="diary" kind="diary" />}
          />
          <Route
            path="/diaries/edit/:id"
            element={<Compose key="edit" kind="diary" />}
          />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/onboarding"
            element={<ProfileEditor key="onboarding" onboarding />}
          />
          <Route
            path={settings}
            element={<ProfileEditor key="edit" onboarding={false} />}
          />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="/community" element={<Community />} />
          <Route path="/admin" element={<Admin />} />
          {["guidelines", "terms", "privacy"].map((page) => (
            <Route
              key={page}
              path={"/" + page}
              element={<Legal page={page} />}
            />
          ))}
          <Route
            path="*"
            element={
              <Narrow title="Page not found">
                <Link to="/">Back to The Square</Link>
              </Narrow>
            }
          />
        </Routes>
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        <NavLink to="/" end>
          <House />
          Home
        </NavLink>
        <NavLink to="/diaries">
          <BookOpen />
          Diaries
        </NavLink>
        <NavLink to="/new">
          <Plus />
          New
        </NavLink>
        <NavLink to={profile?.completed_at ? settings : "/community"}>
          <UserRound />
          Profile
        </NavLink>
      </nav>
    </>
  );
}
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
function Avatar({ profile }: { profile: Profile | null }) {
  const [broken, setBroken] = useState(false);
  const name = profile?.display_name || "Anonymous Survivor";
  const tone = (name.charCodeAt(0) + name.charCodeAt(1)) % 4;
  return (
    <span aria-hidden="true" className={`avatar tone-${tone}`}>
      {profile?.avatar_url && !broken ? (
        <img
          alt=""
          src={profile.avatar_url}
          onError={() => setBroken(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
function Byline({ entry }: { entry: Entry }) {
  const { author } = entry;
  return (
    <div className="byline">
      <Avatar profile={author} />
      {author ? (
        <Link to={"/u/" + author.username}>{author.display_name}</Link>
      ) : (
        <strong>Anonymous Survivor</strong>
      )}
      {author?.region && (
        <>
          <span>·</span>
          <span className="place">{author.region}</span>
        </>
      )}
      <span>·</span>
      <time dateTime={entry.created_at}>{age(entry.created_at)}</time>
    </div>
  );
}
const categoryClass = (name: string) =>
  name.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and");
function EntryCard({ entry }: { entry: Entry }) {
  return (
    <article className={`entry ${entry.kind}`}>
      <div className="entry-top">
        <span className={`tag ${categoryClass(entry.category)}`}>
          {entry.category}
        </span>
        <Link
          className="entry-open"
          aria-label={`Read ${entry.title}`}
          to={entryPath(entry)}
        >
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <h2>
        <Link to={entryPath(entry)}>{entry.title}</Link>
      </h2>
      <p className="excerpt">{entry.body}</p>
      <div className="entry-bottom">
        <Byline entry={entry} />
        <div className="activity">
          <Link
            to={entryPath(entry) + "#replies"}
            aria-label={`${entry.replies} replies`}
          >
            <MessageCircle size={16} />
            {entry.replies}
          </Link>
          <Link
            to={entryPath(entry)}
            aria-label={`${entry.kind === "diary" ? entry.relate : entry.reactions} ${entry.kind === "diary" ? "people relate" : "reactions"}`}
          >
            <Heart size={16} />
            {entry.kind === "diary"
              ? `${entry.relate} relate`
              : entry.reactions}
          </Link>
        </div>
      </div>
    </article>
  );
}
function SectionLinks() {
  return (
    <div className="side-links">
      <Link to="/guidelines">Guidelines</Link>
      <Link to="/terms">Terms</Link>
      <Link to="/privacy">Privacy</Link>
      <span>© {new Date().getFullYear()} Survive9ja</span>
    </div>
  );
}
function Sidebar({
  trending,
  spotlight,
}: {
  trending: Entry[];
  spotlight: Entry | null;
}) {
  return (
    <aside className="sidebar">
      <section className="welcome">
        <div className="welcome-art" aria-hidden="true" />
        <span className="welcome-icon">
          <UsersRound size={20} />
        </span>
        <h2>
          Life in 9ja,
          <br />
          in our own words.
        </h2>
        <p>
          For the everyday gist, the big questions and everything in between.
        </p>
        <Link to="/community">
          Meet the community <ArrowRight size={15} />
        </Link>
      </section>
      {!!trending.length && (
        <section className="side-panel">
          <h2>
            <Flame size={19} /> Trending now
          </h2>
          {trending.slice(0, 3).map((entry, index) => (
            <Link className="trend" key={entry.id} to={entryPath(entry)}>
              <span className="trend-number">0{index + 1}</span>
              <span>
                <strong>{entry.title}</strong>
                <small>
                  {entry.replies} replies · {entry.category}
                </small>
              </span>
            </Link>
          ))}
        </section>
      )}
      {spotlight && (
        <section className="side-panel spotlight">
          <div>
            <Feather size={16} /> From The Diaries
          </div>
          <h2>
            <Link to={entryPath(spotlight)}>{spotlight.title}</Link>
          </h2>
          <p>{spotlight.author?.display_name || "Anonymous Survivor"}</p>
          <Link to="/diaries">
            Explore the Diaries <ArrowRight size={15} />
          </Link>
        </section>
      )}
      <SectionLinks />
    </aside>
  );
}
function Feed({ kind }: { kind: Kind }) {
  const diary = kind === "diary";
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("all");
  const [ranking, setRanking] = useState("latest");
  const [cursor, setCursor] = useState<Entry | null>(null);
  const [more, setMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const [snapshot] = useState(() => new Date().toISOString());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [trending, setTrending] = useState<Entry[]>([]);
  const [spotlight, setSpotlight] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(Boolean(db));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!db) return;
    let active = true;
    void rpc<Entry[]>("feed", {
      p_kind: "square",
      p_rank: "trending",
      p_limit: 3,
    })
      .then((items) => {
        if (active) setTrending(items);
      })
      .catch(() => {});
    void rpc<Entry[]>("feed", { p_kind: "diary", p_limit: 1 })
      .then((items) => {
        if (active) setSpotlight(items[0] ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!db) return;
    let active = true;
    void rpc<Entry[]>("feed", {
      p_kind: kind,
      p_category: category || null,
      p_location: location,
      p_rank: ranking,
      p_limit: 9,
      p_as_of: snapshot,
      p_after_score: cursor?.cursor_score ?? null,
      p_after_date: cursor?.created_at ?? null,
      p_after_id: cursor?.id ?? null,
    })
      .then((items) => {
        if (active) {
          setMore(items.length > 8);
          setEntries((existing) =>
            cursor
              ? [
                  ...existing,
                  ...items
                    .slice(0, 8)
                    .filter(
                      (item) => !existing.some((old) => old.id === item.id),
                    ),
                ]
              : items.slice(0, 8),
          );
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, category, location, ranking, cursor, retry, snapshot]);
  function change(action: () => void, reset = true) {
    setError("");
    setLoading(Boolean(db));
    if (reset) {
      setCursor(null);
      setEntries([]);
      setMore(false);
    }
    action();
  }
  const local = preview
    ? examples.filter(
        (entry) =>
          entry.kind === kind &&
          (!category || entry.category === category) &&
          (location === "all" ||
            (location === "diaspora"
              ? entry.author?.abroad
              : entry.author?.country === "Nigeria")),
      )
    : [];
  if (ranking === "trending")
    local.sort(
      (a, b) =>
        (b.reactions + 2 * b.replies) /
          ((Date.now() - Date.parse(b.created_at)) / 3600000 + 2) ** 1.5 -
        (a.reactions + 2 * a.replies) /
          ((Date.now() - Date.parse(a.created_at)) / 3600000 + 2) ** 1.5,
    );
  const shown = preview ? local : entries;
  return (
    <div className="layout">
      <section className="feed min-w-0">
        <div className={`intro ${diary ? "diary-intro" : ""}`}>
          <div className="eyebrow">
            {diary ? <Feather size={15} /> : <span className="status-dot" />}
            {diary ? "FIRSTHAND STORIES" : "THE NIGERIAN COMMUNITY SPACE"}
          </div>
          <h1>
            {diary ? "The Diaries" : "The Square"}
            <span>.</span>
          </h1>
          <p>
            {diary
              ? "Firsthand stories about finding our way through life."
              : "Discuss. Express. Build. Survive."}
          </p>
          {diary && (
            <Link className="button primary story-button" to="/diaries/new">
              <Feather size={16} /> Share your story
            </Link>
          )}
        </div>
        <div className="feed-controls">
          <div className="toolbar">
            {!diary ? (
              <div className="tabs" aria-label="Sort discussions">
                <button
                  aria-pressed={ranking === "latest"}
                  onClick={() => {
                    if (ranking !== "latest")
                      change(() => setRanking("latest"));
                  }}
                >
                  Latest
                </button>
                <button
                  aria-pressed={ranking === "trending"}
                  onClick={() => {
                    if (ranking !== "trending")
                      change(() => setRanking("trending"));
                  }}
                >
                  <Flame size={16} /> Trending
                </button>
              </div>
            ) : (
              <strong>Browse stories</strong>
            )}
            {!diary && (
              <label className="location">
                <MapPin size={15} />
                <select
                  aria-label="Filter by public location"
                  value={location}
                  onChange={(e) => change(() => setLocation(e.target.value))}
                >
                  <option value="all">All locations</option>
                  <option value="nigeria">In Nigeria</option>
                  <option value="diaspora">Diaspora</option>
                </select>
                <ChevronDown size={15} />
              </label>
            )}
          </div>
          <div
            className="categories"
            aria-label={diary ? "Story tags" : "Discussion categories"}
          >
            {["", ...(diary ? tags : categories)].map((name) => (
              <button
                key={name}
                aria-pressed={category === name}
                onClick={() => {
                  if (category !== name) change(() => setCategory(name));
                }}
              >
                {name || "All topics"}
              </button>
            ))}
          </div>
        </div>
        <div className="feed-label">
          <span>
            {preview ? "FICTIONAL PREVIEW" : diary ? "STORIES" : "DISCUSSIONS"}
          </span>
          {!diary && (
            <details>
              <summary>
                <CircleHelp size={14} /> How ranking works
              </summary>
              <p>
                Latest shows newest posts first. Trending weighs reactions and
                replies, then gives newer discussions more weight. It looks back
                seven days.
              </p>
            </details>
          )}
        </div>
        {!db && !preview && (
          <p className="notice">Connect Supabase to load the community feed.</p>
        )}
        {error && (
          <div className="notice" role="alert">
            {error}{" "}
            <button
              className="text-button"
              onClick={() => change(() => setRetry(retry + 1), false)}
            >
              Try again
            </button>
          </div>
        )}
        {loading && (
          <div className="notice" role="status">
            Loading {diary ? "stories" : "discussions"}…
          </div>
        )}
        {!loading && !error && !shown.length && (
          <div className="empty">
            <h2>{diary ? "No stories here yet" : "No discussions here yet"}</h2>
            <p>Try another filter or start something new.</p>
            <Link
              className="button primary"
              to={diary ? "/diaries/new" : "/new"}
            >
              {diary ? "Share your story" : "New post"}
            </Link>
          </div>
        )}
        {shown.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
        {more && !error && (
          <button
            className="button secondary load"
            disabled={loading}
            onClick={() =>
              change(() => setCursor(entries.at(-1) ?? null), false)
            }
          >
            Load more
          </button>
        )}
      </section>
      <Sidebar
        trending={
          preview ? examples.filter((e) => e.kind === "square") : trending
        }
        spotlight={
          diary
            ? null
            : preview
              ? (examples.find((e) => e.kind === "diary") ?? null)
              : spotlight
        }
      />
    </div>
  );
}
function Narrow({
  title,
  children,
  back,
}: {
  title: string;
  children: ReactNode;
  back?: string;
}) {
  return (
    <section className="narrow">
      {back && (
        <Link className="back" to={back}>
          <ArrowLeft size={16} /> Back
        </Link>
      )}
      <h1>{title}</h1>
      {children}
    </section>
  );
}
function Status({ error, info }: { error?: string; info?: string }) {
  return error ? (
    <p className="notice error" role="alert">
      {error}
    </p>
  ) : info ? (
    <p className="notice" role="status">
      {info}
    </p>
  ) : null;
}
function Require({
  children,
  onboarding = false,
}: {
  children: ReactNode;
  onboarding?: boolean;
}) {
  const { session, profile, loading, error } = useAccount();
  const location = useLocation();
  if (loading)
    return (
      <Narrow title="Checking your account">
        <p role="status">One moment…</p>
      </Narrow>
    );
  if (error)
    return (
      <Narrow title="Account unavailable">
        <Status error={error} />
      </Narrow>
    );
  if (!db)
    return (
      <Narrow title="Account setup required" back="/">
        <p>
          This preview can be read without an account. Connect Supabase to sign
          in and participate.
        </p>
        <Link className="button secondary" to="/auth">
          See sign-in
        </Link>
      </Narrow>
    );
  if (!session)
    return <Navigate to="/auth" state={{ next: location.pathname }} replace />;
  if (!session.user.email_confirmed_at)
    return (
      <Narrow title="Confirm your email">
        <p>Open the confirmation link in your inbox to continue.</p>
      </Narrow>
    );
  if (!onboarding && !profile?.completed_at)
    return <Navigate to="/onboarding" replace />;
  return children;
}
function Auth() {
  const { session, profile, loading } = useAccount();
  const location = useLocation();
  const [mode, setMode] = useState(() =>
    location.search.includes("reset") || sessionStorage.getItem("recovery")
      ? "reset"
      : "login",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const next = (location.state as { next?: string } | null)?.next;
  const base = window.location.origin + "/auth";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (mode === "reset") {
        const result = await db.auth.updateUser({ password });
        if (result.error) throw result.error;
        sessionStorage.removeItem("recovery");
        setMode("login");
      } else if (mode === "forgot") {
        const result = await db.auth.resetPasswordForEmail(email, {
          redirectTo: base + "?reset=1",
        });
        if (result.error) throw result.error;
        setInfo(
          "If an account exists for this address, check your inbox for a reset link.",
        );
      } else if (mode === "register") {
        const result = await db.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: base },
        });
        if (result.error) throw result.error;
        setInfo(
          "Check your inbox to confirm your email. The link takes you back here to create your community profile.",
        );
      } else {
        const result = await db.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : String((e as { message?: string })?.message || message(e)),
      );
    } finally {
      setBusy(false);
    }
  }
  if (session && !loading && mode !== "reset" && mode !== "forgot")
    return (
      <Navigate
        to={profile?.completed_at ? next || settings : "/onboarding"}
        replace
      />
    );
  return (
    <Narrow
      title={
        mode === "register"
          ? "Join Survive9ja"
          : mode === "forgot"
            ? "Reset your password"
            : mode === "reset"
              ? "Choose a new password"
              : "Sign in"
      }
      back="/"
    >
      <p>
        {mode === "login"
          ? "Join the conversation with your community account."
          : mode === "register"
            ? "After signup, confirm your email and set up your public profile."
            : "Use the email address for your community account."}
      </p>
      {!db && <Status info="Account features require Supabase setup." />}
      <Status error={error} info={info} />
      <form className="form" onSubmit={(e) => void submit(e)}>
        {mode !== "reset" && (
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
        )}
        {mode !== "forgot" && (
          <label>
            {mode === "reset" ? "New password" : "Password"}
            <input
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "login" ? undefined : 8}
              required
            />
          </label>
        )}
        <button
          className="button primary"
          disabled={!db || busy || loading || (mode === "reset" && !session)}
        >
          {mode === "register"
            ? "Create account"
            : mode === "forgot"
              ? "Send reset link"
              : mode === "reset"
                ? "Save password"
                : "Sign in"}
        </button>
      </form>
      {(mode === "login" || mode === "register") && (
        <button
          className="button secondary google"
          disabled={!db || busy}
          onClick={() => {
            if (db)
              void db.auth
                .signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: base },
                })
                .then(({ error: e }) => {
                  if (e) setError(e.message);
                });
          }}
        >
          Continue with Google
        </button>
      )}
      <div className="form-links">
        {mode === "login" ? (
          <>
            <button
              onClick={() => {
                setMode("register");
                setError("");
                setInfo("");
              }}
            >
              Create an account
            </button>
            <button
              onClick={() => {
                setMode("forgot");
                setError("");
                setInfo("");
              }}
            >
              Forgot password?
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              setMode("login");
              setError("");
              setInfo("");
            }}
          >
            Back to sign in
          </button>
        )}
      </div>
    </Narrow>
  );
}
function ProfileEditor({ onboarding }: { onboarding: boolean }) {
  return preview ? (
    <ProfileForm onboarding={onboarding} />
  ) : (
    <Require onboarding={onboarding}>
      <ProfileForm onboarding={onboarding} />
    </Require>
  );
}
function ProfileForm({ onboarding }: { onboarding: boolean }) {
  const { profile, refresh } = useAccount();
  const [country, setCountry] = useState(profile?.country || "Nigeria");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (onboarding && profile?.completed_at)
    return <Navigate to={settings} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const val = (key: string) => String(form.get(key) || "").trim();
    setBusy(true);
    setError("");
    try {
      await rpc("save_profile", {
        p_username: val("username"),
        p_name: val("name"),
        p_country: val("country"),
        p_region: val("region") || null,
        p_bio: val("bio") || null,
        p_abroad: form.has("abroad"),
        p_avatar: val("avatar") || null,
        p_terms: form.has("accept") ? "draft-1" : null,
        p_privacy: form.has("accept") ? "draft-1" : null,
      });
      await refresh();
      navigate("/u/" + val("username"));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Narrow
      title={onboarding ? "Make yourself at home" : "Edit your profile"}
      back="/"
    >
      <p>
        Your username, display name and location details appear on your public
        profile after onboarding.
      </p>
      <Status
        error={error}
        info={
          preview
            ? "Preview only · Connect Supabase to save a profile."
            : undefined
        }
      />
      <form className="form" onSubmit={(e) => void submit(e)}>
        <label>
          Username
          <input
            name="username"
            defaultValue={profile?.username}
            required
            pattern="[a-z0-9_]{3,20}"
            maxLength={20}
            autoCapitalize="none"
          />
          <small>3–20 lowercase letters, numbers or underscores.</small>
        </label>
        <label>
          Display name
          <input
            name="name"
            defaultValue={profile?.display_name}
            required
            maxLength={60}
          />
        </label>
        <label>
          Country · public
          <input
            name="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
            maxLength={80}
          />
        </label>
        {country.trim().toLowerCase() === "nigeria" ? (
          <label>
            State or FCT · public
            <select name="region" defaultValue={profile?.region || ""} required>
              <option value="">Choose a state or FCT</option>
              {states.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            City · optional, public
            <input
              name="region"
              defaultValue={
                profile?.country?.toLowerCase() !== "nigeria"
                  ? profile?.region || ""
                  : ""
              }
              maxLength={80}
            />
          </label>
        )}
        <label>
          Bio · optional
          <textarea
            name="bio"
            defaultValue={profile?.bio || ""}
            maxLength={160}
            rows={3}
          />
          <small>Up to 160 characters.</small>
        </label>
        {!onboarding && (
          <label>
            Avatar URL · optional
            <input
              name="avatar"
              type="url"
              defaultValue={profile?.avatar_url || ""}
              placeholder="https://…"
              maxLength={500}
            />
          </label>
        )}
        <label className="check">
          <input
            type="checkbox"
            name="abroad"
            defaultChecked={profile?.abroad}
          />{" "}
          Show a public Based abroad badge
        </label>
        {onboarding && (
          <label className="check">
            <input type="checkbox" name="accept" required />
            <span>
              I accept the draft{" "}
              <Link to="/terms" target="_blank">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" target="_blank">
                Privacy Policy
              </Link>{" "}
              (draft-1).
            </span>
          </label>
        )}
        <button className="button primary" disabled={busy || preview}>
          {onboarding ? "Complete onboarding" : "Save profile"}
        </button>
      </form>
      {!onboarding && !preview && (
        <button
          className="button secondary google"
          onClick={() =>
            void db?.auth.signOut().then(({ error: e }) => {
              if (e) setError(e.message);
              else navigate("/");
            })
          }
        >
          Sign out
        </button>
      )}
      {!onboarding && !preview && <MyDiaries />}
    </Narrow>
  );
}
function MyDiaries() {
  const [rows, setRows] = useState<
    { id: string; title: string; hidden: boolean; anonymous: boolean }[]
  >([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void rpc<typeof rows>("my_diaries")
      .then((items) => {
        if (active) setRows(items);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="community-call">
      <h2>Your diaries</h2>
      <Status error={error} />
      {rows.length ? (
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              {row.title}
              {row.anonymous ? " · Anonymous" : ""}
              {row.hidden ? (
                " · Hidden"
              ) : (
                <>
                  {" "}
                  · <Link to={"/diaries/edit/" + row.id}>Edit story</Link>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>Your stories will appear here.</p>
      )}
    </section>
  );
}
function Community() {
  const { profile } = useAccount();
  return (
    <Narrow title="The Community" back="/">
      <p>
        A space for people with a connection to Nigeria to share what they know,
        tell their stories and learn from each other.
      </p>
      <div className="community-call">
        <UsersRound size={26} />
        <h2>Make it yours</h2>
        <p>
          Set up a public profile to join discussions and share your own
          stories. Reading and taking part are free.
        </p>
        <Link
          className="button primary"
          to={profile?.completed_at ? settings : "/auth"}
        >
          {profile?.completed_at ? "My profile" : "Join the community"}
        </Link>
      </div>
      <SectionLinks />
    </Narrow>
  );
}
function PublicProfile() {
  const { username } = useParams();
  const account = useAccount();
  const [result, setResult] = useState<{
    profile: Profile | null;
    entries: Entry[];
    error: string;
    key: string;
  }>();
  useEffect(() => {
    if (!db) return;
    let active = true;
    void rpc<{ profile: Profile | null; entries: Entry[] }>("public_profile", {
      p_username: username,
    })
      .then((value) => {
        if (active) setResult({ ...value, error: "", key: username || "" });
      })
      .catch((e) => {
        if (active)
          setResult({
            profile: null,
            entries: [],
            error: message(e),
            key: username || "",
          });
      });
    return () => {
      active = false;
    };
  }, [username]);
  const sample = preview
    ? examples.find((e) => e.author?.username === username)?.author
    : null;
  const current = result?.key === username ? result : undefined;
  const profile = sample || current?.profile;
  if (!profile)
    return (
      <Narrow
        title={db && !current ? "Loading profile…" : "Profile unavailable"}
        back="/"
      >
        <Status error={current?.error} />
      </Narrow>
    );
  return (
    <Narrow title={profile.display_name} back="/">
      <div className="profile-meta">
        <Avatar key={profile.avatar_url} profile={profile} />
        <strong>@{profile.username}</strong>
        <span>
          {[profile.region, profile.country].filter(Boolean).join(", ")}
        </span>
        {profile.abroad && <span className="tag">Based abroad</span>}
      </div>
      {sample && <p className="notice">Fictional preview profile</p>}
      {profile.bio && <p>{profile.bio}</p>}
      {account.profile?.username === username && (
        <Link className="button secondary" to={settings}>
          Edit profile
        </Link>
      )}
      <h2>Public activity</h2>
      {(sample
        ? examples.filter((e) => e.author?.username === username)
        : current?.entries || []
      ).map((entry) => (
        <EntryCard key={entry.id} entry={entry} />
      ))}
    </Narrow>
  );
}
function Legal({ page }: { page: string }) {
  const title =
    page === "terms"
      ? "Terms of use"
      : page === "privacy"
        ? "Privacy policy"
        : "Community guidelines";
  return (
    <Narrow title={title} back="/">
      {page !== "guidelines" && (
        <Status info="Draft legal copy · version draft-1" />
      )}
      {page === "terms" ? (
        <>
          <p>
            Survive9ja is a free community for conversations and stories about
            life in Nigeria. You keep ownership of your contributions and allow
            Survive9ja to display them in the community.
          </p>
          <p>
            Follow the community guidelines. Moderators may hide content or
            restrict accounts to protect participants.
          </p>
          <Link to="/guidelines">Read the community guidelines</Link>
        </>
      ) : page === "privacy" ? (
        <>
          <p>
            Your email and sign-in information are used for account access. Your
            completed profile, including the location and badge you choose, is
            public. Report details and moderation records are restricted.
          </p>
          <p>
            Named posts and replies link to your public profile. Where anonymous
            publication is supported, authorised moderators can identify the
            diary author for safety.
          </p>
        </>
      ) : (
        <>
          <p>
            Discuss ideas with care, especially when people disagree. Share what
            you know from experience and say when you are uncertain.
          </p>
          <p>
            Keep other people’s identifying details private. Use the report
            action for harassment, spam or sensitive information.
          </p>
        </>
      )}
    </Narrow>
  );
}
function Compose({ kind }: { kind: Kind }) {
  return preview ? (
    <Editor kind={kind} />
  ) : (
    <Require>
      <Editor kind={kind} />
    </Require>
  );
}
function Editor({ kind }: { kind: Kind }) {
  const { id } = useParams();
  const { session } = useAccount();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const diary = kind === "diary";
  const [anonymousAvailable, setAnonymousAvailable] = useState(false);
  useEffect(() => {
    if (!db || !diary || id) return;
    let active = true;
    void rpc<boolean>("diary_capabilities")
      .then((value) => {
        if (active) setAnonymousAvailable(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [diary, id]);
  const young =
    diary &&
    !id &&
    Date.now() - Date.parse(session?.user.created_at || "") < 86400000;
  useEffect(() => {
    if (!id) return;
    let active = true;
    void rpc<Entry | null>("editable_diary", { p_id: id })
      .then((value) => {
        if (active) setEntry(value);
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = {
      p_title: String(form.get("title")).trim(),
      p_body: String(form.get("body")).trim(),
      p_category: String(form.get("category")),
    };
    setBusy(true);
    setError("");
    try {
      const saved = await (id
        ? rpc<string>("edit_diary", { ...fields, p_id: id })
        : rpc<string>("publish_entry", {
            ...fields,
            p_kind: kind,
            p_anonymous: anonymousAvailable && form.has("anonymous"),
          }));
      navigate((diary ? "/diary/" : "/post/") + saved);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Narrow
      title={
        id
          ? "Edit your story"
          : diary
            ? "Share your story"
            : "Start a discussion"
      }
      back={diary ? "/diaries" : "/"}
    >
      <p>
        {diary
          ? "Write from your own experience. Details in your story can identify you."
          : "Give people enough context to join the conversation."}
      </p>
      <Status
        error={error}
        info={
          preview
            ? "Preview only · Connect Supabase to publish."
            : young
              ? "You can publish your first diary 24 hours after creating your account."
              : id && !loaded
                ? "Loading your story…"
                : id && !entry
                  ? "This story is unavailable for editing."
                  : undefined
        }
      />
      {(!id || entry) && (
        <form className="form" onSubmit={(e) => void submit(e)}>
          <label>
            Title
            <input
              name="title"
              required
              maxLength={140}
              defaultValue={entry?.title}
            />
          </label>
          <label>
            {diary ? "Story tag" : "Category"}
            <select
              name="category"
              required
              defaultValue={entry?.category || ""}
            >
              <option value="">Choose one</option>
              {(diary ? tags : categories).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            {diary ? "Your story" : "Discussion"}
            <textarea
              name="body"
              required
              rows={diary ? 13 : 8}
              maxLength={diary ? 20000 : 6000}
              defaultValue={entry?.body}
            />
          </label>
          {diary && !id && (
            <div>
              <label className="check">
                <input
                  type="checkbox"
                  name="anonymous"
                  disabled={!anonymousAvailable || young}
                />{" "}
                Publish anonymously
              </label>
              <p className="muted">
                Readers see Anonymous Survivor. Authorised moderators can
                identify the author for safety.{" "}
                {!anonymousAvailable &&
                  "Anonymous publishing is disabled pending verification."}
              </p>
            </div>
          )}
          <button
            className="button primary"
            disabled={busy || young || preview}
          >
            {id
              ? "Save changes"
              : diary
                ? "Publish story"
                : "Publish discussion"}
          </button>
        </form>
      )}
    </Narrow>
  );
}
type Thread = { entry: Entry; replies: Entry[] };
function Report({ id }: { id: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await rpc("report_entry", {
        p_id: id,
        p_reason: String(form.get("reason")),
        p_note: String(form.get("note") || "").trim(),
      });
      setSent(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        ref={trigger}
        className="text-button"
        onClick={() => dialog.current?.showModal()}
      >
        <Flag size={15} /> Report
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={"report-" + id}
        onClose={() => trigger.current?.focus()}
      >
        <h2 id={"report-" + id}>Report this content</h2>
        {sent ? (
          <Status info="Report sent privately to moderators." />
        ) : (
          <form className="form" onSubmit={(e) => void submit(e)}>
            <Status error={error} />
            <label>
              Reason
              <select name="reason" required autoFocus>
                <option value="">Choose a reason</option>
                {reasons.map((reason) => (
                  <option key={reason}>{reason}</option>
                ))}
              </select>
            </label>
            <label>
              More context · optional
              <textarea name="note" maxLength={1000} rows={3} />
            </label>
            <button className="button primary" disabled={busy}>
              Send report
            </button>
          </form>
        )}
        <button
          className="button secondary google"
          onClick={() => dialog.current?.close()}
        >
          Close
        </button>
      </dialog>
    </>
  );
}
function Detail({ kind }: { kind: Kind }) {
  const { id } = useParams();
  const { hash } = useLocation();
  const [result, setResult] = useState<{
    thread: Thread | null;
    error: string;
    id: string;
  }>();
  const [reload, setReload] = useState(0);
  const [target, setTarget] = useState<Entry | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { profile, session } = useAccount();
  const eligible = Boolean(
    session?.user.email_confirmed_at && profile?.completed_at,
  );
  const diary = kind === "diary";
  const back = diary ? "/diaries" : "/";
  useEffect(() => {
    if (!db) return;
    let active = true;
    void rpc<Thread | null>("read_thread", { p_id: id, p_kind: kind })
      .then((thread) => {
        if (active) setResult({ thread, error: "", id: id || "" });
      })
      .catch((e) => {
        if (active)
          setResult({ thread: null, error: message(e), id: id || "" });
      });
    return () => {
      active = false;
    };
  }, [id, kind, reload, session?.user.id]);
  const sample = preview
    ? examples.find((e) => e.id === id && e.kind === kind)
    : null;
  const resultHere = result?.id === id ? result : undefined;
  const thread = sample ? { entry: sample, replies: [] } : resultHere?.thread;
  const isReady = Boolean(thread);
  useEffect(() => {
    if (isReady && hash === "#replies") {
      const frame = requestAnimationFrame(() =>
        document.getElementById("replies")?.scrollIntoView(),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [hash, id, isReady]);
  if (!thread)
    return (
      <Narrow
        title={db && !resultHere ? "Loading…" : "Content unavailable"}
        back={back}
      >
        <Status error={resultHere?.error} />
        {resultHere?.error && (
          <button
            className="button secondary"
            onClick={() => setReload(reload + 1)}
          >
            Try again
          </button>
        )}
      </Narrow>
    );
  const { entry, replies } = thread;
  async function act(name: string, args: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await rpc(name, args);
      setReload((value) => value + 1);
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  function actions(item: Entry) {
    return (
      <div className="item-actions">
        {reactionsFor(kind).map((reaction) => (
          <button
            key={reaction}
            className="button secondary"
            disabled={!eligible || busy}
            aria-pressed={item.mine === reaction}
            onClick={() =>
              void act("react_entry", {
                p_id: item.id,
                p_reaction: item.mine === reaction ? null : reaction,
              })
            }
          >
            {reaction}
          </button>
        ))}
        {eligible ? (
          <Report id={item.id} />
        ) : (
          <Link
            className="text-button"
            to="/auth"
            state={{ next: entryPath(entry) }}
          >
            <Flag size={15} /> Report
          </Link>
        )}
      </div>
    );
  }
  function replyCard(reply: Entry) {
    return (
      <article className="reply" key={reply.id}>
        <Byline entry={reply} />
        <p className="prose-body">{reply.body}</p>
        {actions(reply)}
        {eligible && !reply.parent_id && (
          <button
            className="text-button"
            onClick={() => {
              setTarget(reply);
              document.getElementById("reply-body")?.focus();
            }}
          >
            Reply
          </button>
        )}
        {!reply.parent_id &&
          replies
            .filter((child) => child.parent_id === reply.id)
            .map(replyCard)}
      </article>
    );
  }
  return (
    <article className={`reader narrow ${diary ? "diary-reader" : ""}`}>
      <Link className="back" to={back}>
        <ArrowLeft size={16} /> {diary ? "The Diaries" : "The Square"}
      </Link>
      <span className={`tag ${categoryClass(entry.category)}`}>
        {entry.category}
      </span>
      <h1>{entry.title}</h1>
      <Byline entry={entry} />
      {sample && <Status info="Fictional preview content" />}
      <div className="prose-body">{entry.body}</div>
      {entry.owned && diary && (
        <Link className="button secondary" to={"/diaries/edit/" + entry.id}>
          Edit story
        </Link>
      )}
      <p className="muted">
        {diary
          ? `${entry.relate} people relate`
          : `${entry.reactions} reactions`}
      </p>
      {actions(entry)}
      <Status error={error} />
      <section id="replies" className="reply-area">
        <h2>Replies ({entry.replies})</h2>
        {replies.filter((reply) => !reply.parent_id).map(replyCard)}
        {eligible ? (
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const body = String(new FormData(form).get("body")).trim();
              if (
                await act("publish_reply", {
                  p_entry: entry.id,
                  p_parent: target?.id || null,
                  p_body: body,
                })
              ) {
                form.reset();
                setTarget(null);
              }
            }}
          >
            <label htmlFor="reply-body">
              {target
                ? `Reply to ${target.author?.display_name}`
                : "Add a reply"}
            </label>
            {target && (
              <button
                type="button"
                className="text-button"
                onClick={() => setTarget(null)}
              >
                Cancel reply
              </button>
            )}
            <textarea
              id="reply-body"
              name="body"
              rows={4}
              required
              maxLength={2000}
            />
            <button className="button primary" disabled={busy}>
              Post reply
            </button>
          </form>
        ) : (
          <p>
            {sample ? "Account features require Supabase setup. " : ""}
            <Link to="/auth" state={{ next: entryPath(entry) }}>
              Sign in to reply, react or report
            </Link>
          </p>
        )}
      </section>
    </article>
  );
}
type Review = {
  id: string;
  target_id: string;
  root_id: string | null;
  root_body: string | null;
  anonymous: boolean;
  reason: string;
  note: string;
  body: string;
  title: string;
  hidden: boolean;
  target_hidden: boolean;
  parent_hidden: boolean;
  banned: boolean;
  created_at: string;
};
type Queue = { items: Review[]; open: number; hidden: number; banned: number };
function Admin() {
  return (
    <Require>
      <Moderation />
    </Require>
  );
}
function Moderation() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [identity, setIdentity] = useState<{
    report: string;
    username: string;
    display_name: string;
  }>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void rpc<Queue>("moderation_queue")
      .then((value) => {
        if (active) setQueue(value);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  async function moderate(item: Review, action: string, form: HTMLFormElement) {
    const note = String(new FormData(form).get("note") || "").trim();
    if (!note) {
      setError("Add a moderation note first.");
      return;
    }
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (action === "identify") {
        const result = await rpc<{ username: string; display_name: string }>(
          "reported_diary_author",
          { p_report: item.id, p_note: note },
        );
        setIdentity({ report: item.id, ...result });
        setInfo("Identity lookup recorded.");
        return;
      }
      await rpc("moderate_entry", {
        p_report: item.id,
        p_action: action,
        p_note: note,
      });
      form.reset();
      setRefresh((value) => value + 1);
      setInfo("Moderation action saved.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Narrow title="Moderation" back="/">
      <Status error={error} info={info} />
      {!queue && !error && <p role="status">Checking moderator access…</p>}
      {queue && (
        <>
          <p>
            {queue.open} open reports · {queue.hidden} hidden items ·{" "}
            {queue.banned} banned accounts
          </p>
          {queue.items.map((item) => (
            <article className="review" key={item.id}>
              <h2>{item.reason}</h2>
              <p>{item.note}</p>
              <h3>{item.title || "Reply"}</h3>
              <p className="prose-body">{item.body}</p>
              {item.root_id && (
                <details>
                  <summary>Original post</summary>
                  <p>{item.root_body}</p>
                </details>
              )}
              {identity?.report === item.id && (
                <Status
                  info={`Author: ${identity.display_name} (@${identity.username})`}
                />
              )}
              <p className="muted">
                {item.hidden ? "Hidden" : "Visible"} ·{" "}
                {item.banned ? "Account banned" : "Account active"}
                {item.parent_hidden ? " · Parent hidden" : ""}
              </p>
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const submitter = (e.nativeEvent as SubmitEvent).submitter;
                  if (submitter instanceof HTMLButtonElement)
                    void moderate(item, submitter.value, e.currentTarget);
                }}
              >
                <label>
                  Moderation note
                  <textarea name="note" required maxLength={1000} rows={2} />
                </label>
                <div className="item-actions">
                  {[
                    item.target_hidden ? "restore" : "hide",
                    item.banned ? "unban" : "ban",
                    "resolve",
                    ...(item.anonymous ? ["identify"] : []),
                  ].map((action) => (
                    <button
                      className="button secondary"
                      disabled={busy}
                      value={action}
                      key={action}
                    >
                      {action === "identify" ? "Identify author" : action}
                    </button>
                  ))}
                </div>
              </form>
            </article>
          ))}
          {!queue.items.length && <p>No open reports.</p>}
          <h2>Review a past report</h2>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const value = String(
                new FormData(e.currentTarget).get("report"),
              ).trim();
              setError("");
              try {
                const item = await rpc<Review>("moderation_review", {
                  p_id: value,
                });
                setQueue((old) =>
                  old
                    ? {
                        ...old,
                        items: [
                          item,
                          ...old.items.filter((row) => row.id !== item.id),
                        ],
                      }
                    : old,
                );
              } catch (err) {
                setError(message(err));
              }
            }}
          >
            <label>
              Report ID
              <input name="report" required placeholder="Paste report ID" />
            </label>
            <button className="button secondary">Open report</button>
          </form>
          <details>
            <summary>Recent report IDs</summary>
            <ReportHistory />
          </details>
        </>
      )}
    </Narrow>
  );
}
function ReportHistory() {
  const [rows, setRows] = useState<{ id: string; reason: string }[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void rpc<{ id: string; reason: string }[]>("moderation_history")
      .then((items) => {
        if (active) setRows(items);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <Status error={error} />
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            {row.reason} · <code>{row.id}</code>
          </li>
        ))}
      </ul>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AccountProvider>
        <Shell />
      </AccountProvider>
    </BrowserRouter>
  </StrictMode>,
);
