import { useCallback, useEffect, useRef, useState } from "react";
import {
  createFocusAudio,
  type FocusAudio,
  type FocusSound,
} from "../audio/focusAudio";

// Wiring note: the player should call start(sound) when the user presses PLAY (never
// earlier), fadeTo(0) when an interlude starts and fadeTo(1) when the next track starts.

export interface UseFocusAudio {
  sound: FocusSound;
  playing: boolean;
  volume: number;
  muted: boolean;
  setSound: (sound: FocusSound) => void;
  start: (sound?: FocusSound) => void;
  stop: () => void;
  fadeTo: (gain: number, seconds?: number) => void;
  setVolume: (volume: number) => void;
  mute: (on: boolean) => void;
}

export function useFocusAudio(initialSound: FocusSound = "brown"): UseFocusAudio {
  const engineRef = useRef<FocusAudio | null>(null);
  if (engineRef.current === null) engineRef.current = createFocusAudio();
  const engine = engineRef.current;

  const [sound, setSoundState] = useState<FocusSound>(initialSound);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(engine.volume);
  const [muted, setMuted] = useState(engine.muted);

  useEffect(() => () => engine.dispose(), [engine]);

  const start = useCallback(
    (s?: FocusSound) => {
      const next = s ?? sound;
      engine.start(next);
      setSoundState(next);
      setPlaying(true);
    },
    [engine, sound],
  );

  const stop = useCallback(() => {
    engine.stop();
    setPlaying(false);
  }, [engine]);

  const setSound = useCallback(
    (s: FocusSound) => {
      setSoundState(s);
      if (engine.isPlaying) engine.start(s); // switch live only while already playing
    },
    [engine],
  );

  const fadeTo = useCallback((g: number, seconds?: number) => engine.fadeTo(g, seconds), [engine]);

  const setVolume = useCallback(
    (v: number) => {
      engine.setVolume(v);
      setVolumeState(engine.volume);
    },
    [engine],
  );

  const mute = useCallback(
    (on: boolean) => {
      engine.mute(on);
      setMuted(on);
    },
    [engine],
  );

  return { sound, playing, volume, muted, setSound, start, stop, fadeTo, setVolume, mute };
}
