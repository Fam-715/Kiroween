import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  currentItem,
  diffEvents,
  initialPlayerState,
  parsePlayerState,
  planFingerprint,
  plannedRemainingMs,
  remainingMsAt,
  serializePlayerState,
  step,
  type PlayerAction,
  type PlayerItem,
  type PlayerPlan,
  type PlayerState,
  type ItemOutcome,
} from "../domain/player";

export const PLAYER_STORAGE_PREFIX = "cursed-cassette.player.";

export interface TapePlayerHandlers {
  /** A track or interlude was completed or skipped. */
  onItemEnded?: (item: PlayerItem, outcome: ItemOutcome, state: PlayerState) => void;
  /** The user pressed STOP (session ends and should be saved). */
  onSessionStopped?: (state: PlayerState, plannedRemainingMs: number) => void;
  /** The last item on the last side ended (session ends and should be saved). */
  onSessionFinished?: (state: PlayerState) => void;
}

export interface TapePlayer {
  state: PlayerState;
  status: PlayerState["status"];
  side: PlayerState["side"];
  item: PlayerItem | null;
  /** Countdown for the current item in ms, from real-time timestamps. */
  remainingMs: number;
  /** Track that just completed, until the next track starts. */
  recPromptTrackId: string | null;
  play: () => void;
  pause: () => void;
  /** Space: play when not playing, pause when playing. */
  toggle: () => void;
  rew: () => void;
  ff: () => void;
  stop: () => void;
}

function storageKey(tapeId: string): string {
  return `${PLAYER_STORAGE_PREFIX}${tapeId}`;
}

function readStored(tapeId: string, plan: PlayerPlan): PlayerState | null {
  try {
    return parsePlayerState(plan, localStorage.getItem(storageKey(tapeId)));
  } catch {
    return null;
  }
}

function writeStored(tapeId: string, plan: PlayerPlan, state: PlayerState): void {
  try {
    const live = state.status === "playing" || state.status === "paused" || state.status === "flipping";
    if (live) localStorage.setItem(storageKey(tapeId), serializePlayerState(plan, state));
    else localStorage.removeItem(storageKey(tapeId));
  } catch {
    // storage unavailable: the player still works, it just cannot resume after a reload
  }
}

/**
 * Focus-session player. The countdown always uses real time (Date.now), never virtual
 * time. State is persisted to localStorage so a reload resumes with an accurate countdown.
 */
export function useTapePlayer(
  tapeId: string,
  plan: PlayerPlan,
  handlers: TapePlayerHandlers = {},
): TapePlayer {
  const fingerprint = planFingerprint(plan);
  // Keep a stable plan object while its content is unchanged.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stablePlan = useMemo(() => plan, [fingerprint]);

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const stateRef = useRef<PlayerState>(initialPlayerState(stablePlan));
  const [state, setState] = useState<PlayerState>(() => {
    const s = readStored(tapeId, stablePlan) ?? initialPlayerState(stablePlan);
    stateRef.current = s;
    return s;
  });
  const [now, setNow] = useState<number>(() => Date.now());

  const apply = useCallback(
    (action: PlayerAction) => {
      const prev = stateRef.current;
      const next = step(stablePlan, prev, action);
      if (next === prev) return;
      stateRef.current = next;
      setState(next);
      writeStored(tapeId, stablePlan, next);
      const h = handlersRef.current;
      for (const ev of diffEvents(stablePlan, prev, next)) {
        if (ev.type === "item") h.onItemEnded?.(ev.item, ev.outcome, next);
        else if (ev.type === "stopped") {
          h.onSessionStopped?.(next, plannedRemainingMs(stablePlan, prev, action.now));
        } else h.onSessionFinished?.(next);
      }
    },
    [tapeId, stablePlan],
  );

  // Reload resume: settle anything that finished while the page was closed.
  useEffect(() => {
    apply({ type: "TICK", now: Date.now() });
  }, [apply]);

  // Recompute the countdown every animation frame while playing, and on tab re-show.
  const playing = state.status === "playing";
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const loop = () => {
      const t = Date.now();
      apply({ type: "TICK", now: t });
      setNow(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onVisible = () => {
      if (document.visibilityState === "visible") apply({ type: "TICK", now: Date.now() });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [playing, apply]);

  const send = useCallback(
    (type: PlayerAction["type"]) => {
      const t = Date.now();
      apply({ type, now: t });
      setNow(t);
    },
    [apply],
  );

  const play = useCallback(() => send("PLAY"), [send]);
  const pause = useCallback(() => send("PAUSE"), [send]);
  const rew = useCallback(() => send("REW"), [send]);
  const ff = useCallback(() => send("FF"), [send]);
  const stop = useCallback(() => send("STOP"), [send]);
  const toggle = useCallback(() => {
    send(stateRef.current.status === "playing" ? "PAUSE" : "PLAY");
  }, [send]);

  return {
    state,
    status: state.status,
    side: state.side,
    item: currentItem(stablePlan, state),
    remainingMs: remainingMsAt(stablePlan, state, playing ? now : Date.now()),
    recPromptTrackId: state.recPromptTrackId,
    play,
    pause,
    toggle,
    rew,
    ff,
    stop,
  };
}
