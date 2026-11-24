import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import {
  createTape,
  getSettings,
  getTape,
  updateTape,
  type TapeItemWire,
  type TapeItemWireIn,
} from "../../api/tapes";
import {
  INTERLUDE_MAX_MINUTES,
  INTERLUDE_MIN_MINUTES,
  KEY_TERMS_MAX,
  KEY_TERM_MAX_CHARS,
  TRACK_MAX_MINUTES,
  TAPE_LENGTHS,
  minTrackMinutes,
  sideCapacity,
  sideTotal,
  validateTape,
  type RuleViolation,
  type ScheduleItem,
  type SideId,
} from "../../domain/schedule";

/** A track or interlude while it is being edited, before it becomes a wire item. */
interface DraftItem {
  localId: number;
  serverId?: string;
  kind: "track" | "interlude";
  name: string;
  minutes: number;
  keyTerms: string[];
  termInput: string;
}

let nextLocalId = 1;

function makeItem(kind: "track" | "interlude", minutes: number): DraftItem {
  return {
    localId: nextLocalId++,
    kind,
    name: "",
    minutes,
    keyTerms: [],
    termInput: "",
  };
}

function toDraftItem(w: TapeItemWire): DraftItem {
  return {
    localId: nextLocalId++,
    serverId: w.id,
    kind: w.kind,
    name: w.name ?? "",
    minutes: w.minutes,
    keyTerms: w.key_terms ? [...w.key_terms] : [],
    termInput: "",
  };
}

function toScheduleItem(d: DraftItem): ScheduleItem {
  return {
    kind: d.kind,
    minutes: d.minutes,
    id: d.serverId,
    name: d.kind === "track" ? d.name : null,
    keyTerms: d.kind === "track" ? d.keyTerms : null,
  };
}

function toWireItem(d: DraftItem): TapeItemWireIn {
  if (d.kind === "interlude") {
    return { id: d.serverId ?? null, kind: "interlude", minutes: d.minutes };
  }
  return {
    id: d.serverId ?? null,
    kind: "track",
    minutes: d.minutes,
    name: d.name,
    key_terms: d.keyTerms,
  };
}

const controlClass =
  "rounded-sm border border-plastic-500/40 bg-plum-900 px-2 py-1 font-type text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-lcd-green";
const buttonClass =
  "rounded-sm border border-plastic-500/40 bg-plum-800 px-2 py-1 font-type text-sm text-plastic-300 hover:bg-plum-900 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-lcd-green disabled:opacity-40";

export default function Recorder() {
  const [searchParams] = useSearchParams();
  const tapeId = searchParams.get("tape");

  const [title, setTitle] = useState("");
  const [length, setLength] = useState<string>("C60");
  const [sideA, setSideA] = useState<DraftItem[]>([]);
  const [sideB, setSideB] = useState<DraftItem[]>([]);
  const [demoMode, setDemoMode] = useState<boolean | null>(null);
  const [addAlert, setAddAlert] = useState<{ A: string | null; B: string | null }>({
    A: null,
    B: null,
  });
  const [serverViolations, setServerViolations] = useState<RuleViolation[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [loading, setLoading] = useState(true);

  /** Minutes of the loaded (server) items, for the Demo-mode unchanged-id exemption. */
  const originalMinutes = useRef<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settings] = await Promise.all([getSettings()]);
        if (cancelled) return;
        setDemoMode(settings.demo_mode);
        if (tapeId) {
          const tape = await getTape(tapeId);
          if (cancelled) return;
          setTitle(tape.title);
          setLength(tape.length);
          setSideA(tape.side_a.map(toDraftItem));
          setSideB(tape.side_b.map(toDraftItem));
          for (const item of [...tape.side_a, ...tape.side_b]) {
            originalMinutes.current[item.id] = item.minutes;
          }
        }
      } catch (e) {
        if (!cancelled) {
          setSaveError(
            e instanceof Error ? `Could not reach the backend: ${e.message}` : "Could not reach the backend.",
          );
          setDemoMode(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tapeId]);

  const demoOn = demoMode === true;

  const sides: Record<SideId, DraftItem[]> = { A: sideA, B: sideB };
  const setSides: Record<SideId, (updater: (items: DraftItem[]) => DraftItem[]) => void> = {
    A: (u) => setSideA(u),
    B: (u) => setSideB(u),
  };

  const scheduleSides: Record<SideId, ScheduleItem[]> = {
    A: sideA.map(toScheduleItem),
    B: sideB.map(toScheduleItem),
  };

  // Tracks whose id and duration are unchanged keep a Demo-mode duration (Req 12.3).
  const unchangedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of [...sideA, ...sideB]) {
      if (item.kind !== "track" || !item.serverId) continue;
      if (originalMinutes.current[item.serverId] === item.minutes) ids.add(item.serverId);
    }
    return ids;
  }, [sideA, sideB]);

  const clientViolations = useMemo(
    () =>
      validateTape(
        {
          title,
          length,
          sideA: scheduleSides.A,
          sideB: scheduleSides.B,
        },
        demoOn,
        unchangedIds,
      ),
    // scheduleSides is derived from sideA/sideB on every render; recomputed together.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, length, sideA, sideB, demoOn, unchangedIds],
  );

  const allViolations = [...clientViolations, ...serverViolations];
  const violationsFor = (side: SideId) => allViolations.filter((v) => v.side === side);
  const generalViolations = allViolations.filter((v) => v.side === null);

  const clearAddAlert = (side: SideId) => {
    if (addAlert[side] !== null) setAddAlert({ ...addAlert, [side]: null });
  };

  /** Add a track or interlude. Rejects the item when it would not fit (Req 2.4). */
  const addItem = (side: SideId, kind: "track" | "interlude") => {
    const capacity = sideCapacity(length);
    const total = sideTotal(sides[side].map(toScheduleItem));
    const defaultMinutes = kind === "track" ? minTrackMinutes(demoOn) : 5;
    if (total + defaultMinutes > capacity) {
      setAddAlert({
        ...addAlert,
        [side]: `Side ${side} is full: only ${capacity - total} minutes remain.`,
      });
      return;
    }
    clearAddAlert(side);
    setSides[side]((items) => [...items, makeItem(kind, defaultMinutes)]);
  };

  const updateItem = (side: SideId, localId: number, patch: Partial<DraftItem>) => {
    clearAddAlert(side);
    setSides[side]((items) =>
      items.map((it) => (it.localId === localId ? { ...it, ...patch } : it)),
    );
  };

  const removeItem = (side: SideId, localId: number) => {
    clearAddAlert(side);
    setSides[side]((items) => items.filter((it) => it.localId !== localId));
  };

  const moveItem = (side: SideId, localId: number, delta: -1 | 1) => {
    clearAddAlert(side);
    setSides[side]((items) => {
      const index = items.findIndex((it) => it.localId === localId);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= items.length) return items;
      const next = [...items];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const addTerm = (side: SideId, item: DraftItem) => {
    const value = item.termInput.trim();
    if (value === "" || value.length > KEY_TERM_MAX_CHARS) return;
    updateItem(side, item.localId, { keyTerms: [...item.keyTerms, value], termInput: "" });
  };

  const removeTerm = (side: SideId, item: DraftItem, termIndex: number) => {
    updateItem(side, item.localId, {
      keyTerms: item.keyTerms.filter((_, i) => i !== termIndex),
    });
  };

  const handleSave = async () => {
    setAttemptedSave(true);
    setServerViolations([]);
    setSaveError(null);
    if (clientViolations.length > 0) {
      setSaved(false);
      return;
    }
    setSaving(true);
    try {
      const body = {
        title,
        length,
        side_a: sideA.map(toWireItem),
        side_b: sideB.map(toWireItem),
      };
      if (tapeId) {
        await updateTape(tapeId, body);
      } else {
        await createTape(body);
      }
      setSaved(true);
    } catch (e) {
      setSaved(false);
      if (e instanceof ApiError && e.status === 422) {
        setServerViolations(e.violations);
      } else if (e instanceof ApiError && e.status === 409) {
        setSaveError("A session is in progress for this tape. Stop it before editing.");
      } else if (e instanceof Error) {
        setSaveError(`Could not save the tape: ${e.message}`);
      } else {
        setSaveError("Could not save the tape.");
      }
    } finally {
      setSaving(false);
    }
  };

  const renderErrors = (violations: RuleViolation[], label: string) =>
    violations.length > 0 ? (
      <ul
        aria-label={label}
        className="mt-2 space-y-1 rounded-sm border border-label-orange/60 bg-plum-900 p-2"
      >
        {violations.map((v, i) => (
          <li key={i} className="text-sm text-label-orangeBright" role="alert">
            {v.message}
          </li>
        ))}
      </ul>
    ) : null;

  const renderItem = (side: SideId, item: DraftItem, index: number, count: number) => {
    const n = index + 1;
    const isTrack = item.kind === "track";
    const label = isTrack ? `track ${n}` : `interlude ${n}`;
    const minMinutes = isTrack ? (demoOn ? 1 : 10) : INTERLUDE_MIN_MINUTES;
    const maxMinutes = isTrack ? TRACK_MAX_MINUTES : INTERLUDE_MAX_MINUTES;
    return (
      <li
        key={item.localId}
        className="rounded-sm border border-plastic-500/30 bg-plum-900/70 p-4"
        aria-label={`${label} on side ${side}`}
      >
        <div className="flex items-center justify-between gap-2">
          <p
            className={`font-type text-sm uppercase tracking-widest ${
              isTrack ? "text-label-orangeBright" : "text-label-tealBright"
            }`}
          >
            {isTrack ? `Track ${n}` : `Interlude ${n}`}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={buttonClass}
              aria-label={`Move ${label} up on side ${side}`}
              disabled={index === 0}
              onClick={() => moveItem(side, item.localId, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className={buttonClass}
              aria-label={`Move ${label} down on side ${side}`}
              disabled={index === count - 1}
              onClick={() => moveItem(side, item.localId, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              className={buttonClass}
              aria-label={`Remove ${label} from side ${side}`}
              onClick={() => removeItem(side, item.localId)}
            >
              Remove
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="block text-xs text-plastic-300">Minutes</span>
            <input
              type="number"
              className={`${controlClass} mt-1 w-20 font-lcd text-lg`}
              aria-label={`Minutes for ${label} on side ${side}`}
              value={item.minutes}
              min={1}
              max={maxMinutes}
              onChange={(e) =>
                updateItem(side, item.localId, {
                  minutes: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                })
              }
            />
            <span className="mt-1 block text-xs text-plastic-500">
              {minMinutes}–{maxMinutes} min
            </span>
          </label>

          {isTrack && (
            <label className="block flex-1 min-w-40">
              <span className="block text-xs text-plastic-300">Topic name</span>
              <input
                type="text"
                className={`${controlClass} mt-1 w-full`}
                aria-label={`Topic name for ${label} on side ${side}`}
                value={item.name}
                maxLength={60}
                onChange={(e) => updateItem(side, item.localId, { name: e.target.value })}
              />
            </label>
          )}
        </div>

        {isTrack && (
          <div className="mt-3">
            <p className="text-xs text-plastic-300">
              Key terms{" "}
              <span className="font-lcd text-lcd-green">
                {item.keyTerms.length}/{KEY_TERMS_MAX}
              </span>
            </p>
            <ul className="mt-1 flex flex-wrap gap-1" aria-label={`Key terms for ${label}`}>
              {item.keyTerms.map((term, ti) => (
                <li
                  key={`${term}-${ti}`}
                  className="flex items-center gap-1 rounded-sm border border-label-teal/50 bg-plum-800 px-2 py-0.5 font-type text-sm text-label-tealBright"
                >
                  {term}
                  <button
                    type="button"
                    className="px-1 text-plastic-300 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-lcd-green"
                    aria-label={`Remove key term ${term} from ${label} on side ${side}`}
                    onClick={() => removeTerm(side, item, ti)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                className={`${controlClass} w-40`}
                aria-label={`New key term for ${label} on side ${side}`}
                placeholder="add a key term"
                value={item.termInput}
                maxLength={KEY_TERM_MAX_CHARS}
                onChange={(e) => updateItem(side, item.localId, { termInput: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTerm(side, item);
                  }
                }}
              />
              <button
                type="button"
                className={buttonClass}
                aria-label={`Add key term to ${label} on side ${side}`}
                onClick={() => addTerm(side, item)}
              >
                Add term
              </button>
            </div>
          </div>
        )}
      </li>
    );
  };

  const renderSide = (side: SideId) => {
    const items = sides[side];
    const capacity = sideCapacity(length);
    const total = sideTotal(items.map(toScheduleItem));
    const remaining = capacity - total;
    const usedPct = Math.min(100, Math.round((total / capacity) * 100));
    const sideLabel = side === "A" ? "Side A" : "Side B";
    return (
      <section
        aria-label={`${sideLabel} contents`}
        className="rounded-sm border border-plastic-500/30 bg-plum-900/40 p-4"
      >
        <h3
          className={`font-title text-xl ${side === "A" ? "text-label-orangeBright" : "text-label-tealBright"}`}
        >
          {sideLabel}{" "}
          <span className="font-lcd text-lcd-green">({capacity} min)</span>
        </h3>

        <div className="mt-2">
          <p
            className="font-lcd text-lcd-green"
            aria-label={`Minutes remaining on side ${side}`}
          >
            {remaining >= 0 ? `${remaining} min left` : `${-remaining} min over capacity`}
          </p>
          <div
            className="mt-1 h-2 w-full rounded-sm bg-plum-800"
            role="progressbar"
            aria-label={`Tape remaining bar for side ${side}`}
            aria-valuemin={0}
            aria-valuemax={capacity}
            aria-valuenow={Math.max(0, remaining)}
          >
            <div
              className={`h-2 rounded-sm ${remaining < 0 ? "bg-danger" : "bg-label-teal"}`}
              style={{ width: `${remaining < 0 ? 100 : usedPct}%` }}
            />
          </div>
        </div>

        {addAlert[side] !== null && (
          <p role="alert" className="mt-2 font-type text-sm text-label-orangeBright">
            {addAlert[side]}
          </p>
        )}

        <ul className="mt-4 space-y-4">
          {items.map((item, index) => renderItem(side, item, index, items.length))}
        </ul>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className={buttonClass}
            aria-label={`Add a track to side ${side}`}
            onClick={() => addItem(side, "track")}
          >
            + Track
          </button>
          <button
            type="button"
            className={buttonClass}
            aria-label={`Add an interlude to side ${side}`}
            onClick={() => addItem(side, "interlude")}
          >
            + Interlude
          </button>
        </div>

        {renderErrors(violationsFor(side), `Rule errors on side ${side}`)}
      </section>
    );
  };

  if (loading) {
    return (
      <section aria-labelledby="recorder-heading">
        <h2 id="recorder-heading" className="font-title text-3xl text-label-tealBright">
          Record a Tape
        </h2>
        <p role="status" className="mt-4 font-lcd text-lcd-green">
          Loading…
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="recorder-heading">
      <h2 id="recorder-heading" className="font-title text-3xl text-label-tealBright">
        Record a Tape
      </h2>
      <p className="mt-2 max-w-prose text-plastic-300">
        Lay down tracks (study topics with key terms) and interludes (breaks) on
        Side A and Side B. The tape remembers what you learn — and what you skip.
      </p>

      {demoOn && (
        <p
          role="status"
          className="mt-2 inline-block rounded-sm border border-label-teal/60 bg-plum-900 px-2 py-1 font-type text-sm text-label-tealBright"
        >
          Demo mode — tracks may be as short as 1 minute
        </p>
      )}

      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <div className="flex flex-wrap gap-4">
          <label className="block">
            <span className="block text-xs text-plastic-300">Tape title</span>
            <input
              type="text"
              className={`${controlClass} mt-1 w-64`}
              aria-label="Tape title"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cell Biology Midterm"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-plastic-300">Tape length</span>
            <select
              className={`${controlClass} mt-1 font-lcd text-lg`}
              aria-label="Tape length"
              value={length}
              onChange={(e) => setLength(e.target.value)}
            >
              {TAPE_LENGTHS.map((l) => (
                <option key={l} value={l}>
                  {l} ({sideCapacity(l)} min per side)
                </option>
              ))}
            </select>
          </label>
        </div>

        {renderErrors(generalViolations, "General rule errors")}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderSide("A")}
          {renderSide("B")}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="rounded-sm bg-label-orange px-6 py-3 font-type text-lg text-plum-950 hover:bg-label-orangeBright focus-visible:outline focus-visible:outline-2 focus-visible:outline-lcd-green disabled:opacity-40"
            aria-label="Save tape"
            disabled={saving}
          >
            {tapeId ? "Update tape" : "Save tape"}
          </button>
          <Link
            to="/"
            aria-label="Back to the tape shelf"
            className="font-type text-sm text-plastic-300 underline hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-lcd-green"
          >
            Back to the shelf
          </Link>
        </div>

        {saved && (
          <p role="status" className="font-lcd text-lcd-green">
            Tape saved. It sits on the shelf, waiting…
          </p>
        )}
        {attemptedSave && clientViolations.length > 0 && (
          <p role="alert" className="font-type text-sm text-label-orangeBright">
            The tape has rule violations. Fix the highlighted errors and save again.
          </p>
        )}
        {saveError && (
          <p role="alert" className="font-type text-sm text-label-orangeBright">
            {saveError}
          </p>
        )}
      </form>
    </section>
  );
}
