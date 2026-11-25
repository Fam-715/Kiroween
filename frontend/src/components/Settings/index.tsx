/**
 * Settings panel (task 8.2).
 *
 * Requirements:
 *  - Req 12.1  Demo mode is off by default; stored per listener via PUT /api/settings.
 *  - Req 12.2  While Demo mode is on the UI shows a "DEMO MODE" text label.
 *  - Req 12.3  Turning Demo mode off leaves already-saved short tracks playable
 *              (pure backend behaviour; the toggle just calls the API correctly).
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { getSettings, putSettings, type SettingsWire } from "../../api/tapes";

// ---------------------------------------------------------------------------
// Gear icon (SVG, inline, no external assets)
// ---------------------------------------------------------------------------
function GearIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Outer ring / teeth */}
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Demo mode badge — rendered next to the header when demo is active
// ---------------------------------------------------------------------------
export function DemoModeBadge() {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label="Demo mode is active"
      className="rounded-sm border border-label-teal/70 bg-plum-900 px-2 py-0.5 font-type text-xs uppercase tracking-widest text-label-tealBright"
    >
      Demo mode
    </span>
  );
}

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------
export interface SettingsPanelProps {
  /** Called whenever demo_mode changes so the parent can update its own state. */
  onDemoModeChange?: (demoMode: boolean) => void;
}

export default function SettingsPanel({ onDemoModeChange }: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsWire | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Load settings when the panel opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSettings()
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Close on Escape; return focus to trigger
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Close when clicking outside the panel
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Use capture so the click fires before anything else
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [open]);

  const handleDemoToggle = async (nextValue: boolean) => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await putSettings(nextValue);
      setSettings(updated);
      onDemoModeChange?.(updated.demo_mode);
    } catch {
      setError("Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  const panelVariants = {
    hidden: { opacity: 0, y: reduced ? 0 : -8, scale: reduced ? 1 : 0.97 },
    visible: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: reduced ? 0 : -8, scale: reduced ? 1 : 0.97 },
  };

  return (
    <div className="relative">
      {/* Gear trigger button */}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open settings"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-sm border border-plastic-500/40 bg-plum-800 text-plastic-300 hover:bg-plum-900 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-lcd-green"
      >
        <GearIcon className="h-5 w-5" />
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Settings"
            aria-modal="true"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-12 z-50 min-w-64 rounded-sm border border-plastic-500/40 bg-plum-900 p-4 shadow-lg"
          >
            <h2 className="font-type text-base text-ink">Settings</h2>

            {loading && (
              <p role="status" className="mt-3 font-lcd text-sm text-lcd-green">
                Loading…
              </p>
            )}

            {error && (
              <p role="alert" className="mt-3 font-type text-sm text-label-orangeBright">
                {error}
              </p>
            )}

            {settings && !loading && (
              <div className="mt-4 space-y-4">
                {/* Demo mode toggle */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label
                      htmlFor="settings-demo-mode"
                      className="cursor-pointer font-type text-sm text-ink"
                    >
                      Demo mode
                    </label>
                    <p className="mt-0.5 text-xs text-plastic-300">
                      Allows tracks as short as 1 minute
                    </p>
                  </div>
                  {/* Toggle switch */}
                  <button
                    id="settings-demo-mode"
                    type="button"
                    role="switch"
                    aria-checked={settings.demo_mode}
                    aria-label={`Demo mode ${settings.demo_mode ? "on" : "off"}`}
                    disabled={saving}
                    onClick={() => void handleDemoToggle(!settings.demo_mode)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-lcd-green disabled:opacity-50 ${
                      settings.demo_mode
                        ? "border-label-teal bg-label-teal"
                        : "border-plastic-500/60 bg-plum-800"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-ink shadow transition-transform ${
                        settings.demo_mode ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Req 12.2: visible "DEMO MODE" text label while on */}
                {settings.demo_mode && (
                  <p
                    role="status"
                    className="rounded-sm border border-label-teal/50 bg-plum-800/60 px-2 py-1.5 font-type text-sm text-label-tealBright"
                  >
                    DEMO MODE — track durations may be 1–50 minutes
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                aria-label="Close settings"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className="rounded-sm border border-plastic-500/40 bg-plum-800 px-3 py-1.5 font-type text-sm text-plastic-300 hover:bg-plum-900 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-lcd-green"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
