import { Link } from "react-router-dom";
import ConditionText, { type Condition } from "../ConditionText";

/** Placeholder shelf spines showing the condition-text slots (Requirement 9.6). */
function ShelfSpine({
  title,
  length,
  condition,
  due,
}: {
  title: string;
  length: string;
  condition: Condition;
  due: number;
}) {
  return (
    <div className="rounded-sm border border-plastic-500/30 bg-plum-900 p-4">
      <p className="font-lcd text-lg text-lcd-green">{length}</p>
      <h3 className="mt-2 text-base text-ink">{title}</h3>
      <p className="mt-2 flex items-center gap-2 text-sm text-plastic-300">
        Condition: <ConditionText condition={condition} />
      </p>
      {due > 0 && (
        <p className="mt-2 font-lcd text-lcd-green" role="status">
          {due} due
        </p>
      )}
    </div>
  );
}

export default function TapeShelf() {
  return (
    <section aria-labelledby="shelf-heading">
      <h2 id="shelf-heading" className="text-3xl text-label-orangeBright">
        The Shelf
      </h2>
      <p className="mt-2 max-w-prose text-plastic-300">
        Your study tapes live here. Tapes you neglect turn haunted; fully
        forgotten tapes become ghosts.
      </p>
      {/* Placeholder spines until the tape API (task 4) feeds real data. */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ShelfSpine title="Biology Basics" length="C60" condition="Worn" due={1} />
        <ShelfSpine title="Linear Algebra" length="C90" condition="Mint" due={0} />
        <ShelfSpine title="Old Midterm Notes" length="C60" condition="Haunted" due={3} />
      </div>
      <div className="mt-8">
        <Link
          to="/record"
          aria-label="Record a new tape"
          className="inline-block rounded-sm bg-label-orange px-6 py-3 font-type text-lg text-plum-950 hover:bg-label-orangeBright"
        >
          Record a new tape
        </Link>
      </div>
    </section>
  );
}
