import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { getSettings } from "../../api/tapes";
import CassettePlayer from "../CassettePlayer";
import JCard from "../JCard";
import Recorder from "../Recorder";
import SettingsPanel, { DemoModeBadge, TimeWarpBadge } from "../Settings";
import TapeShelf from "../TapeShelf";

/** Route links with aria-labels; active state shown by colour, not motion alone. */
function NavLinks() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-sm text-sm font-type transition-colors ${
      isActive
        ? "bg-plum-800 text-label-orangeBright"
        : "text-plastic-300 hover:bg-plum-800 hover:text-ink"
    }`;

  return (
    <nav aria-label="Main navigation" className="flex items-center gap-2">
      <NavLink to="/" end aria-label="Go to the tape shelf" className={linkClass}>
        Shelf
      </NavLink>
      <NavLink to="/record" aria-label="Open the recorder" className={linkClass}>
        Recorder
      </NavLink>
    </nav>
  );
}

/** Wraps a route page. Motion is fully disabled under prefers-reduced-motion. */
function PageShell({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className="w-full">{children}</div>;
  }
  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function Layout() {
  const [demoMode, setDemoMode] = useState(false);
  const [timeWarp, setTimeWarp] = useState(false);

  // Req 12.2: load settings on mount so the Demo mode badge shows immediately
  // if demo_mode is already on (not just after the user opens the panel).
  useEffect(() => {
    getSettings()
      .then((s) => {
        setDemoMode(s.demo_mode);
        setTimeWarp(s.time_warp_enabled);
      })
      .catch(() => {
        // Network failure on startup — treat demo mode as off, no error shown
      });
  }, []);

  return (
    <div className="min-h-screen bg-plum-950 text-ink font-type flex flex-col">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="border-b border-plum-800 bg-plum-900/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-8 py-4 max-md:px-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              aria-label="Cursed Cassette home, go to the tape shelf"
              className="font-title text-2xl text-ink md:text-3xl"
            >
              Cursed Cassette
            </Link>
            {/* Req 12.2: show "Demo mode" text label while demo is on */}
            {demoMode && <DemoModeBadge />}
            {timeWarp && <TimeWarpBadge />}
          </div>
          <div className="flex items-center gap-2">
            <NavLinks />
            <SettingsPanel onDemoModeChange={setDemoMode} onTimeWarpChange={setTimeWarp} />
          </div>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto w-full max-w-5xl flex-1 px-8 py-8 max-md:px-4"
      >
        <Routes>
          <Route path="/" element={<PageShell><TapeShelf /></PageShell>} />
          <Route path="/record" element={<PageShell><Recorder /></PageShell>} />
          <Route path="/tape/:tapeId" element={<PageShell><JCard /></PageShell>} />
          <Route path="/play/:tapeId" element={<PageShell><CassettePlayer /></PageShell>} />
          <Route path="*" element={<PageShell><TapeShelf /></PageShell>} />
        </Routes>
      </main>
      <footer className="border-t border-plum-800 bg-plum-900/40 px-8 py-4 text-sm text-plastic-300 max-md:px-4">
        <p>
          Record what you learned. Forget it, and the tape remembers…
        </p>
      </footer>
    </div>
  );
}
