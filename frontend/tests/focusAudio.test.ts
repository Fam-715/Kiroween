import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import {
  FOCUS_SOUNDS,
  NOISE_LOOP_SECONDS,
  createFocusAudio,
  effectiveGain,
  fadeValueAt,
  generateLoop,
  volumeToGain,
  type FocusAudioContext,
} from "../src/audio/focusAudio";

/** Mock AudioParam that records ramps and resolves linearly at the ramp end. */
function makeParam(initial = 1) {
  const p = {
    value: initial,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn((v: number) => {
      p.value = v;
    }),
    linearRampToValueAtTime: vi.fn((v: number) => {
      p.value = v; // reaches its target at the end time
    }),
  };
  return p;
}

function makeContext() {
  const gains: { gain: ReturnType<typeof makeParam>; connect: ReturnType<typeof vi.fn> }[] = [];
  const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  const ctx = {
    currentTime: 0,
    sampleRate: 100,
    destination: {} as AudioNode,
    state: "running" as AudioContextState,
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    createGain: vi.fn(() => {
      const g = { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn() };
      gains.push(g);
      return g as unknown as GainNode;
    }),
    createBuffer: vi.fn((_c: number, length: number) => {
      const data = new Float32Array(length);
      return { getChannelData: () => data } as unknown as AudioBuffer;
    }),
    createBufferSource: vi.fn(() => {
      const s = {
        buffer: null,
        loop: false,
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      sources.push(s);
      return s as unknown as AudioBufferSourceNode;
    }),
    createBiquadFilter: vi.fn(() => ({
      type: "lowpass",
      frequency: { value: 0 },
      Q: { value: 0 },
      connect: vi.fn(),
    })) as unknown as FocusAudioContext["createBiquadFilter"],
  };
  return { ctx: ctx as unknown as FocusAudioContext, gains, sources, raw: ctx };
}

describe("focus audio engine", () => {
  it("creates no context and plays nothing before start()", () => {
    const factory = vi.fn();
    const audio = createFocusAudio(factory);
    audio.setVolume(50);
    audio.mute(true);
    audio.fadeTo(0);
    expect(factory).not.toHaveBeenCalled();
    expect(audio.isPlaying).toBe(false);
  });

  it("starts each sound bed only on start()", () => {
    for (const sound of FOCUS_SOUNDS) {
      const m = makeContext();
      const audio = createFocusAudio(() => m.ctx);
      audio.start(sound);
      expect(m.sources).toHaveLength(1);
      expect(m.sources[0].start).toHaveBeenCalledTimes(1);
      expect(audio.sound).toBe(sound);
      audio.stop();
      expect(m.sources[0].stop).toHaveBeenCalled();
      expect(audio.isPlaying).toBe(false);
    }
  });

  it("volume 0 and mute both give volume gain 0", () => {
    const m = makeContext();
    const audio = createFocusAudio(() => m.ctx);
    audio.start("brown");
    const volumeGain = m.gains[1].gain;
    audio.setVolume(0);
    expect(volumeGain.value).toBe(0);
    audio.setVolume(80);
    expect(volumeGain.value).toBeCloseTo(0.8);
    audio.mute(true);
    expect(volumeGain.value).toBe(0);
    audio.mute(false);
    expect(volumeGain.value).toBeCloseTo(0.8);
  });

  it("mute set before start() applies once the context exists", () => {
    const m = makeContext();
    const audio = createFocusAudio(() => m.ctx);
    audio.mute(true);
    audio.start("rain");
    expect(m.gains[1].gain.value).toBe(0);
  });

  it("fadeTo ramps linearly over 2 s by default and reaches its target", () => {
    const m = makeContext();
    const audio = createFocusAudio(() => m.ctx);
    audio.start("lofi");
    const fade = m.gains[0].gain;
    audio.fadeTo(0);
    expect(fade.linearRampToValueAtTime).toHaveBeenCalledWith(0, 2);
    expect(fade.value).toBe(0);
    audio.fadeTo(1, 0.5);
    expect(fade.linearRampToValueAtTime).toHaveBeenLastCalledWith(1, 0.5);
    expect(fade.value).toBe(1);
  });
});

describe("focus audio dispose", () => {
  it("dispose() stops the sound and closes the context", () => {
    const m = makeContext();
    const audio = createFocusAudio(() => m.ctx);
    audio.start("brown");
    audio.dispose();
    expect(m.sources[0].stop).toHaveBeenCalled();
    expect(m.raw.close).toHaveBeenCalledTimes(1);
    expect(audio.isPlaying).toBe(false);
    expect(audio.sound).toBeNull();
  });

  it("start() after dispose() creates a fresh context, and dispose() twice is safe", () => {
    const contexts = [makeContext(), makeContext()];
    let n = 0;
    const audio = createFocusAudio(() => contexts[n++].ctx);
    audio.start("rain");
    audio.dispose();
    audio.dispose();
    audio.start("lofi");
    expect(n).toBe(2);
    expect(contexts[0].raw.close).toHaveBeenCalledTimes(1);
    expect(contexts[1].raw.close).not.toHaveBeenCalled();
    expect(audio.isPlaying).toBe(true);
  });
});

describe("generated loops", () => {
  const SR = 44100;
  const stats = (d: Float32Array) => {
    let sum = 0;
    let peak = 0;
    for (const v of d) {
      sum += v * v;
      peak = Math.max(peak, Math.abs(v));
    }
    return { rms: Math.sqrt(sum / d.length), peak };
  };
  const loops = Object.fromEntries(FOCUS_SOUNDS.map((s) => [s, generateLoop(s, SR)])) as Record<
    (typeof FOCUS_SOUNDS)[number],
    Float32Array
  >;

  it("brown and rain loops are NOISE_LOOP_SECONDS long", () => {
    expect(NOISE_LOOP_SECONDS).toBe(10);
    expect(loops.brown.length).toBe(SR * NOISE_LOOP_SECONDS);
    expect(loops.rain.length).toBe(SR * NOISE_LOOP_SECONDS);
  });

  it("all three loops have similar RMS (within 2 dB) and peak below 0.9", () => {
    const s = FOCUS_SOUNDS.map((k) => ({ k, ...stats(loops[k]) }));
    const db = s.map((x) => 20 * Math.log10(x.rms));
    expect(Math.max(...db) - Math.min(...db)).toBeLessThan(2);
    for (const x of s) expect(x.peak).toBeLessThan(0.9);
  });

  it("brown noise wraps seamlessly: the loop jump is no larger than a normal step", () => {
    const d = loops.brown;
    let maxStep = 0;
    for (let i = 1; i < d.length; i++) maxStep = Math.max(maxStep, Math.abs(d[i] - d[i - 1]));
    expect(Math.abs(d[0] - d[d.length - 1])).toBeLessThanOrEqual(maxStep + 1e-9);
  });
});

describe("focus audio properties", () => {
  /** Validates: Requirements 10.4, 10.5 */
  it("volume to gain is bounded in [0,1] and monotonic", () => {
    fc.assert(
      fc.property(fc.double({ min: -50, max: 150, noNaN: true }), fc.double({ min: -50, max: 150, noNaN: true }), (a, b) => {
        const ga = volumeToGain(a);
        const gb = volumeToGain(b);
        expect(ga).toBeGreaterThanOrEqual(0);
        expect(ga).toBeLessThanOrEqual(1);
        if (a <= b) expect(ga).toBeLessThanOrEqual(gb);
      }),
    );
  });

  /** Validates: Requirements 10.5 */
  it("gain is 0 when muted and never above volume", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), fc.boolean(), (v, muted) => {
        const g = effectiveGain(v, muted);
        if (muted) expect(g).toBe(0);
        expect(g).toBeLessThanOrEqual(v / 100 + 1e-12);
      }),
    );
  });

  /** Validates: Requirements 10.4 */
  it("fade value stays between start and end and is monotonic in time", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 12, noNaN: true }),
        fc.double({ min: 0, max: 12, noNaN: true }),
        (from, to, dur, t1, t2) => {
          const [ta, tb] = t1 <= t2 ? [t1, t2] : [t2, t1];
          const a = fadeValueAt(from, to, dur, ta);
          const b = fadeValueAt(from, to, dur, tb);
          const lo = Math.min(from, to) - 1e-9;
          const hi = Math.max(from, to) + 1e-9;
          expect(a).toBeGreaterThanOrEqual(lo);
          expect(a).toBeLessThanOrEqual(hi);
          if (to >= from) expect(b).toBeGreaterThanOrEqual(a - 1e-9);
          else expect(b).toBeLessThanOrEqual(a + 1e-9);
          expect(fadeValueAt(from, to, dur, dur)).toBe(to);
        },
      ),
    );
  });
});
