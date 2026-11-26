import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsWire } from "../src/api/tapes";

const getSettings = vi.hoisted(() => vi.fn());
vi.mock("../src/api/tapes", () => ({ getSettings }));

import { useVirtualClock } from "../src/hooks/useVirtualClock";

const settings = (scale: number): SettingsWire => ({
  demo_mode: false,
  time_warp_allowed: true,
  time_warp_enabled: scale !== 1,
  time_scale: scale,
  real_now: "2030-01-01T00:00:00Z",
  virtual_now: "2030-01-10T00:00:00Z",
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useVirtualClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z")); // local clock differs from server
  });
  afterEach(() => {
    vi.useRealTimers();
    getSettings.mockReset();
  });

  // Validates: Requirements 6.12, 12.7
  it("follows the server offset at scale 1", async () => {
    getSettings.mockResolvedValue(settings(1));
    const { result } = renderHook(() => useVirtualClock());
    await flush();
    expect(result.current.virtualNow()).toBe(Date.parse("2030-01-10T00:00:00Z"));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.virtualNow()).toBe(Date.parse("2030-01-10T00:00:05Z"));
    expect(result.current.warpOn).toBe(false);
  });

  // Validates: Requirements 12.5
  it("refreshes when the settings-changed event fires", async () => {
    getSettings.mockResolvedValue(settings(1));
    const { result } = renderHook(() => useVirtualClock());
    await flush();
    expect(result.current.warpOn).toBe(false);
    expect(getSettings).toHaveBeenCalledTimes(1);

    getSettings.mockResolvedValue(settings(1440));
    act(() => {
      window.dispatchEvent(new Event("cursed-cassette:settings-changed"));
    });
    await flush();
    expect(getSettings).toHaveBeenCalledTimes(2);
    expect(result.current.warpOn).toBe(true);
  });

  it("applies the time scale when warp is on", async () => {
    getSettings.mockResolvedValue(settings(1440));
    const { result } = renderHook(() => useVirtualClock());
    await flush();
    expect(result.current.warpOn).toBe(true);
    expect(result.current.virtualNow()).toBe(Date.parse("2030-01-10T00:00:00Z"));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.virtualNow()).toBe(Date.parse("2030-01-11T00:00:00Z"));
  });
});
