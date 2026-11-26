/**
 * Virtual clock used for memory decay. Mirrors `backend/app/domain/clock.py`.
 * Pure functions only, no I/O. Times are epoch milliseconds.
 */

export const TIME_SCALE_REAL = 1;
export const TIME_SCALE_WARP = 1440; // 1 day = 1 minute
export const ALLOWED_SCALES: readonly number[] = [TIME_SCALE_REAL, TIME_SCALE_WARP];

export interface Clock {
  scale: number;
  anchorReal: number;
  anchorVirtual: number;
}

/** anchorVirtual + (realNow - anchorReal) * scale */
export function virtualNow(clock: Clock, realNow: number): number {
  return clock.anchorVirtual + (realNow - clock.anchorReal) * clock.scale;
}

/** New clock with a new scale whose virtual time is continuous at `realNow`. */
export function setScale(clock: Clock, realNow: number, scale: number): Clock {
  if (!ALLOWED_SCALES.includes(scale)) {
    throw new Error(`scale must be one of ${ALLOWED_SCALES.join(", ")}, got ${scale}`);
  }
  return { scale, anchorReal: realNow, anchorVirtual: virtualNow(clock, realNow) };
}
