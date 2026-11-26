/**
 * Tape scheduling rules — a pure TypeScript mirror of `backend/app/domain/schedule.py`.
 *
 * Client-side pre-validation for the Recorder. Limits are named constants so the
 * frontend and backend enforce the same rules (Requirements 2.1–2.8, 12.2, 12.3).
 * No I/O here; everything is property-testable.
 */

export type SideId = "A" | "B";
export type TapeLength = "C60" | "C90" | "C120";
export type ItemKind = "track" | "interlude";

// --- Named constants (mirror the backend) -------------------------------------
export const SIDE_CAPACITY_MINUTES: Record<TapeLength, number> = {
  C60: 30,
  C90: 45,
  C120: 60,
};
export const TAPE_LENGTHS = ["C60", "C90", "C120"] as const;

export const TITLE_MIN_CHARS = 1;
export const TITLE_MAX_CHARS = 60;
export const NAME_MIN_CHARS = 1;
export const NAME_MAX_CHARS = 40;
export const KEY_TERM_MIN_CHARS = 1;
export const KEY_TERM_MAX_CHARS = 40;
export const KEY_TERMS_MIN = 3;
export const KEY_TERMS_MAX = 5;

export const TRACK_MIN_MINUTES = 10;
export const TRACK_MIN_MINUTES_DEMO = 1;
export const TRACK_MAX_MINUTES = 50;
export const INTERLUDE_MIN_MINUTES = 3;
export const INTERLUDE_MAX_MINUTES = 15;

export interface RuleViolation {
  rule: string;
  side: SideId | null;
  message: string;
}

export interface ScheduleItem {
  kind: ItemKind;
  minutes: number;
  /** Server item id (edit mode); a track in `unchangedIds` is exempt from the 10-minute minimum. */
  id?: string;
  name?: string | null;
  keyTerms?: readonly string[] | null;
}

export interface TapeDraft {
  title: string;
  length: string;
  sideA: readonly ScheduleItem[];
  sideB: readonly ScheduleItem[];
}

export function isTapeLength(value: string): value is TapeLength {
  return (TAPE_LENGTHS as readonly string[]).includes(value);
}

export function sideCapacity(length: string): number {
  return isTapeLength(length) ? SIDE_CAPACITY_MINUTES[length] : 0;
}

export function minTrackMinutes(demoMode: boolean): number {
  return demoMode ? TRACK_MIN_MINUTES_DEMO : TRACK_MIN_MINUTES;
}

export function sideTotal(items: readonly ScheduleItem[]): number {
  return items.reduce((sum, i) => sum + i.minutes, 0);
}

/** Side capacity minus the sum of the item durations (negative when over). */
export function remainingMinutes(items: readonly ScheduleItem[], length: string): number {
  return sideCapacity(length) - sideTotal(items);
}

function keyTermViolations(
  item: ScheduleItem,
  side: SideId | null,
  label: string,
): RuleViolation[] {
  const terms = item.keyTerms ?? [];
  const out: RuleViolation[] = [];
  if (!(KEY_TERMS_MIN <= terms.length && terms.length <= KEY_TERMS_MAX)) {
    out.push({
      rule: "key_terms_count",
      side,
      message: `${label} needs ${KEY_TERMS_MIN} to ${KEY_TERMS_MAX} key terms (has ${terms.length}).`,
    });
  }
  for (const t of terms) {
    if (t.length > KEY_TERM_MAX_CHARS || t.trim().length < KEY_TERM_MIN_CHARS) {
      out.push({
        rule: "key_term_length",
        side,
        message: `${label}: key terms must be ${KEY_TERM_MIN_CHARS} to ${KEY_TERM_MAX_CHARS} characters.`,
      });
    }
  }
  const folded = terms.map((t) => t.trim().toLowerCase());
  if (new Set(folded).size !== folded.length) {
    out.push({
      rule: "key_terms_unique",
      side,
      message: `${label}: key terms must be unique (ignoring case).`,
    });
  }
  return out;
}

export function validateSide(
  items: readonly ScheduleItem[],
  demoMode: boolean,
  unchangedIds: ReadonlySet<string> = new Set(),
  length: string,
  side: SideId | null = null,
): RuleViolation[] {
  const out: RuleViolation[] = [];
  if (isTapeLength(length)) {
    const left = remainingMinutes(items, length);
    if (left < 0) {
      out.push({
        rule: "capacity",
        side,
        message: `Side is over capacity by ${-left} minutes (${sideCapacity(length)} minutes available).`,
      });
    }
  }

  let prevKind: ItemKind | null = null;
  items.forEach((item, i) => {
    const n = i + 1;
    if (item.kind === "track") {
      const label = `Track ${n}`;
      if (prevKind === "track") {
        out.push({
          rule: "adjacent_tracks",
          side,
          message: `${label} follows another track. Put an interlude between tracks on the same side.`,
        });
      }
      const name = item.name ?? "";
      if (!(NAME_MIN_CHARS <= name.trim().length) || name.length > NAME_MAX_CHARS) {
        out.push({
          rule: "track_name",
          side,
          message: `${label}: topic name must be ${NAME_MIN_CHARS} to ${NAME_MAX_CHARS} characters.`,
        });
      }
      const exempt = item.id !== undefined && unchangedIds.has(item.id);
      const lo = exempt ? TRACK_MIN_MINUTES_DEMO : minTrackMinutes(demoMode);
      if (!(lo <= item.minutes && item.minutes <= TRACK_MAX_MINUTES)) {
        out.push({
          rule: "track_minutes",
          side,
          message: `${label}: duration must be ${lo} to ${TRACK_MAX_MINUTES} minutes.`,
        });
      }
      out.push(...keyTermViolations(item, side, label));
    } else if (
      !(INTERLUDE_MIN_MINUTES <= item.minutes && item.minutes <= INTERLUDE_MAX_MINUTES)
    ) {
      out.push({
        rule: "interlude_minutes",
        side,
        message: `Item ${n}: interlude must be ${INTERLUDE_MIN_MINUTES} to ${INTERLUDE_MAX_MINUTES} minutes.`,
      });
    }
    prevKind = item.kind;
  });
  return out;
}

export function validateTape(
  tape: TapeDraft,
  demoMode: boolean,
  unchangedIds: ReadonlySet<string> = new Set(),
): RuleViolation[] {
  const out: RuleViolation[] = [];
  const title = tape.title;
  if (!(TITLE_MIN_CHARS <= title.trim().length) || title.length > TITLE_MAX_CHARS) {
    out.push({
      rule: "title",
      side: null,
      message: `Title must be ${TITLE_MIN_CHARS} to ${TITLE_MAX_CHARS} characters.`,
    });
  }
  if (!isTapeLength(tape.length)) {
    out.push({
      rule: "length",
      side: null,
      message: `Length must be one of ${TAPE_LENGTHS.join(", ")}.`,
    });
  }
  if (![...tape.sideA, ...tape.sideB].some((i) => i.kind === "track")) {
    out.push({ rule: "no_tracks", side: null, message: "Add at least one track." });
  }
  out.push(
    ...validateSide(tape.sideA, demoMode, unchangedIds, tape.length, "A"),
    ...validateSide(tape.sideB, demoMode, unchangedIds, tape.length, "B"),
  );
  return out;
}
