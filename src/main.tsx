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
  diaryReactions,
  reasons,
  states,
  tags,
  type Entry,
  type Kind,
  type Profile,
} from "./data";
import { authCallback, db, message, preview, rpc } from "./api";
import { validateProfile, type ProfileFields } from "./profile-validation";
import { examples } from "./examples";
import { AvatarEditor, uploadAvatar, type AvatarChange } from "./avatar";
import { SurvivalGuide } from "./survival";
import { ShareConversation } from "./share";
import { MentionField, MentionText } from "./mentions";
import { GistIntro, rememberGistDiary } from "./gist";
import {
  CircleDestination,
  CircleModeration,
  CirclePage,
  CirclesDirectory,
  CreateCircle,
  newCircleDestination,
} from "./circles";
import {
  Boost,
  BusinessHub,
  Certificate,
  CreditDesk,
  ExpansionModeration,
  ManageBusiness,
  PublicBadge,
  Sponsored,
  SurvivalDesk,
  SurvivalVote,
} from "./expansion";
import { profilePath, profileReturn } from "./profile-navigation";
import { AdminDashboard } from "./admin";
import "./style.css";
import "./gist.css";

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
      <img
        className="logomark"
        src="/brand-mark.svg"
        alt=""
        width={44}
        height={44}
      />
      <span>
        Survive<span className="logonine">9ja</span>
      </span>
    </Link>
  );
}
function Shell() {
  const { profile, session, loading } = useAccount();
  const [callbackPending, setCallbackPending] = useState(
    window.location.pathname === "/" &&
      (authCallback.type === "signup" ||
        authCallback.type === "recovery" ||
        authCallback.failed),
  );
  const navigate = useNavigate();
  useEffect(() => {
    if (!callbackPending || loading) return;
    setCallbackPending(false);
    if (authCallback.type === "recovery")
      navigate("/auth?reset=1", { replace: true });
    else if (session && !authCallback.failed)
      navigate(profile?.completed_at ? profilePath : "/onboarding", {
        replace: true,
      });
    else
      navigate("/auth", { replace: true, state: { confirmationFailed: true } });
  }, [callbackPending, loading, navigate, profile?.completed_at, session]);
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
              to={profile?.completed_at ? profilePath : "/auth"}
            >
              {profile?.completed_at ? "My profile" : "Sign in"}
            </Link>
            <Link className="button primary head-new" to="/new">
              <Plus size={18} /> Drop a gist
            </Link>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Feed key={`square-${session?.user.id ?? "public"}`} kind="square" gist />} />
          <Route path="/gist-preview" element={<Navigate to="/" replace />} />
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
          <Route path={profilePath} element={<Require><ProfileOverview own /></Require>} />
          <Route path="/u/:username" element={<ProfileOverview />} />
          <Route path="/community" element={<Community />} />
          <Route path="/circles" element={<CirclesRoute />} />
          <Route
            path="/circles/new"
            element={
              <Require>
                <CreateCircle />
              </Require>
            }
          />
          <Route path="/circles/:slug" element={<CirclesRoute detail />} />
          <Route path="/survival" element={<SurvivalGuide />} />
          <Route
            path="/survival/awards"
            element={
              <Require>
                <SurvivalDesk />
              </Require>
            }
          />
          <Route path="/certificate/:code" element={<Certificate />} />
          <Route path="/business" element={<BusinessRoute />} />
          <Route
            path="/business/survivors"
            element={
              <Require>
                <BusinessHub key="private" privateSpace member />
              </Require>
            }
          />
          <Route
            path="/business/manage"
            element={
              <Require>
                <ManageBusiness />
              </Require>
            }
          />
          <Route
            path="/credits"
            element={
              <Require>
                <CreditDesk />
              </Require>
            }
          />
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
        <NavLink className="nav-create" to="/new">
          <Plus />
          New
        </NavLink>
        <NavLink to={profilePath}>
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
function Avatar({
  profile,
  initialsOnly = false,
  label,
}: {
  profile: Profile | null;
  initialsOnly?: boolean;
  label?: string;
}) {
  const [broken, setBroken] = useState(false);
  const name = label || profile?.display_name || "Anonymous Survivor";
  const tone = (name.charCodeAt(0) + name.charCodeAt(1)) % 4;
  return (
    <span aria-hidden="true" className={`avatar tone-${tone}`}>
      {profile?.avatar_url && !broken && !initialsOnly ? (
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
      <Avatar
        profile={author}
        label={entry.system_seed ? "Survive9ja" : undefined}
      />
      {author ? (
        <Link to={"/u/" + author.username}>{author.display_name}</Link>
      ) : (
        <strong>
          {entry.system_seed ? "Survive9ja" : "Anonymous Survivor"}
        </strong>
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
function EntryCircle({ entry }: { entry: Entry }) {
  return entry.circle ? (
    <Link className="circle-label" to={"/circles/" + entry.circle.slug}>
      <UsersRound size={14} aria-hidden="true" /> {entry.circle.name}
    </Link>
  ) : null;
}
const categoryClass = (name: string) =>
  name.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and");
function likeCount(count: number) {
  return `${count} ${count === 1 ? "like" : "likes"}`;
}

function LikeButton({ item, path }: { item: Entry; path: string }) {
  const { session, profile, loading } = useAccount();
  const eligible = Boolean(session?.user.email_confirmed_at && profile?.completed_at);
  if (!loading && !eligible)
    return (
      <Link className="text-button like-button" to="/auth" state={{ next: path }} aria-label={`Sign in to like (${likeCount(item.reactions)})`}>
        <Heart size={16} aria-hidden="true" /> Like <span>{item.reactions}</span>
      </Link>
    );
  return (
    <MemberLike
      key={JSON.stringify([session?.user.id, item.id, item.mine, item.reactions])}
      item={item}
      disabled={loading}
    />
  );
}

function MemberLike({ item, disabled }: { item: Entry; disabled: boolean }) {
  // Every legacy Square reaction represents a single existing like.
  const [liked, setLiked] = useState(Boolean(item.mine));
  const [count, setCount] = useState(item.reactions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <span className="like-control">
      <button
        className="text-button like-button"
        type="button"
        aria-pressed={liked}
        aria-label={`Like (${likeCount(count)})`}
        disabled={disabled || busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await rpc("react_entry", { p_id: item.id, p_reaction: liked ? null : "Support" });
            setLiked(!liked);
            setCount((value) => Math.max(0, value + (liked ? -1 : 1)));
          } catch (reason) {
            setError(message(reason));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Heart size={16} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
        Like <span>{count}</span>
      </button>
      {error && <span className="notice error" role="alert">{error}</span>}
    </span>
  );
}

function EntryCard({ entry, gist = false }: { entry: Entry; gist?: boolean }) {
  if (gist) {
    const author = entry.author;
    const path = entryPath(entry);
    return (
      <article className="gist-entry">
        <Avatar
          profile={author}
          initialsOnly
          label={entry.system_seed ? "Survive9ja" : undefined}
        />
        <div className="gist-entry-copy">
          <EntryCircle entry={entry} />
          <div className="gist-entry-meta">
            {author ? (
              <Link to={"/u/" + author.username}>{author.display_name}</Link>
            ) : (
              <strong>
                {entry.system_seed ? "Survive9ja" : "Anonymous Survivor"}
              </strong>
            )}
            <span>·</span>
            <time dateTime={entry.created_at}>{age(entry.created_at)}</time>
          </div>
          <h2>
            <Link to={path}>{entry.title}</Link>
          </h2>
          <div className="share-row">
            <Link className="gist-replies" to={path + "#replies"}>
              <MessageCircle size={17} aria-hidden="true" />
              {entry.replies} {entry.replies === 1 ? "reply" : "replies"}
            </Link>
            <LikeButton item={entry} path={path} />
            <ShareConversation path={path} title={entry.title} />
          </div>
        </div>
        <Link
          className="gist-entry-open"
          aria-label={"Read " + entry.title}
          to={path}
        >
          <ArrowUpRight size={18} />
        </Link>
      </article>
    );
  }
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
      <EntryCircle entry={entry} />
      <h2>
        <Link to={entryPath(entry)}>{entry.title}</Link>
      </h2>
      <p className="excerpt"><MentionText text={entry.body} /></p>
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
          {entry.kind === "square" ? (
            <LikeButton item={entry} path={entryPath(entry)} />
          ) : (
            <Link to={entryPath(entry)} aria-label={`${entry.relate} people relate`}>
              <Heart size={16} /> {entry.relate} relate
            </Link>
          )}
          <ShareConversation path={entryPath(entry)} title={entry.title} />
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
function Feed({ kind, gist = false }: { kind: Kind; gist?: boolean }) {
  const diary = kind === "diary";
  const [showFilters, setShowFilters] = useState(false);
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
    <div className={gist ? "layout gist-layout" : "layout"}>
      <section className="feed min-w-0">
        {gist ? (
          <GistIntro />
        ) : (
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
        )}
        {gist && (
          <h2 className="gist-feed-heading" id="gist-feed">
            In The Square
          </h2>
        )}
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
            <button
              className="feed-filter-button"
              type="button"
              aria-controls="feed-filters"
              aria-expanded={showFilters}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters <ChevronDown size={16} />
            </button>
          </div>
          <div id="feed-filters" hidden={!showFilters}>
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
                Latest shows newest posts first. Trending weighs {diary ? "reactions" : "likes"} and
                replies, then gives newer discussions more weight. It looks back
                seven days.
              </p>
            </details>
          )}
        </div>
        {kind === "square" && Boolean(db) && <Sponsored kind="square" />}
        {!db && !preview && (
          <p className="notice">
            The community feed is unavailable. This deployment is missing its
            Supabase configuration.
          </p>
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
          <EntryCard key={entry.id} entry={entry} gist={gist} />
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
  backLabel = "Back",
}: {
  title: string;
  children: ReactNode;
  back?: string;
  backLabel?: string;
}) {
  return (
    <section className="narrow">
      {back && (
        <Link className="back" to={back}>
          <ArrowLeft size={16} /> {backLabel}
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
    return (
      <Navigate
        to="/auth"
        state={{
          next: onboarding ? undefined : location.pathname + location.search,
          confirmationFailed: onboarding && authCallback.failed,
        }}
        replace
      />
    );
  if (!session.user.email_confirmed_at)
    return (
      <Narrow title="Confirm your email">
        <p>Open the confirmation link in your inbox to continue.</p>
      </Narrow>
    );
  if (!onboarding && !profile?.completed_at)
    return (
      <Navigate
        to="/onboarding"
        state={{ next: location.pathname + location.search }}
        replace
      />
    );
  return children;
}
function PasswordField({
  existing,
  reset,
}: {
  existing: boolean;
  reset: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <label htmlFor="account-password">
        {reset ? "New password" : "Password"}
      </label>
      <div className="password-control">
        <input
          id="account-password"
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={existing ? "current-password" : "new-password"}
          minLength={existing ? undefined : 8}
          aria-describedby={existing ? undefined : "password-length"}
          required
        />
        <button
          type="button"
          aria-controls="account-password"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible(!visible)}
        >
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d={
                visible
                  ? "M5 4h14v7l-4 3-3-3-3 3-4-3z"
                  : "M5 4h14v12l-4 3-3-3-3 3-4-3z"
              }
            />
            {visible ? (
              <path d="M12 14v7m-3-2 3 2 3-2M9 8h6" />
            ) : (
              <path d="M9 10h6m-6 3h6" />
            )}
          </svg>
          <span>{visible ? "Hide" : "Show"}</span>
        </button>
      </div>
      {!existing && (
        <small id="password-length">Use at least 8 characters.</small>
      )}
    </div>
  );
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
  const authState = location.state as {
    next?: string;
    confirmationFailed?: boolean;
  } | null;
  const [error, setError] = useState(() =>
    authCallback.failed || authState?.confirmationFailed
      ? "This email link expired or has already been used. Sign in if your email is confirmed, or request a fresh confirmation link."
      : "",
  );
  const [info, setInfo] = useState("");
  const next = authState?.next;
  const confirmationTarget = window.location.origin + "/onboarding";
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
      if (mode === "resend") {
        const result = await db.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: confirmationTarget },
        });
        if (result.error) throw result.error;
        setInfo(
          "If this address has an unconfirmed account, check your inbox for a fresh link.",
        );
      } else if (mode === "reset") {
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
          options: { emailRedirectTo: confirmationTarget },
        });
        if (result.error) throw result.error;
        setInfo(
          "Check your inbox and spam folder for a confirmation link. If you already have an account, sign in. If you’re still waiting on a link, use Resend confirmation.",
        );
      } else {
        const result = await db.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
      }
    } catch (e) {
      const problem = message(e);
      if (
        (mode === "register" || mode === "resend") &&
        /error sending confirmation email/i.test(problem)
      ) {
        setError(
          "We couldn’t send the confirmation email. Please try Resend confirmation later.",
        );
      } else {
        setError(problem);
      }
    } finally {
      setBusy(false);
    }
  }
  if (session && !loading && (mode === "login" || mode === "register"))
    return (
      <Navigate
        to={profile?.completed_at ? next || profilePath : "/onboarding"}
        state={profile?.completed_at ? undefined : { next }}
        replace
      />
    );
  return (
    <Narrow
      title={
        mode === "register"
          ? "Join Survive9ja"
          : mode === "resend"
            ? "Resend confirmation email"
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
        {(mode === "login" || mode === "register" || mode === "reset") && (
          <PasswordField
            key={mode}
            existing={mode === "login"}
            reset={mode === "reset"}
          />
        )}
        <button
          className="button primary"
          disabled={!db || busy || loading || (mode === "reset" && !session)}
        >
          {mode === "register"
            ? "Create account"
            : mode === "resend"
              ? "Send new confirmation link"
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
            <button
              onClick={() => {
                setMode("resend");
                setError("");
                setInfo("");
              }}
            >
              Resend confirmation
            </button>
          </>
        ) : (
          <>
            {mode === "register" && (info || error) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setMode("resend");
                  setError("");
                  setInfo("");
                }}
              >
                Resend confirmation
              </button>
            )}
            <button
              onClick={() => {
                setMode("login");
                setError("");
                setInfo("");
              }}
            >
              Back to sign in
            </button>
          </>
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
  const { profile, refresh, session } = useAccount();
  const [avatar, setAvatar] = useState<AvatarChange>({ kind: "keep" });
  const [cropPending, setCropPending] = useState(false);
  const uploaded = useRef<{ blob: Blob; url: string } | null>(null);
  const [fields, setFields] = useState<ProfileFields>({
    username: profile?.username || "",
    name: profile?.display_name || "",
    country: profile?.country || "Nigeria",
    region: profile?.region || "",
    bio: profile?.bio || "",
    accept: false,
  });
  const [touched, setTouched] = useState<
    Partial<Record<keyof ProfileFields, boolean>>
  >({});
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const afterOnboarding = (location.state as { next?: string } | null)?.next;
  const editReturn = profileReturn(location.state) || profilePath;
  const errors = validateProfile(fields, onboarding);
  const nigeria = fields.country.trim().toLowerCase() === "nigeria";
  const steps = [
    {
      label: "Name",
      completed: !errors.username && !errors.name && !usernameError,
    },
    { label: "Location", completed: !errors.country && !errors.region },
    { label: "Review", completed: !errors.bio && !errors.accept },
  ];
  const complete = steps.filter((step) => step.completed).length;
  if (onboarding && profile?.completed_at)
    return <Navigate to={profilePath} replace />;

  function update(key: keyof ProfileFields, value: string | boolean) {
    if (key === "username") setUsernameError("");
    setFields((previous) => ({
      ...previous,
      ...(key === "country" &&
      typeof value === "string" &&
      (previous.country.trim().toLowerCase() === "nigeria") !==
        (value.trim().toLowerCase() === "nigeria")
        ? { region: "" }
        : {}),
      [key]: value,
    }));
  }

  function feedback(key: keyof ProfileFields) {
    return (
      (key === "username" && usernameError) ||
      ((attempted || touched[key]) && errors[key]) ||
      ""
    );
  }

  function fieldProps(key: keyof ProfileFields) {
    return {
      name: key,
      onBlur: () => setTouched((previous) => ({ ...previous, [key]: true })),
      "aria-invalid": Boolean(feedback(key)),
      "aria-describedby":
        [
          feedback(key) && key + "-error",
          (key === "username" || key === "bio") && key + "-hint",
        ]
          .filter(Boolean)
          .join(" ") || undefined,
    };
  }

  function fieldError(key: keyof ProfileFields) {
    const text = feedback(key);
    return text ? (
      <small className="field-error" id={key + "-error"}>
        {text}
      </small>
    ) : null;
  }

  function focusField(key: keyof ProfileFields) {
    requestAnimationFrame(() => {
      const input = formRef.current?.elements.namedItem(key);
      if (input instanceof HTMLElement) input.focus();
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview || busy || cropPending) return;
    setAttempted(true);
    setError("");
    const firstInvalid = (Object.keys(errors) as (keyof ProfileFields)[])[0];
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }
    if (usernameError) {
      focusField("username");
      return;
    }
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      let avatarUrl =
        avatar.kind === "keep" ? profile?.avatar_url || null : null;
      if (avatar.kind === "replace") {
        if (!session) throw new Error("Sign in to upload your profile photo.");
        if (uploaded.current?.blob !== avatar.blob) {
          uploaded.current = {
            blob: avatar.blob,
            url: await uploadAvatar(session.user.id, avatar.blob),
          };
        }
        avatarUrl = uploaded.current.url;
      }
      await rpc("save_profile", {
        p_username: fields.username,
        p_name: fields.name.trim(),
        p_country: fields.country.trim(),
        p_region: fields.region.trim() || null,
        p_bio: fields.bio.trim() || null,
        p_abroad: form.has("abroad"),
        p_avatar: avatarUrl,
        p_terms: fields.accept ? "draft-1" : null,
        p_privacy: fields.accept ? "draft-1" : null,
      });
      await refresh();
      navigate(
        onboarding && afterOnboarding
          ? afterOnboarding
          : onboarding ? profilePath : editReturn,
      );
    } catch (e) {
      const problem = message(e);
      if (problem === "That username is already taken.") {
        setUsernameError(problem);
        focusField("username");
      } else {
        setError(
          problem === "Failed to fetch"
            ? "Couldn’t reach the server. Check your connection and try saving again."
            : problem,
        );
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Narrow
      title={onboarding ? "Make yourself at home" : "Edit your profile"}
      back={onboarding ? "/" : editReturn}
      backLabel={onboarding ? undefined : "Back to profile"}
    >
      <p>
        Your username, display name and location details appear on your public
        profile after onboarding.
      </p>
      {onboarding && (
        <div className="profile-progress">
          <div>
            <strong>Profile progress</strong>
            <span>
              {complete} of {steps.length} complete
            </span>
          </div>
          <progress
            aria-label="Profile readiness"
            value={complete}
            max={steps.length}
          />
          <ul aria-label="Profile sections">
            {steps.map((step) => (
              <li key={step.label} data-complete={step.completed}>
                {step.label}
                <span className="sr-only">
                  {" "}
                  {step.completed ? "complete" : "incomplete"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Status
        error={
          error ||
          (attempted && (Object.keys(errors).length || usernameError)
            ? "Check the highlighted fields before saving."
            : "")
        }
        info={
          preview
            ? "Preview only · Connect Supabase to save a profile."
            : undefined
        }
      />
      {!onboarding && <CommunityShortcuts />}
      <form
        ref={formRef}
        className="form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <label>
          Username
          <input
            {...fieldProps("username")}
            value={fields.username}
            onChange={(e) => update("username", e.target.value)}
            required
            autoCapitalize="none"
            spellCheck={false}
          />
          <small id="username-hint">
            3–20 lowercase letters, numbers or underscores.
          </small>
          {fieldError("username")}
        </label>
        <label>
          Display name
          <input
            {...fieldProps("name")}
            value={fields.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />
          {fieldError("name")}
        </label>
        <label>
          Country · public
          <input
            {...fieldProps("country")}
            value={fields.country}
            onChange={(e) => update("country", e.target.value)}
            required
          />
          {fieldError("country")}
        </label>
        <label>
          {nigeria ? "State or FCT · public" : "City · optional, public"}
          {nigeria ? (
            <select
              {...fieldProps("region")}
              value={fields.region}
              onChange={(e) => update("region", e.target.value)}
              required
            >
              <option value="">Choose a state or FCT</option>
              {states.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          ) : (
            <input
              {...fieldProps("region")}
              value={fields.region}
              onChange={(e) => update("region", e.target.value)}
            />
          )}
          {fieldError("region")}
        </label>
        <label>
          Bio · optional
          <textarea
            {...fieldProps("bio")}
            value={fields.bio}
            onChange={(e) => update("bio", e.target.value)}
            rows={3}
          />
          <small id="bio-hint">
            {Array.from(fields.bio.trim()).length} of 160 characters
          </small>
          {fieldError("bio")}
        </label>
        <AvatarEditor
          existing={profile?.avatar_url}
          value={avatar}
          onChange={setAvatar}
          onPending={setCropPending}
          disabled={busy}
        />
        <label className="check">
          <input
            type="checkbox"
            name="abroad"
            defaultChecked={profile?.abroad}
          />
          Show a public Based abroad badge
        </label>
        {onboarding && (
          <div>
            <label className="check">
              <input
                {...fieldProps("accept")}
                type="checkbox"
                checked={fields.accept}
                onChange={(e) => update("accept", e.target.checked)}
                required
              />
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
            {fieldError("accept")}
          </div>
        )}
        <button
          className="button primary"
          disabled={busy || preview || cropPending}
        >
          {busy
            ? "Saving…"
            : onboarding
              ? "Complete onboarding"
              : "Save profile"}
        </button>
      </form>
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
                  · <Link to={"/diaries/edit/" + row.id} state={{ fromProfile: profilePath }}>Edit story</Link>
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
function BusinessRoute() {
  const { profile, session } = useAccount();
  return (
    <BusinessHub
      member={Boolean(
        profile?.completed_at && session?.user.email_confirmed_at,
      )}
    />
  );
}
function CirclesRoute({ detail = false }: { detail?: boolean }) {
  const { slug } = useParams();
  const { session, profile } = useAccount();
  const member = Boolean(
    session?.user.email_confirmed_at && profile?.completed_at,
  );
  return detail ? (
    <CirclePage
      key={slug}
      member={member}
      renderPost={(entry) => <EntryCard key={entry.id} entry={entry} />}
    />
  ) : (
    <CirclesDirectory member={member} />
  );
}

function CommunityShortcuts() {
  return (
    <nav className="community-shortcuts" aria-label="Community features">
      <Link className="button secondary" to="/circles">
        Circles
      </Link>
      <Link className="button secondary" to="/survival">
        Survival Levels
      </Link>
      <Link className="button secondary" to="/business">
        Business Hub
      </Link>
      <Link className="button secondary" to="/credits">
        Credit Book
      </Link>
    </nav>
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
          to={profile?.completed_at ? profilePath : "/auth"}
        >
          {profile?.completed_at ? "My profile" : "Join the community"}
        </Link>
      </div>
      <CommunityShortcuts />
      <img
        className="community-logo"
        src="/survive9ja-logo.svg"
        alt="Survive9ja. Discuss. Express. Build. Survive."
        width={230}
        height={200}
        loading="lazy"
      />
      <SectionLinks />
    </Narrow>
  );
}
function ProfileOverview({ own = false }: { own?: boolean }) {
  const params = useParams();
  const account = useAccount();
  const { state } = useLocation();
  const navigate = useNavigate();
  const username = own ? account.profile?.username : params.username;
  const returnPath = profileReturn(state);
  const [signOutError, setSignOutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
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
  const profile = own ? account.profile : sample || current?.profile;
  if (!profile)
    return (
      <Narrow
        title={db && !current ? "Loading profile…" : "Profile unavailable"}
        back={returnPath || "/"}
        backLabel={returnPath ? "Back to profile" : undefined}
      >
        <Status error={current?.error} />
      </Narrow>
    );

  const owner = account.profile?.username === profile.username;
  const source = own ? profilePath : "/u/" + profile.username;
  const publicActivity = sample
    ? examples.filter((entry) => entry.author?.username === username)
    : current?.entries || [];

  return (
    <section className="narrow profile-page">
      {!own && (
        <Link className="back" to={returnPath || "/"}>
          <ArrowLeft size={16} /> {returnPath ? "Back to profile" : "The Square"}
        </Link>
      )}
      <header className="profile-summary">
        <div className="profile-identity">
          <Avatar key={profile.avatar_url} profile={profile} />
          <div>
            <h1>{profile.display_name}</h1>
            <p className="profile-handle">@{profile.username}</p>
          </div>
        </div>
        <div className="profile-location">
          <span><MapPin size={16} aria-hidden="true" /> {[profile.region, profile.country].filter(Boolean).join(", ")}</span>
          {profile.abroad && <span className="tag">Based abroad</span>}
        </div>
        {profile.bio && <p className="prose-body profile-bio">{profile.bio}</p>}
        {sample && <p className="notice">Fictional preview profile</p>}
        <div className="item-actions profile-actions">
          {owner && <Link className="button primary" to={settings} state={{ fromProfile: source }}>Edit profile</Link>}
          {own && <Link className="button secondary" to={"/u/" + profile.username} state={{ fromProfile: source }}>View public profile</Link>}
          <PublicBadge key={profile.username} username={profile.username} fromProfile={source} />
        </div>
      </header>
      <section className="profile-activity" aria-labelledby="profile-activity-title">
        <h2 id="profile-activity-title">Public activity</h2>
        <Status error={current?.error} />
        {db && !current && <p role="status">Loading activity…</p>}
        {(sample || (current && !current.error)) && !publicActivity.length && (
          <p className="muted">Public gists and diaries will appear here.</p>
        )}
        {publicActivity.length > 0 && (
          <ul className="profile-activity-list">
            {publicActivity.map((entry) => (
              <li key={entry.id}>
                <span className="muted">{entry.kind === "diary" ? "Diary" : "Gist"} · {entry.category} · <time dateTime={entry.created_at}>{age(entry.created_at)}</time></span>
                <Link to={entryPath(entry)} state={{ fromProfile: source }}>{entry.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {own && (
        <>
          <MyDiaries />
          <Status error={signOutError} />
          <button
            className="button secondary"
            disabled={signingOut}
            onClick={async () => {
              if (!db) return;
              setSigningOut(true);
              setSignOutError("");
              try {
                const { error } = await db.auth.signOut();
                if (error) throw error;
                navigate("/", { replace: true });
              } catch (reason) {
                setSignOutError(message(reason));
              } finally {
                setSigningOut(false);
              }
            }}
          >
            Sign out
          </button>
        </>
      )}
    </section>
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
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const diary = kind === "diary";
  const location = useLocation();
  const [destination, setDestination] = useState(() =>
    new URLSearchParams(location.search).get("circle") ?? "",
  );
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
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const fields = {
      p_title: String(form.get("title")).trim(),
      p_body: String(form.get("body")).trim(),
      p_category: String(form.get("category")),
    };
    setBusy(true);
    setError("");
    try {
      if (!diary && destination === newCircleDestination) {
        const slug = await rpc<string>("create_circle", {
          ...fields,
          p_name: String(form.get("name") || "").trim(),
          p_description: String(form.get("description") || "").trim(),
        });
        navigate("/circles/" + slug);
        return;
      }
      const saved = await (id
        ? rpc<string>("edit_diary", { ...fields, p_id: id })
        : !diary && destination
          ? rpc<string>("publish_circle_post", {
              ...fields,
              p_slug: destination,
            })
          : rpc<string>("publish_entry", {
              ...fields,
              p_kind: kind,
              p_anonymous: anonymousAvailable && form.has("anonymous"),
            }));
      navigate((id && profileReturn(location.state)) || (diary ? "/diary/" : "/post/") + saved);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const categoryField = (
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
  );
  return (
    <Narrow
      title={
        id
          ? "Edit your story"
          : diary
            ? "Share your story"
            : "Start a gist"
      }
      back={profileReturn(location.state) || (diary ? "/diaries" : "/")}
      backLabel={profileReturn(location.state) ? "Back to profile" : undefined}
    >
      {diary && <p>Write from your own experience. Details in your story can identify you.</p>}
      <Status
        error={error}
        info={
          preview
            ? "Preview only · Connect Supabase to publish."
            : id && !loaded
              ? "Loading your story…"
              : id && !entry
                ? "This story is unavailable for editing."
                : undefined
        }
      />
      {(!id || entry) && (
        <form className="form" onSubmit={(e) => void submit(e)}>
          {!diary && (
            <CircleDestination
              selected={destination}
              onChange={setDestination}
            />
          )}
          <label>
            Title
            <input
              name="title"
              required
              maxLength={140}
              defaultValue={entry?.title}
            />
          </label>
          {diary && categoryField}
          <MentionField
            label={diary ? "Your story" : "Your gist"}
            placeholder={diary ? undefined : "Wetin dey happen?"}
            name="body"
            required
            rows={diary ? 13 : 5}
            maxLength={diary ? 20000 : 6000}
            defaultValue={entry?.body}
          />
          {!diary && categoryField}
          {diary && !id && (
            <div>
              <label className="check">
                <input
                  type="checkbox"
                  name="anonymous"
                  disabled={!anonymousAvailable}
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
            disabled={busy || preview}
          >
            {id
              ? "Save changes"
              : diary
                ? "Publish story"
                : destination === newCircleDestination
                  ? "Create Circle and post"
                  : "Publish gist"}
          </button>
        </form>
      )}
      {!diary && <Link className="text-button" to="/diaries/new">Write a Diary instead</Link>}
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
  const { hash, state } = useLocation();
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
  const returnPath = profileReturn(state);
  const back = returnPath || (diary ? "/diaries" : "/");
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
  const diaryOpened = kind === "diary" ? thread?.entry.id : undefined;
  useEffect(() => {
    if (diaryOpened) rememberGistDiary(diaryOpened);
  }, [diaryOpened]);
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
        backLabel={returnPath ? "Back to profile" : undefined}
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
  function actions(item: Entry, conversationActions?: ReactNode) {
    return (
      <div className="item-actions">
        {diary ? diaryReactions.map((reaction) => (
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
        )) : <LikeButton item={item} path={entryPath(entry)} />}
        {conversationActions}
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
        <p className="prose-body"><MentionText text={reply.body} /></p>
        {actions(reply, eligible && !reply.parent_id && (
          <button
            className="text-button"
            onClick={() => {
              setTarget(reply);
              document.getElementById("reply-body")?.focus();
            }}
          >
            <MessageCircle size={16} aria-hidden="true" /> Reply
          </button>
        ))}
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
        <ArrowLeft size={16} /> {returnPath ? "Back to profile" : diary ? "The Diaries" : "The Square"}
      </Link>
      <span className={`tag ${categoryClass(entry.category)}`}>
        {entry.category}
      </span>
      <EntryCircle entry={entry} />
      <h1>{entry.title}</h1>
      {kind === "diary" && !entry.anonymous && !sample && (
        <SurvivalVote
          key={entry.id}
          id={entry.id}
          canVote={eligible}
          owner={entry.owned}
        />
      )}
      {kind === "square" && entry.owned && !sample && (
        <Boost kind="square" id={entry.id} />
      )}
      <Byline entry={entry} />
      {sample && <Status info="Fictional preview content" />}
      <div className="prose-body"><MentionText text={entry.body} /></div>
      {entry.owned && diary && (
        <Link className="button secondary" to={"/diaries/edit/" + entry.id} state={state}>
          Edit story
        </Link>
      )}
      {diary && <p className="muted">{entry.relate} people relate</p>}
      {actions(entry, <>
        <Link className="text-button" to={entryPath(entry) + "#replies"} state={state}>
          <MessageCircle size={16} aria-hidden="true" /> {entry.replies} {entry.replies === 1 ? "reply" : "replies"}
        </Link>
        <ShareConversation path={entryPath(entry)} title={entry.title} />
      </>)}
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
            {target && (
              <button
                type="button"
                className="text-button"
                onClick={() => setTarget(null)}
              >
                Cancel reply
              </button>
            )}
            <MentionField
              label={target ? `Reply to ${target.author?.display_name ?? "this reply"}` : "Add a reply"}
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
  system_seed?: boolean;
  banned: boolean;
  created_at: string;
};
type Queue = { items: Review[]; open: number; hidden: number; banned: number };
function Admin() {
  const { session } = useAccount();
  return (
    <Require>
      {session && (
        <AdminDashboard
          key={session.user.id}
          token={session.access_token}
          moderation={<><Moderation /><ExpansionModeration /><CircleModeration /></>}
        />
      )}
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
                    ...(item.system_seed
                      ? []
                      : [item.banned ? "unban" : "ban"]),
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
