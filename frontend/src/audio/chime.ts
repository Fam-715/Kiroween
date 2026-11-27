/**
 * Completion chime: a two-tone oscillator beep of about 0.4 s with its own small
 * AudioContext. `prime()` must be called from a user gesture (the PLAY click); nothing
 * is created or played before that. Task 16 can improve the sound.
 */
export const CHIME_TONES_HZ: readonly [number, number] = [660, 880];
export const CHIME_SECONDS = 0.4;
const PEAK_GAIN = 0.15;

export interface Chime {
  /** Create (or resume) the AudioContext. Call from the PLAY click. */
  prime: () => void;
  /** Play the beep. A no-op until primed or when Web Audio is unavailable. */
  play: () => void;
  dispose: () => void;
}

export type ChimeContextFactory = () => AudioContext;

const defaultFactory: ChimeContextFactory = () => {
  const w = window as unknown as {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) throw new Error("Web Audio is not supported in this browser");
  return new Ctor();
};

export function createChime(factory: ChimeContextFactory = defaultFactory): Chime {
  let ctx: AudioContext | null = null;

  function prime(): void {
    try {
      ctx ??= factory();
      if (ctx.state === "suspended") void ctx.resume();
    } catch {
      ctx = null; // unsupported: the chime is simply silent
    }
  }

  function play(): void {
    if (!ctx) return;
    try {
      const start = ctx.currentTime;
      const half = CHIME_SECONDS / 2;
      CHIME_TONES_HZ.forEach((hz, i) => {
        const at = start + i * half;
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.type = "sine";
        osc.frequency.value = hz;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(PEAK_GAIN, at + 0.02);
        gain.gain.linearRampToValueAtTime(0, at + half);
        osc.connect(gain);
        gain.connect(ctx!.destination);
        osc.start(at);
        osc.stop(at + half);
      });
    } catch {
      // a failed beep must never affect the timer
    }
  }

  function dispose(): void {
    const c = ctx;
    ctx = null;
    if (c && c.state !== "closed") void c.close().catch(() => {});
  }

  return { prime, play, dispose };
}
