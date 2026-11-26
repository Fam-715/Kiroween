import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTapes, type TapeWire } from "../../api/tapes";
import { predictFromWire } from "../../domain/shelf";
import { useVirtualClock } from "../../hooks/useVirtualClock";
import ConditionText from "../ConditionText";

type HauntLevel = "none" | "faint" | "medium" | "strong";

// Surfaces stay dark so condition text keeps AA contrast (haunted purple on
// bg-void is about 5:1). The glow is a separate overlay, so text is never dimmed.
const HAUNT_STYLES: Record<HauntLevel, { surface: string; glow: string }> = {
  none: { surface: "bg-plum-900", glow: "" },
  faint: { surface: "bg-plum-900", glow: "shadow-glow-faint" },
  medium: { surface: "bg-plum-950", glow: "shadow-glow-medium" },
  strong: { surface: "bg-void", glow: "shadow-glow-strong" },
};

function hauntLevel(condition: string): HauntLevel {
  if (condition === "Haunted" || condition === "Dead") return "strong";
  if (condition === "Warped") return "medium";
  if (condition === "Worn") return "faint";
  return "none";
}

function ShelfSpine({ tape, nowMs }: { tape: TapeWire; nowMs: number }) {
  const reduced = useReducedMotion();
  // Live prediction between API calls; the API value wins on the next fetch.
  const live = predictFromWire(tape, nowMs);
  const ghost = tape.ghost || live.ghost;
  const due = live.dueCount;
  const haunted = due > 0 && !ghost;

  const level = haunted ? hauntLevel(live.condition) : "none";
  const style = HAUNT_STYLES[level];

  const classes = [
    "relative block rounded-sm border p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-label-orangeBright",
    style.surface,
    haunted ? "border-condition-haunted/60" : "border-plastic-500/30",
    ghost ? "opacity-50 border-dashed" : "",
  ].join(" ");

  const body = (
    <Link
      to={`/tape/${tape.id}`}
      aria-label={`Open the J-card for ${tape.title}`}
      className={classes}
      data-testid="tape-spine"
      data-haunted={haunted ? "true" : "false"}
      data-ghost={ghost ? "true" : "false"}
      data-haunt-level={level}
    >
      {style.glow && (
        <span
          aria-hidden="true"
          data-testid="haunt-glow"
          className={`pointer-events-none absolute inset-0 rounded-sm ${style.glow} ${
            reduced ? "" : "animate-glow-flicker motion-reduce:animate-none"
          }`}
        />
      )}
      <p className="font-lcd text-lg text-lcd-green">{tape.length}</p>
      <h3 className="mt-2 text-base text-ink">{tape.title}</h3>
      <p className="mt-2 flex items-center gap-2 text-sm text-plastic-300">
        Condition: <ConditionText condition={live.condition} />
      </p>
      {ghost && <p className="mt-2 font-type text-sm text-plastic-100">Forgotten</p>}
      {due > 0 && <p className="mt-2 font-lcd text-lcd-green">{due} due</p>}
    </Link>
  );

  if (ghost && !reduced) {
    return (
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {body}
      </motion.div>
    );
  }
  return body;
}

export default function TapeShelf() {
  const [tapes, setTapes] = useState<TapeWire[] | null>(null);
  const [failed, setFailed] = useState(false);
  const { virtualNow } = useVirtualClock();

  const load = useCallback(() => {
    setFailed(false);
    setTapes(null);
    listTapes()
      .then(setTapes)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const nowMs = virtualNow();

  return (
    <section aria-labelledby="shelf-heading">
      <h2 id="shelf-heading" className="text-3xl text-label-orangeBright">
        The Shelf
      </h2>
      <p className="mt-2 max-w-prose text-plastic-300">
        Your study tapes live here. Tapes you neglect turn haunted; fully
        forgotten tapes become ghosts.
      </p>

      {failed ? (
        <div role="alert" className="mt-6 text-plastic-100">
          <p>The tape deck did not answer.</p>
          <button
            type="button"
            onClick={load}
            aria-label="Retry loading the shelf"
            className="mt-2 rounded-sm bg-label-orange px-4 py-2 font-type text-plum-950 hover:bg-label-orangeBright"
          >
            Retry
          </button>
        </div>
      ) : tapes === null ? (
        <p role="status" className="mt-6 text-plastic-300">
          Waking up the tape deck…
        </p>
      ) : tapes.length === 0 ? (
        <p className="mt-6 text-plastic-300">No tapes yet. Record your first one.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tapes.map((t) => (
            <ShelfSpine key={t.id} tape={t} nowMs={nowMs} />
          ))}
        </div>
      )}

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
