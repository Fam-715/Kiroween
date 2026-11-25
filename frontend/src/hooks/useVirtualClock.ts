import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings, type SettingsWire } from "../api/tapes";
import { TIME_SCALE_REAL, virtualNow as clockVirtualNow, type Clock } from "../domain/clock";

export const TICK_MS_REAL = 1000;
export const TICK_MS_WARP = 250;

interface ClockState {
  clock: Clock;
  /** server real_now minus local Date.now() at the moment of the fetch, in ms */
  offsetMs: number;
}

export interface VirtualClock {
  /** Current virtual time in epoch ms, based on the server clock. */
  virtualNow: () => number;
  timeScale: number;
  warpOn: boolean;
  /** Re-load GET /api/settings, e.g. after a settings change. */
  refresh: () => Promise<void>;
}

function stateFromSettings(s: SettingsWire, localNow: number): ClockState {
  const serverReal = Date.parse(s.real_now);
  return {
    clock: { scale: s.time_scale, anchorReal: serverReal, anchorVirtual: Date.parse(s.virtual_now) },
    offsetMs: serverReal - localNow,
  };
}

/**
 * Virtual time for memory decay. Never used by the focus timer, which uses real time.
 * Before settings load, virtual time equals local real time.
 */
export function useVirtualClock(): VirtualClock {
  const [state, setState] = useState<ClockState | null>(null);
  const [, setTick] = useState(0);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const settings = await getSettings();
      if (mounted.current) setState(stateFromSettings(settings, Date.now()));
    } catch {
      // keep the previous clock; the next refresh will retry
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const scale = state?.clock.scale ?? TIME_SCALE_REAL;
  const warpOn = scale !== TIME_SCALE_REAL;

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), warpOn ? TICK_MS_WARP : TICK_MS_REAL);
    return () => clearInterval(id);
  }, [warpOn]);

  const virtualNow = useCallback((): number => {
    const local = Date.now();
    if (!state) return local;
    return clockVirtualNow(state.clock, local + state.offsetMs);
  }, [state]);

  return { virtualNow, timeScale: scale, warpOn, refresh };
}
