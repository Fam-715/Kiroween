/**
 * Recall API. The recall text is sent once to be scored. It is never stored or logged
 * here, and the backend discards it too.
 */
import { ApiError, apiFetch } from "./client";
import type { TrackMemoryWire } from "./tapes";
import { RetryQueue, type RetryJob } from "../domain/retryQueue";

export type RecallSource = "speech" | "typed";

export interface RecallWire {
  score: number;
  matched: string[];
  missed: string[];
  memory: TrackMemoryWire;
}

export interface RecallBody {
  client_event_id: string;
  text: string;
  source: RecallSource;
}

export function postRecall(trackId: string, body: RecallBody): Promise<RecallWire> {
  return apiFetch<RecallWire>(`/api/tracks/${trackId}/recalls`, { method: "POST", body });
}

/** Network failures and 5xx are retried; 4xx will not succeed on retry. */
export function isRetryableRecallError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500;
  return true;
}

export const recallQueue = new RetryQueue();

export interface RecallSubmit {
  trackId: string;
  text: string;
  source: RecallSource;
  onSuccess: (result: RecallWire) => void;
  onPending?: (attempt: number) => void;
  onGiveUp: (error: unknown) => void;
  /** Test seam; defaults to the shared queue. */
  queue?: RetryQueue;
}

/** Queues a recall submit. One `client_event_id` is reused for every retry (idempotent). */
export function submitRecall(s: RecallSubmit): void {
  const body: RecallBody = {
    client_event_id: crypto.randomUUID(),
    text: s.text,
    source: s.source,
  };
  const job: RetryJob<RecallWire> = {
    run: () => postRecall(s.trackId, body),
    onSuccess: s.onSuccess,
    onPending: s.onPending,
    onGiveUp: s.onGiveUp,
    isRetryable: isRetryableRecallError,
  };
  (s.queue ?? recallQueue).enqueue(job);
}
