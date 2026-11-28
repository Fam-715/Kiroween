import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import * as tapesApi from "../src/api/tapes";

// Layout calls getSettings on mount; mock it so tests never hit the network.
vi.mock("../src/api/tapes", async (importOriginal) => {
  const actual = await importOriginal<typeof tapesApi>();
  return {
    ...actual,
    getSettings: vi.fn(),
    putSettings: vi.fn(),
    listTapes: vi.fn(),
    getTape: vi.fn(),
  };
});

const mockGetSettings = vi.mocked(tapesApi.getSettings);
const mockListTapes = vi.mocked(tapesApi.listTapes);
const mockGetTape = vi.mocked(tapesApi.getTape);

function makePlayerTape(): tapesApi.TapeWire {
  return {
    id: "abc-123",
    title: "Biology",
    length: "C60",
    created_at: "",
    is_sample: false,
    virtual_now: "",
    side_a: [
      {
        id: "trk1",
        side: "A",
        position: 0,
        kind: "track",
        name: "Cells",
        minutes: 10,
        key_terms: ["a", "b", "c"],
        memory: {
          recorded: true,
          strength: 90,
          condition: "Mint",
          stability_days: 3,
          review_count: 1,
          last_reviewed_at: null,
          next_review_at: null,
          due: false,
        },
      },
    ],
    side_b: [],
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

function makeSettings(overrides: Partial<tapesApi.SettingsWire> = {}): tapesApi.SettingsWire {
  return {
    demo_mode: false,
    time_warp_allowed: false,
    time_warp_enabled: false,
    time_scale: 1,
    real_now: new Date().toISOString(),
    virtual_now: new Date().toISOString(),
    ...overrides,
  };
}

describe("base layout and routes (task 7.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue(makeSettings());
    mockListTapes.mockResolvedValue([]);
  });
  it("renders the header, brand link and both nav links with aria-labels", () => {
    render(<App />);
    expect(screen.getByText("Cursed Cassette")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to the tape shelf" }),
    ).toHaveAttribute("aria-label", "Go to the tape shelf");
    expect(screen.getByRole("link", { name: "Open the recorder" })).toBeInTheDocument();
    expect(screen.getByLabelText("Main navigation")).toBeInTheDocument();
  });

  it("renders the skip-to-content link and main landmark", () => {
    render(<App />);
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("shows the shelf route by default with its empty state", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "The Shelf" })).toBeInTheDocument();
    expect(await screen.findByText("No tapes yet. Record your first one.")).toBeInTheDocument();
  });

  it("navigates to the recorder route from the shelf button", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: "Record a new tape" }));
    expect(
      screen.getByRole("heading", { name: "Record a Tape" }),
    ).toBeInTheDocument();
    // The shelf (with its second "Record a new tape" link) is gone.
    expect(screen.queryByRole("heading", { name: "The Shelf" })).not.toBeInTheDocument();
  });

  it("navigates to the recorder via the nav and back to the shelf", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: "Open the recorder" }));
    expect(
      screen.getByRole("heading", { name: "Record a Tape" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Go to the tape shelf" }));
    expect(screen.getByRole("heading", { name: "The Shelf" })).toBeInTheDocument();
  });

  it("renders the player route with condition text", async () => {
    mockGetTape.mockResolvedValue(makePlayerTape());
    window.history.pushState({}, "", "/play/abc-123");
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Cassette Player" }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("lcd")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Cassette Player" }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("condition-text").length).toBeGreaterThan(0);
    window.history.pushState({}, "", "/");
  });

  it("gives nav links a visible focus treatment (tabindex is not -1)", () => {
    render(<App />);
    const shelfLink = screen.getByRole("link", {
      name: "Go to the tape shelf",
    });
    expect(shelfLink).not.toHaveAttribute("tabindex", "-1");
  });
});
