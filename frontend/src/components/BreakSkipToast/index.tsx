import { useEffect, useState } from "react";
import type { FocusPenalty } from "../../hooks/useFocusSession";

export const TOAST_MS = 4000;

export function penaltyDetail(penalty: FocusPenalty): string {
  const n = penalty.trackIds.length;
  return `Memory span −${penalty.percent}% on ${n} ${n === 1 ? "track" : "tracks"}`;
}

/** "The tape remembers…" toast for 4 s after a skipped break or track. */
export function BreakSkipToast({ penalty }: { penalty: FocusPenalty | null }) {
  const [shown, setShown] = useState<FocusPenalty | null>(null);

  useEffect(() => {
    if (penalty === null) {
      setShown(null);
      return;
    }
    setShown(penalty);
    const timer = setTimeout(() => setShown(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [penalty]);

  if (shown === null) return null;
  return (
    <div
      role="status"
      className="rounded border border-condition-haunted bg-plum-900 px-4 py-3 font-type text-ink shadow-glow-faint"
    >
      <p className="text-lg">The tape remembers…</p>
      <p className="text-sm text-plastic-300">{penaltyDetail(shown)}</p>
    </div>
  );
}

export default BreakSkipToast;
