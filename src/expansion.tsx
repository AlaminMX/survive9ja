import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Award as AwardIcon,
  Compass,
  Flag,
  Shield,
  Sprout,
} from "lucide-react";
import { db, message, rpc } from "./api";

const levels = [
  "",
  "Survivor",
  "Steady Survivor",
  "Pathfinder",
  "Survival Veteran",
  "Survival Legend",
];
const levelMarks = [Sprout, Sprout, Shield, Compass, Flag, AwardIcon];
function LevelMark({ level }: { level: number }) {
  const Icon = levelMarks[level];
  return Icon ? <Icon size={20} aria-hidden="true" /> : null;
}
const kinds = ["Business", "Product", "Service", "Initiative", "Collaboration"];
const questions = [
  [
    "A neighbour helped you. How do you share the lesson?",
    "Publish their contact details",
    "Describe the lesson and get consent for identifiable details",
    "Post their private messages",
  ],
  [
    "You need help with a new problem. What is the best first step?",
    "Assume the first online tip is correct",
    "Share your passwords with a volunteer",
    "Identify the specific problem and ask a trusted source",
  ],
  [
    "You see someone offer surprising financial advice. What should you do?",
    "Check the claim against reliable sources",
    "Forward the advice immediately",
    "Send them money to find out",
  ],
];
const responses = (form: HTMLFormElement) => new FormData(form);
const value = (form: FormData, key: string) => String(form.get(key) || "");

function useRemote<T>(
  name: string,
  args: Record<string, unknown> = {},
  enabled = true,
) {
  const key = JSON.stringify(args);
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  const [revision, refresh] = useState(0);
  useEffect(() => {
    if (!enabled || !db) return;
    let active = true;
    void rpc<T>(name, JSON.parse(key) as Record<string, unknown>).then(
      (data) => {
        if (active) setState({ data });
      },
      (error) => {
        if (active) setState({ error: message(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [name, key, enabled, revision]);
  return { ...state, reload: () => refresh((n) => n + 1) };
}

function useAction() {
  const [status, setStatus] = useState({ busy: false, error: "", info: "" });
  async function run(task: () => Promise<unknown>, info = "") {
    setStatus({ busy: true, error: "", info: "" });
    try {
      await task();
      setStatus({ busy: false, error: "", info });
      return true;
    } catch (error) {
      setStatus({ busy: false, error: message(error), info: "" });
      return false;
    }
  }
  return { ...status, run };
}

function Feedback({ error, info }: { error?: string; info?: string }) {
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

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="narrow feature-page">
      <Link className="back" to="/community">
        ← The Community
      </Link>
      <h1>{title}</h1>
      {children}
    </section>
  );
}

type Award = { code: string; shared: boolean };
type Submission = {
  id: string;
  title: string;
  score: number | null;
  quiz: number | null;
  approved: number | null;
};
type Survival = { level: number; award: Award | null; stories: Submission[] };

export function SurvivalDesk() {
  const result = useRemote<Survival>("my_survival");
  const action = useAction();
  const [story, setStory] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = responses(event.currentTarget);
    void action.run(async () => {
      await rpc("submit_survival", {
        p_story: story,
        p_context: value(form, "context"),
        p_duration: value(form, "duration"),
        p_challenges: value(form, "challenges"),
        p_response: value(form, "response"),
        p_lesson: value(form, "lesson"),
        p_answers: questions.map((_, i) => Number(form.get("q" + i))),
      });
      result.reload();
    }, "Diary submitted. Members can now vote on its page.");
  }
  return (
    <Panel title="Your Survival Level">
      <p>
        Submit a named Diary, answer three scenarios and invite readers to
        consider your story. Certificates are free.
      </p>
      <Feedback error={action.error || result.error} info={action.info} />
      {!result.data && !result.error && (
        <p role="status">Loading your submissions…</p>
      )}
      {result.data && (
        <>
          <div className="community-call">
            <h2>
              {result.data.level
                ? `Level ${result.data.level} · ${levels[result.data.level]}`
                : "No level awarded yet"}
            </h2>
            {result.data.award && (
              <div className="item-actions">
                <button
                  className="button secondary"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(
                      async () => {
                        await rpc("share_survival", {
                          p_shared: !result.data?.award?.shared,
                        });
                        result.reload();
                      },
                      result.data?.award?.shared
                        ? "Public sharing turned off."
                        : "Certificate and badge are now public.",
                    )
                  }
                >
                  {result.data.award.shared
                    ? "Stop sharing"
                    : "Share badge and certificate"}
                </button>
                <Link
                  className="button primary"
                  to={"/certificate/" + result.data.award.code}
                >
                  {result.data.award.shared
                    ? "Open certificate"
                    : "Open private certificate"}
                </Link>
              </div>
            )}
          </div>
          {result.data.stories
            .filter((s) => s.score !== null)
            .map((s) => (
              <div className="community-call" key={s.id}>
                <h3>
                  <Link to={"/diary/" + s.id}>{s.title}</Link>
                </h3>
                <p>
                  {s.score} points · {s.quiz}/3 scenarios correct{" "}
                  {s.approved ? `· Approved for Level ${s.approved}` : ""}
                </p>
                <button
                  className="button secondary"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () => {
                      await rpc("claim_survival", { p_story: s.id });
                      result.reload();
                    }, "Level checked.")
                  }
                >
                  Claim or update level
                </button>
              </div>
            ))}
          {result.data.stories.length ? (
            <form className="form" onSubmit={submit}>
              <label>
                Choose your Diary
                <select
                  required
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                >
                  <option value="">Select a named Diary</option>
                  {result.data.stories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
              {[
                ["context", "What happened?"],
                ["duration", "How long did it last?"],
                ["challenges", "What challenges came up?"],
                ["response", "What did you do?"],
                ["lesson", "What could help someone else?"],
              ].map(([name, label]) => (
                <label key={name}>
                  {label}
                  <textarea
                    required
                    name={name}
                    minLength={name === "duration" ? 3 : 20}
                    maxLength={name === "duration" ? 120 : 600}
                    rows={2}
                  />
                </label>
              ))}
              <p>
                These answers go to reviewers. Leave out private evidence,
                identity details and information about others.
              </p>
              {questions.map(([q, ...options], index) => (
                <fieldset key={q}>
                  <legend>{q}</legend>
                  {options.map((choice, i) => (
                    <label className="survival-answer" key={choice}>
                      <input
                        type="radio"
                        required
                        name={"q" + index}
                        value={i}
                      />
                      {choice}
                    </label>
                  ))}
                </fieldset>
              ))}
              <button disabled={action.busy} className="button primary">
                Submit story and quiz
              </button>
            </form>
          ) : (
            <Link to="/diaries/new" className="button primary">
              Write a Diary
            </Link>
          )}
        </>
      )}
    </Panel>
  );
}

export function SurvivalVote({
  id,
  canVote,
  owner,
}: {
  id: string;
  canVote: boolean;
  owner: boolean;
}) {
  const result = useRemote<{
    useful: number;
    vouches: number;
    vote: string | null;
  } | null>("survival_story", { p_story: id });
  const action = useAction();
  if (!result.data)
    return owner ? (
      <p>
        <Link to="/survival/awards">
          Submit this Diary for a Survival Level
        </Link>
      </p>
    ) : null;
  const vote = result.data.vote;
  return (
    <aside className="community-call">
      <h2>Survival story feedback</h2>
      <p>
        {result.data.useful} useful · {result.data.vouches} vouches
      </p>
      <Feedback error={action.error} info={action.info} />
      {!owner &&
        (canVote ? (
          <div className="item-actions">
            {[
              ["useful", "Useful lesson"],
              ["vouch", "I can vouch"],
            ].map(([key, label]) => (
              <button
                key={key}
                className="button secondary"
                type="button"
                disabled={action.busy}
                aria-pressed={vote === key}
                onClick={() =>
                  void action.run(async () => {
                    await rpc("vote_survival", {
                      p_story: id,
                      p_kind: vote === key ? null : key,
                    });
                    result.reload();
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <Link to="/auth">Sign in to give feedback</Link>
        ))}
      {owner && <Link to="/survival/awards">Review your submission</Link>}
    </aside>
  );
}

export function Certificate() {
  const { code } = useParams();
  const valid = Boolean(code && /^[0-9a-f-]{36}$/i.test(code));
  const result = useRemote<{
    level: number;
    name: string;
    issued_at: string;
    id: string;
  } | null>("verify_survival", { p_code: code }, valid);
  return (
    <Panel title="Certificate of Survival">
      <Feedback error={result.error} />
      {result.data ? (
        <article
          className="community-call printable-certificate"
          data-level={result.data.level}
        >
          <span className="certificate-mark">
            <LevelMark level={result.data.level} />
          </span>
          <p>Survive9ja</p>
          <h2>{levels[result.data.level]}</h2>
          <p>
            Presented to <strong>{result.data.name}</strong> · Level{" "}
            {result.data.level}
          </p>
          <p>
            Issued{" "}
            {new Date(result.data.issued_at).toLocaleDateString("en-NG", {
              timeZone: "Africa/Lagos",
            })}
          </p>
          <p>
            Verification ID <code>{result.data.id}</code>
          </p>
          <p>A symbolic community award for a contribution to Survive9ja.</p>
          <button className="button secondary" onClick={() => window.print()}>
            Print or save as PDF
          </button>
        </article>
      ) : (
        <p>
          {!valid || result.data === null
            ? "This certificate is unavailable or its holder has stopped sharing it."
            : result.error
              ? "Verification unavailable."
              : "Checking the certificate…"}
        </p>
      )}
    </Panel>
  );
}

export function PublicBadge({ username }: { username: string }) {
  const result = useRemote<{ level: number; code: string } | null>(
    "public_survival_badge",
    { p_username: username },
  );
  return result.data ? (
    <Link className="button secondary" to={"/certificate/" + result.data.code}>
      <LevelMark level={result.data.level} /> Level {result.data.level} ·{" "}
      {levels[result.data.level]}
    </Link>
  ) : null;
}

type Listing = {
  id: string;
  kind: string;
  title: string;
  description: string;
  location: string | null;
  website: string | null;
  status?: string;
  username?: string;
  display_name?: string;
  reports?: string[];
};
type Promotion = { id: string; title: string };
export function Sponsored({ kind }: { kind: "square" | "business" }) {
  const result = useRemote<Promotion[]>("sponsored_content", { p_kind: kind });
  return result.data?.length ? (
    <aside className="community-call">
      <h2>Sponsored</h2>
      {result.data.map((p) => (
        <p key={p.id}>
          <Link
            to={
              kind === "square" ? "/post/" + p.id : "/business?listing=" + p.id
            }
          >
            {p.title}
          </Link>
        </p>
      ))}
    </aside>
  ) : null;
}
export function Boost({
  kind,
  id,
}: {
  kind: "square" | "business";
  id: string;
}) {
  const action = useAction();
  return (
    <details>
      <summary>Boost for 24 hours</summary>
      <p>One credit. Boosts appear in a labelled Sponsored section.</p>
      <button
        className="button secondary"
        disabled={action.busy || Boolean(action.info)}
        onClick={() =>
          void action.run(
            () => rpc("boost_content", { p_kind: kind, p_id: id }),
            "Boost active for 24 hours.",
          )
        }
      >
        Spend one credit
      </button>
      <Feedback error={action.error} info={action.info} />
    </details>
  );
}

export function BusinessHub({
  privateSpace = false,
  member = false,
}: {
  privateSpace?: boolean;
  member?: boolean;
}) {
  const [search] = useSearchParams();
  const listingId = search.get("listing");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const result = useRemote<Listing[]>("business_directory", {
    p_query: query,
    p_kind: kind || null,
    p_private: privateSpace,
    p_listing: listingId,
  });
  const action = useAction();
  return (
    <Panel title={privateSpace ? "Business Survivors" : "Business Hub"}>
      <div className="item-actions">
        <Link
          className="button secondary"
          to={privateSpace ? "/business" : "/business/survivors"}
        >
          {privateSpace ? "Public directory" : "Business Survivors · Level 3+"}
        </Link>
        <Link className="button primary" to="/business/manage">
          Manage listings
        </Link>
      </div>
      {!privateSpace && <Sponsored kind="business" />}
      {listingId && !privateSpace && (
        <Link to="/business">Browse the full directory</Link>
      )}
      {!listingId && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            const data = responses(e.currentTarget);
            setQuery(value(data, "query"));
            setKind(value(data, "kind"));
          }}
        >
          <label>
            Search listings
            <input name="query" maxLength={100} />
          </label>
          {!privateSpace && (
            <label>
              Category
              <select name="kind">
                <option value="">All categories</option>
                {kinds.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
          )}
          <button className="button secondary">Search</button>
        </form>
      )}
      <Feedback error={result.error || action.error} info={action.info} />
      {result.data?.length === 0 && <p>No matching listings yet.</p>}
      {result.data?.map((item) => (
        <article className="community-call" key={item.id}>
          <small>
            {item.kind} {item.location && `· ${item.location}`}
          </small>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
          <Link to={"/u/" + item.username}>{item.display_name}</Link>
          {item.website && (
            <p>
              <a href={item.website} target="_blank" rel="noopener noreferrer">
                Visit website ↗
              </a>
            </p>
          )}
          {member && (
            <details>
              <summary>Report listing</summary>
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = responses(e.currentTarget);
                  void action.run(
                    () =>
                      rpc("report_business", {
                        p_id: item.id,
                        p_reason: value(form, "reason"),
                      }),
                    "Report sent.",
                  );
                }}
              >
                <label>
                  Reason
                  <input name="reason" required minLength={5} maxLength={300} />
                </label>
                <button className="button secondary" disabled={action.busy}>
                  Send report
                </button>
              </form>
            </details>
          )}
        </article>
      ))}
    </Panel>
  );
}

export function ManageBusiness() {
  const result = useRemote<Listing[]>("my_business");
  const survival = useRemote<Survival>("my_survival");
  const [editing, setEditing] = useState<Listing | null>(null);
  const action = useAction();
  return (
    <Panel title="Manage business listings">
      <p>New listings and edits go to moderators for review.</p>
      <Feedback error={action.error || result.error} info={action.info} />
      <form
        className="form"
        key={editing?.id || "new"}
        onSubmit={(e) => {
          e.preventDefault();
          const target = e.currentTarget;
          const form = responses(target);
          void action.run(async () => {
            await rpc("save_business", {
              p_id: editing?.id || null,
              p_kind: value(form, "kind"),
              p_title: value(form, "title"),
              p_description: value(form, "description"),
              p_location: value(form, "location"),
              p_website: value(form, "website"),
            });
            setEditing(null);
            result.reload();
            target.reset();
          }, "Submitted for moderation.");
        }}
      >
        <label>
          Category
          <select name="kind" defaultValue={editing?.kind || "Business"}>
            {[
              ...kinds,
              ...((survival.data?.level || 0) >= 3
                ? ["Business Survivors"]
                : []),
            ].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input
            name="title"
            required
            minLength={3}
            maxLength={100}
            defaultValue={editing?.title}
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            rows={4}
            required
            minLength={20}
            maxLength={2000}
            defaultValue={editing?.description}
          />
        </label>
        <label>
          Location
          <input
            name="location"
            maxLength={100}
            defaultValue={editing?.location || ""}
          />
        </label>
        <label>
          Website
          <input
            name="website"
            type="url"
            placeholder="https://"
            maxLength={300}
            defaultValue={editing?.website || ""}
          />
        </label>
        <button className="button primary" disabled={action.busy}>
          {editing ? "Submit edit" : "Submit listing"}
        </button>
        {editing && (
          <button
            className="button secondary"
            type="button"
            onClick={() => setEditing(null)}
          >
            Cancel editing
          </button>
        )}
      </form>
      {result.data?.map((item) => (
        <article className="community-call" key={item.id}>
          <h2>{item.title}</h2>
          <p>
            {item.kind} · {item.status}
          </p>
          {item.status !== "hidden" && (
            <button
              className="button secondary"
              onClick={() => setEditing(item)}
            >
              Edit listing
            </button>
          )}
          {item.status === "published" &&
            item.kind !== "Business Survivors" && (
              <Boost kind="business" id={item.id} />
            )}
        </article>
      ))}
    </Panel>
  );
}

type Wallet = {
  balance: number;
  activity: { id: number; delta: number; reason: string; created_at: string }[];
  packs: { id: string; credits: number; amount_kobo: number }[];
};
const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
});
export function CreditDesk() {
  const result = useRemote<Wallet>("credit_wallet");
  const action = useAction();
  const returned = new URLSearchParams(window.location.search).has("checkout");
  async function buy(pack: string) {
    const { data } = await db!.auth.getSession();
    if (!data.session) throw Error("Sign in to buy credits.");
    const response = await fetch("/api/paystack/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({ pack }),
    });
    const body = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !body.url)
      throw Error(body.error || "Checkout is unavailable.");
    const destination = new URL(body.url);
    if (destination.origin !== "https://checkout.paystack.com")
      throw Error("Invalid checkout destination.");
    window.location.assign(destination.href);
  }
  return (
    <Panel title="Credit Book">
      <p>Credits buy optional promotion. A 24-hour boost costs one credit.</p>
      {returned && (
        <p className="notice">
          Credits appear after payment is verified.{" "}
          <button className="text-button" onClick={result.reload}>
            Refresh balance
          </button>
        </p>
      )}
      <Feedback error={action.error || result.error} info={action.info} />
      {result.data && (
        <>
          <h2>Balance: {result.data.balance}</h2>
          <button
            className="button secondary"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await rpc("earn_survival_credit");
                result.reload();
              }, "Participation credit checked. Each member can earn this credit once.")
            }
          >
            Claim Survival participation credit
          </button>
          <h2>Credit packs</h2>
          {!result.data.packs.length && (
            <p>Credit purchases are unavailable at the moment.</p>
          )}
          <div className="item-actions">
            {result.data.packs.map((pack) => (
              <button
                className="button primary"
                key={pack.id}
                disabled={action.busy}
                onClick={() => void action.run(() => buy(pack.id))}
              >
                {pack.credits} credits · {naira.format(pack.amount_kobo / 100)}
              </button>
            ))}
          </div>
          <h2>Recent activity</h2>
          {!result.data.activity.length && (
            <p>Your credit activity will appear here.</p>
          )}
          <ul>
            {result.data.activity.map((row) => (
              <li key={row.id}>
                {row.delta > 0 ? "+" : ""}
                {row.delta} · {row.reason} ·{" "}
                {new Date(row.created_at).toLocaleDateString("en-NG", {
                  timeZone: "Africa/Lagos",
                })}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

type Review = {
  story_id: string;
  title: string;
  context: string;
  duration: string;
  challenges: string;
  response: string;
  lesson: string;
  quiz_score: number;
  score: number;
  approved_level: number | null;
};
export function ExpansionModeration() {
  const stories = useRemote<Review[]>("survival_review_queue");
  const businesses = useRemote<Listing[]>("business_review_queue");
  const action = useAction();
  return (
    <section className="community-call">
      <h2>Survival reviews</h2>
      <Feedback
        error={action.error || stories.error || businesses.error}
        info={action.info}
      />
      {stories.data?.length === 0 && <p>No top-level submissions to review.</p>}
      {stories.data?.map((s) => (
        <article className="community-call" key={s.story_id}>
          <h3>
            <Link to={"/diary/" + s.story_id}>{s.title}</Link>
          </h3>
          <p>
            {s.score} points · {s.quiz_score}/3 scenarios correct
          </p>
          <dl>
            <dt>Context</dt>
            <dd>{s.context}</dd>
            <dt>Duration</dt>
            <dd>{s.duration}</dd>
            <dt>Challenges</dt>
            <dd>{s.challenges}</dd>
            <dt>Response</dt>
            <dd>{s.response}</dd>
            <dt>Lesson</dt>
            <dd>{s.lesson}</dd>
          </dl>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = responses(e.currentTarget);
              void action.run(async () => {
                await rpc("approve_survival", {
                  p_story: s.story_id,
                  p_level: Number(value(data, "level")),
                  p_note: value(data, "reason"),
                });
                stories.reload();
              }, "Review recorded.");
            }}
          >
            <label>
              Approve level
              <select name="level" required>
                {(s.approved_level === 4
                  ? [5]
                  : s.score >= 90
                    ? [4, 5]
                    : [4]
                ).map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label>
              Review note
              <input name="reason" required minLength={3} maxLength={500} />
            </label>
            <button className="button primary" disabled={action.busy}>
              Approve level
            </button>
          </form>
        </article>
      ))}
      <h2>Business listings</h2>
      {businesses.data?.length === 0 && <p>No business listings to review.</p>}
      {businesses.data?.map((b) => (
        <article className="community-call" key={b.id}>
          <h3>{b.title}</h3>
          <p>
            {b.kind} · {b.status}
          </p>
          <p>{b.description}</p>
          {!!b.reports?.length && (
            <ul>
              {b.reports.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          )}
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = responses(e.currentTarget);
              void action.run(async () => {
                await rpc("moderate_business", {
                  p_id: b.id,
                  p_status: value(data, "status"),
                  p_note: value(data, "reason"),
                });
                businesses.reload();
              }, "Listing reviewed.");
            }}
          >
            <label>
              Decision
              <select name="status">
                <option value="published">Publish or keep visible</option>
                <option value="hidden">Hide</option>
              </select>
            </label>
            <label>
              Moderation note
              <input name="reason" required minLength={3} maxLength={500} />
            </label>
            <button className="button primary" disabled={action.busy}>
              Save decision
            </button>
          </form>
        </article>
      ))}
    </section>
  );
}
