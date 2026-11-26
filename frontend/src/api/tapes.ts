/**
 * Typed API client for the tape and settings endpoints (wire format is snake_case,
 * mirroring `backend/app/schemas.py`).
 */
import { apiFetch } from "./client";

export type ItemKind = "track" | "interlude";
export type TapeLength = "C60" | "C90" | "C120";
export type ConditionName = "Mint" | "Worn" | "Warped" | "Haunted" | "Dead";

// --- Requests ------------------------------------------------------------------
export interface TapeItemWireIn {
  id?: string | null;
  kind: ItemKind;
  minutes: number;
  name?: string | null;
  key_terms?: string[] | null;
}

export interface TapeWireIn {
  title: string;
  length: string;
  side_a: TapeItemWireIn[];
  side_b: TapeItemWireIn[];
}

// --- Responses -------------------------------------------------------------------
export interface TrackMemoryWire {
  recorded: boolean;
  strength: number | null;
  condition: ConditionName | null;
  stability_days: number;
  review_count: number;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  due: boolean;
}

export interface TapeItemWire {
  id: string;
  side: "A" | "B";
  position: number;
  kind: ItemKind;
  name: string | null;
  minutes: number;
  key_terms: string[] | null;
  memory: TrackMemoryWire | null;
}

/** Liner-note stats; mirrors the backend's TapeStatsOut. */
export interface TapeStatsWire {
  sessions: number;
  focus_minutes: number;
  tracks_completed: number;
  tracks_skipped: number;
}

export interface TapeWire {
  id: string;
  title: string;
  length: TapeLength;
  created_at: string;
  is_sample: boolean;
  virtual_now: string;
  side_a: TapeItemWire[];
  side_b: TapeItemWire[];
  remaining_a: number;
  remaining_b: number;
  strength: number | null;
  condition: ConditionName;
  due_count: number;
  next_review_at: string | null;
  ghost: boolean;
  stats: TapeStatsWire;
}

// --- Settings ----------------------------------------------------------------------
export interface SettingsWire {
  demo_mode: boolean;
  time_warp_allowed: boolean;
  time_warp_enabled: boolean;
  time_scale: number;
  real_now: string;
  virtual_now: string;
}

// --- Endpoints -----------------------------------------------------------------------
export function listTapes(): Promise<TapeWire[]> {
  return apiFetch<TapeWire[]>("/api/tapes");
}

export function getTape(tapeId: string): Promise<TapeWire> {
  return apiFetch<TapeWire>(`/api/tapes/${tapeId}`);
}

export function createTape(body: TapeWireIn): Promise<TapeWire> {
  return apiFetch<TapeWire>("/api/tapes", { method: "POST", body });
}

export function updateTape(tapeId: string, body: TapeWireIn): Promise<TapeWire> {
  return apiFetch<TapeWire>(`/api/tapes/${tapeId}`, { method: "PUT", body });
}

export function deleteTape(tapeId: string): Promise<void> {
  return apiFetch<void>(`/api/tapes/${tapeId}`, { method: "DELETE" });
}

export function getSettings(): Promise<SettingsWire> {
  return apiFetch<SettingsWire>("/api/settings");
}

export function putSettings(demoMode: boolean): Promise<SettingsWire> {
  return apiFetch<SettingsWire>("/api/settings", { method: "PUT", body: { demo_mode: demoMode } });
}
