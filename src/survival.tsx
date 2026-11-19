import { useState } from "react";
import { Award, Compass, Flag, Shield, Sprout } from "lucide-react";
import { Link } from "react-router-dom";

const levels = [
  { name: "Survivor", mark: Sprout },
  { name: "Steady Survivor", mark: Shield },
  { name: "Pathfinder", mark: Compass },
  { name: "Survival Veteran", mark: Flag },
  { name: "Survival Legend", mark: Award },
];

const answers = [
  {
    text: "Share the person’s contact information so others can check the story.",
    feedback:
      "Keep private contact information out of your story. Other members can respond to the experience without accessing those details.",
  },
  {
    text: "Describe what happened and what helped. Ask before including details about anyone else.",
    feedback:
      "Good call. Practical details help readers learn, and consent gives the other person control over what becomes public.",
  },
  {
    text: "Post screenshots with names visible so the story is more convincing.",
    feedback:
      "Screenshots can identify people. Ask for consent and remove identifying details before sharing anything publicly.",
  },
];

export function SurvivalGuide() {
  const [answer, setAnswer] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  return (
    <section className="narrow">
      <Link className="back" to="/community">
        ← The Community
      </Link>
      <h1>Survival Levels</h1>
      <p>
        See how Survive9ja recognises practical knowledge shared through the
        Diaries. Badges and certificates are free. This guide explains the
        programme and includes a practice scenario.
      </p>

      <div className="item-actions">
        <Link className="button primary" to="/survival/awards">
          Submit a Diary or view your award
        </Link>
        <Link className="button secondary" to="/business">
          Business Hub
        </Link>
      </div>
      <ol className="survival-levels" aria-label="Survival level ladder">
        {levels.map(({ name, mark: Mark }, index) => (
          <li key={name}>
            <span className="survival-mark">
              <Mark size={20} aria-hidden="true" />
            </span>
            <div>
              <small>Level {index + 1}</small>
              <strong>{name}</strong>
            </div>
          </li>
        ))}
      </ol>

      <h2>How a story earns recognition</h2>
      <ol className="survival-steps">
        <li>
          <strong>Tell the story.</strong> Explain what you faced, how long it
          lasted, what you did and what someone else could take from it. Share
          only details you are comfortable making public.
        </li>
        <li>
          <strong>Get community feedback.</strong> Members can vouch for what
          they know and recognise practical lessons. Votes reflect community
          feedback.
        </li>
        <li>
          <strong>Try a scenario.</strong> Short questions add a practical
          skills component. Moderators review candidates for Levels 4 and 5.
        </li>
        <li>
          <strong>Earn a badge and certificate.</strong> Recognition matches the
          awarded level. Level 3 and above will qualify members for Business
          Survivors.
        </li>
      </ol>
      <p>
        Scoring starts with 20 points for a complete submission. Each correct
        scenario adds 15. Useful votes add 2 and vouches add 3, with a combined
        cap of 35 points. Level 2 requires 45 points and one correct answer.
        Level 3 requires 65 points, two correct answers and feedback from two
        members. Levels 4 and 5 require all three answers, moderator approval,
        and 80 or 90 points respectively.
      </p>
      <p>
        Certificates recognise community contributions. They carry no government
        accreditation or independent verification of hardship.
      </p>

      <form
        className="form community-call"
        onSubmit={(event) => {
          event.preventDefault();
          setChecked(true);
        }}
      >
        <fieldset>
          <legend>
            <strong>Practice scenario</strong>
          </legend>
          <p>
            You want to share how a neighbour helped you through a difficult
            period. How could you tell the story while protecting their privacy?
          </p>
          {answers.map(({ text }, index) => (
            <label className="survival-answer" key={text}>
              <input
                type="radio"
                name="scenario"
                checked={answer === index}
                onChange={() => {
                  setAnswer(index);
                  setChecked(false);
                }}
              />
              {text}
            </label>
          ))}
        </fieldset>
        <button className="button primary" disabled={answer === null}>
          Check answer
        </button>
        {checked && answer !== null && (
          <p role="status">{answers[answer].feedback}</p>
        )}
      </form>
      <Link className="button secondary" to="/diaries">
        Explore the Diaries
      </Link>
    </section>
  );
}
