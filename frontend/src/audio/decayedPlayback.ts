/**
 * Decayed playback of a recall recording (Requirement 7). Every effect amount comes from
 * `EffectSettings` (see domain/effects.ts). Nothing is created until playRecording() is
 * called from a button press, so no AudioContext exists at import time.
 *
 * Graph (voice):  source -> voiceGain -> [waveShaper] -> master -> destination
 *   speed LFO -> depth gain -> source.playbackRate     (only when audioWobblePct > 0)
 *   pitch LFO -> depth gain -> source.detune           (only when pitchWobbleCents > 0)
 * Graph (hiss):   looping noise -> noiseGain -> master (only when the level is above 0)
 * Dead tape (voiceGain 0): the voice is never connected, only static plays.
 */
import type { EffectSettings } from "../domain/effects";

/** Minimal AudioContext surface used here, so tests can supply a mock. */
export interface PlaybackAudioContext {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: AudioNode;
  readonly state: AudioContextState;
  resume(): Promise<void>;
  close(): Promise<void>;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer>;
  createGain(): GainNode;
  createOscillator(): OscillatorNode;
  createWaveShaper(): WaveShaperNode;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer;
  createBufferSource(): AudioBufferSourceNode;
}

export type PlaybackContextFactory = () => PlaybackAudioContext;

export interface PlaybackOptions {
  /** Called once when playback ends on its own (not after stop()). */
  onEnded?: () => void;
  /** Injectable for tests. Defaults to a real AudioContext. */
  contextFactory?: PlaybackContextFactory;
}

export interface PlaybackHandle {
  /** Stops playback, disconnects every node and closes the context. Safe to call twice. */
  stop(): void;
}

const defaultFactory: PlaybackContextFactory = () => {
  const w = window as unknown as {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) throw new Error("Web Audio is not supported in this browser");
  return new Ctor();
};

/** Wobble LFO speed in Hz and length of the looping hiss buffer in seconds. */
const LFO_HZ = 0.6;
const NOISE_SECONDS = 2;
/** Gain of the master stage. */
const MASTER_GAIN = 1;

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the recording"));
    reader.readAsArrayBuffer(blob);
  });
}

/** Soft-clip curve. amount 0 is the identity, larger amounts bend harder. */
export function distortionCurve(amount: number, samples = 256): Float32Array<ArrayBuffer> {
  const k = Math.max(0, amount) * 50;
  const curve: Float32Array<ArrayBuffer> = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

/**
 * Decodes the blob and plays it through the decay chain for `effects`.
 * Rejects if the audio cannot be decoded. The returned handle is live only after the
 * promise resolves, and the AudioContext is closed when decoding fails.
 */
export async function playRecording(
  blob: Blob,
  effects: EffectSettings,
  options: PlaybackOptions = {},
): Promise<PlaybackHandle> {
  const ctx = (options.contextFactory ?? defaultFactory)();
  const nodes: AudioNode[] = [];
  const sources: Array<AudioScheduledSourceNode> = [];
  let stopped = false;

  const track = <T extends AudioNode>(node: T): T => {
    nodes.push(node);
    return node;
  };

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    for (const s of sources) {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* never started or already stopped */
      }
    }
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    if (ctx.state !== "closed") void ctx.close().catch(() => {});
  };

  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await readBlob(blob));
  } catch (err) {
    stop();
    throw err instanceof Error ? err : new Error("Could not decode the recording");
  }

  const master = track(ctx.createGain());
  master.gain.value = MASTER_GAIN;
  master.connect(ctx.destination);

  const hasVoice = effects.voiceGain > 0;
  // Dead tapes use noiseGain, the others use hissGain. One of the two is always 0.
  const noiseLevel = effects.hissGain + effects.noiseGain;

  let voice: AudioBufferSourceNode | null = null;
  if (hasVoice) {
    voice = ctx.createBufferSource();
    sources.push(voice);
    track(voice);
    voice.buffer = decoded;

    const voiceGain = track(ctx.createGain());
    voiceGain.gain.value = effects.voiceGain;
    voice.connect(voiceGain);

    if (effects.distortion > 0) {
      const shaper = track(ctx.createWaveShaper());
      shaper.curve = distortionCurve(effects.distortion);
      voiceGain.connect(shaper);
      shaper.connect(master);
    } else {
      voiceGain.connect(master);
    }

    const addLfo = (depth: number, target: AudioParam): void => {
      if (!(depth > 0)) return;
      const lfo = ctx.createOscillator();
      sources.push(lfo);
      track(lfo);
      lfo.frequency.value = LFO_HZ;
      const depthGain = track(ctx.createGain());
      depthGain.gain.value = depth;
      lfo.connect(depthGain);
      depthGain.connect(target);
      lfo.start();
    };
    addLfo(effects.audioWobblePct / 100, voice.playbackRate);
    addLfo(effects.pitchWobbleCents, voice.detune);
  }

  let noise: AudioBufferSourceNode | null = null;
  if (noiseLevel > 0) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise = ctx.createBufferSource();
    sources.push(noise);
    track(noise);
    noise.buffer = buffer;
    noise.loop = true;
    const noiseGain = track(ctx.createGain());
    noiseGain.gain.value = noiseLevel;
    noise.connect(noiseGain);
    noiseGain.connect(master);
  }

  const finish = (): void => {
    if (stopped) return;
    stop();
    options.onEnded?.();
  };

  if (voice) {
    voice.onended = finish;
    voice.start();
    noise?.start();
  } else if (noise) {
    // Dead: static plays for as long as the recording would have.
    noise.onended = finish;
    noise.start();
    noise.stop(ctx.currentTime + decoded.duration);
  } else {
    stop();
    options.onEnded?.();
    return { stop };
  }
  if (ctx.state === "suspended") void ctx.resume();

  return { stop };
}
