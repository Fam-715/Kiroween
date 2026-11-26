import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { TIME_SCALE_REAL, TIME_SCALE_WARP, setScale, virtualNow } from "../src/domain/clock";

const ms = fc.integer({ min: 0, max: 4_000_000_000_000 });
const scale = fc.constantFrom(TIME_SCALE_REAL, TIME_SCALE_WARP);
const clockArb = fc.record({ scale, anchorReal: ms, anchorVirtual: ms });

describe("clock", () => {
  it("matches backend: warp runs 1 day per real minute", () => {
    const c = { scale: 1440, anchorReal: 0, anchorVirtual: 1000 };
    expect(virtualNow(c, 60_000)).toBe(1000 + 86_400_000);
  });

  // Validates: Requirements 6.12, 12.7
  it("virtual time never decreases as real time advances", () => {
    fc.assert(
      fc.property(clockArb, ms, ms, (c, a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(virtualNow(c, hi)).toBeGreaterThanOrEqual(virtualNow(c, lo));
      }),
    );
  });

  // Validates: Requirements 6.12
  it("equals real offset at scale 1", () => {
    fc.assert(
      fc.property(ms, ms, (anchor, t) => {
        const c = { scale: 1, anchorReal: anchor, anchorVirtual: anchor };
        expect(virtualNow(c, t)).toBe(t);
      }),
    );
  });

  // Validates: Requirements 6.12
  it("setScale keeps virtual time continuous", () => {
    fc.assert(
      fc.property(clockArb, ms, scale, (c, t, s) => {
        expect(virtualNow(setScale(c, t, s), t)).toBe(virtualNow(c, t));
      }),
    );
  });

  it("rejects unknown scales", () => {
    expect(() => setScale({ scale: 1, anchorReal: 0, anchorVirtual: 0 }, 0, 7)).toThrow();
  });
});
