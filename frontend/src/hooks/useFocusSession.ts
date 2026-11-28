import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isRetryableSessionError,
  NoSessionError,
  postSessionEvent,
  startSession,
  stopSession,
  type SessionEventWire,
} from "../api/sessions";
import { ApiError } from "../api/client";
import type { TapeItemWire, TapeWire } from "../api/tapes";
import { createChime, type Chime } from "../audio/chime";
import {
  currentItem,
  type ItemOutcome,
  type PlayerItem,
  type PlayerPlan,
  type PlayerState,
} from "../domain/player";
import { RetryQueue } from "../domain/retryQueue";
import { useFocusAudio, type UseFocusAudio } from "./useFocusAudio";
import { useTapePlayer, type TapePlayer } from "./useTapePlayer";

export const SESSION_STORAGE_PREFIX = "cursed-cassette.session.";

export interface FocusPenalty {
  /** Track ids whose stability dropped. */
  trackIds: string[];
  message: string;
  /** Largest stability drop in percent across the penalised tracks, from the server response. */
  percent: number;
}

/** Percent stability drop for one track; 0 when `before` is not positive (no NaN/Infinity). */
export function penaltyPercent(before: number, after: number): number {
  if (!(before > 0) || !Number.isFinite(before) || !Number.isFinite(after)) return 0;
  return Math.round((1 - after / before) * 100);
}

export interface FocusSession extends TapePlayer {
  /** Penalty from the latest skip response, or null (for the break-skip toast). */
  lastPenalty: FocusPenalty | null;
  audio: UseFocusAudio;
}

export interface FocusSessionOptions {
  /** Test seams. */
  queue?: RetryQueue;
  chime?: Chime;
}

/** The session id may arrive late (start is retried), so jobs share this holder. */
interface SessionHolder {
  id: string | null;
}

/** The shared queue keeps ordering (start, events, stop) across remounts. */
const sharedQueue = new RetryQueue();

export function buildPlan(tape: TapeWire): PlayerPlan {
  const toItems = (items: TapeItemWire[]): PlayerItem[] =>
    [...items]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ id: i.id, kind: i.kind, durationMs: i.minutes * 60000 }));
  return { sideA: toItems(tape.side_a), sideB: toItems(tape.side_b) };
}

function sessionKey(tapeId: string): string {
  return `${SESSION_STORAGE_PREFIX}${tapeId}`;
}

function readSessionId(tapeId: string): string | null {
  try {
    return localStorage.getItem(sessionKey(tapeId));
  } catch {
    return null;
  }
}

function writeSessionId(tapeId: string, id: string): void {
  try {
    localStorage.setItem(sessionKey(tapeId), id);
  } catch {
    // storage unavailable: events after a reload cannot rejoin the session
  }
}

function clearSessionId(tapeId: string, id: string | null): void {
  try {
    if (id === null || localStorage.getItem(sessionKey(tapeId)) === id) {
      localStorage.removeItem(sessionKey(tapeId));
    }
  } catch {
    // ignore
  }
}

function needsNewSession(status: PlayerState["status"]): boolean {
  return status === "idle" || status === "stopped" || status === "finished";
}

/**
 * Focus session: wraps `useTapePlayer` for a tape, reports events to the API through an
 * ordered retry queue, plays the completion chime and drives the focus audio. Network
 * failures never touch the countdown or the audio.
 */
export function useFocusSession(
  tape: TapeWire,
  options: FocusSessionOptions = {},
): FocusSession {
  const tapeId = tape.id;
  // Keep the first queue: a per-render queue would split start and event jobs.
  const queueRef = useRef<RetryQueue>(options.queue ?? sharedQueue);
  const queue = queueRef.current;
  const plan = useMemo(() => buildPlan(tape), [tape]);
  const audio = useFocusAudio();

  const chimeRef = useRef<Chime | null>(null);
  if (chimeRef.current === null) chimeRef.current = options.chime ?? createChime();
  const chime = chimeRef.current;
  useEffect(() => () => chime.dispose(), [chime]);

  const holderRef = useRef<SessionHolder | null | undefined>(undefined);
  if (holderRef.current === undefined) {
    const stored = readSessionId(tapeId);
    holderRef.current = stored ? { id: stored } : null;
  }

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [lastPenalty, setLastPenalty] = useState<FocusPenalty | null>(null);

  const beginSession = useCallback((): SessionHolder => {
    const holder: SessionHolder = { id: null };
    holderRef.current = holder;
    queue.enqueue({
      // Set the id inside run: the queue starts the next job before onSuccess fires.
      run: async () => {
        const s = await startSession(tapeId);
        holder.id = s.id;
        writeSessionId(tapeId, s.id);
        return s;
      },
      onSuccess: () => {},
      onGiveUp: () => {},
      isRetryable: isRetryableSessionError,
    });
    return holder;
  }, [queue, tapeId]);

  const ensureHolder = useCallback(
    (): SessionHolder => holderRef.current ?? beginSession(),
    [beginSession],
  );

  const sendEvent = useCallback(
    (item: PlayerItem, outcome: ItemOutcome) => {
      const holder = ensureHolder();
      // One id per event, reused on every retry (the backend applies it once).
      const body = {
        client_event_id: crypto.randomUUID(),
        type: outcome === "completed" ? ("complete" as const) : ("skip" as const),
        item_id: item.id,
      };
      queue.enqueue<SessionEventWire | null>({
        run: async () => {
          if (holder.id === null) throw new NoSessionError();
          try {
            return await postSessionEvent(holder.id, body);
          } catch (e) {
            // 409: already recorded (or the session ended). Success, so later events go on.
            if (e instanceof ApiError && e.status === 409) return null;
            throw e;
          }
        },
        onSuccess: (res) => {
          if (body.type !== "skip" || res === null || !mounted.current) return;
          const ids = res.penalty.map((p) => p.track_id);
          setLastPenalty(
            ids.length === 0
              ? null
              : {
                  trackIds: ids,
                  percent: Math.max(
                    ...res.penalty.map((p) => penaltyPercent(p.stability_before, p.stability_after)),
                  ),
                  message: `The tape remembers… ${ids.length} ${
                    ids.length === 1 ? "track" : "tracks"
                  } faded a little.`,
                },
          );
        },
        onGiveUp: () => {},
        isRetryable: isRetryableSessionError,
      });
    },
    [ensureHolder, queue],
  );

  const endSession = useCallback(() => {
    const holder = ensureHolder();
    holderRef.current = null;
    queue.enqueue({
      run: async () => {
        if (holder.id === null) throw new NoSessionError();
        return stopSession(holder.id);
      },
      onSuccess: () => clearSessionId(tapeId, holder.id),
      onGiveUp: () => clearSessionId(tapeId, holder.id),
      isRetryable: isRetryableSessionError,
    });
  }, [ensureHolder, queue, tapeId]);

  const audioRef = useRef(audio);
  audioRef.current = audio;

  const player = useTapePlayer(tapeId, plan, {
    onItemEnded: (item, outcome, state) => {
      sendEvent(item, outcome);
      chime.play();
      // Interludes fade the sound bed out, the next track brings it back.
      const next = state.status === "playing" ? currentItem(plan, state) : null;
      if (next?.kind === "interlude") audioRef.current.fadeTo(0);
      else if (next?.kind === "track") audioRef.current.fadeTo(1);
    },
    onSessionStopped: () => {
      endSession();
      audioRef.current.stop();
    },
    onSessionFinished: () => {
      endSession();
      audioRef.current.stop();
    },
  });

  const status = player.status;
  const playerPlay = player.play;
  const playerPause = player.pause;
  const itemKind = player.item?.kind ?? null;

  const pause = useCallback(() => {
    playerPause();
    audioRef.current.fadeTo(0);
  }, [playerPause]);

  // Runs inside the click: the audio contexts are created here, never in an effect.
  const play = useCallback(() => {
    if (plan.sideA.length === 0 && plan.sideB.length === 0) return;
    chime.prime();
    const newSession = needsNewSession(status);
    // A new session restarts at the first item, not where the old one stopped.
    const kind = newSession ? (plan.sideA[0] ?? plan.sideB[0])?.kind : itemKind;
    if (audioRef.current.playing) {
      // Resuming: bring the sound back only on a track; interludes stay silent.
      if (kind === "track") audioRef.current.fadeTo(1);
    } else {
      audioRef.current.start();
      // start() resets the gain to 1, so silence an interlude at once (no fade-in blip).
      if (kind === "interlude") audioRef.current.fadeTo(0, 0);
    }
    if (newSession) beginSession();
    else ensureHolder();
    playerPlay();
  }, [plan, chime, status, itemKind, beginSession, ensureHolder, playerPlay]);

  const toggle = useCallback(() => {
    if (status === "playing") pause();
    else play();
  }, [status, pause, play]);

  return { ...player, play, pause, toggle, lastPenalty, audio };
}
