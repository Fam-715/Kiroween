import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as tapesApi from "../src/api/tapes";
import type { TapeItemWire, TapeWire } from "../src/api/tapes";
import CassettePlayer from "../src/components/CassettePlayer";
import { effectsFor } from "../src/domain/effects";

vi.mock("../src/api/tapes", async (importOriginal) => {
  const actual = await importOriginal<typeof tapesApi>();
  return { ...actual, getTape: vi.fn() };
});
vi.mock("../src/api/sessions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api/sessions")>();
  return {
    ...actual,
    startSession: vi.fn().mockResolvedValue({ id: "s1" }),
    postSessionEvent: vi.fn().mockResolvedValue({ penalty: [] }),
    stopSession: vi.fn().mockResolvedValue({}),
  };
});
vi.mock("../src/audio/chime", () => ({
  createChime: () => ({ prime: vi.fn(), play: vi.fn(), dispose: vi.fn() }),
}));
vi.mock("../src/hooks/useFocusAudio", () => {
  const stub = {
    sound: "brown",
    playing: false,
    volume: 50,
    muted: false,
    setSound: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    fadeTo: vi.fn(),
    setVolume: vi.fn(),
    mute: vi.fn(),
  };
  return { useFocusAudio: () => stub };
});

const getTape = vi.mocked(tapesApi.getTape);

function track(id: string, strength: number | null, position = 0): TapeItemWire {
  return {
    id,
    side: "A",
    position,
    kind: "track",
    name: `Track ${id}`,
    minutes: 10,
    key_terms: ["a", "b", "c"],
    memory:
      strength === null
        ? null
        : {
            recorded: true,
            strength,
            condition: "Mint",
            stability_days: 3,
            review_count: 1,
            last_reviewed_at: null,
            next_review_at: null,
            due: false,
          },
  };
}

function tapeWith(items: TapeItemWire[], strength: number | null): TapeWire {
  return {
    id: "tape1",
    title: "Biology",
    length: "C60",
    created_at: "",
    is_sample: false,
    virtual_now: "",
    side_a: items,
    side_b: [],
    remaining_a: 0,
    remaining_b: 0,
    strength,
    condition: "Mint",
    due_count: 0,
    next_review_at: null,
    ghost: false,
    stats: { sessions: 0, focus_minutes: 0, tracks_completed: 0, tracks_skipped: 0 },
  } as TapeWire;
}

async function show(tape: TapeWire) {
  getTape.mockResolvedValue(tape);
  render(
    <MemoryRouter initialEntries={["/play/tape1"]}>
      <Routes>
        <Route path="/play/:tapeId" element={<CassettePlayer />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByTestId("lcd-condition");
}

const originalMatchMedia = window.matchMedia;
function setReduced(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  setReduced(false);
});
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("haunted effects on the player", () => {
  it("Mint has no bleed, flicker or shadow figures", async () => {
    await show(tapeWith([track("a1", 95)], 95));
    expect(screen.getByTestId("cassette")).toHaveAttribute("data-condition", "Mint");
    expect(screen.queryByTestId("colour-bleed")).not.toBeInTheDocument();
    expect(screen.queryByTestId("flicker-layer")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("shadow-figure")).toHaveLength(0);
    expect(screen.getByTestId("lcd-condition")).toHaveTextContent("Condition: Mint");
  });

  it("Haunted shows bleed, 8 Hz flicker and shadow figures", async () => {
    await show(tapeWith([track("a1", 10)], 10));
    expect(screen.getByTestId("cassette")).toHaveAttribute("data-condition", "Haunted");
    expect(screen.getByTestId("colour-bleed")).toHaveAttribute(
      "data-bleed-px",
      String(effectsFor(10, false).colourBleedPx),
    );
    const hz = Number(screen.getByTestId("flicker-layer").getAttribute("data-flicker-hz"));
    expect(hz).toBe(8);
    expect(hz).toBeLessThanOrEqual(8);
    const figures = screen.getAllByTestId("shadow-figure");
    expect(figures.length).toBeGreaterThanOrEqual(1);
    expect(figures.length).toBeLessThanOrEqual(2);
    expect(figures[0].closest("[aria-hidden='true']")).not.toBeNull();
    expect(screen.getByTestId("lcd-condition")).toHaveTextContent(/haunted/i);
  });

  it("Warped flickers at 4 Hz without shadow figures", async () => {
    await show(tapeWith([track("a1", 30)], 30));
    expect(screen.getByTestId("flicker-layer")).toHaveAttribute("data-flicker-hz", "4");
    expect(screen.queryAllByTestId("shadow-figure")).toHaveLength(0);
  });

  it("reduced motion removes flicker and reel spin but keeps bleed and shadows", async () => {
    setReduced(true);
    await show(tapeWith([track("a1", 10)], 10));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.queryByTestId("flicker-layer")).not.toBeInTheDocument();
    for (const reel of screen.getAllByTestId("reel")) {
      expect(reel).toHaveAttribute("data-spinning", "false");
    }
    expect(screen.getByTestId("colour-bleed")).toBeInTheDocument();
    expect(screen.getAllByTestId("shadow-figure").length).toBeGreaterThan(0);
    expect(screen.getByTestId("lcd-condition")).toBeInTheDocument();
  });

  it("reels spin with wobble while playing a Haunted track", async () => {
    await show(tapeWith([track("a1", 10)], 10));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    const reel = screen.getAllByTestId("reel")[0];
    expect(reel).toHaveAttribute("data-spinning", "true");
    expect(reel).toHaveAttribute("data-wobble", String(effectsFor(10, false).reelWobblePct));
  });

  it("Dead is greyed with stopped reels and no flicker", async () => {
    await show(tapeWith([track("a1", 0)], 0));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByTestId("cassette")).toHaveAttribute("data-condition", "Dead");
    expect(screen.getByTestId("cassette").className).toMatch(/grayscale/);
    expect(screen.queryByTestId("flicker-layer")).not.toBeInTheDocument();
    for (const reel of screen.getAllByTestId("reel")) {
      expect(reel).toHaveAttribute("data-spinning", "false");
    }
    expect(screen.getByTestId("lcd-condition")).toBeInTheDocument();
  });

  it("follows the current track strength, else the tape strength, else Mint", async () => {
    await show(tapeWith([track("a1", 10)], 95));
    expect(screen.getByTestId("cassette")).toHaveAttribute("data-condition", "Haunted");
  });

  it("falls back to the tape strength for an unrecorded track", async () => {
    await show(tapeWith([track("a1", null)], 30));
    expect(screen.getByTestId("cassette")).toHaveAttribute("data-condition", "Warped");
  });

  it("treats a null tape strength as Mint", async () => {
    await show(tapeWith([track("a1", null)], null));
    expect(screen.getByTestId("cassette")).toHaveAttribute("data-condition", "Mint");
  });
});
