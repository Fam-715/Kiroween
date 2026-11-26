/**
 * Focus-session state machine (pure, no I/O). Requirements 3.1–3.9, 3.11, 3.12, 12.11.
 *
 * The countdown is derived from timestamps (`itemEndsAt - now`), never counted in
 * intervals, so hidden tabs and reloads stay accurate. All times are real epoch
 * milliseconds; virtual time / time warp is never used here.
 *
 *   idle → playing ⇄ paused → flipping → playing → finished | stopped
 */

export type PlayerItemKind = "track" | "interlude";
export type PlayerSide = "A" | "B";
export type PlayerStatus = "idle" | "playing" | "paused" | "flipping" | "finished" | "stopped";
export type ItemOutcome = "completed" | "skipped";

export interface PlayerItem {
  id: string;
  kind: PlayerItemKind;
  durationMs: number;
}

export interface PlayerPlan {
  sideA: readonly PlayerItem[];
  sideB: readonly PlayerItem[];
}

export interface PlayerState {
  status: PlayerStatus;
  side: PlayerSide;
  /** Index of the current item on `side`. */
  index: number;
  /** Epoch ms when the current item ends. Only set while `playing`. */
  itemEndsAt: number | null;
  /** Remaining ms of the current item while not playing. */
  remainingMs: number;
  /** Outcome per item id. Items without an entry were not played. */
  outcomes: Readonly<Record<string, ItemOutcome>>;
  /** Track that just completed; kept until the next track starts. */
  recPromptTrackId: string | null;
  /** Epoch ms of the first PLAY of this session. */
  startedAt: number | null;
}

export type PlayerAction =
  | { type: "PLAY"; now: number }
  | { type: "PAUSE"; now: number }
  | { type: "REW"; now: number }
  | { type: "FF"; now: number }
  | { type: "STOP"; now: number }
  | { type: "TICK"; now: number };

export function sideItems(plan: PlayerPlan, side: PlayerSide): readonly PlayerItem[] {
  return side === "A" ? plan.sideA : plan.sideB;
}

export function currentItem(plan: PlayerPlan, state: PlayerState): PlayerItem | null {
  return sideItems(plan, state.side)[state.index] ?? null;
}

export function initialPlayerState(plan: PlayerPlan): PlayerState {
  const side: PlayerSide = plan.sideA.length > 0 ? "A" : "B";
  return {
    status: "idle",
    side,
    index: 0,
    itemEndsAt: null,
    remainingMs: sideItems(plan, side)[0]?.durationMs ?? 0,
    outcomes: {},
    recPromptTrackId: null,
    startedAt: null,
  };
}

function startItem(
  plan: PlayerPlan,
  state: PlayerState,
  side: PlayerSide,
  index: number,
  at: number,
): PlayerState {
  const item = sideItems(plan, side)[index];
  if (!item) return { ...state, status: "finished", itemEndsAt: null, remainingMs: 0 };
  return {
    ...state,
    status: "playing",
    side,
    index,
    itemEndsAt: at + item.durationMs,
    remainingMs: item.durationMs,
    recPromptTrackId: item.kind === "track" ? null : state.recPromptTrackId,
  };
}

/** Record the current item's outcome and move on (next item, flip, or finish). */
function endCurrent(
  plan: PlayerPlan,
  state: PlayerState,
  outcome: ItemOutcome,
  at: number,
): PlayerState {
  const item = currentItem(plan, state);
  if (!item) return state;
  const marked: PlayerState = {
    ...state,
    outcomes: { ...state.outcomes, [item.id]: outcome },
    recPromptTrackId:
      outcome === "completed" && item.kind === "track" ? item.id : state.recPromptTrackId,
  };
  const items = sideItems(plan, state.side);
  if (state.index + 1 < items.length) {
    return startItem(plan, marked, state.side, state.index + 1, at);
  }
  if (state.side === "A" && plan.sideB.length > 0) {
    return {
      ...marked,
      status: "flipping",
      side: "B",
      index: 0,
      itemEndsAt: null,
      remainingMs: plan.sideB[0]?.durationMs ?? 0,
    };
  }
  return { ...marked, status: "finished", itemEndsAt: null, remainingMs: 0 };
}

/** Resolve every item whose end time has passed (chained from the previous end time). */
function settle(plan: PlayerPlan, state: PlayerState, now: number): PlayerState {
  let s = state;
  while (s.status === "playing" && s.itemEndsAt !== null && now >= s.itemEndsAt) {
    s = endCurrent(plan, s, "completed", s.itemEndsAt);
  }
  return s;
}

export function step(plan: PlayerPlan, prev: PlayerState, action: PlayerAction): PlayerState {
  const now = action.now;
  const state = settle(plan, prev, now);
  const item = currentItem(plan, state);

  switch (action.type) {
    case "TICK":
      return state;

    case "PLAY": {
      if (state.status === "playing") return state;
      if (state.status === "paused" && item) {
        return {
          ...state,
          status: "playing",
          itemEndsAt: now + state.remainingMs,
        };
      }
      if (state.status === "flipping") {
        return startItem(plan, state, "B", 0, now);
      }
      // idle, stopped or finished: begin a new session.
      const fresh = initialPlayerState(plan);
      if (!sideItems(plan, fresh.side)[0]) return state;
      return startItem(plan, { ...fresh, startedAt: now }, fresh.side, 0, now);
    }

    case "PAUSE": {
      if (state.status !== "playing" || state.itemEndsAt === null || !item) return state;
      const remaining = Math.min(item.durationMs, Math.max(0, state.itemEndsAt - now));
      return { ...state, status: "paused", itemEndsAt: null, remainingMs: remaining };
    }

    case "REW": {
      if (!item) return state;
      if (state.status === "playing") {
        return { ...state, itemEndsAt: now + item.durationMs, remainingMs: item.durationMs };
      }
      if (state.status === "paused") return { ...state, remainingMs: item.durationMs };
      return state;
    }

    case "FF": {
      if (state.status !== "playing" && state.status !== "paused") return state;
      return endCurrent(plan, state, "skipped", now);
    }

    case "STOP": {
      if (state.status === "idle" || state.status === "finished" || state.status === "stopped") {
        return state;
      }
      return { ...state, status: "stopped", itemEndsAt: null };
    }
  }
}

/** Countdown for the current item. Always within [0, item duration]. */
export function remainingMsAt(plan: PlayerPlan, state: PlayerState, now: number): number {
  const item = currentItem(plan, state);
  if (!item) return 0;
  if (state.status === "playing" && state.itemEndsAt !== null) {
    return Math.min(item.durationMs, Math.max(0, state.itemEndsAt - now));
  }
  return Math.min(item.durationMs, Math.max(0, state.remainingMs));
}

/** Planned time not yet played (current item's remainder plus every later item). */
export function plannedRemainingMs(plan: PlayerPlan, state: PlayerState, now: number): number {
  if (state.status === "idle") {
    return [...plan.sideA, ...plan.sideB].reduce((n, i) => n + i.durationMs, 0);
  }
  if (state.status === "finished") return 0;
  let total = remainingMsAt(plan, state, now);
  const items = sideItems(plan, state.side);
  for (let i = state.index + 1; i < items.length; i++) total += items[i]?.durationMs ?? 0;
  if (state.side === "A") for (const i of plan.sideB) total += i.durationMs;
  return total;
}

export type PlayerEvent =
  | { type: "item"; item: PlayerItem; outcome: ItemOutcome }
  | { type: "stopped" }
  | { type: "finished" };

/** Events produced by moving from `prev` to `next` (for logging and API calls). */
export function diffEvents(plan: PlayerPlan, prev: PlayerState, next: PlayerState): PlayerEvent[] {
  const out: PlayerEvent[] = [];
  const byId = new Map([...plan.sideA, ...plan.sideB].map((i) => [i.id, i] as const));
  const ordered = [...plan.sideA, ...plan.sideB];
  for (const item of ordered) {
    const outcome = next.outcomes[item.id];
    if (outcome && !prev.outcomes[item.id] && byId.has(item.id)) {
      out.push({ type: "item", item, outcome });
    }
  }
  if (prev.status !== next.status) {
    if (next.status === "stopped") out.push({ type: "stopped" });
    if (next.status === "finished") out.push({ type: "finished" });
  }
  return out;
}

// --- Persistence (reload resume) ---------------------------------------------------

export function planFingerprint(plan: PlayerPlan): string {
  const f = (items: readonly PlayerItem[]) =>
    items.map((i) => `${i.id}:${i.kind}:${i.durationMs}`).join(",");
  return `${f(plan.sideA)}|${f(plan.sideB)}`;
}

export function serializePlayerState(plan: PlayerPlan, state: PlayerState): string {
  return JSON.stringify({ fingerprint: planFingerprint(plan), state });
}

const STATUSES: readonly string[] = [
  "idle",
  "playing",
  "paused",
  "flipping",
  "finished",
  "stopped",
];

/** Returns the stored state only if it belongs to this exact plan and is well formed. */
export function parsePlayerState(plan: PlayerPlan, raw: string | null): PlayerState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { fingerprint?: unknown; state?: Partial<PlayerState> };
    const s = data.state;
    if (data.fingerprint !== planFingerprint(plan) || !s) return null;
    if (typeof s.status !== "string" || !STATUSES.includes(s.status)) return null;
    if (s.side !== "A" && s.side !== "B") return null;
    if (typeof s.index !== "number" || typeof s.remainingMs !== "number") return null;
    if (s.itemEndsAt !== null && typeof s.itemEndsAt !== "number") return null;
    if (typeof s.outcomes !== "object" || s.outcomes === null) return null;
    const state = s as PlayerState;
    if (!currentItem(plan, state) && state.status !== "finished") return null;
    return {
      ...state,
      recPromptTrackId: state.recPromptTrackId ?? null,
      startedAt: state.startedAt ?? null,
    };
  } catch {
    return null;
  }
}
