import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  UsersRound,
  Pencil,
  Store,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";

const diaryGoalKey = "survive9ja-gist-diary-goal";
const goalTarget = 3;
const goalStartedKey = diaryGoalKey + "-started";

function openedDiaries(): string[] {
  try {
    const items: unknown = JSON.parse(
      localStorage.getItem(diaryGoalKey) || "[]",
    );
    return Array.isArray(items)
      ? items
          .filter((item): item is string => typeof item === "string")
          .slice(0, goalTarget)
      : [];
  } catch {
    return [];
  }
}

export function rememberGistDiary(id: string) {
  let started = false;
  try {
    started = localStorage.getItem(goalStartedKey) === "1";
  } catch {
    return;
  }
  if (!started) return;
  const items = openedDiaries();
  if (items.length < goalTarget && !items.includes(id)) {
    try {
      localStorage.setItem(diaryGoalKey, JSON.stringify([...items, id]));
    } catch {
      // The reading goal is optional when the browser blocks local storage.
    }
  }
}

const destinations = [
  { title: "Circles", to: "/circles", icon: UsersRound },
  { title: "Diaries", to: "/diaries", icon: BookOpen },
  { title: "Business Hub", to: "/business", icon: Store },
  {
    title: "Survival Levels",
    to: "/survival",
    icon: ChartNoAxesColumnIncreasing,
  },
];

export function GistIntro() {
  const [progress, setProgress] = useState(() => openedDiaries().length);
  useEffect(() => {
    const update = () => setProgress(openedDiaries().length);
    window.addEventListener("storage", update);
    window.addEventListener("pageshow", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("pageshow", update);
    };
  }, []);
  return (
    <>
      <header className="gist-hero">
        <div className="gist-paper-stripes" aria-hidden="true" />
        <div className="gist-city" aria-hidden="true" />
        <div className="gist-hero-copy">
          <span className="gist-kicker">Wetin dey happen?</span>
          <h1>The Gist</h1>
        </div>
        <div className="gist-sticker" aria-hidden="true">
          <span className="gist-star">★</span>
          <span className="gist-bubble">
            <i />
            <i />
            <i />
          </span>
        </div>
      </header>
      <p className="gist-introduction">
        Find your people in <Link to="/circles">Circles</Link>, read real
        stories in <Link to="/diaries">Diaries</Link>, or share a gist with{" "}
        <a href="#gist-feed">The Square</a>.
      </p>
      <nav className="gist-destinations" aria-label="Explore Survive9ja">
        {destinations.map(({ title, to, icon: Icon }, index) => (
          <Link
            className={
              index === 0 ? "gist-tile gist-tile-selected" : "gist-tile"
            }
            to={to}
            key={title}
          >
            <Icon size={25} strokeWidth={2.2} aria-hidden="true" />
            <strong>{title}</strong>
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <Link className="gist-compose" to="/new">
        <Pencil size={23} strokeWidth={2.3} aria-hidden="true" /> Drop a gist{" "}
        <ArrowUpRight size={21} aria-hidden="true" />
      </Link>
      <Link
        className="gist-goal"
        to="/diaries"
        onClick={() => {
          try {
            localStorage.setItem(goalStartedKey, "1");
          } catch {
            /* Optional goal. */
          }
        }}
      >
        <span className="gist-goal-icon">
          <Target size={26} strokeWidth={2.3} aria-hidden="true" />
        </span>
        <span className="gist-goal-body">
          <strong>
            {progress === goalTarget
              ? "You found three stories"
              : "Find a story that hits home"}
          </strong>
          <span className="gist-goal-progress">
            <span>
              {progress} of {goalTarget} Diaries opened
            </span>
            <span className="gist-progress-bars" aria-hidden="true">
              {Array.from({ length: goalTarget }, (_, i) => (
                <i key={i} data-done={i < progress} />
              ))}
            </span>
          </span>
        </span>
        <ChevronRight
          className="gist-goal-arrow"
          size={20}
          aria-hidden="true"
        />
      </Link>
    </>
  );
}
