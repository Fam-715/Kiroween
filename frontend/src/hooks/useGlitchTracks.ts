import { useEffect, useState } from "react";
import type { FocusPenalty } from "./useFocusSession";

export const GLITCH_MS = 1200;

const EMPTY: ReadonlySet<string> = new Set<string>();

/**
 * Track ids that should glitch for 1.2 s after each new penalty, then an empty set.
 * A new penalty object restarts the 1.2 s.
 */
export function useGlitchTracks(penalty: FocusPenalty | null): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(EMPTY);

  useEffect(() => {
    if (penalty === null) {
      setIds(EMPTY);
      return;
    }
    setIds(new Set(penalty.trackIds));
    const timer = setTimeout(() => setIds(EMPTY), GLITCH_MS);
    return () => clearTimeout(timer);
  }, [penalty]);

  return ids;
}
