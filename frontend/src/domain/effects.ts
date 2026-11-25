/**
 * Decay effects by condition and gain helpers. Frontend only, pure functions, no I/O.
 * Numbers come from the effects table in the design document (Requirements 7 and 9).
 */
import { condition, type Condition } from "./strength";

export interface GhostWhispers {
  minIntervalS: number;
  maxIntervalS: number;
  minLengthS: number;
  maxLengthS: number;
  gain: number;
}

export interface EffectSettings {
  condition: Condition;
  /** Hiss gain of the recording chain (0-1). Audio, unaffected by reduced motion. */
  hissGain: number;
  /** Speed wobble in the audio, ± percent. Unaffected by reduced motion. */
  audioWobblePct: number;
  /** Visual reel wobble, ± percent. 0 with reduced motion. */
  reelWobblePct: number;
  /** Whether the reels spin. False with reduced motion. */
  reelSpin: boolean;
  /** Pitch wobble, ± cents. Audio. */
  pitchWobbleCents: number;
  /** Playback distortion amount (0-1). Audio. */
  distortion: number;
  /** Colour bleed in px. Static cue, kept with reduced motion. */
  colourBleedPx: number;
  /** Flicker rate in Hz. 0 with reduced motion. */
  flickerHz: number;
  /** Static-only noise gain, used when the tape is Dead. */
  noiseGain: number;
  /** Gain of the recorded voice. 0 when Dead. */
  voiceGain: number;
  /** Optional ghost whispers, Haunted only. */
  ghostWhispers: GhostWhispers | null;
}

interface Row {
  hiss: number;
  wobble: number;
  pitch: number;
  distortion: number;
  bleed: number;
  flicker: number;
  noise: number;
  voice: number;
  whispers: boolean;
}

const TABLE: Record<Condition, Row> = {
  Mint: { hiss: 0, wobble: 0, pitch: 0, distortion: 0, bleed: 0, flicker: 0, noise: 0, voice: 1, whispers: false },
  Worn: { hiss: 0.02, wobble: 2, pitch: 0, distortion: 0.05, bleed: 0, flicker: 0, noise: 0, voice: 1, whispers: false },
  Warped: { hiss: 0.05, wobble: 6, pitch: 25, distortion: 0.2, bleed: 2, flicker: 4, noise: 0, voice: 1, whispers: false },
  Haunted: { hiss: 0.1, wobble: 12, pitch: 60, distortion: 0.45, bleed: 4, flicker: 8, noise: 0, voice: 1, whispers: true },
  Dead: { hiss: 0, wobble: 0, pitch: 0, distortion: 0, bleed: 0, flicker: 0, noise: 0.15, voice: 0, whispers: false },
};

export const GHOST_WHISPERS: GhostWhispers = {
  minIntervalS: 20,
  maxIntervalS: 45,
  minLengthS: 1.5,
  maxLengthS: 3,
  gain: 0.08,
};

export function effectsFor(strength: number, reducedMotion: boolean): EffectSettings {
  const c = condition(strength);
  const row = TABLE[c];
  return {
    condition: c,
    hissGain: row.hiss,
    audioWobblePct: row.wobble,
    reelWobblePct: reducedMotion ? 0 : row.wobble,
    reelSpin: !reducedMotion && c !== "Dead",
    pitchWobbleCents: row.pitch,
    distortion: row.distortion,
    colourBleedPx: row.bleed,
    flickerHz: reducedMotion ? 0 : row.flicker,
    noiseGain: row.noise,
    voiceGain: row.voice,
    ghostWhispers: row.whispers ? GHOST_WHISPERS : null,
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Linear fade from `start` to `end` over `duration` seconds, evaluated at time `t`.
 * Always between `start` and `end`. Non-positive duration jumps straight to `end`.
 */
export function fadeGain(t: number, start: number, end: number, duration: number): number {
  if (!(duration > 0)) return end;
  const p = clamp(t / duration, 0, 1);
  return start + (end - start) * p;
}

/** Final gain for the output: 0 when muted, otherwise `gain` clamped to [0, volume]. */
export function outputGain(gain: number, volume: number, muted: boolean): number {
  if (muted) return 0;
  const v = clamp(volume, 0, 1);
  return clamp(gain, 0, v);
}
