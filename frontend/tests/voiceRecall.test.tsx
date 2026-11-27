import "fake-indexeddb/auto";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as recordingStore from "../src/audio/recordingStore";
import RecallPanel from "../src/components/RecallPanel";

const NOTICE_KEY = "cursed-cassette.speechNoticeAck";

class FakeRecorder {
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: unknown) {}
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"]) });
    this.onstop?.();
  }
}

class FakeSpeech {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: unknown = null;
  onerror: unknown = null;
  onend: unknown = null;
  start() {}
  stop() {}
  abort() {}
}

function stubMic(getUserMedia: () => Promise<unknown>) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
}

const stream = { getTracks: () => [{ stop: () => {} }] };

function resetStores() {
  return new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("cursed-cassette");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  localStorage.clear();
  await resetStores();
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
});

const track = { id: "t1", name: "Cells" };

describe("recordingStore", () => {
  it("replaces the earlier audio when a track is re-recorded, and removes on request", async () => {
    const rec = (n: number) => ({
      blob: new Blob([`take${n}`]),
      mimeType: "audio/webm",
      durationMs: n * 1000,
      recordedAt: n,
    });
    await recordingStore.save("t1", rec(1));
    await recordingStore.save("t1", rec(2));
    await recordingStore.save("t2", rec(3));
    expect((await recordingStore.get("t1"))?.durationMs).toBe(2000);
    await recordingStore.removeMany(["t1", "t2"]);
    expect(await recordingStore.get("t1")).toBeUndefined();
    expect(await recordingStore.get("t2")).toBeUndefined();
    await recordingStore.remove("missing");
  });
});

describe("RecallPanel voice", () => {
  it("falls back to typing when SpeechRecognition is missing", () => {
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    stubMic(() => Promise.resolve(stream));
    render(<RecallPanel track={track} onClose={() => {}} />);
    expect(screen.getByLabelText("Voice unavailable").textContent).toMatch(/no speech recognition/i);
    expect(screen.queryByLabelText("Start voice recording")).toBeNull();
    expect(screen.getByLabelText("Recall text")).toBeInTheDocument();
  });

  it("shows the typing box with a reason when the microphone is denied", async () => {
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("SpeechRecognition", FakeSpeech);
    localStorage.setItem(NOTICE_KEY, "1");
    stubMic(() => Promise.reject(new DOMException("no", "NotAllowedError")));
    const onChange = vi.fn();
    render(<RecallPanel track={track} onClose={() => {}} onRecordingChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Start voice recording"));
    await waitFor(() =>
      expect(screen.getByLabelText("Voice unavailable").textContent).toMatch(/denied/i),
    );
    expect(screen.getByLabelText("Recall text")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the notice once, opens the mic only after it, reports recording true then false, and stores the audio", async () => {
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("SpeechRecognition", FakeSpeech);
    const getUserMedia = vi.fn(() => Promise.resolve(stream));
    stubMic(getUserMedia);
    const onChange = vi.fn();
    render(<RecallPanel track={track} onClose={() => {}} onRecordingChange={onChange} />);

    expect(getUserMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Start voice recording"));
    expect(screen.getByLabelText("Speech service notice")).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Accept notice and start recording"));

    const stopButton = await screen.findByLabelText("Stop recording");
    expect(onChange.mock.calls).toEqual([[true]]);
    await act(async () => {
      fireEvent.click(stopButton);
    });
    expect(onChange.mock.calls).toEqual([[true], [false]]);
    expect(screen.getByText(/That was short/)).toBeInTheDocument();
    await waitFor(async () => expect(await recordingStore.get("t1")).toBeDefined());
    expect(localStorage.getItem(NOTICE_KEY)).toBe("1");
  });

  it("reports false when the panel unmounts mid-recording", async () => {
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("SpeechRecognition", FakeSpeech);
    localStorage.setItem(NOTICE_KEY, "1");
    stubMic(() => Promise.resolve(stream));
    const onChange = vi.fn();
    const { unmount } = render(
      <RecallPanel track={track} onClose={() => {}} onRecordingChange={onChange} />,
    );
    fireEvent.click(screen.getByLabelText("Start voice recording"));
    await screen.findByLabelText("Stop recording");
    unmount();
    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });

  it("still saves a recording that was stopped before the panel unmounted and onstop fired late", async () => {
    let last: LateRecorder | null = null;
    class LateRecorder extends FakeRecorder {
      constructor(s: unknown) {
        super(s);
        last = this;
      }
      stop() {
        this.state = "inactive"; // onstop is fired later by the test
      }
    }
    vi.stubGlobal("MediaRecorder", LateRecorder);
    vi.stubGlobal("SpeechRecognition", FakeSpeech);
    localStorage.setItem(NOTICE_KEY, "1");
    stubMic(() => Promise.resolve(stream));
    const { unmount } = render(<RecallPanel track={track} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText("Start voice recording"));
    fireEvent.click(await screen.findByLabelText("Stop recording"));
    unmount();

    const recorder = last as LateRecorder | null;
    expect(recorder).not.toBeNull();
    recorder!.ondataavailable?.({ data: new Blob(["audio"]) });
    recorder!.onstop?.();
    await waitFor(async () => expect(await recordingStore.get("t1")).toBeDefined());
  });
});
