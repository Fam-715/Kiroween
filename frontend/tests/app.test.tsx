import { render, screen } from "@testing-library/react";
import fc from "fast-check";
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
  };
});

const mockGetSettings = vi.mocked(tapesApi.getSettings);

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

describe("scaffold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue(makeSettings());
  });

  it("renders the app title", () => {
    render(<App />);
    expect(screen.getByText("Cursed Cassette")).toBeInTheDocument();
  });

  it("fast-check is wired up", () => {
    fc.assert(fc.property(fc.integer(), (n) => n + 0 === n));
  });
});
