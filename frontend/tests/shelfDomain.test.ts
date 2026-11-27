import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { dueCount, focusMinutes, relativeReview } from "../src/domain/shelf";
import { DUE_STRENGTH, decayRatio } from "../src/domain/strength";

describe("shelf domain (task 15)", () => {
  it("Property: total focus minutes equals the sum of completed track durations", () => {
    // **Validates: Requirements 11.2**
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 60 })), (mins) => {
        let sum = 0;
        for (const m of mins) sum += m;
        expect(focusMinutes(mins)).toBe(sum);
      }),
    );
  });

  it("Property: due count equals tracks with unrounded strength <= 70", () => {
    // **Validates: Requirements 6.10, 6.11**
    const track = fc.record({
      base: fc.integer({ min: 0, max: 100 }),
      stabilityDays: fc.double({ min: 0.25, max: 60, noNaN: true }),
      elapsedDays: fc.double({ min: 0, max: 400, noNaN: true }),
    });
    fc.assert(
      fc.property(fc.array(track, { maxLength: 12 }), (tracks) => {
        const expected = tracks.filter(
          (t) => t.base * decayRatio(t.elapsedDays, t.stabilityDays) <= DUE_STRENGTH,
        ).length;
        expect(dueCount(tracks)).toBe(expected);
      }),
    );
  });

  it("formats relative review times", () => {
    const now = 1_000_000_000_000;
    expect(relativeReview(now - 5, now)).toBe("due now");
    expect(relativeReview(now + 3 * 86_400_000, now)).toBe("in 3 days");
    expect(relativeReview(now + 2 * 3_600_000, now)).toBe("in 2 hours");
  });
});
