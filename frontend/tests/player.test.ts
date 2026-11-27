import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  currentItem,
  initialPlayerState,
  parsePlayerState,
  remainingMsAt,
  serializePlayerState,
  step,
  type PlayerAction,
  type PlayerItem,
  type PlayerPlan,
  type PlayerState,
} from "../src/domain/player";

const MIN = 60_000;

function plan(a: number[], b: number[]): PlayerPlan {
  const mk = (p: string, ds: number[]): PlayerItem[] =>
    ds.map((d, i) => ({ id: `${p}${i}`, kind: i % 2 === 0 ? "track" : "interlude", durationMs: d * MIN }));
  return { sideA: mk("a", a), sideB: mk("b", b) };
}

const planArb = fc
  .tuple(
    fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 0, maxLength: 4 }),
    fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 0, maxLength: 4 }),
  )
  .filter(([a, b]) => a.length + b.length > 0)
  .map(([a, b]) => plan(a, b));

const actionsArb = fc.array(
  fc.record({
    type: fc.constantFrom("PLAY", "PAUSE", "REW", "FF", "STOP", "TICK"),
    dt: fc.integer({ min: 0, max: 30 * MIN }),
  }),
  { maxLength: 40 },
);

function run(p: PlayerPlan, acts: { type: string; dt: number }[], check: (s: PlayerState, now: number) => void) {
  let s = initialPlayerState(p);
  let now = 1_700_000_000_000;
  for (const a of acts) {
    now += a.dt;
    s = step(p, s, { type: a.type, now } as PlayerAction);
    check(s, now);
  }
  return { s, now };
}

describe("player state machine", () => {
  it("PLAY starts the first item; PAUSE then PLAY resumes from remaining", () => {
    const p = plan([10], []);
    let s = step(p, initialPlayerState(p), { type: "PLAY", now: 0 });
    expect(remainingMsAt(p, s, 4 * MIN)).toBe(6 * MIN);
    s = step(p, s, { type: "PAUSE", now: 4 * MIN });
    expect(remainingMsAt(p, s, 100 * MIN)).toBe(6 * MIN);
    s = step(p, s, { type: "PLAY", now: 50 * MIN });
    expect(remainingMsAt(p, s, 51 * MIN)).toBe(5 * MIN);
  });

  it("REW restarts the item, FF skips it, and a track end sets the REC prompt", () => {
    const p = plan([10, 5, 10], []);
    let s = step(p, initialPlayerState(p), { type: "PLAY", now: 0 });
    s = step(p, s, { type: "REW", now: 3 * MIN });
    expect(remainingMsAt(p, s, 3 * MIN)).toBe(10 * MIN);
    s = step(p, s, { type: "TICK", now: 13 * MIN });
    expect(s.outcomes["a0"]).toBe("completed");
    expect(s.recPromptTrackId).toBe("a0");
    s = step(p, s, { type: "FF", now: 14 * MIN });
    expect(s.outcomes["a1"]).toBe("skipped");
    expect(currentItem(p, s)?.id).toBe("a2");
    expect(s.recPromptTrackId).toBeNull();
  });

  it("flips after Side A, waits for PLAY, and finishes after Side B", () => {
    const p = plan([10], [10]);
    let s = step(p, initialPlayerState(p), { type: "PLAY", now: 0 });
    s = step(p, s, { type: "TICK", now: 10 * MIN });
    expect(s.status).toBe("flipping");
    s = step(p, s, { type: "TICK", now: 500 * MIN });
    expect(s.status).toBe("flipping");
    s = step(p, s, { type: "PLAY", now: 500 * MIN });
    expect(s.status).toBe("playing");
    s = step(p, s, { type: "TICK", now: 510 * MIN });
    expect(s.status).toBe("finished");
  });

  it("STOP ends the session and resume after reload is accurate", () => {
    const p = plan([10], []);
    const s = step(p, initialPlayerState(p), { type: "PLAY", now: 0 });
    const restored = parsePlayerState(p, serializePlayerState(p, s));
    expect(restored).not.toBeNull();
    expect(remainingMsAt(p, restored as PlayerState, 7 * MIN)).toBe(3 * MIN);
    expect(parsePlayerState(plan([11], []), serializePlayerState(p, s))).toBeNull();
    expect(step(p, s, { type: "STOP", now: MIN }).status).toBe("stopped");
  });

  it("property: countdown is never negative or above the item duration", () => {
    // **Validates: Requirements 3.2, 3.3, 3.11, 3.12, 12.11**
    fc.assert(
      fc.property(planArb, actionsArb, fc.integer({ min: 0, max: 600 * MIN }), (p, acts, extra) => {
        run(p, acts, (s, now) => {
          const item = currentItem(p, s);
          if (!item) return;
          for (const t of [now, now + extra, now - extra]) {
            const r = remainingMsAt(p, s, t);
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThanOrEqual(item.durationMs);
          }
        });
      }),
    );
  });

  it("property: every item ends completed, skipped or not played, in order", () => {
    // **Validates: Requirements 3.1–3.9**
    fc.assert(
      fc.property(planArb, actionsArb, (p, acts) => {
        const { s } = run(p, acts, () => {});
        const ordered = [...p.sideA, ...p.sideB];
        const known = new Set(ordered.map((i) => i.id));
        for (const id of Object.keys(s.outcomes)) expect(known.has(id)).toBe(true);
        // Outcomes form a prefix of the play order: nothing after a not-played item.
        let seenUnplayed = false;
        for (const item of ordered) {
          const o = s.outcomes[item.id];
          if (o === undefined) seenUnplayed = true;
          else expect(seenUnplayed).toBe(false);
        }
        if (s.status === "finished") expect(Object.keys(s.outcomes).length).toBe(ordered.length);
      }),
    );
  });

  it("property: extra TICK events never change the countdown or outcomes", () => {
    // **Validates: Requirements 3.11**
    fc.assert(
      fc.property(planArb, actionsArb, fc.array(fc.integer({ min: 0, max: 5 * MIN }), { maxLength: 10 }), (p, acts, ticks) => {
        const a = run(p, acts, () => {});
        let s = a.s;
        let now = a.now;
        for (const dt of ticks) {
          now += dt;
          s = step(p, s, { type: "TICK", now });
        }
        const direct = step(p, a.s, { type: "TICK", now });
        expect(s.outcomes).toEqual(direct.outcomes);
        expect(remainingMsAt(p, s, now)).toBe(remainingMsAt(p, direct, now));
      }),
    );
  });
});
