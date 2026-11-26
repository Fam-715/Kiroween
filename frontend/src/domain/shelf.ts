/**
 * Pure helpers for the shelf and J-card. No I/O. The backend values always win on the next
 * fetch; these only keep the display moving between API calls (e.g. under Demo time warp).
 */
import type { TapeWire } from "../api/tapes";
import {
  MS_PER_DAY,
  isDue,
  strengthAt,
  tapeCondition,
  tapeStrength,
  type Condition,
} from "./strength";

/** Total focus minutes: the sum of completed track durations. */
export function focusMinutes(completedTrackMinutes: readonly number[]): number {
  return completedTrackMinutes.reduce((a, b) => a + b, 0);
}

export interface DecayInput {
  /** Strength at the time of the last API response (unrounded base for the model). */
  base: number;
  stabilityDays: number;
  elapsedDays: number;
}

/** Number of tracks whose unrounded strength is at or below the due threshold. */
export function dueCount(tracks: readonly DecayInput[]): number {
  return tracks.filter((t) => isDue(t.base, t.stabilityDays, t.elapsedDays)).length;
}

export interface LiveTrack {
  recorded: boolean;
  strength: number | null;
  stabilityDays: number;
  /** epoch ms of the next review, or null when unrecorded */
  nextReviewMs: number | null;
}

export interface LiveTape {
  strength: number | null;
  condition: Condition;
  dueCount: number;
  ghost: boolean;
}

/** Strength of one track `elapsedMs` of virtual time after the API response. */
export function predictStrength(apiStrength: number, stabilityDays: number, elapsedMs: number): number {
  return strengthAt(apiStrength, stabilityDays, elapsedMs / MS_PER_DAY);
}

/** Predict a tape's strength, condition, due count and ghost flag from its tracks. */
export function predictTape(tracks: readonly LiveTrack[], elapsedMs: number, nowMs: number): LiveTape {
  const recorded = tracks.filter((t) => t.recorded && t.strength !== null);
  const strengths = recorded.map((t) =>
    predictStrength(t.strength as number, t.stabilityDays, elapsedMs),
  );
  const due = recorded.filter(
    (t) => t.nextReviewMs !== null && t.nextReviewMs <= nowMs,
  ).length;
  const strength = tapeStrength(strengths);
  const ghost = strengths.length > 0 && strengths.every((v) => v === 0);
  return {
    strength,
    condition: strengths.length === 0 ? "Mint" : tapeCondition(strengths),
    dueCount: due,
    ghost,
  };
}

/** Predict a whole tape from an API tape, `nowMs` being the current virtual time. */
export function predictFromWire(tape: TapeWire, nowMs: number): LiveTape {
  const elapsedMs = Math.max(0, nowMs - Date.parse(tape.virtual_now));
  const tracks: LiveTrack[] = [...tape.side_a, ...tape.side_b]
    .filter((i) => i.kind === "track" && i.memory !== null)
    .map((i) => {
      const m = i.memory as NonNullable<typeof i.memory>;
      return {
        recorded: m.recorded,
        strength: m.strength,
        stabilityDays: m.stability_days,
        nextReviewMs: m.next_review_at === null ? null : Date.parse(m.next_review_at),
      };
    });
  return predictTape(tracks, elapsedMs, nowMs);
}

/** "due now", "in 3 days", "in 2 hours" ... for a next review time. */
export function relativeReview(nextReviewMs: number, nowMs: number): string {
  const diff = nextReviewMs - nowMs;
  if (diff <= 0) return "due now";
  const minutes = Math.ceil(diff / 60_000);
  if (minutes < 60) return `in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return `in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(diff / MS_PER_DAY);
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}
