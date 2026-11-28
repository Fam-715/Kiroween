import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tapesApi from "../src/api/tapes";
import * as playback from "../src/audio/decayedPlayback";
import * as recordingStore from "../src/audio/recordingStore";
import JCard from "../src/components/JCard";
import { effectsFor } from "../src/domain/effects";

vi.mock("../src/api/tapes", async (importOriginal) => {
  const actual = await importOriginal<typeof tapesApi>();
  return { ...actual, getTape: vi.fn(), deleteTape: vi.fn() };
});

vi.mock("../src/audio/recordingStore", () => ({
  save: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
  removeMany: vi.fn(),
}));

vi.mock("../src/audio/decayedPlayback", () => ({
  playRecording: vi.fn(),
}));

const NOW = new Date().toISOString();
const FUTURE = new Date(Date.now() + 3 * 86_400_000).toISOString();

function tape(): tapesApi.TapeWire {
  return {
    id: "t1",
    title: "Biology",
    length: "C60",
    created_at: NOW,
    is_sample: false,
    virtual_now: NOW,
    side_a: [
      {
        id: "one",
        side: "A",
        position: 0,
        kind: "track",
        name: "Cells",
        minutes: 10,
        key_terms: ["a", "b", "c"],
        memory: {
          recorded: true,
          strength: 100,
          condition: "Mint",
          stability_days: 5,
          review_count: 1,
          last_reviewed_at: NOW,
          next_review_at: FUTURE,
          due: false,
        },
      },
    ],
    side_b: [],
    remaining_a: 0,
    remaining_b: 0,
    strength: 100,
    condition: "Mint",
    due_count: 0,
    next_review_at: FUTURE,
    ghost: false,
    stats: { sessions: 0, focus_minutes: 0, tracks_completed: 0, tracks_skipped: 0 },
  };
}

function renderJCard() {
  return render(
    <MemoryRouter initialEntries={["/tape/t1"]}>
      <Routes>
        <Route path="/tape/:tapeId" element={<JCard />} />
      </Routes>
    </MemoryRouter>,
  );
}

const recording: recordingStore.StoredRecording = {
  blob: new Blob(["x"]),
  mimeType: "audio/webm",
  durationMs: 1000,
  recordedAt: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tapesApi.getTape).mockResolvedValue(tape());
});

describe("JCard recording playback", () => {
  it("says so when there is no recording on this device", async () => {
    vi.mocked(recordingStore.get).mockResolvedValue(undefined);
    renderJCard();
    fireEvent.click(await screen.findByRole("button", { name: "Play recording of Cells" }));
    expect(await screen.findByText("No recording on this device")).toBeInTheDocument();
    expect(playback.playRecording).not.toHaveBeenCalled();
  });

  it("plays with the row's effects, and a second press stops it", async () => {
    const stop = vi.fn();
    vi.mocked(recordingStore.get).mockResolvedValue(recording);
    vi.mocked(playback.playRecording).mockResolvedValue({ stop });
    const view = renderJCard();

    fireEvent.click(await screen.findByRole("button", { name: "Play recording of Cells" }));
    const stopButton = await screen.findByRole("button", { name: "Stop recording of Cells" });
    expect(recordingStore.get).toHaveBeenCalledWith("one");
    expect(playback.playRecording).toHaveBeenCalledWith(
      recording.blob,
      effectsFor(100, false),
      expect.anything(),
    );

    fireEvent.click(stopButton);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Play recording of Cells" })).toBeInTheDocument();
    view.unmount();
  });

  it("stops playback when the J-card unmounts", async () => {
    const stop = vi.fn();
    vi.mocked(recordingStore.get).mockResolvedValue(recording);
    vi.mocked(playback.playRecording).mockResolvedValue({ stop });
    const view = renderJCard();
    fireEvent.click(await screen.findByRole("button", { name: "Play recording of Cells" }));
    await screen.findByRole("button", { name: "Stop recording of Cells" });
    view.unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("shows a short message when decoding fails", async () => {
    vi.mocked(recordingStore.get).mockResolvedValue(recording);
    vi.mocked(playback.playRecording).mockRejectedValue(new Error("bad audio"));
    renderJCard();
    fireEvent.click(await screen.findByRole("button", { name: "Play recording of Cells" }));
    await waitFor(() => expect(screen.getByText("Could not play this recording")).toBeInTheDocument());
  });
});
