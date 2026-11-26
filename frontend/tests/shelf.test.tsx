import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tapesApi from "../src/api/tapes";
import JCard from "../src/components/JCard";
import TapeShelf from "../src/components/TapeShelf";

vi.mock("../src/api/tapes", async (importOriginal) => {
  const actual = await importOriginal<typeof tapesApi>();
  return {
    ...actual,
    getSettings: vi.fn(),
    listTapes: vi.fn(),
    getTape: vi.fn(),
    deleteTape: vi.fn(),
  };
});

const NOW = new Date().toISOString();
const FUTURE = new Date(Date.now() + 3 * 86_400_000 + 3_600_000).toISOString();

function track(id: string, over: Partial<tapesApi.TrackMemoryWire> | null): tapesApi.TapeItemWire {
  return {
    id,
    side: "A",
    position: 0,
    kind: "track",
    name: `Track ${id}`,
    minutes: 10,
    key_terms: ["a", "b", "c"],
    memory:
      over === null
        ? { recorded: false, strength: null, condition: null, stability_days: 1, review_count: 0, last_reviewed_at: null, next_review_at: null, due: false }
        : {
            recorded: true,
            strength: 90,
            condition: "Mint",
            stability_days: 5,
            review_count: 1,
            last_reviewed_at: NOW,
            next_review_at: FUTURE,
            due: false,
            ...over,
          },
  };
}

function tape(over: Partial<tapesApi.TapeWire> = {}): tapesApi.TapeWire {
  return {
    id: "t1",
    title: "Biology",
    length: "C60",
    created_at: NOW,
    is_sample: false,
    virtual_now: NOW,
    side_a: [track("one", {}), track("two", null)],
    side_b: [],
    remaining_a: 0,
    remaining_b: 0,
    strength: 90,
    condition: "Mint",
    due_count: 0,
    next_review_at: FUTURE,
    ghost: false,
    stats: { sessions: 2, focus_minutes: 40, tracks_completed: 4, tracks_skipped: 1 },
    ...over,
  };
}

const settings: tapesApi.SettingsWire = {
  demo_mode: false,
  time_warp_allowed: false,
  time_warp_enabled: false,
  time_scale: 1,
  real_now: NOW,
  virtual_now: NOW,
};

function renderShelf() {
  return render(
    <MemoryRouter>
      <TapeShelf />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tapesApi.getSettings).mockResolvedValue(settings);
});

describe("TapeShelf states", () => {
  it("shows the waking message while loading, then the empty state", async () => {
    vi.mocked(tapesApi.listTapes).mockResolvedValue([]);
    renderShelf();
    expect(screen.getByText("Waking up the tape deck…")).toBeInTheDocument();
    expect(await screen.findByText("No tapes yet. Record your first one.")).toBeInTheDocument();
  });

  it("shows an error with Retry that reloads", async () => {
    vi.mocked(tapesApi.listTapes).mockRejectedValueOnce(new Error("down"));
    vi.mocked(tapesApi.listTapes).mockResolvedValueOnce([tape()]);
    renderShelf();
    fireEvent.click(await screen.findByRole("button", { name: "Retry loading the shelf" }));
    expect(await screen.findByText("Biology")).toBeInTheDocument();
  });

  it("lists tapes as links with condition text and N due", async () => {
    vi.mocked(tapesApi.listTapes).mockResolvedValue([
      tape({
        side_a: [track("one", { strength: 40, condition: "Warped", due: true, next_review_at: NOW })],
        strength: 40,
        condition: "Warped",
        due_count: 1,
      }),
    ]);
    renderShelf();
    const link = await screen.findByRole("link", { name: "Open the J-card for Biology" });
    expect(link).toHaveAttribute("href", "/tape/t1");
    expect(screen.getByText("1 due")).toBeInTheDocument();
    expect(screen.getByTestId("condition-text")).toHaveTextContent(/warped/i);
    expect(link).toHaveAttribute("data-haunted", "true");
    expect(link).toHaveAttribute("data-haunt-level", "medium");
  });

  it("scales the haunted glow: Haunted > Warped > Worn, none when not due", async () => {
    // The shelf derives the live condition from strength, so strengths match conditions.
    const mk = (id: string, condition: tapesApi.TapeWire["condition"], strength: number, due: boolean) =>
      tape({
        id,
        title: id,
        condition,
        strength,
        due_count: due ? 1 : 0,
        side_a: [track(id, { condition, strength, due, next_review_at: due ? NOW : FUTURE })],
      });
    vi.mocked(tapesApi.listTapes).mockResolvedValue([
      mk("hh", "Haunted", 10, true),
      mk("ww", "Warped", 35, true),
      mk("wo", "Worn", 65, true),
      mk("mm", "Mint", 90, false),
    ]);
    renderShelf();
    const level = async (name: string) =>
      (await screen.findByRole("link", { name: `Open the J-card for ${name}` })).getAttribute("data-haunt-level");
    expect(await level("hh")).toBe("strong");
    expect(await level("ww")).toBe("medium");
    expect(await level("wo")).toBe("faint");
    expect(await level("mm")).toBe("none");
    expect(screen.getAllByTestId("haunt-glow")).toHaveLength(3);
  });

  it("labels ghost tapes Forgotten", async () => {
    vi.mocked(tapesApi.listTapes).mockResolvedValue([
      tape({
        ghost: true,
        condition: "Dead",
        strength: 0,
        side_a: [track("one", { strength: 0, condition: "Dead", due: true, next_review_at: NOW })],
      }),
    ]);
    renderShelf();
    expect(await screen.findByText("Forgotten")).toBeInTheDocument();
  });
});

describe("JCard", () => {
  function renderJCard() {
    return render(
      <MemoryRouter initialEntries={["/tape/t1"]}>
        <Routes>
          <Route path="/tape/:tapeId" element={<JCard />} />
          <Route path="/" element={<p>Shelf page</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("renders stats and tracks with next review", async () => {
    vi.mocked(tapesApi.getTape).mockResolvedValue(tape());
    renderJCard();
    expect(await screen.findByText("Sessions")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getAllByTestId("jcard-track")).toHaveLength(2);
    expect(screen.getByText(/in 3 days/)).toBeInTheDocument();
    expect(screen.getByText("Not recorded yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Play tape" })).toHaveAttribute("href", "/play/t1");
    expect(screen.getByRole("link", { name: "Edit tape" })).toHaveAttribute("href", "/record?tape=t1");
  });

  it("asks for confirmation before deleting, then returns to the shelf", async () => {
    vi.mocked(tapesApi.getTape).mockResolvedValue(tape());
    vi.mocked(tapesApi.deleteTape).mockResolvedValue(undefined);
    renderJCard();
    fireEvent.click(await screen.findByRole("button", { name: "Delete tape" }));
    expect(tapesApi.deleteTape).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    await waitFor(() => expect(tapesApi.deleteTape).toHaveBeenCalledWith("t1"));
    expect(await screen.findByText("Shelf page")).toBeInTheDocument();
  });
});
