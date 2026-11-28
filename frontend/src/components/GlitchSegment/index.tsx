import type { ReactNode } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";

/** Class names for the glitch, reusable on any element. */
export const GLITCH_ANIMATED_CLASS = "animate-glitch-jitter shadow-glitch-split";
export const GLITCH_STATIC_CLASS = "outline outline-2 outline-offset-1 outline-condition-haunted";

interface GlitchSegmentProps {
  /** True for the 1.2 s after a penalty (see useGlitchTracks). */
  glitching: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Tape-map segment wrapper. While glitching it jitters with a colour split,
 * or shows a static outline under prefers-reduced-motion.
 */
export function GlitchSegment({ glitching, className = "", children }: GlitchSegmentProps) {
  const reduced = useReducedMotion();
  const effect = !glitching ? "" : reduced ? GLITCH_STATIC_CLASS : GLITCH_ANIMATED_CLASS;
  return (
    <div
      className={`${className} ${effect}`.trim()}
      data-glitch={glitching ? (reduced ? "outline" : "animated") : "off"}
    >
      {children}
    </div>
  );
}

export default GlitchSegment;
