import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/client";
import * as tapesApi from "../src/api/tapes";
import type { TapeItemWire, TapeWire } from "../src/api/tapes";
import CassettePlayer from "../src/components/CassettePlayer";
import { initialPlayerState, serializePlayerState, step } from "../src/domain/player";
import { buildPlan } from "../src/hooks/useFocusSession";
import { PLAYER_STORAGE_PREFIX } from "../src/hooks/useTapePlayer";

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

function item(
  id: string,
  side: "A" | "B",
  position: number,
  kind: "track" | "interlude",
  minutes: number,
  name: string | null = null,
): TapeItemWire {
  return {
    id,
    side,
    position,
    kind,
    name: kind === "track" ? (name ?? `Track ${id}`) : null,
    minutes,
    key_terms: kind === "track" ? ["a", "b", "c"] : null,
    memory:
      kind === "track"
        ? {
            recorded: true,
            strength: 90,
            condition: "Mint",
            stability_days: 3,
            review_count: 1,
            last_reviewed_at: null,
            next_review_at: null,
            due: false,
          }
        : null,
  };
}

function makeTape(sideA: TapeItemWire[], sideB: TapeItemWire[]): TapeWire {
  return {
    id: "tape1",
    title: "Biology",
    length: "C60",
    created_at: "",
    is_sample: false,
    virtual_now: "",
    side_a: sideA,
    side_b: sideB,
    remaining_a: 0,
    remaining_b: 0,
    strength: 90,
    condition: "Mint",
    due_count: 0,
    next_review_at: null,
    ghost: false,
    stats: { sessions: 0, focus_minutes: 0, tracks_completed: 0, tracks_skipped: 0 },
  };
}

const BASIC = makeTape(
  [item("a1", "A", 0, "track", 10, "Cells"), item("i1", "A", 1, "interlude", 5)],
  [item("b1", "B", 0, "track", 20, "Genes")],
);

function renderPlayer() {
  return render(
    <MemoryRouter initialEntries={["/play/tape1"]}>
      <Routes>
        <Route path="/play/:tapeId" element={<CassettePlayer />} />
        <Route path="/" element={<p>Shelf page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function ready(tape: TapeWire = BASIC) {
  getTape.mockResolvedValue(tape);
  renderPlayer();
  await screen.findByTestId("lcd");
}

function seed(tape: TapeWire, build: (plan: ReturnType<typeof buildPlan>, now: number) => ReturnType<typeof initialPlayerState>) {
  const plan = buildPlan(tape);
  const state = build(plan, Date.now());
  localStorage.setItem(`${PLAYER_STORAGE_PREFIX}${tape.id}`, serializePlayerState(plan, state));
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("CassettePlayer loading", () => {
  it("shows a loading state, then the player", async () => {
    getTape.mockResolvedValue(BASIC);
    renderPlayer();
    expect(screen.getByText(/rewinding/i)).toBeInTheDocument();
    await screen.findByTestId("lcd");
  });

  it("shows Tape not found with a link to the shelf on 404", async () => {
    getTape.mockRejectedValue(new ApiError(404, {}));
    renderPlayer();
    expect(await screen.findByText(/tape not found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /shelf/i })).toHaveAttribute("href", "/");
  });

  it("offers Retry on a network error", async () => {
    getTape.mockRejectedValueOnce(new TypeError("down")).mockResolvedValue(BASIC);
    renderPlayer();
    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));
    await screen.findByTestId("lcd");
  });
});

describe("CassettePlayer", () => {
  it("renders the LCD countdown, item name and side", async () => {
    await ready();
    expect(screen.getByTestId("lcd-time")).toHaveTextContent("10:00");
    expect(screen.getByTestId("lcd-side")).toHaveTextContent("SIDE A");
    expect(screen.getByTestId("lcd-item")).toHaveTextContent("Cells");
  });

  it("Space toggles play and pause", async () => {
    await ready();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: " " });
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: " " });
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("the PLAY button starts playback", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("Escape stops and shows the summary with a J-card link", async () => {
    await ready();
    fireEvent.keyDown(document.body, { key: " " });
    fireEvent.keyDown(document.body, { key: "Escape" });
    const summary = await screen.findByRole("status", { name: /session summary/i });
    expect(summary).toHaveTextContent(/stopped/i);
    expect(screen.getByRole("link", { name: /j-card/i })).toHaveAttribute("href", "/tape/tape1");
  });

  it("ignores keys typed in a textarea", async () => {
    await ready();
    const area = document.createElement("textarea");
    document.body.appendChild(area);
    fireEvent.keyDown(area, { key: " " });
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    fireEvent.keyDown(area, { key: "Escape" });
    expect(screen.queryByRole("status", { name: /session summary/i })).not.toBeInTheDocument();
    area.remove();
  });

  it("gives every button an aria-label", async () => {
    await ready();
    for (const b of screen.getAllByRole("button")) {
      expect(b).toHaveAttribute("aria-label");
    }
    for (const name of ["Rewind", "Play", "Stop", "Fast forward"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /record a recall/i })).toBeDisabled();
  });

  it("draws one tape-map segment per item, with data-track-id on tracks", async () => {
    await ready();
    const segments = screen.getAllByTestId("map-segment");
    expect(segments).toHaveLength(3);
    const trackSegments = segments.filter((s) => s.hasAttribute("data-track-id"));
    expect(trackSegments.map((s) => s.getAttribute("data-track-id"))).toEqual(["a1", "b1"]);
    expect(screen.getAllByTestId("condition-text")).toHaveLength(2);
  });

  it("shows the RecPrompt when a track has just ended and enables REC", async () => {
    const tape = makeTape(
      [item("a1", "A", 0, "track", 1, "Cells"), item("i1", "A", 1, "interlude", 1)],
      [],
    );
    seed(tape, (plan, now) => {
      let s = step(plan, initialPlayerState(plan), { type: "PLAY", now: now - 61000 });
      s = step(plan, s, { type: "TICK", now: now - 1000 });
      return step(plan, s, { type: "PAUSE", now });
    });
    await ready(tape);
    expect(screen.getByRole("status", { name: /recall prompt/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record a recall/i })).toBeEnabled();
    act(() => {
      fireEvent.keyDown(document.body, { key: "r" });
    });
    await waitFor(() =>
      expect(screen.queryByRole("status", { name: /recall prompt/i })).not.toBeInTheDocument(),
    );
  });

  it("shows the flip prompt and starts Side B on PLAY", async () => {
    const tape = makeTape([item("a1", "A", 0, "track", 1, "Cells")], [item("b1", "B", 0, "track", 1, "Genes")]);
    seed(tape, (plan, now) => {
      const s = step(plan, initialPlayerState(plan), { type: "PLAY", now: now - 61000 });
      return step(plan, s, { type: "TICK", now });
    });
    await ready(tape);
    expect(screen.getByTestId("flip-prompt")).toHaveTextContent(/flip the tape/i);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.queryByTestId("flip-prompt")).not.toBeInTheDocument();
    expect(screen.getByTestId("lcd-side")).toHaveTextContent("SIDE B");
  });
});
