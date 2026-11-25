import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Recorder from "./index";

/**
 * Component tests for the Recorder (task 8.1). The network layer is the only thing
 * stubbed (a fetch mock); all component and domain logic runs for real.
 * Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.7, 12.2.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SETTINGS = {
  demo_mode: false,
  time_warp_allowed: false,
  time_warp_enabled: false,
  time_scale: 1,
  real_now: "2026-01-01T00:00:00Z",
  virtual_now: "2026-01-01T00:00:00Z",
};

interface FetchOptions {
  demoMode?: boolean;
  postTapes?: () => Response;
}

function installFetch(options: FetchOptions = {}) {
  const impl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/settings") && method === "GET") {
      return Promise.resolve(
        jsonResponse({ ...SETTINGS, demo_mode: options.demoMode ?? false }),
      );
    }
    if (url.endsWith("/api/tapes") && method === "POST") {
      return Promise.resolve(options.postTapes ? options.postTapes() : jsonResponse({ id: "t1" }, 201));
    }
    return Promise.resolve(jsonResponse({ detail: "not found" }, 404));
  });
  vi.stubGlobal("fetch", impl);
  return impl;
}

function renderRecorder() {
  return render(
    <MemoryRouter initialEntries={["/record"]}>
      <Recorder />
    </MemoryRouter>,
  );
}

async function renderReady(options: FetchOptions = {}) {
  installFetch(options);
  renderRecorder();
  await screen.findByRole("button", { name: "Save tape" });
}

function addTrack(side: "A" | "B") {
  fireEvent.click(screen.getByRole("button", { name: `Add a track to side ${side}` }));
}

function addInterlude(side: "A" | "B") {
  fireEvent.click(screen.getByRole("button", { name: `Add an interlude to side ${side}` }));
}

function setMinutes(trackNo: number, side: "A" | "B", minutes: number) {
  fireEvent.change(screen.getByLabelText(`Minutes for track ${trackNo} on side ${side}`), {
    target: { value: String(minutes) },
  });
}

function setName(trackNo: number, side: "A" | "B", name: string) {
  fireEvent.change(screen.getByLabelText(`Topic name for track ${trackNo} on side ${side}`), {
    target: { value: name },
  });
}

function addTerm(trackNo: number, side: "A" | "B", term: string) {
  fireEvent.change(
    screen.getByLabelText(`New key term for track ${trackNo} on side ${side}`),
    { target: { value: term } },
  );
  fireEvent.click(
    screen.getByLabelText(`Add key term to track ${trackNo} on side ${side}`),
  );
}

function remainingOn(side: "A" | "B"): string {
  return screen.getByLabelText(`Minutes remaining on side ${side}`).textContent ?? "";
}

function removeItem(kind: "track" | "interlude", trackNo: number, side: "A" | "B") {
  fireEvent.click(
    screen.getByLabelText(`Remove ${kind} ${trackNo} from side ${side}`),
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Recorder (task 8.1)", () => {
  it("rejects an item that would exceed side capacity and shows the remaining minutes", async () => {
    await renderReady();
    addTrack("A");
    setMinutes(1, "A", 25);
    expect(remainingOn("A")).toBe("5 min left");

    // Adding a default 10-minute track would exceed C60's 30-minute side.
    addTrack("A");
    expect(
      await screen.findByText("Side A is full: only 5 minutes remain."),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^track \d+ on side A$/)).toHaveLength(1);
    expect(remainingOn("A")).toBe("5 min left");
  });

  it("flags too few and too many key terms", async () => {
    await renderReady();
    addTrack("A");
    setName(1, "A", "Photosynthesis");
    addTerm(1, "A", "chloroplast");
    addTerm(1, "A", "light");
    expect(
      await screen.findByText("Track 1 needs 3 to 5 key terms (has 2)."),
    ).toBeInTheDocument();

    addTerm(1, "A", "stomata");
    addTerm(1, "A", "glucose");
    addTerm(1, "A", "water");
    addTerm(1, "A", "membrane");
    expect(
      await screen.findByText("Track 1 needs 3 to 5 key terms (has 6)."),
    ).toBeInTheDocument();
  });

  it("rejects duplicate key terms ignoring case", async () => {
    await renderReady();
    addTrack("A");
    setName(1, "A", "Cells");
    addTerm(1, "A", "Cell");
    addTerm(1, "A", "cell");
    addTerm(1, "A", "wall");
    expect(
      await screen.findByText("Track 1: key terms must be unique (ignoring case)."),
    ).toBeInTheDocument();
  });

  it("shows the adjacency error for two consecutive tracks, and clears it behind an interlude", async () => {
    await renderReady();
    addTrack("A");
    setName(1, "A", "Topic one");
    addTrack("A");
    setName(2, "A", "Topic two");
    expect(
      await screen.findByText(/Track 2 follows another track/),
    ).toBeInTheDocument();

    removeItem("track", 2, "A");
    addInterlude("A");
    addTrack("A");
    setName(3, "A", "Topic three");
    await waitFor(() => {
      expect(screen.queryByText(/follows another track/)).not.toBeInTheDocument();
    });
  });

  it("requires 10-minute tracks when Demo mode is off", async () => {
    await renderReady();
    addTrack("A");
    setName(1, "A", "Enzymes");
    setMinutes(1, "A", 1);
    addTerm(1, "A", "active site");
    addTerm(1, "A", "substrate");
    addTerm(1, "A", "catalyst");
    expect(
      await screen.findByText("Track 1: duration must be 10 to 50 minutes."),
    ).toBeInTheDocument();
  });

  it("accepts 1-minute tracks and shows the Demo mode label while Demo mode is on", async () => {
    await renderReady({ demoMode: true });
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
    addTrack("A");
    setMinutes(1, "A", 1);
    setName(1, "A", "Enzymes");
    addTerm(1, "A", "active site");
    addTerm(1, "A", "substrate");
    addTerm(1, "A", "catalyst");
    await waitFor(() => {
      expect(screen.queryByText(/duration must be/)).not.toBeInTheDocument();
      expect(screen.queryByText(/needs 3 to 5 key terms/)).not.toBeInTheDocument();
    });
  });

  it("restores the previous remaining value after adding and removing an item", async () => {
    await renderReady();
    expect(remainingOn("A")).toBe("30 min left");
    addTrack("A");
    expect(remainingOn("A")).toBe("20 min left");
    removeItem("track", 1, "A");
    expect(remainingOn("A")).toBe("30 min left");
  });

  it("maps backend 422 violations to inline errors on save", async () => {
    await renderReady({
      demoMode: true,
      postTapes: () =>
        jsonResponse(
          {
            detail: [
              {
                rule: "capacity",
                side: "A",
                message: "Side is over capacity by 5 minutes (30 minutes available).",
              },
            ],
          },
          422,
        ),
    });
    fireEvent.change(screen.getByLabelText("Tape title"), {
      target: { value: "Biology Midterm" },
    });
    addTrack("A");
    setMinutes(1, "A", 1);
    setName(1, "A", "DNA replication");
    addTerm(1, "A", "helicase");
    addTerm(1, "A", "polymerase");
    addTerm(1, "A", "ligase");

    fireEvent.click(screen.getByRole("button", { name: "Save tape" }));
    expect(
      await screen.findByText("Side is over capacity by 5 minutes (30 minutes available)."),
    ).toBeInTheDocument();
    // The violation sits inside Side A's inline error list.
    expect(
      screen.getByLabelText("Rule errors on side A").textContent,
    ).toContain("over capacity");
  });
});
