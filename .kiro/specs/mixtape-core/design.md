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
  client_event_id: UUID (unique per session; duplicates are ignored)
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
    "skip_interlude": -12,
    "skip_track": -4,
    "abandon": -20,          # stop with > 50% planned time remaining (Glossary: abandoned)
    "complete_interlude": +5,
    "clean_side": +10,       # side completed with no skips
}
def apply(health: int, event: HealthEvent) -> int      # clamps to [0, 100] per event
def apply_all(health: int, events: Sequence[HealthEvent]) -> int  # in order, clamp each
def condition(health: int) -> Condition                 # Mint/Worn/Warped/Haunted/Dead
```
A stop with ≤ 50% of planned time remaining has no delta. The same table is mirrored in
`frontend/src/domain/health.ts` for instant UI prediction.

### `planner/`
```python
class PlannerProvider(Protocol):
    def plan(self, tasks: list[TaskIn], length: TapeLength, style: FocusStyle) -> PlanOut: ...
```
`FocusStyle` presets: `pomodoro = (track 25, interlude 5)` (default), `deep_work = (track 50,
interlude 10)`.
- `rule_based.py` (default):
  1. `effective_track = min(style.track, side_capacity(length))` (Deep work on C60 → 30).
  2. Round each task estimate up to at least 10 minutes.
  3. Split a task longer than `effective_track` into `n = ceil(minutes / effective_track)`
     parts of near-equal length (sizes differ by at most 1). Every part is then between
     10 and `effective_track`, and parts sum to the estimate. Parts are named
     `"<task> (part N)"`.
  4. Process tasks in input order. Try to place all of a task's parts (each followed by an
     interlude of `style.interlude`, never between tracks of different sides, never
     splitting a track across sides) on Side A then Side B. If the whole task does not fit,
     discard the attempt, add it to `left_out`, and continue with the next task. Parts of one
     task may span the A/B boundary.
  5. Drop a trailing interlude on a side when it does not fit.
  Placement is atomic per task, so a left-out task never leaves partial tracks.
- `llm.py` (**Optional** scope; the `PlannerProvider` interface stays in the MVP so it can
  be added later; enabled when `PLANNER_PROVIDER=llm` and an API key is set): asks the
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
| POST | `/api/planner` | `{tasks, length, style?}` → `{plan, left_out}` (not saved; `style` defaults to `pomodoro`) |
| POST | `/api/tapes/{id}/sessions` | Start a session (409 if tape is Dead) |
| POST | `/api/sessions/{id}/events` | `{event_id, type, item_id}` → `{health, condition}`; idempotent on `event_id` |
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
- `JCard/`: fold-out liner notes with stats; the health history sparkline is Optional.

### `useTapePlayer` hook
State machine: `idle → playing ⇄ paused → flipping → playing → finished | stopped`.
Countdown = `itemEndsAt - Date.now()`, recalculated with `requestAnimationFrame`, and
persisted to `localStorage` so a reload resumes correctly.

### Audio engine (`src/audio/`)
- One `AudioContext` created on first PLAY.
- Numeric parameters: master volume 0–1 (default 0.5); mute forces gain 0; interlude fade
  uses a linear ramp of exactly 2 s out and 2 s in; sound-bed gain never exceeds volume.
  `fadeGain` (frontend `domain/effects.ts`) is pure so it can be property-tested.
- Effect amounts come from `effectsFor` (table below).
- Sound beds: brown noise (filtered white noise buffer), rain (noise + random droplet
  envelopes), lo-fi loop (simple oscillators + low-pass + vinyl crackle).
- Condition effects chain: `bed → wobble (LFO on playbackRate/detune) → hiss (noise
  gain) → bitcrush-ish waveshaper → master gain`. Effect amounts are a function of
  condition. Ghost whispers in Haunted (Optional): band-passed noise bursts with a slow envelope.

### `frontend/src/domain/effects.ts` (frontend only, no backend counterpart)
`effectsFor(health: number, reducedMotion: boolean): EffectSettings` is a pure function of
health (through `condition`). Numeric thresholds (Requirements 6 and 7):

| Condition | Hiss gain | Reel wobble (± % speed) | Pitch wobble (± cents) | Colour bleed (px) | Flicker (Hz) | Ghost whispers (Optional) |
|---|---|---|---|---|---|---|
| Mint (80–100) | 0 | 0 | 0 | 0 | 0 | off |
| Worn (50–79) | 0.02 | 2 | 0 | 0 | 0 | off |
| Warped (20–49) | 0.05 | 6 | 25 | 2 | 4 | off |
| Haunted (1–19) | 0.10 | 12 | 60 | 4 | 8 | one burst every 20–45 s, 1.5–3 s long, gain 0.08 |
| Dead (0) | not playable | | | | | |

With `reducedMotion` true: reel wobble, reel spin and flicker are 0; colour bleed and
shadow figures stay as static cues; audio effects (hiss, pitch wobble, whispers) are
unchanged. Intensity values never decrease as health decreases. Condition text is always
rendered.

`fadeGain(t, start, end, duration)` is a pure function in the same module (monotonic,
bounded by start and end) used by the audio engine for the 2 s interlude fade.

### `frontend/src/domain/eventQueue.ts` (frontend only, Optional)
Pure queue logic for the full offline mode: `enqueue(queue, event)`,
`nextRetryDelay(attempt) = min(1 * 2**attempt, 30)` seconds, `ack(queue, eventId)` and
`predictHealth(base, queue)`. The MVP uses only a simple retry (see Error handling).

### Visual theme
Dark plum/black background, cassette in off-white plastic with orange and teal labels, LCD
green digits. Effects by condition: Worn = subtle grain; Warped = chromatic aberration +
flicker; Haunted = vignette, shadow silhouettes in the cassette window. All effects gated by
`useReducedMotion`.

## Error handling
- Network failure during play, MVP: the timer and audio never stop. Each event carries a
  `client_event_id` and is retried a few times at a fixed interval (for example every 5 s,
  in order) while the session is open. The backend ignores duplicate IDs, so retries are
  safe. When a response arrives the frontend shows the API health.
- Network failure, Optional (full Requirement 9): the queue is persisted in `localStorage`,
  delivered in order with exponential backoff (1 s doubling to 30 s), predicted health is
  labelled "unsynced", a 4xx drops the event, and the queue resumes on the next page load.
- Planner LLM failure (Optional feature): silent fallback to rule-based, with a small
  "DJ improvised" note.

## Testing strategy
- **Property-based (Hypothesis, backend)**
  - Any plan from the rule-based planner passes `validate_tape`.
  - The planner preserves task order, every track ≤ `min(style.track, side_capacity)` and
    ≥ 10, parts of a task sum to `max(estimate, 10)`, included + left-out names equal the
    input, and a left-out task would not have fitted when it was tried.
  - `apply_all` always returns a value in [0, 100] for any sequence of events.
  - `condition` is monotonic: higher health never gives a worse condition.
  - Event application is idempotent per `client_event_id`; any duplicate/failure pattern
    gives the same final health as applying each event once in order.
- **Property-based (fast-check, frontend)**
  - Frontend `health.ts` matches the same deltas and clamping for random event sequences.
  - `effects.ts`: `effectsFor` intensity never increases with health; reduced motion zeroes
    wobble and flicker; `fadeGain` is monotonic and bounded; gain is 0 when muted.
  - Optional: `eventQueue.ts` delivery order equals occurrence order, retry delay is in
    [1, 30] s and non-decreasing, queue empties after all acks.
  - Countdown never goes negative and reaches zero exactly at `itemEndsAt`.
- **Unit/API (pytest)**: each endpoint, listener scoping, 400/409/422 paths.
- **Component (Vitest + RTL)**: keyboard controls, reduced-motion fallbacks, Recorder
  capacity errors.
