import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/client";
import type { SessionEventBody } from "../src/api/sessions";
import * as sessionsApi from "../src/api/sessions";
import type { TapeWire } from "../src/api/tapes";
import { RetryQueue } from "../src/domain/retryQueue";
import { useFocusAudio } from "../src/hooks/useFocusAudio";
import { penaltyDetail } from "../src/components/BreakSkipToast";
import { penaltyPercent, useFocusSession } from "../src/hooks/useFocusSession";

vi.mock("../src/api/sessions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api/sessions")>();
  return {
    ...actual,
    startSession: vi.fn(),
    postSessionEvent: vi.fn(),
    stopSession: vi.fn(),
  };
});

// jsdom has no Web Audio; the focus audio engine is not what is under test here.
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

// The mocked hook returns this same object every render, so tests can flip `playing`.
const audioStub = useFocusAudio() as unknown as {
  playing: boolean;
  start: ReturnType<typeof vi.fn>;
  fadeTo: ReturnType<typeof vi.fn>;
};

const start = vi.mocked(sessionsApi.startSession);
const postEvent = vi.mocked(sessionsApi.postSessionEvent);
const stop = vi.mocked(sessionsApi.stopSession);

function item(id: string, position: number, kind: "track" | "interlude") {
  return {
    id,
    side: "A" as const,
    position,
    kind,
    name: kind === "track" ? `Track ${id}` : null,
    minutes: 10,
    key_terms: kind === "track" ? ["a", "b", "c"] : null,
    memory: null,
  };
}

const TAPE = {
  id: "tape1",
  side_a: [item("t2", 2, "track"), item("t1", 0, "track"), item("i1", 1, "interlude")],
  side_b: [],
} as unknown as TapeWire;

const fast = () => new RetryQueue({ intervalMs: 10, maxAttempts: 5 });
const chime = () => ({ prime: vi.fn(), play: vi.fn(), dispose: vi.fn() });

const sessionOut = { id: "s1", tape_id: "tape1", started_at: "", ended_at: null };
const eventOut = (penalty: sessionsApi.PenaltyWire[] = []) => ({
  client_event_id: "x",
  type: "skip" as const,
  item_id: "t1",
  penalty,
  session_ended: false,
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  audioStub.playing = false;
  start.mockResolvedValue(sessionOut);
  postEvent.mockResolvedValue(eventOut());
  stop.mockResolvedValue({} as sessionsApi.SessionSummaryWire);
});

describe("useFocusSession", () => {
  it("retries an event with the same client_event_id", async () => {
    postEvent.mockRejectedValueOnce(new TypeError("down")).mockResolvedValueOnce(eventOut());
    const { result } = renderHook(() => useFocusSession(TAPE, { queue: fast(), chime: chime() }));
    act(() => result.current.play());
    act(() => result.current.ff());
    await waitFor(() => expect(postEvent).toHaveBeenCalledTimes(2));
    const bodies = postEvent.mock.calls.map((c) => c[1] as SessionEventBody);
    expect(bodies[0].client_event_id).toBe(bodies[1].client_event_id);
    expect(bodies[0]).toMatchObject({ type: "skip", item_id: "t1" });
  });

  it("keeps the countdown running when the network fails", async () => {
    start.mockRejectedValue(new TypeError("down"));
    postEvent.mockRejectedValue(new TypeError("down"));
    const { result } = renderHook(() => useFocusSession(TAPE, { queue: fast(), chime: chime() }));
    act(() => result.current.play());
    await waitFor(() => expect(start.mock.calls.length).toBeGreaterThan(1));
    expect(result.current.status).toBe("playing");
    await waitFor(() => expect(result.current.remainingMs).toBeLessThan(600000));
    expect(result.current.status).toBe("playing");
  });

  it("sets lastPenalty from a skip response", async () => {
    postEvent.mockResolvedValue(
      eventOut([{ track_id: "t1", stability_before: 2, stability_after: 1.5 }]),
    );
    const { result } = renderHook(() => useFocusSession(TAPE, { queue: fast(), chime: chime() }));
    expect(result.current.lastPenalty).toBeNull();
    act(() => result.current.play());
    act(() => result.current.ff());
    await waitFor(() => expect(result.current.lastPenalty).not.toBeNull());
    expect(result.current.lastPenalty?.trackIds).toEqual(["t1"]);
    expect(result.current.lastPenalty?.message).toContain("The tape remembers");
  });

  it("derives the toast percent from a skipped track's server stability (10 -> 9.5)", async () => {
    postEvent.mockResolvedValue(
      eventOut([{ track_id: "t1", stability_before: 10, stability_after: 9.5 }]),
    );
    const { result } = renderHook(() => useFocusSession(TAPE, { queue: fast(), chime: chime() }));
    act(() => result.current.play());
    act(() => result.current.ff());
    await waitFor(() => expect(result.current.lastPenalty).not.toBeNull());
    expect(result.current.lastPenalty?.percent).toBe(5);
    expect(penaltyDetail(result.current.lastPenalty!)).toBe("Memory span −5% on 1 track");
  });

  it("derives the toast percent from a skipped interlude (10 -> 9), max across tracks", async () => {
    postEvent
      .mockResolvedValueOnce(eventOut())
      .mockResolvedValue(
        eventOut([
          { track_id: "t1", stability_before: 10, stability_after: 9 },
          { track_id: "t2", stability_before: 10, stability_after: 9.5 },
        ]),
      );
    const { result } = renderHook(() => useFocusSession(TAPE, { queue: fast(), chime: chime() }));
    act(() => result.current.play());
    act(() => result.current.ff());
    act(() => result.current.ff());
    await waitFor(() => expect(result.current.lastPenalty).not.toBeNull());
    expect(result.current.lastPenalty?.percent).toBe(10);
    expect(penaltyDetail(result.current.lastPenalty!)).toBe("Memory span −10% on 2 tracks");
  });

  it("penaltyPercent guards a zero stability_before", () => {
    expect(penaltyPercent(0, 0)).toBe(0);
    expect(penaltyPercent(10, 9)).toBe(10);
  });

  it("treats a 409 as success so later events still go out", async () => {
    postEvent
      .mockRejectedValueOnce(new ApiError(409, { detail: "dup" }))
      .mockResolvedValue(eventOut());
    const { result } = renderHook(() => useFocusSession(TAPE, { queue: fast(), chime: chime() }));
    act(() => result.current.play());
    act(() => result.current.ff());
    act(() => result.current.ff());
    await waitFor(() => expect(postEvent).toHaveBeenCalledTimes(2));
  });

  it("sends /stop when the session finishes", async () => {
    const c = chime();
    const { result } = renderHook(() => useFocusSession(TAPE, { queue: fast(), chime: c }));
    act(() => result.current.play());
    act(() => result.current.ff());
    act(() => result.current.ff());
    act(() => result.current.ff());
    await waitFor(() => expect(stop).toHaveBeenCalledWith("s1"));
    expect(postEvent).toHaveBeenCalledTimes(3);
    expect(c.prime).toHaveBeenCalled();
    expect(c.play).toHaveBeenCalledTimes(3);
    await waitFor(() => expect(localStorage.getItem("cursed-cassette.session.tape1")).toBeNull());
  });

  it("keeps the session id across a remount", async () => {
    const first = renderHook(() => useFocusSession(TAPE, { queue: fast(), chime: chime() }));
    act(() => first.result.current.play());
    await waitFor(() =>
      expect(localStorage.getItem("cursed-cassette.session.tape1")).toBe("s1"),
    );
    first.unmount();

    const second = renderHook(() => useFocusSession(TAPE, { queue: fast(), chime: chime() }));
    expect(second.result.current.status).toBe("playing");
    act(() => second.result.current.ff());
    await waitFor(() => expect(postEvent).toHaveBeenCalled());
    expect(postEvent.mock.calls[0][0]).toBe("s1");
    expect(start).toHaveBeenCalledTimes(1);
  });

  describe("focus audio", () => {
    it("fades to 0 on pause", () => {
      const { result } = renderHook(() => useFocusSession(TAPE, { queue: fast(), chime: chime() }));
      act(() => result.current.play());
      audioStub.playing = true;
      audioStub.fadeTo.mockClear();
      act(() => result.current.pause());
      expect(audioStub.fadeTo).toHaveBeenCalledWith(0);
      expect(result.current.status).toBe("paused");
    });

    it("fades to 1 when resuming on a track", () => {
      const { result } = renderHook(() => useFocusSession(TAPE, { queue: fast(), chime: chime() }));
      act(() => result.current.play());
      audioStub.playing = true;
      act(() => result.current.pause());
      audioStub.fadeTo.mockClear();
      act(() => result.current.play());
      expect(audioStub.fadeTo).toHaveBeenCalledWith(1);
    });

    it("leaves the sound at 0 when resuming on an interlude", () => {
      const { result } = renderHook(() => useFocusSession(TAPE, { queue: fast(), chime: chime() }));
      act(() => result.current.play());
      act(() => result.current.ff()); // t1 skipped, now on interlude i1
      audioStub.playing = true;
      act(() => result.current.pause());
      audioStub.fadeTo.mockClear();
      act(() => result.current.play());
      expect(audioStub.fadeTo).not.toHaveBeenCalledWith(1);
    });

    it("does not silence a new session that starts on a track after STOP on an interlude", () => {
      const { result } = renderHook(() => useFocusSession(TAPE, { queue: fast(), chime: chime() }));
      act(() => result.current.play());
      act(() => result.current.ff()); // now on interlude i1
      act(() => result.current.stop());
      audioStub.playing = false;
      audioStub.fadeTo.mockClear();
      act(() => result.current.play());
      expect(audioStub.fadeTo).not.toHaveBeenCalledWith(0, 0);
    });

    it("starts silent when the first item is an interlude", () => {
      const interludeFirst = {
        id: "tape2",
        side_a: [item("i1", 0, "interlude"), item("t1", 1, "track")],
        side_b: [],
      } as unknown as TapeWire;
      const { result } = renderHook(() =>
        useFocusSession(interludeFirst, { queue: fast(), chime: chime() }),
      );
      act(() => result.current.play());
      expect(audioStub.start).toHaveBeenCalledTimes(1);
      expect(audioStub.fadeTo).toHaveBeenCalledWith(0, 0);
      expect(audioStub.start.mock.invocationCallOrder[0]).toBeLessThan(
        audioStub.fadeTo.mock.invocationCallOrder[0],
      );
    });
  });
});
