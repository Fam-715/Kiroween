/**
 * Session API (wire format mirrors `backend/app/schemas.py`). Events are idempotent on
 * `client_event_id`, so a retry must reuse the same id.
 */
import { ApiError, apiFetch } from "./client";

export type SessionEventType = "complete" | "skip";

export interface PenaltyWire {
  track_id: string;
  stability_before: number;
  stability_after: number;
}

export interface SessionStartWire {
  id: string;
  tape_id: string;
  started_at: string;
  ended_at: string | null;
}

export interface SessionEventBody {
  client_event_id: string;
  type: SessionEventType;
  item_id: string;
}

export interface SessionEventWire {
  client_event_id: string;
  type: SessionEventType;
  item_id: string | null;
  penalty: PenaltyWire[];
  session_ended: boolean;
}

export interface SessionSummaryWire {
  id: string;
  tape_id: string;
  started_at: string;
  ended_at: string;
  abandoned: boolean;
  penalty: PenaltyWire[];
  tracks_completed: number;
  tracks_skipped: number;
  focus_minutes: number;
}

export function startSession(tapeId: string): Promise<SessionStartWire> {
  return apiFetch<SessionStartWire>(`/api/tapes/${tapeId}/sessions`, { method: "POST" });
}

export function postSessionEvent(
  sessionId: string,
  body: SessionEventBody,
): Promise<SessionEventWire> {
  return apiFetch<SessionEventWire>(`/api/sessions/${sessionId}/events`, { method: "POST", body });
}

export function stopSession(sessionId: string): Promise<SessionSummaryWire> {
  return apiFetch<SessionSummaryWire>(`/api/sessions/${sessionId}/stop`, { method: "POST" });
}

/** Network failures and 5xx are retried; other 4xx will not succeed on retry. */
export function isRetryableSessionError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500;
  return !(error instanceof NoSessionError);
}

/** The session never started (its start request gave up), so there is nothing to send to. */
export class NoSessionError extends Error {
  constructor() {
    super("No session id");
    this.name = "NoSessionError";
  }
}
