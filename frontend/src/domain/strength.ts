/**
 * Memory strength, decay and tape condition. Mirrors `backend/app/domain/strength.py`.
 * Pure functions only, no I/O. Strength follows R(t) = exp(-t / S), S in days.
 * The backend value always replaces any prediction made here.
 */

export const S_MIN = 0.25;
export const S_MAX = 60.0; // days
export const DUE_STRENGTH = 70.0; // unrounded strength at or below this is due
export const MS_PER_DAY = 86_400_000;

export type Condition = "Mint" | "Worn" | "Warped" | "Haunted" | "Dead";

function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

export function decayRatio(elapsedDays: number, s: number): number {
  return Math.exp(-Math.max(0, elapsedDays) / s);
}

export function strengthAt(base: number, s: number, elapsedDays: number): number {
  const value = roundHalfUp(base * decayRatio(elapsedDays, s));
  return Math.min(100, Math.max(0, value));
}

export function condition(strength: number): Condition {
  if (strength >= 80) return "Mint";
  if (strength >= 50) return "Worn";
  if (strength >= 20) return "Warped";
  if (strength >= 1) return "Haunted";
  return "Dead";
}

export function isDue(base: number, s: number, elapsedDays: number): boolean {
  return base * decayRatio(elapsedDays, s) <= DUE_STRENGTH;
}

/** Epoch ms at which the track becomes due. */
export function nextReviewAt(lastReviewedAt: number, base: number, s: number): number {
  if (base <= DUE_STRENGTH) return lastReviewedAt;
  return lastReviewedAt + s * Math.log(base / DUE_STRENGTH) * MS_PER_DAY;
}

export function isGhost(strengths: readonly number[]): boolean {
  return strengths.length > 0 && strengths.every((v) => v === 0);
}

export function tapeStrength(strengths: readonly number[]): number | null {
  if (strengths.length === 0) return null;
  const sum = strengths.reduce((a, b) => a + b, 0);
  const mean = roundHalfUp(sum / strengths.length);
  return isGhost(strengths) ? mean : Math.max(1, mean);
}

export function tapeCondition(strengths: readonly number[]): Condition {
  if (strengths.length === 0) return "Mint";
  if (isGhost(strengths)) return "Dead";
  return condition(tapeStrength(strengths) as number);
}
