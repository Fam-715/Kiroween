import { useEffect, useState } from "react";
import type { RecallWire } from "../../api/recalls";
import type { TapeWire } from "../../api/tapes";
import type { RetryQueue } from "../../domain/retryQueue";
import RecallPanel from "../RecallPanel";

interface Props {
  tape: TapeWire;
  /** `recPromptTrackId` from the player: the track that just ended. */
  trackId: string | null;
  onResult?: (result: RecallWire) => void;
  /** Test seam for the recall retry queue. */
  queue?: RetryQueue;
  /** Called true when voice recording starts and false when it ends. */
  onRecordingChange?: (recording: boolean) => void;
}

/** Shown when a track ends. Opens the existing RecallPanel; there is no second recall UI. */
export default function RecPrompt({ tape, trackId, onResult, queue, onRecordingChange }: Props) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setOpen(false);
    setDismissed(false);
  }, [trackId]);

  if (trackId === null) return null;
  const track = [...tape.side_a, ...tape.side_b].find((i) => i.id === trackId && i.kind === "track");
  if (!track) return null;
  const label = track.name ?? "Untitled track";

  if (open) {
    return (
      <RecallPanel
        track={{ id: track.id, name: track.name }}
        onResult={onResult}
        onClose={() => {
          setOpen(false);
          setDismissed(true);
        }}
        queue={queue}
        onRecordingChange={onRecordingChange}
      />
    );
  }
  if (dismissed) return null;

  return (
    <section
      role="status"
      aria-label="Recall prompt"
      className="mt-4 rounded-sm border border-danger bg-plum-900 p-4"
    >
      <p className="font-type text-ink">
        Track done: “{label}”. Press REC and explain it from memory.
      </p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          aria-label={`REC recall ${label}`}
          onClick={() => setOpen(true)}
          className="rounded-sm border-2 border-danger bg-plum-950 px-4 py-2 font-type text-ink hover:bg-plum-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-lcd-green"
        >
          ● REC
        </button>
        <button
          type="button"
          aria-label="Skip recall for now"
          onClick={() => setDismissed(true)}
          className="rounded-sm border border-plastic-500 px-4 py-2 font-type text-ink hover:bg-plum-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-lcd-green"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
