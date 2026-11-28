import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BreakSkipToast } from "../src/components/BreakSkipToast";
import { GlitchSegment } from "../src/components/GlitchSegment";
import type { FocusPenalty } from "../src/hooks/useFocusSession";
import { useGlitchTracks } from "../src/hooks/useGlitchTracks";

const p = (ids: string[], percent = 10): FocusPenalty => ({
  trackIds: ids,
  message: "m",
  percent,
});

function setReduced(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setReduced(false);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("BreakSkipToast", () => {
  it("shows the message and hides after 4 s", () => {
    render(<BreakSkipToast penalty={p(["a", "b"])} />);
    expect(screen.getByRole("status")).toHaveTextContent("The tape remembers…");
    expect(screen.getByRole("status")).toHaveTextContent("Memory span −10% on 2 tracks");
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(screen.queryByRole("status")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("restarts the timer on a new penalty", () => {
    const { rerender } = render(<BreakSkipToast penalty={p(["a"])} />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    rerender(<BreakSkipToast penalty={p(["a"])} />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByRole("status")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("useGlitchTracks", () => {
  it("returns the ids, then empties after 1.2 s; a new penalty restarts it", () => {
    const { result, rerender } = renderHook(({ pen }) => useGlitchTracks(pen), {
      initialProps: { pen: p(["a", "b"]) },
    });
    expect([...result.current]).toEqual(["a", "b"]);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender({ pen: p(["c"]) });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect([...result.current]).toEqual(["c"]);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.size).toBe(0);
  });
});

describe("GlitchSegment", () => {
  it("animates normally", () => {
    const { container } = render(<GlitchSegment glitching />);
    expect(container.firstElementChild).toHaveAttribute("data-glitch", "animated");
    expect(container.firstElementChild?.className).toContain("animate-glitch-jitter");
  });

  it("uses a static outline with reduced motion", () => {
    setReduced(true);
    const { container } = render(<GlitchSegment glitching />);
    const el = container.firstElementChild;
    expect(el).toHaveAttribute("data-glitch", "outline");
    expect(el?.className).toContain("outline-2");
    expect(el?.className).not.toContain("animate-");
  });
});
