import { useEffect, useRef, useState } from "react";
import { submitRecall, type RecallWire } from "../../api/recalls";
import type { RetryQueue } from "../../domain/retryQueue";
import ConditionText from "../ConditionText";

export interface RecallTrack {
  id: string;
  name: string | null;
}

interface Props {
  track: RecallTrack;
  onResult?: (result: RecallWire) => void;
  onClose: () => void;
  /** Test seam. */
  queue?: RetryQueue;
}

type Phase = "typing" | "pending" | "done" | "failed";

/**
 * Recall by typing (task 10). Voice capture joins this panel in task 11.
 * The text is held only in component state and sent once to be scored.
 */
export default function RecallPanel({ track, onResult, onClose, queue }: Props) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");
  const [result, setResult] = useState<RecallWire | null>(null);
  const mounted = useRef(true);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    mounted.current = true;
    areaRef.current?.focus();
    return () => {
      mounted.current = false;
    };
  }, []);

  function submit() {
    const body = text.trim();
    if (body === "") return;
    setPhase("pending");
    submitRecall({
      trackId: track.id,
      text: body,
      source: "typed",
      queue,
      onSuccess: (r) => {
        onResult?.(r);
        if (!mounted.current) return;
        setResult(r);
        setPhase("done");
      },
      onGiveUp: () => {
        if (mounted.current) setPhase("failed");
      },
    });
  }

  const label = track.name ?? "Untitled track";
  const m = result?.memory;

  return (
    <section
      aria-label={`Recall ${label}`}
      className="mt-4 rounded-sm border border-danger bg-plum-950 p-4"
    >
      <h3 className="font-type text-lg text-ink">REC: explain “{label}” from memory</h3>

      {(phase === "typing" || phase === "failed") && (
        <>
          <label htmlFor="recall-text" className="mt-2 block text-sm text-plastic-300">
            Type what you remember
          </label>
          <textarea
            id="recall-text"
            ref={areaRef}
            aria-label="Recall text"
            value={text}
            maxLength={5000}
            rows={5}
            onChange={(e) => setText(e.target.value)}
            className="mt-1 w-full rounded-sm border border-plastic-500 bg-plum-900 p-2 text-ink"
          />
          {phase === "failed" && (
            <p role="alert" className="mt-2 text-plastic-100">
              Could not reach the scorer. Your text is still here. Try again.
            </p>
          )}
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              aria-label="Submit recall"
              disabled={text.trim() === ""}
              onClick={submit}
              className="rounded-sm bg-label-orange px-4 py-2 font-type text-plum-950 hover:bg-label-orangeBright disabled:opacity-50"
            >
              Submit recall
            </button>
            <button
              type="button"
              aria-label="Cancel recall"
              onClick={onClose}
              className="rounded-sm border border-plastic-500 px-4 py-2 font-type text-ink hover:bg-plum-800"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {phase === "pending" && (
        <p role="status" className="mt-3 font-type text-lcd-green">
          Scoring pending… the tape is still listening. We keep trying every few seconds.
        </p>
      )}

      {phase === "done" && result && m && (
        <div className="mt-3" role="status">
          <p className="font-lcd text-3xl text-lcd-green" data-testid="recall-score">
            Score {Math.round(result.score * 100)}%
          </p>
          <p className="mt-2 text-sm text-ink">
            Matched:{" "}
            <span data-testid="recall-matched">
              {result.matched.length > 0 ? result.matched.join(", ") : "none"}
            </span>
          </p>
          <p className="text-sm text-ink">
            Missed:{" "}
            <span data-testid="recall-missed">
              {result.missed.length > 0 ? result.missed.join(", ") : "none"}
            </span>
          </p>
          {m.strength !== null && (
            <p className="mt-2 text-sm text-plastic-300">
              Strength <span className="font-lcd text-lcd-green">{m.strength}</span>{" "}
              {m.condition && <ConditionText condition={m.condition} />}
              {" · stability "}
              <span className="font-lcd text-lcd-green">{m.stability_days.toFixed(1)}</span> days
            </p>
          )}
          <button
            type="button"
            aria-label="Close recall"
            onClick={onClose}
            className="mt-3 rounded-sm border border-plastic-500 px-4 py-2 font-type text-ink hover:bg-plum-800"
          >
            Close
          </button>
        </div>
      )}
    </section>
  );
}
