import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { getTape, type TapeItemWire, type TapeWire } from "../../api/tapes";
import { FOCUS_SOUNDS, type FocusSound } from "../../audio/focusAudio";
import { useFocusSession } from "../../hooks/useFocusSession";
import { useGlitchTracks } from "../../hooks/useGlitchTracks";
import BreakSkipToast from "../BreakSkipToast";
import ConditionText from "../ConditionText";
import GlitchSegment from "../GlitchSegment";
import RecPrompt from "../RecPrompt";

type LoadState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ready"; tape: TapeWire };

const SOUND_LABELS: Record<FocusSound, string> = {
  brown: "Brown noise",
  rain: "Rain",
  lofi: "Lo-fi",
};

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** True when a key press belongs to a text field or another control, not the player. */
function ignoreKey(target: EventTarget | null, key: string): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.closest('[contenteditable]:not([contenteditable="false"])')) return true;
  // The recall panel owns its own keys (typing, Escape).
  if (target.closest("[data-recall-root]")) return true;
  // Buttons and links already activate on Space.
  if (key === " " && (tag === "BUTTON" || tag === "A")) return true;
  return false;
}

export default function CassettePlayer() {
  const { tapeId } = useParams<{ tapeId: string }>();
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!tapeId) {
      setLoad({ kind: "notfound" });
      return;
    }
    let cancelled = false;
    setLoad({ kind: "loading" });
    getTape(tapeId).then(
      (tape) => {
        if (!cancelled) setLoad({ kind: "ready", tape });
      },
      (e: unknown) => {
        if (cancelled) return;
        setLoad({ kind: e instanceof ApiError && e.status === 404 ? "notfound" : "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tapeId, attempt]);

  // Silent refresh after a recall so condition text follows the new strength.
  const refresh = useCallback(() => {
    if (!tapeId) return;
    getTape(tapeId).then(
      (tape) => setLoad((cur) => (cur.kind === "ready" ? { kind: "ready", tape } : cur)),
      () => {},
    );
  }, [tapeId]);

  if (load.kind === "loading") {
    return (
      <PageShell>
        <p role="status" className="font-type text-plastic-300">
          Rewinding the tape…
        </p>
      </PageShell>
    );
  }
  if (load.kind === "notfound") {
    return (
      <PageShell>
      <div role="alert" className="font-type text-ink">
        <p>Tape not found.</p>
        <Link
          to="/"
          aria-label="Back to the tape shelf"
          className="mt-3 inline-block underline focus:outline-none focus-visible:ring-2 focus-visible:ring-lcd-green"
        >
          Back to the shelf
        </Link>
      </div>
      </PageShell>
    );
  }
  if (load.kind === "error") {
    return (
      <PageShell>
      <div role="alert" className="font-type text-ink">
        <p>Could not load this tape. Check your connection.</p>
        <button
          type="button"
          aria-label="Retry loading the tape"
          onClick={() => setAttempt((n) => n + 1)}
          className="mt-3 min-h-12 rounded-sm border border-plastic-500 px-4 py-2 hover:bg-plum-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-lcd-green"
        >
          Retry
        </button>
      </div>
      </PageShell>
    );
  }
  return <Player tape={load.tape} onRecalled={refresh} />;
}

/** Page heading shared by every state, so the route always has an h2. */
function PageHeading() {
  return (
    <h2 id="player-heading" className="font-title text-3xl text-label-orangeBright">
      Cassette Player
    </h2>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="player-heading" className="mx-auto max-w-3xl">
      <PageHeading />
      <div className="mt-4">{children}</div>
    </section>
  );
}

function itemLabel(item: TapeItemWire): string {
  return item.kind === "track" ? (item.name ?? "Untitled track") : "Interlude";
}

function Player({ tape, onRecalled }: { tape: TapeWire; onRecalled: () => void }) {
  const player = useFocusSession(tape);
  const reduced = useReducedMotion() ?? false;
  const [recRequest, setRecRequest] = useState(0);
  const userMuted = useRef(player.audio.muted);

  const allItems = [...tape.side_a, ...tape.side_b];
  const current = player.item ? allItems.find((i) => i.id === player.item?.id) : undefined;
  const playing = player.status === "playing";
  const flipping = player.status === "flipping";
  const ended = player.status === "finished" || player.status === "stopped";
  const canRec = player.recPromptTrackId !== null;

  const openRec = useCallback(() => setRecRequest((n) => n + 1), []);

  // Keyboard shortcuts read the latest player through a ref (it changes every frame).
  const latest = useRef({ player, canRec, openRec });
  latest.current = { player, canRec, openRec };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key === "Spacebar" ? " " : e.key;
      if (ignoreKey(e.target, key)) return;
      const { player: p, canRec: rec, openRec: open } = latest.current;
      switch (key) {
        case " ":
          e.preventDefault(); // no page scroll
          if (!e.repeat) p.toggle();
          break;
        case "ArrowLeft":
          p.rew();
          break;
        case "ArrowRight":
          p.ff();
          break;
        case "Escape":
          p.stop();
          break;
        case "r":
        case "R":
          if (rec) open();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const trackIds = allItems.filter((i) => i.kind === "track").map((i) => i.id);
  const completed = trackIds.filter((id) => player.state.outcomes[id] === "completed").length;
  const skipped = trackIds.filter((id) => player.state.outcomes[id] === "skipped").length;

  const lcdName = flipping
    ? "FLIP TAPE"
    : player.status === "finished"
      ? "TAPE END"
      : current
        ? current.kind === "track"
          ? (current.name ?? "Untitled track")
          : "INTERLUDE"
        : "—";

  const btnBase =
    "flex min-h-12 min-w-12 items-center justify-center rounded-sm border border-plastic-500 px-3 py-2 font-type focus:outline-none focus-visible:ring-2 focus-visible:ring-lcd-green disabled:cursor-not-allowed disabled:opacity-40";
  const btn = `${btnBase} bg-plum-900 text-ink hover:bg-plum-800`;
  const btnPrimary = `${btnBase} bg-label-orange text-plum-950 hover:bg-label-orangeBright`;

  return (
    <section aria-labelledby="player-heading" className="mx-auto max-w-3xl">
      <PageHeading />
      <h3 className="mt-2 font-type text-2xl text-label-orangeBright">{tape.title}</h3>

      <Cassette
        title={tape.title}
        side={player.side}
        spinning={playing && !reduced}
      />

      <div
        className="mt-4 rounded-sm border border-plastic-500/30 bg-plum-900 p-4"
        data-testid="lcd"
      >
        <div className="flex items-baseline justify-between gap-4 font-lcd text-lcd-green">
          <p
            className="text-5xl"
            role="timer"
            aria-label="Time remaining in this item"
            data-testid="lcd-time"
          >
            {formatClock(player.remainingMs)}
          </p>
          <p className="text-2xl" data-testid="lcd-side">
            SIDE {player.side}
          </p>
        </div>
        <p className="mt-1 truncate font-lcd text-2xl text-lcd-green" data-testid="lcd-item">
          {lcdName}
        </p>
      </div>

      {flipping && <FlipPrompt reduced={reduced} />}

      <div data-recall-root>
        <RecPrompt
          tape={tape}
          trackId={player.recPromptTrackId}
          openRequest={recRequest}
          onResult={onRecalled}
          onRecordingChange={(r) => player.audio.mute(r || userMuted.current)}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3" role="group" aria-label="Transport controls">
        <button
          type="button"
          aria-label="Rewind"
          onClick={player.rew}
          className={btn}
        >
          ⏪ REW
        </button>
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          aria-pressed={playing}
          onClick={() => (playing ? player.pause() : player.play())}
          className={btnPrimary}
        >
          {playing ? "⏸ PAUSE" : "▶ PLAY"}
        </button>
        <button type="button" aria-label="Stop" onClick={player.stop} className={btn}>
          ⏹ STOP
        </button>
        <button type="button" aria-label="Fast forward" onClick={player.ff} className={btn}>
          FF ⏩
        </button>
        <button
          type="button"
          aria-label="Record a recall of the track that just ended"
          disabled={!canRec}
          onClick={openRec}
          className={`${btn} border-2 border-danger`}
        >
          ● REC
        </button>
      </div>
      <p className="mt-2 text-xs text-plastic-300">
        Keys: Space play/pause, ← rewind, → fast forward, Esc stop, R record a recall.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4 font-type text-ink">
        <label className="flex items-center gap-2">
          Focus sound
          <select
            aria-label="Focus sound"
            value={player.audio.sound}
            onChange={(e) => player.audio.setSound(e.target.value as FocusSound)}
            className="min-h-12 rounded-sm border border-plastic-500 bg-plum-950 px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-lcd-green"
          >
            {FOCUS_SOUNDS.map((s) => (
              <option key={s} value={s}>
                {SOUND_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Volume
          <input
            type="range"
            aria-label="Volume"
            min={0}
            max={100}
            value={player.audio.volume}
            onChange={(e) => player.audio.setVolume(Number(e.target.value))}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-lcd-green"
          />
        </label>
        <button
          type="button"
          aria-label={player.audio.muted ? "Unmute focus sound" : "Mute focus sound"}
          aria-pressed={player.audio.muted}
          onClick={() => {
            userMuted.current = !player.audio.muted;
            player.audio.mute(userMuted.current);
          }}
          className={btn}
        >
          {player.audio.muted ? "🔇 Muted" : "🔈 Sound on"}
        </button>
      </div>

      <BreakSkipToast penalty={player.lastPenalty} />

      <TapeMap tape={tape} player={player} />

      {ended && (
        <div role="status" aria-label="Session summary" className="mt-6 rounded-sm border border-plastic-500/30 bg-plum-900 p-4 font-type text-ink">
          <p>
            {player.status === "finished" ? "Tape finished." : "Tape stopped."} Tracks completed:{" "}
            <span className="font-lcd text-xl text-lcd-green">{completed}</span>, skipped:{" "}
            <span className="font-lcd text-xl text-lcd-green">{skipped}</span>.
          </p>
          <Link
            to={`/tape/${tape.id}`}
            aria-label="Back to the J-card"
            className="mt-3 inline-block underline focus:outline-none focus-visible:ring-2 focus-visible:ring-lcd-green"
          >
            Back to the J-card
          </Link>
        </div>
      )}
    </section>
  );
}

function FlipPrompt({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      role="status"
      aria-label="Flip the tape"
      data-testid="flip-prompt"
      className="mt-4 rounded-sm border-2 border-label-tealBright bg-plum-900 p-4 text-center"
      initial={reduced ? false : { rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
    >
      <p className="font-type text-2xl text-label-tealBright">Flip the tape</p>
      <p className="mt-1 font-type text-ink">Side A is done. Press PLAY to start Side B.</p>
    </motion.div>
  );
}

function Reel({ cx, spinning }: { cx: number; spinning: boolean }) {
  return (
    <motion.g
      data-testid="reel"
      data-spinning={spinning}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
      animate={{ rotate: spinning ? 360 : 0 }}
      transition={spinning ? { repeat: Infinity, duration: 2, ease: "linear" } : { duration: 0 }}
    >
      <circle cx={cx} cy={78} r={22} className="fill-plum-950" />
      <circle cx={cx} cy={78} r={8} className="fill-plastic-300" />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <rect
          key={deg}
          x={cx - 1.5}
          y={58}
          width={3}
          height={10}
          className="fill-plastic-300"
          transform={`rotate(${deg} ${cx} 78)`}
        />
      ))}
    </motion.g>
  );
}

function Cassette({
  title,
  side,
  spinning,
}: {
  title: string;
  side: "A" | "B";
  spinning: boolean;
}) {
  const sideFill = side === "A" ? "fill-label-orange" : "fill-label-teal";
  return (
    <svg
      viewBox="0 0 320 180"
      role="img"
      aria-label={`Cassette, side ${side}`}
      className="mt-4 w-full max-w-md"
    >
      <rect x={4} y={4} width={312} height={172} rx={10} className="fill-plastic-100 stroke-plastic-300" strokeWidth={2} />
      <rect x={24} y={16} width={272} height={60} rx={4} className={sideFill} />
      <rect x={24} y={16} width={272} height={60} rx={4} className="fill-plastic-100" opacity={0.35} />
      <text x={34} y={40} className="fill-plum-950 font-type" fontSize={16}>
        {title.length > 28 ? `${title.slice(0, 27)}…` : title}
      </text>
      <text x={34} y={64} className="fill-plum-950 font-type" fontSize={14}>
        SIDE {side}
      </text>
      <rect x={60} y={96} width={200} height={62} rx={31} className="fill-plum-900" />
      <Reel cx={105} spinning={spinning} />
      <Reel cx={215} spinning={spinning} />
    </svg>
  );
}

function TapeMap({ tape, player }: { tape: TapeWire; player: ReturnType<typeof useFocusSession> }) {
  const currentId =
    player.status === "idle" || player.status === "finished" || player.status === "stopped"
      ? null
      : (player.item?.id ?? null);
  const glitching = useGlitchTracks(player.lastPenalty);
  const sides: Array<{ name: "A" | "B"; items: TapeItemWire[] }> = [
    { name: "A", items: [...tape.side_a].sort((a, b) => a.position - b.position) },
    { name: "B", items: [...tape.side_b].sort((a, b) => a.position - b.position) },
  ];
  return (
    <div className="mt-6" aria-label="Tape map" role="group">
      {sides.map(
        (side) =>
          side.items.length > 0 && (
            <div key={side.name} className="mt-3">
              <p className="font-type text-sm text-plastic-300">Side {side.name}</p>
              <ul className="mt-1 flex gap-1 overflow-x-auto">
                {side.items.map((item) => {
                  const done = player.state.outcomes[item.id] !== undefined;
                  const isCurrent = item.id === currentId;
                  const condition = item.memory?.condition ?? null;
                  return (
                    <li
                      key={item.id}
                      data-testid="map-segment"
                      data-item-id={item.id}
                      data-track-id={item.kind === "track" ? item.id : undefined}
                      data-current={isCurrent}
                      data-done={done}
                      aria-current={isCurrent ? "step" : undefined}
                      style={{ flexGrow: item.minutes, flexBasis: 0 }}
                      className={`min-w-[5.5rem] rounded-sm border p-2 font-type text-xs text-ink ${
                        item.kind === "track" ? "bg-plum-900" : "bg-plum-950"
                      } ${isCurrent ? "border-lcd-green ring-2 ring-lcd-green" : "border-plastic-500/40"} ${
                        done ? "opacity-50" : ""
                      }`}
                    >
                      <GlitchSegment glitching={item.kind === "track" && glitching.has(item.id)}>
                        <p className="truncate">{itemLabel(item)}</p>
                        <p className="font-lcd text-base text-plastic-300">{item.minutes} min</p>
                        {item.kind === "track" &&
                          (condition ? (
                            <ConditionText condition={condition} className="text-xs" />
                          ) : (
                            <span className="text-plastic-300">No recording yet</span>
                          ))}
                        {done && (
                          <p className="text-plastic-300">
                            {player.state.outcomes[item.id] === "completed" ? "Done" : "Skipped"}
                          </p>
                        )}
                      </GlitchSegment>
                    </li>
                  );
                })}
              </ul>
            </div>
          ),
      )}
    </div>
  );
}
