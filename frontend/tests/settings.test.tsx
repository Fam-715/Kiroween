/**
 * Tests for the Settings panel (task 8.2).
 *
 * Requirements verified:
 *  - Req 12.1  Demo mode is off by default.
 *  - Req 12.2  While Demo mode is on, the UI shows a "Demo mode" / "DEMO MODE" label.
 *  - Req 12.3  Toggle calls PUT /api/settings correctly.
 *  - Accessibility: gear button has aria-label, panel has role="dialog",
 *                   toggle has role="switch" and aria-checked.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPanel, { DemoModeBadge } from "../src/components/Settings";
import * as tapesApi from "../src/api/tapes";

// ---------------------------------------------------------------------------
// Mock framer-motion so AnimatePresence unmounts children immediately
// (jsdom never fires animation completion callbacks, so without this mock
// exit animations keep the dialog in the DOM forever).
// ---------------------------------------------------------------------------
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    // Replace AnimatePresence with a simple passthrough — children appear/
    // disappear immediately based on whether the parent renders them.
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// ---------------------------------------------------------------------------
// Mock the API module so tests never hit the network
// ---------------------------------------------------------------------------
vi.mock("../src/api/tapes", async (importOriginal) => {
  const actual = await importOriginal<typeof tapesApi>();
  return {
    ...actual,
    getSettings: vi.fn(),
    putSettings: vi.fn(),
  };
});

const mockGetSettings = vi.mocked(tapesApi.getSettings);
const mockPutSettings = vi.mocked(tapesApi.putSettings);

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

// ---------------------------------------------------------------------------
// DemoModeBadge unit tests
// ---------------------------------------------------------------------------
describe("DemoModeBadge", () => {
  it("renders the demo mode label text", () => {
    render(<DemoModeBadge />);
    expect(screen.getByText(/demo mode/i)).toBeInTheDocument();
  });

  it("has role=status and aria-label", () => {
    render(<DemoModeBadge />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("aria-label", "Demo mode is active");
  });
});

// ---------------------------------------------------------------------------
// SettingsPanel integration tests
// ---------------------------------------------------------------------------
describe("SettingsPanel (task 8.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the gear button with aria-label='Open settings'", () => {
    render(<SettingsPanel />);
    expect(screen.getByRole("button", { name: "Open settings" })).toBeInTheDocument();
  });

  it("panel is closed initially; no dialog visible", () => {
    render(<SettingsPanel />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the settings dialog when the gear button is clicked", async () => {
    mockGetSettings.mockResolvedValue(makeSettings());
    render(<SettingsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
  });

  it("loads and displays the demo mode toggle after opening", async () => {
    mockGetSettings.mockResolvedValue(makeSettings({ demo_mode: false }));
    render(<SettingsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    // Wait for the API call to resolve and the toggle to appear
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /demo mode/i })).toBeInTheDocument(),
    );

    const toggle = screen.getByRole("switch", { name: /demo mode/i });
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("Req 12.1: demo mode starts off (aria-checked=false)", async () => {
    mockGetSettings.mockResolvedValue(makeSettings({ demo_mode: false }));
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /demo mode/i })).toBeInTheDocument(),
    );

    expect(screen.getByRole("switch", { name: /demo mode/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("Req 12.2: shows DEMO MODE text label inside the panel when demo is on", async () => {
    mockGetSettings.mockResolvedValue(makeSettings({ demo_mode: true }));
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /demo mode/i })).toBeInTheDocument(),
    );

    expect(screen.getByText(/demo mode/i, { selector: "[role=status]" })).toBeInTheDocument();
  });

  it("Req 12.2: does NOT show the DEMO MODE status label when demo is off", async () => {
    mockGetSettings.mockResolvedValue(makeSettings({ demo_mode: false }));
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /demo mode/i })).toBeInTheDocument(),
    );

    // The inner status paragraph should not be present when demo is off
    const statuses = screen.queryAllByRole("status");
    const demoStatusInPanel = statuses.find((el) =>
      el.textContent?.toUpperCase().includes("DEMO MODE"),
    );
    expect(demoStatusInPanel).toBeUndefined();
  });

  it("Req 12.3 / toggling: calls putSettings with true when toggled on", async () => {
    mockGetSettings.mockResolvedValue(makeSettings({ demo_mode: false }));
    mockPutSettings.mockResolvedValue(makeSettings({ demo_mode: true }));

    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /demo mode/i })).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: /demo mode/i }));
    });

    expect(mockPutSettings).toHaveBeenCalledWith(true);
  });

  it("calls putSettings(false) when toggled off", async () => {
    mockGetSettings.mockResolvedValue(makeSettings({ demo_mode: true }));
    mockPutSettings.mockResolvedValue(makeSettings({ demo_mode: false }));

    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /demo mode/i })).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: /demo mode/i }));
    });

    expect(mockPutSettings).toHaveBeenCalledWith(false);
  });

  it("fires onDemoModeChange callback with new value after save", async () => {
    mockGetSettings.mockResolvedValue(makeSettings({ demo_mode: false }));
    mockPutSettings.mockResolvedValue(makeSettings({ demo_mode: true }));

    const callback = vi.fn();
    render(<SettingsPanel onDemoModeChange={callback} />);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /demo mode/i })).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: /demo mode/i }));
    });

    expect(callback).toHaveBeenCalledWith(true);
  });

  it("closes panel when Escape key is pressed", async () => {
    mockGetSettings.mockResolvedValue(makeSettings());
    render(<SettingsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    // Wait for Framer Motion exit animation to finish and element to unmount
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("closes panel when the Close button is clicked", async () => {
    mockGetSettings.mockResolvedValue(makeSettings());
    render(<SettingsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    // Wait for Framer Motion exit animation to finish and element to unmount
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("toggle switch is keyboard reachable (not tabindex=-1)", async () => {
    mockGetSettings.mockResolvedValue(makeSettings({ demo_mode: false }));
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /demo mode/i })).toBeInTheDocument(),
    );

    expect(screen.getByRole("switch", { name: /demo mode/i })).not.toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("shows an error message when getSettings fails", async () => {
    mockGetSettings.mockRejectedValue(new Error("Network error"));
    render(<SettingsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/could not load settings/i);
  });
});

// ---------------------------------------------------------------------------
// Layout integration: DemoModeBadge appears in the header when demo is on
// ---------------------------------------------------------------------------
import App from "../src/App";

describe("Layout with Settings — Req 12.2 header badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Layout calls getSettings on mount; stub it so tests don't hit the network.
    mockGetSettings.mockResolvedValue(makeSettings({ demo_mode: false }));
  });

  it("renders the Settings gear button in the header", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Open settings" })).toBeInTheDocument();
  });

  it("Req 12.2: shows header Demo mode badge on load when demo_mode is already on", async () => {
    // Override the mount stub to return demo_mode: true
    mockGetSettings.mockResolvedValue(makeSettings({ demo_mode: true }));

    render(<App />);

    // The badge must appear without the user ever opening the panel
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Demo mode is active" }),
      ).toBeInTheDocument(),
    );
  });

  it("shows the Demo mode header badge after toggling on via the panel", async () => {
    mockGetSettings.mockResolvedValue(makeSettings({ demo_mode: false }));
    mockPutSettings.mockResolvedValue(makeSettings({ demo_mode: true }));

    render(<App />);

    // No badge yet (wait for mount fetch to settle)
    await waitFor(() =>
      expect(screen.queryByRole("status", { name: "Demo mode is active" })).not.toBeInTheDocument(),
    );

    // Open settings — getSettings is called again by the panel
    mockGetSettings.mockResolvedValue(makeSettings({ demo_mode: false }));
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /demo mode/i })).toBeInTheDocument(),
    );

    // Toggle on
    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: /demo mode/i }));
    });

    // The header badge should now appear
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Demo mode is active" }),
      ).toBeInTheDocument(),
    );
  });
});
