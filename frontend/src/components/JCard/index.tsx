import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteTape, getTape, type TapeItemWire, type TapeWire } from "../../api/tapes";
import { predictFromWire, predictStrength, relativeReview } from "../../domain/shelf";
import { condition as conditionOf } from "../../domain/strength";
import { useVirtualClock } from "../../hooks/useVirtualClock";
import ConditionText from "../ConditionText";

function TrackRow({ item, tape, nowMs }: { item: TapeItemWire; tape: TapeWire; nowMs: number }) {
  const label = item.name ?? "Untitled track";
  const m = item.memory;
  let detail: React.ReactNode;
  if (!m || !m.recorded || m.strength === null) {
    detail = <span className="text-plastic-300">Not recorded yet</span>;
  } else {
    const elapsed = Math.max(0, nowMs - Date.parse(tape.virtual_now));
    const strength = predictStrength(m.strength, m.stability_days, elapsed);
    const next = m.next_review_at === null ? null : Date.parse(m.next_review_at);
    const isDue = next !== null && next <= nowMs;
    detail = (
      <>
        <span className="font-lcd text-lcd-green">{strength}</span>{" "}
        <ConditionText condition={conditionOf(strength)} />
        {isDue && <span className="ml-2 font-type text-label-orangeBright">due</span>}
        {next !== null && (
          <span className="ml-2 text-plastic-300">Next review: {relativeReview(next, nowMs)}</span>
        )}
      </>
    );
  }
  return (
    <li className="flex flex-wrap items-baseline gap-2 py-1" data-testid="jcard-track">
      <span className="font-hand text-lg text-ink">{label}</span>
      <span className="text-sm">{detail}</span>
      {/* Tasks 10-12 add the REC button (recall) and the play-recording button here. */}
    </li>
  );
}

function Side({ name, items, tape, nowMs }: { name: string; items: TapeItemWire[]; tape: TapeWire; nowMs: number }) {
  const tracks = items.filter((i) => i.kind === "track");
  return (
    <section aria-label={`${name} tracks`} className="mt-4">
      <h3 className="font-type text-label-orangeBright">{name}</h3>
      {tracks.length === 0 ? (
        <p className="text-sm text-plastic-300">No tracks.</p>
      ) : (
        <ul>
          {tracks.map((t) => (
            <TrackRow key={t.id} item={t} tape={tape} nowMs={nowMs} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function JCard() {
  const { tapeId } = useParams<{ tapeId: string }>();
  const navigate = useNavigate();
  const { virtualNow } = useVirtualClock();
  const [tape, setTape] = useState<TapeWire | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  useEffect(() => {
    if (!tapeId) return;
    let cancelled = false;
    setFailed(false);
    getTape(tapeId)
      .then((t) => {
        if (!cancelled) setTape(t);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tapeId]);

  async function confirmDelete() {
    if (!tape) return;
    setDeleteFailed(false);
    try {
      // Task 11 must also remove this tape's recordings from IndexedDB here.
      await deleteTape(tape.id);
      navigate("/");
    } catch {
      setDeleteFailed(true);
    }
  }

  if (failed) {
    return (
      <p role="alert" className="text-plastic-100">
        Could not load this tape. <Link to="/" className="underline">Back to the shelf</Link>
      </p>
    );
  }
  if (!tape) {
    return (
      <p role="status" className="text-plastic-300">
        Waking up the tape deck…
      </p>
    );
  }

  const nowMs = virtualNow();
  const live = predictFromWire(tape, nowMs);
  const s = tape.stats;

  return (
    <article aria-labelledby="jcard-title" className="rounded-sm border border-plastic-500/30 bg-plum-900 p-6">
      <h2 id="jcard-title" className="text-3xl text-label-orangeBright">
        {tape.title}
      </h2>
      <p className="mt-2 text-plastic-300">
        <span className="font-lcd text-lcd-green">{tape.length}</span>
        {" · "}
        <ConditionText condition={live.condition} />
        {live.strength !== null && (
          <>
            {" · strength "}
            <span className="font-lcd text-lcd-green">{live.strength}</span>
          </>
        )}
        {(tape.ghost || live.ghost) && <span className="ml-2">Forgotten</span>}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" aria-label="Tape stats">
        <div><dt className="text-plastic-300">Sessions</dt><dd className="font-lcd text-lg text-lcd-green">{s.sessions}</dd></div>
        <div><dt className="text-plastic-300">Focus minutes</dt><dd className="font-lcd text-lg text-lcd-green">{s.focus_minutes}</dd></div>
        <div><dt className="text-plastic-300">Tracks completed</dt><dd className="font-lcd text-lg text-lcd-green">{s.tracks_completed}</dd></div>
        <div><dt className="text-plastic-300">Tracks skipped</dt><dd className="font-lcd text-lg text-lcd-green">{s.tracks_skipped}</dd></div>
      </dl>

      <Side name="Side A" items={tape.side_a} tape={tape} nowMs={nowMs} />
      <Side name="Side B" items={tape.side_b} tape={tape} nowMs={nowMs} />

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to={`/play/${tape.id}`}
          aria-label="Play tape"
          className="rounded-sm bg-label-orange px-4 py-2 font-type text-plum-950 hover:bg-label-orangeBright"
        >
          Play tape
        </Link>
        <Link
          to={`/record?tape=${tape.id}`}
          aria-label="Edit tape"
          className="rounded-sm border border-plastic-500 px-4 py-2 font-type text-ink hover:bg-plum-800"
        >
          Edit tape
        </Link>
        <button
          type="button"
          aria-label="Delete tape"
          onClick={() => setConfirming(true)}
          className="rounded-sm border border-danger px-4 py-2 font-type text-ink hover:bg-danger"
        >
          Delete tape
        </button>
      </div>

      {confirming && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          className="mt-4 rounded-sm border border-danger bg-plum-950 p-4"
        >
          <p id="delete-title" className="text-ink">
            Delete “{tape.title}” and its recordings? This cannot be undone.
          </p>
          {deleteFailed && <p role="alert" className="mt-2 text-plastic-100">Delete failed. Try again.</p>}
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              autoFocus
              onClick={() => setConfirming(false)}
              className="rounded-sm border border-plastic-500 px-4 py-2 font-type text-ink hover:bg-plum-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              className="rounded-sm bg-danger px-4 py-2 font-type text-ink"
            >
              Yes, delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
