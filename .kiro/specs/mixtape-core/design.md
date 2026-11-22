# Design Document

## Overview

A React single-page app talks to a FastAPI backend over JSON. All business rules (side
capacity, adjacency, planning, health) live in pure domain modules so they can be
property-tested. The frontend runs the timer and audio locally; it reports events
(complete, skip, stop) to the backend, which updates health and returns the new value.

```
Browser (React)                                  Backend (FastAPI)
┌──────────────────────────────┐                 ┌────────────────────────────┐
│ Recorder ─┐                  │  REST + JSON    │ api/tapes.py               │
│ Player ───┼─ api client ─────┼────────────────▶│ api/sessions.py            │
│ Shelf ────┘                  │  X-Listener-Id  │ api/planner.py             │
│ useTapePlayer (timestamps)   │                 │   │                        │
│ audio engine (Web Audio)     │                 │ domain/ health, schedule   │
│ domain/ health prediction    │                 │ planner/ rule_based, llm   │
└──────────────────────────────┘                 │ SQLite (SQLModel)          │
                                                 └────────────────────────────┘
```

## Data model (SQLModel)

```text
Tape
  id: UUID (pk)
  listener_id: UUID (indexed)
  title: str (1–60)
  length: Literal["C60", "C90", "C120"]
  health: int (0–100, default 100)
  created_at: datetime

TapeItem
  id: UUID (pk)
  tape_id: UUID (fk Tape, cascade delete)
  side: Literal["A", "B"]
  position: int (0-based order within side)
  kind: Literal["track", "interlude"]
  name: str | None (required for track)
  minutes: int

Session
  id: UUID (pk)
  tape_id: UUID (fk Tape, cascade delete)
  started_at: datetime
  ended_at: datetime | None
  health_before: int
  health_after: int | None

SessionEvent
  id: UUID (pk)
  session_id: UUID (fk Session)
  item_id: UUID (fk TapeItem) | None
  type: Literal["complete", "skip", "side_complete", "stop"]
  at: datetime
  health_delta: int
```

Side capacity in minutes: `C60 → 30`, `C90 → 45`, `C120 → 60`.

## Domain modules

### `domain/schedule.py`
- `side_capacity(length) -> int`
- `validate_side(items) -> list[RuleViolation]`: total ≤ capacity, no adjacent tracks,
  durations in range, track names present.
- `validate_tape(tape) -> list[RuleViolation]`

### `domain/health.py`
```python
DELTAS = {
    "skip_interlude": -15,
    "skip_track": -5,
    "abandon": -20,          # stop with > 50% planned time remaining
    "complete_interlude": +5,
    "clean_side": +10,       # side completed with no skips
}
def apply(health: int, event: HealthEvent) -> int      # clamps to [0, 100]
def condition(health: int) -> Condition                 # Mint/Worn/Warped/Haunted/Dead
```
The same table is mirrored in `frontend/src/domain/health.ts` for instant UI prediction.

### `planner/`
```python
class PlannerProvider(Protocol):
    def plan(self, tasks: list[TaskIn], length: TapeLength) -> PlanOut: ...
```
- `rule_based.py` (default): split each task into tracks of at most 25 minutes
  (minimum 10; remainders under 10 merge into the previous part), insert a 5-minute
  interlude after each track, fill Side A then Side B, never split a track across sides,
  drop the trailing interlude on a side when it doesn't fit, and report tasks that don't fit.
- `llm.py` (optional, enabled when `PLANNER_PROVIDER=llm` and an API key is set): asks the
  model for a JSON plan, then validates it with `validate_tape`. Any error or invalid
  plan falls back to the rule-based planner.

## API

All endpoints require `X-Listener-Id` (UUID v4) and return 400 if it is missing/invalid.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/tapes` | List the listener's tapes (shelf) |
| POST | `/api/tapes` | Create a tape with items; validated; health = 100 |
| GET | `/api/tapes/{id}` | Tape with items and liner notes stats |
| PUT | `/api/tapes/{id}` | Replace title/items (only if no session is in progress) |
| DELETE | `/api/tapes/{id}` | Delete tape and its sessions |
| POST | `/api/planner` | `{tasks, length}` → `{plan, left_out}` (not saved) |
| POST | `/api/tapes/{id}/sessions` | Start a session (409 if tape is Dead) |
| POST | `/api/sessions/{id}/events` | `{type, item_id}` → `{health, condition}` |
| POST | `/api/sessions/{id}/stop` | End session; applies abandon rule; returns summary |

Validation errors return 422 with a list of `{rule, side, message}` so the Recorder can
show them inline.

## Frontend

### Components
- `Recorder/`: two side columns with drag-to-reorder items, live "tape remaining" bars,
  "Ask the Mixtape DJ" panel (task list input → editable plan).
- `CassettePlayer/`: SVG cassette with spinning reels (speed and wobble driven by
  condition), LCD-style countdown, chunky PLAY/PAUSE/STOP/REW/FF buttons, side indicator,
  flip animation.
- `TapeShelf/`: grid of cassette spines; Dead tapes render as translucent ghosts.
- `JCard/`: fold-out liner notes with stats and a health history sparkline.

### `useTapePlayer` hook
State machine: `idle → playing ⇄ paused → flipping → playing → finished | stopped`.
Countdown = `itemEndsAt - Date.now()`, recalculated with `requestAnimationFrame`, and
persisted to `localStorage` so a reload resumes correctly.

### Audio engine (`src/audio/`)
- One `AudioContext` created on first PLAY.
- Sound beds: brown noise (filtered white noise buffer), rain (noise + random droplet
  envelopes), lo-fi loop (simple oscillators + low-pass + vinyl crackle).
- Condition effects chain: `bed → wobble (LFO on playbackRate/detune) → hiss (noise
  gain) → bitcrush-ish waveshaper → master gain`. Effect amounts are a function of
  condition. Ghost whispers in Haunted: band-passed noise bursts with a slow envelope.

### Visual theme
Dark plum/black background, cassette in off-white plastic with orange and teal labels, LCD
green digits. Effects by condition: Worn = subtle grain; Warped = chromatic aberration +
flicker; Haunted = vignette, shadow silhouettes in the cassette window. All effects gated by
`useReducedMotion`.

## Error handling
- Network failure during play: queue events in memory and retry; the timer never stops
  because of the network.
- Planner LLM failure: silent fallback to rule-based, with a small "DJ improvised" note.

## Testing strategy
- **Property-based (Hypothesis, backend)**
  - Any plan from the rule-based planner passes `validate_tape`.
  - The planner preserves task order and never schedules more focus minutes than requested.
  - `apply` always returns a value in [0, 100] for any sequence of events.
  - `condition` is monotonic: higher health never gives a worse condition.
- **Property-based (fast-check, frontend)**
  - Frontend `health.ts` matches the same deltas and clamping for random event sequences.
  - Countdown never goes negative and reaches zero exactly at `itemEndsAt`.
- **Unit/API (pytest)**: each endpoint, listener scoping, 400/409/422 paths.
- **Component (Vitest + RTL)**: keyboard controls, reduced-motion fallbacks, Recorder
  capacity errors.
