import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  condition,
  isDue,
  nextReviewAt,
  strengthAt,
  tapeCondition,
  tapeStrength,
  S_MAX,
  S_MIN,
} from "../src/domain/strength";

// Vectors generated from backend/app/domain/strength.py.
const STRENGTH_VECTORS: [number, number, number, number][] = [
  [100, 0.25, 0.5, 14],
  [100, 1.0, 0.5, 61],
  [100, 1.0, 3, 5],
  [100, 7.5, 3, 67],
  [100, 60.0, 30, 61],
  [50, 1.0, 0.5, 30],
  [50, 7.5, 0.5, 47],
  [50, 7.5, 30, 1],
  [50, 0.25, 0.5, 7],
  [1, 1.0, 0.5, 1],
  [1, 1.0, 3, 0],
  [0, 7.5, 3, 0],
];
const DUE_VECTORS: [number, number, number, boolean][] = [
  [70, 1.0, 0, true],
  [71, 1.0, 0, false],
  [71, 1.0, 0.1, true],
  [71, 10.0, 2, true],
  [100, 10.0, 2, false],
  [100, 1.0, 2, true],
];
const T0 = Date.UTC(2025, 0, 1);
const NEXT_VECTORS: [number, number, number][] = [
  [50, 1.0, 1735689600000.0],
  [71, 1.0, 1735690825552.4631],
  [100, 12.5, 1736074808939.454],
];
const TAPE_VECTORS: [number[], number | null, string][] = [
  [[], null, "Mint"],
  [[0], 0, "Dead"],
  [[0, 1], 1, "Haunted"],
  [[100, 0], 50, "Worn"],
  [[49, 50, 48, 70], 54, "Worn"],
  [[80, 80, 79], 80, "Mint"],
];

describe("strength parity with backend", () => {
  it.each(STRENGTH_VECTORS)("strengthAt(%d, %d, %d) = %d", (b, s, e, want) => {
    expect(strengthAt(b, s, e)).toBe(want);
  });
  it.each(DUE_VECTORS)("isDue(%d, %d, %d) = %s", (b, s, e, want) => {
    expect(isDue(b, s, e)).toBe(want);
  });
  it.each(NEXT_VECTORS)("nextReviewAt(%d, %d)", (b, s, want) => {
    expect(Math.abs(nextReviewAt(T0, b, s) - want)).toBeLessThan(1);
  });
  it.each(TAPE_VECTORS)("tape %j", (xs, strength, cond) => {
    expect(tapeStrength(xs)).toBe(strength);
    expect(tapeCondition(xs)).toBe(cond);
  });
  it("condition thresholds", () => {
    expect(
      [100, 80, 79, 50, 49, 20, 19, 1, 0].map(condition),
    ).toEqual(["Mint", "Mint", "Worn", "Worn", "Warped", "Warped", "Haunted", "Haunted", "Dead"]);
  });
});

describe("strength properties", () => {
  const base = fc.integer({ min: 0, max: 100 });
  const stab = fc.double({ min: S_MIN, max: S_MAX, noNaN: true });
  const days = fc.double({ min: 0, max: 400, noNaN: true });

  // Validates: Requirements 6.2, 6.3
  it("strength is an integer in 0..100", () => {
    fc.assert(
      fc.property(base, stab, days, (b, s, e) => {
        const v = strengthAt(b, s, e);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }),
    );
  });

  // Validates: Requirements 6.2
  it("strength never increases as time passes", () => {
    fc.assert(
      fc.property(base, stab, days, days, (b, s, e1, e2) => {
        const [lo, hi] = e1 <= e2 ? [e1, e2] : [e2, e1];
        expect(strengthAt(b, s, hi)).toBeLessThanOrEqual(strengthAt(b, s, lo));
      }),
    );
  });

  // Validates: Requirements 6.4
  it("tape strength is within 0..100 and ghost iff all zero", () => {
    fc.assert(
      fc.property(fc.array(base, { minLength: 1, maxLength: 12 }), (xs) => {
        const t = tapeStrength(xs) as number;
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(100);
        expect(t === 0).toBe(xs.every((x) => x === 0));
      }),
    );
  });

  const ORDER = ["Dead", "Haunted", "Warped", "Worn", "Mint"];

  const rank = (c: string) => ORDER.indexOf(c);

  // Validates: Requirements 6.4
  it("condition is monotonic in strength", () => {
    fc.assert(
      fc.property(base, base, (x, y) => {
        const [a, b] = x <= y ? [x, y] : [y, x];
        expect(rank(condition(a))).toBeLessThanOrEqual(rank(condition(b)));
      }),
    );
  });

  // Validates: Requirements 6.4
  it("condition never improves over time", () => {
    fc.assert(
      fc.property(base, stab, days, days, (b, s, x, y) => {
        const [e1, e2] = x <= y ? [x, y] : [y, x];
        expect(rank(condition(strengthAt(b, s, e2)))).toBeLessThanOrEqual(
          rank(condition(strengthAt(b, s, e1))),
        );
      }),
    );
  });
});
