import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { effectsFor, fadeGain, outputGain } from "../src/domain/effects";

const strength = fc.integer({ min: 0, max: 100 });
const gain = fc.double({ min: 0, max: 1, noNaN: true });

/** Intensity fields that must not increase as strength rises. */
function intensity(s: number, reduced: boolean) {
  const e = effectsFor(s, reduced);
  return [
    e.hissGain,
    e.audioWobblePct,
    e.reelWobblePct,
    e.pitchWobbleCents,
    e.distortion,
    e.colourBleedPx,
    e.flickerHz,
    e.ghostWhispers ? 1 : 0,
  ];
}

describe("effectsFor", () => {
  it("matches the table for each condition", () => {
    expect(effectsFor(90, false).hissGain).toBe(0);
    expect(effectsFor(60, false)).toMatchObject({ hissGain: 0.02, reelWobblePct: 2, distortion: 0.05 });
    expect(effectsFor(30, false)).toMatchObject({ pitchWobbleCents: 25, colourBleedPx: 2, flickerHz: 4 });
    expect(effectsFor(10, false)).toMatchObject({ hissGain: 0.1, distortion: 0.45, flickerHz: 8 });
    expect(effectsFor(10, false).ghostWhispers?.gain).toBe(0.08);
    expect(effectsFor(0, false)).toMatchObject({ noiseGain: 0.15, voiceGain: 0 });
  });

  // Validates: Requirements 7.2, 9.1, 9.2, 9.3
  // Dead (0) is "static only" in the table: its tape effects are 0 and noiseGain takes over,
  // so the property covers strengths 1-100.
  it("effect intensity never increases with strength", () => {
    const alive = fc.integer({ min: 1, max: 100 });
    fc.assert(
      fc.property(alive, alive, fc.boolean(), (a, b, reduced) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const weak = intensity(lo, reduced);
        const strong = intensity(hi, reduced);
        weak.forEach((v, i) => expect(v).toBeGreaterThanOrEqual(strong[i]));
      }),
    );
  });

  // Validates: Requirements 7.8, 9.5
  it("reduced motion zeroes visual wobble, spin and flicker but keeps audio effects", () => {
    fc.assert(
      fc.property(strength, (s) => {
        const r = effectsFor(s, true);
        const n = effectsFor(s, false);
        expect(r.reelWobblePct).toBe(0);
        expect(r.flickerHz).toBe(0);
        expect(r.reelSpin).toBe(false);
        expect(r.hissGain).toBe(n.hissGain);
        expect(r.audioWobblePct).toBe(n.audioWobblePct);
        expect(r.pitchWobbleCents).toBe(n.pitchWobbleCents);
        expect(r.distortion).toBe(n.distortion);
        expect(r.colourBleedPx).toBe(n.colourBleedPx);
      }),
    );
  });

  // Validates: Requirements 9.1
  it("Dead has no voice gain and other conditions keep the voice", () => {
    fc.assert(
      fc.property(strength, fc.boolean(), (s, reduced) => {
        const e = effectsFor(s, reduced);
        if (s === 0) {
          expect(e.voiceGain).toBe(0);
          expect(e.noiseGain).toBe(0.15);
        } else {
          expect(e.voiceGain).toBe(1);
          expect(e.noiseGain).toBe(0);
        }
      }),
    );
  });
});

describe("fadeGain", () => {
  const time = fc.double({ min: -10, max: 100, noNaN: true });
  const dur = fc.double({ min: 0.01, max: 60, noNaN: true });

  // Validates: Requirements 10.4, 10.5
  it("is bounded by start and end", () => {
    fc.assert(
      fc.property(time, gain, gain, dur, (t, a, b, d) => {
        const g = fadeGain(t, a, b, d);
        expect(g).toBeGreaterThanOrEqual(Math.min(a, b) - 1e-12);
        expect(g).toBeLessThanOrEqual(Math.max(a, b) + 1e-12);
      }),
    );
  });

  it("is monotonic in time in the direction of the fade", () => {
    fc.assert(
      fc.property(time, time, gain, gain, dur, (t1, t2, a, b, d) => {
        const [x, y] = t1 <= t2 ? [t1, t2] : [t2, t1];
        const g1 = fadeGain(x, a, b, d);
        const g2 = fadeGain(y, a, b, d);
        if (b >= a) expect(g2).toBeGreaterThanOrEqual(g1 - 1e-12);
        else expect(g2).toBeLessThanOrEqual(g1 + 1e-12);
      }),
    );
  });

  it("hits the endpoints and handles zero duration", () => {
    expect(fadeGain(0, 0.2, 0.8, 5)).toBe(0.2);
    expect(fadeGain(5, 0.2, 0.8, 5)).toBeCloseTo(0.8);
    expect(fadeGain(1, 0.2, 0.8, 0)).toBe(0.8);
  });
});

describe("outputGain", () => {
  // Validates: Requirements 7.3, 7.4
  it("is 0 when muted and never above volume", () => {
    fc.assert(
      fc.property(fc.double({ min: -1, max: 2, noNaN: true }), gain, fc.boolean(), (g, v, muted) => {
        const out = outputGain(g, v, muted);
        expect(out).toBeGreaterThanOrEqual(0);
        expect(out).toBeLessThanOrEqual(v);
        if (muted) expect(out).toBe(0);
      }),
    );
  });
});
