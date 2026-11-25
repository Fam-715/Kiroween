/**
 * Procedural focus audio (Requirement 10). Everything is generated with the Web Audio
 * API, with no audio files. The AudioContext is created lazily in start(), so nothing
 * can play before the user presses PLAY.
 *
 * Graph: source -> fadeGain (0..1, interlude fades) -> volumeGain (volume/mute) -> out
 */

export type FocusSound = "brown" | "rain" | "lofi";

export const FOCUS_SOUNDS: readonly FocusSound[] = ["brown", "rain", "lofi"];
export const DEFAULT_FADE_SECONDS = 2;

const clamp = (n: number, lo: number, hi: number): number =>
  Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;

/** Volume 0-100 (%) to linear gain 0-1. */
export function volumeToGain(volume: number): number {
  return clamp(volume, 0, 100) / 100;
}

/** Gain of the volume stage: 0 when muted, never above the chosen volume. */
export function effectiveGain(volume: number, muted: boolean): number {
  return muted ? 0 : volumeToGain(volume);
}

/** Linear fade value at time t (seconds) for a fade from `from` to `to` over `duration`. */
export function fadeValueAt(from: number, to: number, duration: number, t: number): number {
  if (duration <= 0 || t >= duration) return to;
  if (t <= 0) return from;
  return from + (to - from) * (t / duration);
}

/** Minimal AudioContext surface used here, so tests can supply a mock. */
export interface FocusAudioContext {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: AudioNode;
  readonly state: AudioContextState;
  resume(): Promise<void>;
  close(): Promise<void>;
  createGain(): GainNode;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer;
  createBufferSource(): AudioBufferSourceNode;
  createBiquadFilter(): BiquadFilterNode;
}

export type ContextFactory = () => FocusAudioContext;

const defaultFactory: ContextFactory = () => {
  const w = window as unknown as {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) throw new Error("Web Audio is not supported in this browser");
  return new Ctor();
};

/** Deterministic pseudo random generator so loops are the same every time. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Loop length of the brown noise and rain beds, in seconds. */
export const NOISE_LOOP_SECONDS = 10;
/** Loop length of the lo-fi bed, in seconds. */
export const LOFI_LOOP_SECONDS = 16;
/** Crossfade used to make the brown noise loop seamlessly, in seconds. */
const LOOP_CROSSFADE_SECONDS = 1;
/** Every loop is scaled to this RMS so the three beds sound equally loud. */
const TARGET_RMS = 0.18;
/** Soft limiter ceiling: no sample can reach this magnitude, so nothing clips. */
const PEAK_CEILING = 0.88;

/**
 * Scale to TARGET_RMS, then soft-limit with ceiling * tanh(x / ceiling). The limiter is
 * almost linear for quiet samples and only rounds off rare peaks. Both steps work per
 * sample, so a loop that wraps smoothly still wraps smoothly.
 */
function normalizeLoop(data: Float32Array): Float32Array {
  let sum = 0;
  for (const v of data) sum += v * v;
  const rms = Math.sqrt(sum / Math.max(1, data.length));
  const scale = rms > 0 ? TARGET_RMS / rms : 0;
  for (let i = 0; i < data.length; i++) {
    data[i] = PEAK_CEILING * Math.tanh((data[i] * scale) / PEAK_CEILING);
  }
  return data;
}

function brownData(length: number, sampleRate: number): Float32Array {
  const rand = lcg(1);
  const fade = Math.min(Math.floor(sampleRate * LOOP_CROSSFADE_SECONDS), Math.floor(length / 2));
  // Generate extra samples past the end and blend them into the start, so the last
  // sample flows into the first one without a jump.
  const raw = new Float32Array(length + fade);
  let last = 0;
  for (let i = 0; i < raw.length; i++) {
    last = (last + 0.02 * (rand() * 2 - 1)) / 1.02;
    raw[i] = last * 3.5;
  }
  const out = raw.slice(0, length);
  for (let i = 0; i < fade; i++) {
    const w = i / fade;
    out[i] = raw[i] * w + raw[length + i] * (1 - w);
  }
  return out;
}

function rainData(length: number): Float32Array {
  const rand = lcg(2);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = (rand() * 2 - 1) * 0.5;
  return out;
}

/** Four-chord loop (Am7, Fmaj7, Cmaj7, G6) with soft tone and vinyl crackle. */
function lofiData(length: number, sampleRate: number): Float32Array {
  const rand = lcg(3);
  const out = new Float32Array(length);
  const chords = [
    [220.0, 261.63, 329.63, 392.0],
    [174.61, 220.0, 261.63, 329.63],
    [261.63, 329.63, 392.0, 493.88],
    [196.0, 246.94, 293.66, 329.63],
  ];
  const chordLen = Math.floor(length / chords.length);
  for (let c = 0; c < chords.length; c++) {
    for (let i = 0; i < chordLen; i++) {
      const t = i / sampleRate;
      const env = Math.min(1, t * 8) * Math.exp(-t * 0.6);
      const wobble = 1 + 0.003 * Math.sin(2 * Math.PI * 0.5 * (c * chordLen + i) / sampleRate);
      let v = 0;
      for (const f of chords[c]) v += Math.sin(2 * Math.PI * f * wobble * t);
      out[c * chordLen + i] = (v / chords[c].length) * env * 0.35;
    }
  }
  for (let i = 0; i < length; i++) {
    if (rand() > 0.9995) out[i] += (rand() * 2 - 1) * 0.15; // crackle
  }
  return out;
}

/** Raw samples of one loop of a sound bed (before the playback filter). */
export function generateLoop(sound: FocusSound, sampleRate: number): Float32Array {
  const seconds = sound === "lofi" ? LOFI_LOOP_SECONDS : NOISE_LOOP_SECONDS;
  const length = Math.floor(sampleRate * seconds);
  const data =
    sound === "brown"
      ? brownData(length, sampleRate)
      : sound === "rain"
        ? rainData(length)
        : lofiData(length, sampleRate);
  return normalizeLoop(data);
}

export interface FocusAudio {
  start(sound: FocusSound): void;
  stop(): void;
  /** Stops the sound and closes the AudioContext. A later start() creates a fresh one. */
  dispose(): void;
  /** Linear ramp of the fade stage to `gain` (0-1) over `seconds` (default 2). */
  fadeTo(gain: number, seconds?: number): void;
  setVolume(volume: number): void;
  mute(on: boolean): void;
  readonly isPlaying: boolean;
  readonly sound: FocusSound | null;
  readonly volume: number;
  readonly muted: boolean;
}

export function createFocusAudio(factory: ContextFactory = defaultFactory): FocusAudio {
  let ctx: FocusAudioContext | null = null;
  let fadeGain: GainNode | null = null;
  let volumeGain: GainNode | null = null;
  let source: AudioBufferSourceNode | null = null;
  let current: FocusSound | null = null;
  let volume = 60;
  let muted = false;

  function ensureContext(): FocusAudioContext {
    if (!ctx) {
      ctx = factory();
      fadeGain = ctx.createGain();
      volumeGain = ctx.createGain();
      volumeGain.gain.value = effectiveGain(volume, muted);
      fadeGain.connect(volumeGain);
      volumeGain.connect(ctx.destination);
    }
    return ctx;
  }

  function buildSource(c: FocusAudioContext, sound: FocusSound): AudioBufferSourceNode {
    const data = generateLoop(sound, c.sampleRate);
    const buffer = c.createBuffer(1, data.length, c.sampleRate);
    buffer.getChannelData(0).set(data);

    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = c.createBiquadFilter();
    if (sound === "rain") {
      filter.type = "bandpass";
      filter.frequency.value = 3500;
      filter.Q.value = 0.4;
    } else {
      filter.type = "lowpass";
      filter.frequency.value = sound === "lofi" ? 2200 : 1200;
    }
    src.connect(filter);
    filter.connect(fadeGain as GainNode);
    return src;
  }

  function stopSource(): void {
    if (source) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
      source = null;
    }
  }

  return {
    start(sound) {
      const c = ensureContext();
      stopSource();
      (fadeGain as GainNode).gain.cancelScheduledValues(c.currentTime);
      (fadeGain as GainNode).gain.setValueAtTime(1, c.currentTime);
      source = buildSource(c, sound);
      source.start();
      current = sound;
      if (c.state === "suspended") void c.resume();
    },
    stop() {
      stopSource();
      current = null;
    },
    dispose() {
      stopSource();
      current = null;
      const closing = ctx;
      ctx = null;
      fadeGain = null;
      volumeGain = null;
      if (closing && closing.state !== "closed") void closing.close().catch(() => {});
    },
    fadeTo(gain, seconds = DEFAULT_FADE_SECONDS) {
      if (!ctx || !fadeGain) return; // nothing to fade before start()
      const target = clamp(gain, 0, 1);
      const now = ctx.currentTime;
      const param = fadeGain.gain;
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      if (seconds <= 0) param.setValueAtTime(target, now);
      else param.linearRampToValueAtTime(target, now + seconds);
    },
    setVolume(v) {
      volume = clamp(v, 0, 100);
      if (ctx && volumeGain) volumeGain.gain.value = effectiveGain(volume, muted);
    },
    mute(on) {
      muted = on;
      if (ctx && volumeGain) volumeGain.gain.value = effectiveGain(volume, muted);
    },
    get isPlaying() {
      return source !== null;
    },
    get sound() {
      return current;
    },
    get volume() {
      return volume;
    },
    get muted() {
      return muted;
    },
  };
}
