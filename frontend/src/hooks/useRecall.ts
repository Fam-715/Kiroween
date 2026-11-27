import { useCallback, useEffect, useRef, useState } from "react";
import * as recordingStore from "../audio/recordingStore";

export const MAX_RECORD_SECONDS = 90;
export const MIN_GOOD_SECONDS = 30;
const NOTICE_KEY = "cursed-cassette.speechNoticeAck";

interface SpeechResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function speechCtor(): SpeechRecognitionCtor | null {
  const w = globalThis as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Why voice cannot be used right now, or null when it can. */
export function voiceUnsupportedReason(): string | null {
  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "This browser cannot record audio, so type your recall instead.";
  }
  if (!speechCtor()) {
    return "This browser has no speech recognition, so type your recall instead.";
  }
  return null;
}

function noticeAcknowledged(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return false;
  }
}

export type RecallVoiceStatus = "idle" | "notice" | "starting" | "recording" | "stopped";

export interface UseRecallOptions {
  trackId: string;
  /** Called with the full transcript so far; the panel shows it in the editable box. */
  onTranscript: (text: string) => void;
  /** true when recording starts; false when it stops, is cancelled or the panel unmounts. */
  onRecordingChange?: (recording: boolean) => void;
}

export interface UseRecall {
  status: RecallVoiceStatus;
  elapsedSeconds: number;
  /** Short reason the typing box is the only option, or null. */
  fallbackReason: string | null;
  /** Gentle hint after a recording under 30 s. */
  shortHint: boolean;
  /** True once a voice transcript has been produced (source = speech). */
  usedSpeech: boolean;
  /** Press REC. Shows the one-time notice first if needed. */
  requestStart: () => void;
  confirmNotice: () => void;
  stop: () => void;
  cancel: () => void;
}

/** Voice capture: MediaRecorder for audio (kept in IndexedDB), Web Speech for the text. */
export function useRecall({ trackId, onTranscript, onRecordingChange }: UseRecallOptions): UseRecall {
  const [status, setStatus] = useState<RecallVoiceStatus>("idle");
  const [elapsedSeconds, setElapsed] = useState(0);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [shortHint, setShortHint] = useState(false);
  const [usedSpeech, setUsedSpeech] = useState(false);

  const cbRef = useRef({ onTranscript, onRecordingChange });
  cbRef.current = { onTranscript, onRecordingChange };

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const announcedRef = useRef(false);
  /** Discard flag of the recording that is currently active (one object per recorder). */
  const takeRef = useRef<{ discard: boolean } | null>(null);
  const aliveRef = useRef(true);
  const attemptRef = useRef(0);

  const announce = useCallback((on: boolean) => {
    if (announcedRef.current === on) return;
    announcedRef.current = on;
    cbRef.current.onRecordingChange?.(on);
  }, []);

  const teardown = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        // already stopped
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const finish = useCallback(
    (cancelled: boolean) => {
      attemptRef.current += 1; // abandons a pending getUserMedia
      const recorder = recorderRef.current;
      // Only the still-active recording can be discarded. One already stopped keeps its flag.
      if (recorder && takeRef.current) takeRef.current.discard = cancelled;
      recorderRef.current = null;
      takeRef.current = null;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop(); // onstop saves the audio unless discarded
        } catch {
          // ignore
        }
      }
      teardown();
      announce(false);
      if (aliveRef.current) setStatus(cancelled ? "idle" : "stopped");
    },
    [announce, teardown],
  );

  const begin = useCallback(async () => {
    const attempt = ++attemptRef.current;
    setStatus("starting");
    setShortHint(false);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      if (attempt !== attemptRef.current || !aliveRef.current) return;
      setFallbackReason("Microphone access was denied, so type your recall instead.");
      setStatus("idle");
      return;
    }
    if (attempt !== attemptRef.current || !aliveRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setFallbackReason("This browser cannot record audio, so type your recall instead.");
      setStatus("idle");
      return;
    }
    streamRef.current = stream;
    recorderRef.current = recorder;
    const take = { discard: false };
    takeRef.current = take;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      if (take.discard) return;
      const durationMs = Date.now() - startedAtRef.current;
      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunks, { type: mimeType });
      recordingStore
        .save(trackId, { blob, mimeType, durationMs, recordedAt: Date.now() })
        .catch(() => {
          // audio is a bonus; the recall text still works
        });
      if (aliveRef.current && durationMs < MIN_GOOD_SECONDS * 1000) setShortHint(true);
    };

    // Speech transcription feeds the editable box.
    const Ctor = speechCtor();
    if (Ctor) {
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";
      let finalText = "";
      recognition.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += `${r[0].transcript} `;
          else interim += r[0].transcript;
        }
        setUsedSpeech(true);
        cbRef.current.onTranscript((finalText + interim).trim());
      };
      recognition.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        setFallbackReason("Speech recognition failed, so type or fix your recall below.");
      };
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        setFallbackReason("Speech recognition failed, so type your recall instead.");
      }
    }

    startedAtRef.current = Date.now();
    setElapsed(0);
    recorder.start();
    setStatus("recording");
    announce(true);
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(Math.min(secs, MAX_RECORD_SECONDS));
      if (secs >= MAX_RECORD_SECONDS) finish(false);
    }, 250);
  }, [announce, finish, trackId]);

  const requestStart = useCallback(() => {
    const reason = voiceUnsupportedReason();
    if (reason) {
      setFallbackReason(reason);
      return;
    }
    setFallbackReason(null);
    if (!noticeAcknowledged()) {
      setStatus("notice");
      return;
    }
    void begin();
  }, [begin]);

  const confirmNotice = useCallback(() => {
    try {
      localStorage.setItem(NOTICE_KEY, "1");
    } catch {
      // the notice will show again; harmless
    }
    void begin();
  }, [begin]);

  const stop = useCallback(() => finish(false), [finish]);
  const cancel = useCallback(() => finish(true), [finish]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      finish(true);
    };
  }, [finish]);

  return {
    status,
    elapsedSeconds,
    fallbackReason,
    shortHint,
    usedSpeech,
    requestStart,
    confirmNotice,
    stop,
    cancel,
  };
}
