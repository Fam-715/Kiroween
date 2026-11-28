import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { effectsFor, type EffectSettings } from "../src/domain/effects";
import type { Condition } from "../src/domain/strength";
import { playRecording, type PlaybackAudioContext } from "../src/audio/decayedPlayback";

interface Param {
  value: number;
}

class MockNode {
  connections: unknown[] = [];
  disconnected = false;
  started = false;
  stopped = false;
  loop = false;
  buffer: unknown = null;
  curve: unknown = null;
  onended: (() => void) | null = null;
  gain: Param = { value: 1 };
  frequency: Param = { value: 0 };
  playbackRate: Param = { value: 1 };
  detune: Param = { value: 0 };
  constructor(readonly kind: string) {}
  connect(target: unknown): unknown {
    this.connections.push(target);
    return target;
  }
  disconnect(): void {
    this.disconnected = true;
  }
  start(): void {
    this.started = true;
  }
  stop(): void {
    this.stopped = true;
  }
  getChannelData(): Float32Array {
    return new Float32Array(8);
  }
}

class MockContext {
  readonly currentTime = 0;
  readonly sampleRate = 8;
  readonly destination = new MockNode("destination");
  state = "running";
  closed = false;
  nodes: MockNode[] = [];
  decoded = { kind: "decoded", duration: 2 };
  decodeError: Error | null = null;
  private make(kind: string): MockNode {
    const n = new MockNode(kind);
    this.nodes.push(n);
    return n;
  }
  resume = async (): Promise<void> => {};
  close = async (): Promise<void> => {
    this.closed = true;
    this.state = "closed";
  };
  decodeAudioData = async (): Promise<unknown> => {
    if (this.decodeError) throw this.decodeError;
    return this.decoded;
  };
  createGain = (): MockNode => this.make("gain");
  createOscillator = (): MockNode => this.make("osc");
  createWaveShaper = (): MockNode => this.make("shaper");
  createBuffer = (): MockNode => new MockNode("buffer");
  createBufferSource = (): MockNode => this.make("source");
  of(kind: string): MockNode[] {
    return this.nodes.filter((n) => n.kind === kind);
  }
  get voice(): MockNode | undefined {
    return this.of("source").find((s) => s.buffer === this.decoded);
  }
  get noise(): MockNode | undefined {
    return this.of("source").find((s) => s.loop);
  }
}

const blob = { arrayBuffer: async () => new ArrayBuffer(4) } as unknown as Blob;
const STRENGTH: Record<Condition, number> = { Mint: 100, Worn: 60, Warped: 30, Haunted: 10, Dead: 0 };
const CONDITIONS = Object.keys(STRENGTH) as Condition[];

function setup(effects: EffectSettings, onEnded?: () => void) {
  const ctx = new MockContext();
  const factory = vi.fn(() => ctx as unknown as PlaybackAudioContext);
  const promise = playRecording(blob, effects, { contextFactory: factory, onEnded });
  return { ctx, factory, promise };
}

/** Depth of the LFO driving `param`, or null when there is none. */
function lfoDepth(ctx: MockContext, param: "playbackRate" | "detune"): number | null {
  const voice = ctx.voice as MockNode;
  const g = ctx.of("gain").find((n) => n.connections.includes(voice[param]));
  return g ? g.gain.value : null;
}

function check(ctx: MockContext, e: EffectSettings): void {
  if (e.voiceGain === 0) {
    expect(ctx.voice).toBeUndefined();
    expect(ctx.noise?.connections).toHaveLength(1);
    expect((ctx.noise?.connections[0] as MockNode).gain.value).toBe(e.noiseGain);
    expect(ctx.of("osc")).toHaveLength(0);
    expect(ctx.of("shaper")).toHaveLength(0);
    return;
  }
  const voice = ctx.voice as MockNode;
  expect((voice.connections[0] as MockNode).gain.value).toBe(e.voiceGain);
  expect(lfoDepth(ctx, "playbackRate")).toBe(e.audioWobblePct > 0 ? e.audioWobblePct / 100 : null);
  expect(lfoDepth(ctx, "detune")).toBe(e.pitchWobbleCents > 0 ? e.pitchWobbleCents : null);
  expect(ctx.of("shaper")).toHaveLength(e.distortion > 0 ? 1 : 0);
  if (e.hissGain > 0) {
    expect((ctx.noise?.connections[0] as MockNode).gain.value).toBe(e.hissGain);
  } else {
    expect(ctx.noise).toBeUndefined();
  }
}

describe("playRecording", () => {
  it("creates no AudioContext at import time, only when called", async () => {
    const Ctor = vi.fn();
    vi.stubGlobal("AudioContext", Ctor);
    vi.resetModules();
    const mod = await import("../src/audio/decayedPlayback");
    expect(Ctor).not.toHaveBeenCalled();
    expect(mod.playRecording).toBeTypeOf("function");
    vi.unstubAllGlobals();
    const { factory, promise } = setup(effectsFor(100, false));
    expect(factory).toHaveBeenCalledTimes(1);
    (await promise).stop();
  });

  it("Dead plays static at 0.15 and never connects the voice", async () => {
    const e = effectsFor(0, false);
    const { ctx, promise } = setup(e);
    await promise;
    expect(ctx.voice).toBeUndefined();
    expect(ctx.of("source")).toHaveLength(1);
    expect((ctx.noise?.connections[0] as MockNode).gain.value).toBe(0.15);
    expect(ctx.noise?.started).toBe(true);
  });

  it("Mint has no hiss, wobble or distortion", async () => {
    const { ctx, promise } = setup(effectsFor(100, false));
    await promise;
    expect(ctx.noise).toBeUndefined();
    expect(ctx.of("osc")).toHaveLength(0);
    expect(ctx.of("shaper")).toHaveLength(0);
    expect((ctx.voice?.connections[0] as MockNode).gain.value).toBe(1);
    expect(ctx.voice?.started).toBe(true);
  });

  it("Haunted adds hiss, both wobbles and distortion from effectsFor", async () => {
    const e = effectsFor(10, false);
    const { ctx, promise } = setup(e);
    await promise;
    check(ctx, e);
    expect(ctx.of("osc")).toHaveLength(2);
  });

  it("rejects and closes the context when decoding fails", async () => {
    const ctx = new MockContext();
    ctx.decodeError = new Error("bad audio");
    await expect(
      playRecording(blob, effectsFor(100, false), {
        contextFactory: () => ctx as unknown as PlaybackAudioContext,
      }),
    ).rejects.toThrow("bad audio");
    expect(ctx.closed).toBe(true);
  });

  it("stop() disconnects everything, closes the context and is idempotent", async () => {
    const onEnded = vi.fn();
    const { ctx, promise } = setup(effectsFor(10, false), onEnded);
    const handle = await promise;
    handle.stop();
    handle.stop();
    expect(ctx.nodes.length).toBeGreaterThan(5);
    expect(ctx.nodes.every((n) => n.disconnected)).toBe(true);
    expect(ctx.of("source").every((n) => n.stopped)).toBe(true);
    expect(ctx.closed).toBe(true);
    expect(onEnded).not.toHaveBeenCalled();
  });

  it("calls onEnded once when the source ends naturally, then cleans up", async () => {
    const onEnded = vi.fn();
    const { ctx, promise } = setup(effectsFor(60, false), onEnded);
    const handle = await promise;
    ctx.voice?.onended?.();
    handle.stop();
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(ctx.closed).toBe(true);
  });

  it("property: every condition's graph matches effectsFor", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...CONDITIONS), fc.boolean(), async (c, reduced) => {
        const e = effectsFor(STRENGTH[c], reduced);
        const { ctx, promise } = setup(e);
        const handle = await promise;
        check(ctx, e);
        handle.stop();
        expect(ctx.nodes.every((n) => n.disconnected)).toBe(true);
        expect(ctx.closed).toBe(true);
      }),
      { numRuns: 25 },
    );
  });
});
