# Design Document

## Overview

A React single-page app talks to a FastAPI backend over JSON. All business rules (side
capacity, adjacency, recall scoring, memory decay, stability updates, virtual time) live in
pure domain modules so they can be property-tested. The frontend runs the focus timer, the
recording and the audio locally. It reports session events and recalls to the backend, which
is the source of truth for scores, stability and strength.

The user's voice never leaves the browser: audio is stored in IndexedDB. Only the recall
text is sent to the backend, which scores it and does not store it.

```
Browser (React)                                  Backend (FastAPI)
┌───────────────────────────────┐                ┌────────────────────────────┐
│ Recorder ─┐                   │  REST + JSON   │ api/tapes.py               │
│ Player ───┤                   │───────────────▶│ api/sessions.py            │
│ RecallPanel ─ api client ─────┤  X-Listener-Id │ api/recalls.py             │
│ Shelf / JCard ┘               │                │ api/settings.py            │
│ useTapePlayer (timestamps)    │                │   │                        │
│ useRecall (MediaRecorder,     │                │ domain/ schedule, strength,│
│   Web Speech, typing)         │                │   recall, clock, sample    │
│ audio/ engine, recordingStore │                │ SQLite (SQLModel)          │
│   (IndexedDB), decayedPlayback│                └────────────────────────────┘
│ domain/ strength, clock,      │
│   effects (mirrors)           │
└───────────────────────────────┘
```

## Data model (SQLModel)

```text
Listener
  listener_id: UUID (pk)
  demo_mode: bool (default false)
  time_scale: int (1 or 1440, default 1)
  clock_anchor_real: datetime
  clock_anchor_virtual: datetime

Tape
  id: UUID (pk)
  listener_id: UUID (indexed)
  title: str (1–60)
  length: Literal["C60", "C90", "C120"]
  created_at: datetime
  is_sample: bool (default false)

TapeItem
  id: UUID (pk)
  tape_id: UUID (fk Tape, cascade delete)
  side: Literal["A", "B"]
  position: int (0-based order within side)
  kind: Literal["track", "interlude"]
  name: str | None (topic; required for track)
  minutes: int
  key_terms: list[str] | None (JSON; 3–5 terms for a track)
  base_strength: int | None (0–100; None = unrecorded)
  stability_days: float (default 1.0; tracks only)
  last_reviewed_at: datetime | None (virtual time)
  review_count: int (default 0)

Recall
  id: UUID (pk)
  track_id: UUID (fk TapeItem, cascade delete)
  client_event_id: UUID (unique per track; duplicates are ignored)
  at: datetime (virtual time)
  source: Literal["speech", "typed"]
  score: float (0–1)
  matched_terms: list[str]
  missed_terms: list[str]
  strength_before: int | None
  strength_after: int
  stability_before: float
  stability_after: float
  (the recall text is NOT stored)

Session
  id: UUID (pk)
  tape_id: UUID (fk Tape, cascade delete)
  started_at: datetime (real time)
  ended_at: datetime | None
  abandoned: bool (default false; set by the stop endpoint)
  stop_penalty: list[{track_id, stability_before, stability_after}] (saved by the stop endpoint)

SessionEvent
  id: UUID (pk)
  session_id: UUID (fk Session, cascade delete)
  item_id: UUID (fk TapeItem) | None
  client_event_id: UUID (unique per session; duplicates are ignored)
  type: Literal["complete", "skip"]
  at: datetime (real time)
  penalty: list[{track_id, stability_before, stability_after}]
```

Side capacity in minutes: `C60 → 30`, `C90 → 45`, `C120 → 60`. Memory timestamps use virtual
time. Session timestamps use real time.

## Domain modules (backend, pure, no I/O)

### `domain/schedule.py`
- `side_capacity(length) -> int`
- `min_track_minutes(demo_mode) -> int` (10, or 1 in Demo mode)
- `validate_side(items, demo_mode, unchanged_ids=frozenset()) -> list[RuleViolation]`:
  total ≤ capacity, no adjacent tracks, durations in range, track names present, 3–5 unique
  (ignoring case) key terms of 1–40 characters. A track in `unchanged_ids` (same id and same
  minutes as the saved tape) is exempt from the 10-minute minimum, so a tape saved in Demo
  mode can still be edited after Demo mode is turned off.
- `validate_tape(tape, demo_mode, unchanged_ids=frozenset()) -> list[RuleViolation]`

### `domain/strength.py`
```python
S_INITIAL = 1.0; S_MIN = 0.25; S_MAX = 60.0     # days
PASS_SCORE = 0.6
DUE_STRENGTH = 70.0                              # unrounded strength at or below = due
ELIGIBLE_RATIO = 0.9                             # stability may rise only if ratio <= 0.9
PENALTY = {"skip_interlude": 0.9, "skip_track": 0.95, "abandon": 0.8}

def decay_ratio(elapsed_days: float, s: float) -> float        # exp(-max(0, Δ)/S)
def strength_at(base: int, s: float, elapsed_days: float) -> int   # round half up, 0–100
def condition(strength: int) -> Condition      # Mint/Worn/Warped/Haunted/Dead
def stability_factor(score: float) -> float
def review(mem: TrackMemory, score: float, now: datetime) -> TrackMemory
def apply_penalty(s: float, kind: PenaltyKind) -> float        # clamp to [S_MIN, S_MAX]
def is_due(base: int, s: float, elapsed_days: float) -> bool
def next_review_at(last_reviewed_at, base: int, s: float) -> datetime
def is_ghost(strengths: list[int]) -> bool                     # non-empty and all 0
def tape_strength(strengths: list[int]) -> int | None
    # None when empty. Mean, rounded half up. If not a ghost, at least 1.
def tape_condition(strengths: list[int]) -> Condition
    # Mint when empty; Dead only when is_ghost; otherwise condition(tape_strength) (min Haunted)
```

**Stability factor** (monotonic non-decreasing in score, jump at 0.6):
- score < 0.6: `0.5 + 0.45 × (score / 0.6)`, which is 0.5 to just under 0.95.
- score ≥ 0.6: `1.2 + 1.3 × (score − 0.6) / 0.4`, which is 1.2 to 2.5.

**`review`**:
1. `ratio = decay_ratio(Δ, S)` since the last review. A first recall (`last_reviewed_at is
   None`) is treated as eligible.
2. `factor = stability_factor(score)`. If `factor > 1` and the track was recalled before and
   `ratio > ELIGIBLE_RATIO`, use `factor = 1`.
3. `S' = clamp(S × factor, S_MIN, S_MAX)`.
4. `base' = 100` if `score ≥ PASS_SCORE`, else `round_half_up(score × 100)`.
5. `last_reviewed_at' = now`, `review_count' = review_count + 1`.

The result is monotonic: for the same state, a higher score never gives a lower `S'`.

**Next review**: `base ≤ 70 → last_reviewed_at`. Otherwise
`last_reviewed_at + S × ln(base / 70)` days. A track is due at time t exactly when
`t ≥ next_review_at`.

**Penalties** apply to the stability of every track completed so far in the session
(`skip_interlude`, `skip_track`) or completed in the session (`abandon`). They never raise
stability and are clamped to `[S_MIN, S_MAX]`. A stop with ≤ 50% of planned time remaining
has no penalty.

### `domain/recall.py`
```python
def normalize(text: str) -> str          # lowercase, punctuation to spaces, collapse spaces
def score(key_terms: Sequence[str], text: str) -> RecallScore  # score, matched, missed
```
A term is found when its normalised form appears in the normalised text bounded by word
edges (so "cell" does not match "excellent", and a phrase must appear whole). Each term counts
once. Score = matched / total.

### `domain/clock.py`
```python
TIME_SCALE_WARP = 1440                    # 1 day = 1 minute
@dataclass class Clock: scale: int; anchor_real: datetime; anchor_virtual: datetime
def virtual_now(clock: Clock, real_now: datetime) -> datetime
    # anchor_virtual + (real_now - anchor_real) * scale
def set_scale(clock: Clock, real_now: datetime, scale: int) -> Clock
    # new anchors = (real_now, virtual_now(clock, real_now)); keeps virtual time continuous
```

### `domain/sample.py`
`sample_tape(virtual_now) -> TapeSpec` is deterministic. It builds a C60 tape "Sample: Biology
Basics" with four tracks of 10 minutes (Side A: Photosynthesis, interlude 5, Cell respiration;
Side B: Enzymes, interlude 5, DNA replication). Each track has 4 key terms, except DNA
replication, which has 5 so that its seeded score of 0.4 is 2 of 5. The seeded memory is:

| Track | Stability (days) | Base | Age at creation (days) | Strength | Condition | Seeded score |
|---|---|---|---|---|---|---|
| Photosynthesis | 10 | 100 | 1.0 | 90 | Mint, not due (due in 2.57 days) | 0.75 |
| Cell respiration | 3 | 100 | 1.2 | 67 | Worn, due now | 0.75 |
| Enzymes | 2 | 100 | 2.5 | 29 | Warped, due | 0.75 |
| DNA replication | 1.5 | 40 | 2.5 | 8 | Haunted, due | 0.4 |

`last_reviewed_at = virtual_now − age`. Each track also gets one seeded `Recall` row with the
seeded score. There is no audio. The tape has `is_sample = true`. The mean strength is 49, so
the tape is Warped with 3 tracks due.

## API

All endpoints require `X-Listener-Id` (UUID v4) and return 400 if it is missing or invalid.
Every tape response includes `virtual_now`, and for each track a `memory` object
`{recorded, strength, condition, stability_days, review_count, last_reviewed_at,
next_review_at, due}`, plus tape-level `{strength, condition, due_count, next_review_at,
ghost}`, all computed at virtual now.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/tapes` | List the listener's tapes (shelf) |
| POST | `/api/tapes` | Create a tape with items; validated (Demo mode lowers the track minimum) |
| POST | `/api/tapes/sample` | Create the sample tape |
| GET | `/api/tapes/{id}` | Tape with items, memory state and liner-note stats |
| PUT | `/api/tapes/{id}` | Replace title/items (only if no session is in progress). Tracks matched by id keep memory unless their key terms change |
| DELETE | `/api/tapes/{id}` | Delete tape, sessions and recalls |
| POST | `/api/tapes/{id}/sessions` | Start a session |
| POST | `/api/sessions/{id}/events` | `{client_event_id, type, item_id}` → `{penalty: [...]}`; idempotent on `client_event_id` |
| POST | `/api/sessions/{id}/stop` | End session; applies the abandon rule once and saves `abandoned` and `stop_penalty`; returns summary and penalty. Calling it again on an ended session returns the saved summary with no new penalty. This is the only way a session is stopped, so there is no `stop` event type |
| POST | `/api/tracks/{id}/recalls` | `{client_event_id, text, source}` → `{score, matched, missed, memory}`; idempotent; text is not stored |
| GET | `/api/settings` | `{demo_mode, time_warp_allowed, time_warp_enabled, time_scale, real_now, virtual_now}` |
| PUT | `/api/settings` | `{demo_mode?, time_warp?}`; 403 if `time_warp` is true and `ALLOW_TIME_WARP` is not true |

Validation errors return 422 with a list of `{rule, side, message}` so the Recorder can show
them inline.

## Frontend

### Components
- `Recorder/`: two side columns with drag-to-reorder items, live "tape remaining" bars, a
  key terms field (3–5 chips) for each track.
- `CassettePlayer/`: SVG cassette with spinning reels (speed and wobble driven by tape
  condition), LCD countdown, PLAY/PAUSE/STOP/REW/FF/REC buttons, side indicator, flip
  animation, and a tape map of the tracks (used for the break-skip glitch).
- `RecallPanel/`: REC flow for one track (see `useRecall`), editable transcript or typing
  box, result with score and matched/missed terms.
- `TapeShelf/`: grid of cassette spines. Tapes with due tracks look haunted with an "N due"
  label. Ghost tapes render translucent and labelled "Forgotten".
- `JCard/`: liner notes with stats, per-track strength, condition, next review, REC and
  PLAY-recording buttons. The strength sparkline is Optional.
- `Settings/`: "Demo mode" toggle, "Demo time warp" toggle (hidden when not allowed, with
  a "TIME WARP ON" label), and a "Load sample tape" button.
- `Toast/`: short messages, including "The tape remembers…".

### `useTapePlayer` hook
State machine: `idle → playing ⇄ paused → flipping → playing → finished | stopped`.
Countdown = `itemEndsAt - Date.now()`, recalculated with `requestAnimationFrame`, and
persisted to `localStorage` so a reload resumes correctly. It always uses real time. When a
track completes it exposes `recPromptTrackId` until the next track starts.

### `useVirtualClock` hook
Loads `GET /api/settings` on mount and after each settings change, stores the server's
`real_now`, `virtual_now` and `time_scale`, and computes the offset from the local clock. It
returns `virtualNow()` using `domain/clock.ts`, and re-renders on a slow tick (about once a
second, faster while time warp is on) so strengths and "due" labels stay current. It is used
by `TapeShelf`, `JCard` and `RecallPanel`, and never by the focus timer.

### `useRecall` hook
State machine: `idle → requesting_mic → recording → review → submitting → result | error`.
- `requesting_mic`: start only after the user presses REC. Fall back to typing if denied.
- `recording`: `MediaRecorder` captures audio. Where `SpeechRecognition` (or
  `webkitSpeechRecognition`) exists, it runs at the same time (`continuous = true`,
  `interimResults = true`). Auto-stop at 90 s. The focus sound bed is muted while recording.
- `review`: shows an editable text box with the transcript (or empty for typing). Saves the
  audio blob to IndexedDB.
- `submitting`: sends `{client_event_id, text, source}`. Failed sends are retried (see Error
  handling).
- A one-time notice explains that speech recognition may use the browser vendor's cloud
  service, and that recordings stay on this device.

### Frontend domain (pure, mirrors the backend where noted)
- `domain/strength.ts` (mirrors `strength.py`): `strengthAt`, `condition`, `isDue`,
  `nextReviewAt`, `tapeStrength`. Used to update the display between API calls. The API
  value always replaces the prediction.
- `domain/clock.ts` (mirrors `clock.py`): `virtualNow(clock, realNow)`. The client computes
  an offset from the API's `real_now` so it does not depend on the local clock.
- `domain/effects.ts` (frontend only): `effectsFor(strength, reducedMotion)` and
  `fadeGain(t, start, end, duration)`. See the effects table.
- `domain/eventQueue.ts` (frontend only, Optional): `enqueue`, `nextRetryDelay(attempt) =
  min(1 × 2^attempt, 30)` seconds, `ack`, `predictStrength`.

### Audio (`src/audio/`)
- `engine.ts`: one `AudioContext` created on first PLAY or REC press. It also plays the
  completion chime: a simple two-tone oscillator beep (about 0.4 s) in phase 1, which the
  full audio engine can improve later. Sound beds: brown noise
  (filtered white noise buffer), rain (noise + random droplet envelopes), lo-fi loop (simple
  oscillators + low-pass + vinyl crackle). Master volume 0–1 (default 0.5); mute forces gain
  0; interlude fade uses a linear ramp of 2 s out and 2 s in; sound-bed gain never exceeds
  volume.
- `recordingStore.ts`: IndexedDB database `cursed-cassette`, object store `recordings`, key
  `trackId`, value `{blob, mimeType, durationMs, recordedAt}`. Functions `save`, `get`,
  `remove`, `removeMany`. The recording is deleted when its track, tape or the listener data
  is deleted.
- `decayedPlayback.ts`: `playRecording(trackId, effects)`. Decodes the blob with
  `decodeAudioData`, then `AudioBufferSourceNode → wobble → distortion → hiss mix → master`.
  Speed wobble is an LFO on `playbackRate`, pitch wobble is an LFO on `detune`, distortion
  is a `WaveShaperNode`, hiss is a looping noise buffer. Dead tracks play static only.
  Playback starts only on a button press.

### Effects table (Requirements 7 and 9)
`effectsFor(strength: number, reducedMotion: boolean): EffectSettings` is a pure function of
strength (through `condition`). The same table drives the player's tape condition effects
and decayed playback of a track.

| Condition | Hiss gain | Reel / speed wobble (± %) | Pitch wobble (± cents) | Playback distortion (0–1) | Colour bleed (px) | Flicker (Hz) | Ghost whispers (Optional) |
|---|---|---|---|---|---|---|---|
| Mint (80–100) | 0 | 0 | 0 | 0 | 0 | 0 | off |
| Worn (50–79) | 0.02 | 2 | 0 | 0.05 | 0 | 0 | off |
| Warped (20–49) | 0.05 | 6 | 25 | 0.20 | 2 | 4 | off |
| Haunted (1–19) | 0.10 | 12 | 60 | 0.45 | 4 | 8 | one burst every 20–45 s, 1.5–3 s long, gain 0.08 |
| Dead (0) | static only: noise gain 0.15, voice gain 0 | 0 | 0 | 0 | 0 | 0 | off |

The "Playback distortion" column is new, added for decayed playback. With `reducedMotion`
true: reel and speed wobble, reel spin and flicker are 0 for visuals; colour bleed and shadow
figures stay as static cues. Audio effects (hiss, speed wobble in the audio, pitch wobble,
distortion) are unchanged. Values never decrease as strength decreases. Condition text is
always rendered.

### Break-skip feedback
WHEN the API returns a `penalty` list for a skipped interlude, the UI shows a toast "The
tape remembers…" with a second line such as "Memory span −10% on 2 tracks" for 4 seconds. Each
affected track on the tape map glitches for 1.2 s (Framer Motion: jitter, colour split). With
reduced motion, the affected tracks get a static outline for 1.2 s and the toast still shows.

### Demo settings
- Demo mode only changes the minimum track duration (1 minute). The player and rules are
  otherwise unchanged.
- Demo time warp is controlled by the `Settings` toggle. The UI polls `GET /api/settings`
  on load and after each toggle, and shows "TIME WARP ON". The backend uses
  `ALLOW_TIME_WARP` from the environment (`.env.example` sets it to `false`; the deployed
  Render service sets it to `true`).
- "Load sample tape" calls `POST /api/tapes/sample`. It needs no audio, so playback of its
  tracks shows "No recording on this device" with a REC button.

### Visual theme
Dark plum/black background, cassette in off-white plastic with orange and teal labels, LCD
green digits. Effects by condition: Worn = subtle grain; Warped = chromatic aberration +
flicker; Haunted = vignette, shadow silhouettes in the cassette window. All effects gated by
`useReducedMotion`.

## Error handling
- Network failure during a session or recall, MVP: the timer, audio and local recording never
  stop. Each event and recall carries a `client_event_id` and is retried a few times at a fixed
  interval (about 5 s, in order). The backend ignores duplicate IDs, so retries are safe. A
  recall shows "scoring pending" until the response arrives. When a response arrives, the
  frontend shows the API values.
- Network failure, Optional (full Requirement 13): the queue is persisted in `localStorage`,
  delivered in order with exponential backoff (1 s doubling to 30 s), predicted strength is
  labelled "unsynced", a 4xx drops the item, and the queue resumes on the next page load.
- Microphone denied, speech unsupported or speech error: switch to the typing box and still
  score the recall.
- Browser storage full or IndexedDB unavailable: skip saving the audio, show a notice, and
  still submit the recall text.

## Testing strategy
- **Property-based (Hypothesis, backend)**
  - `strength_at` is an integer in 0–100 and non-increasing in elapsed time.
  - Stability is always in [0.25, 60] after any `review` or `apply_penalty`; penalties never
    raise it; for the same state, a higher score never gives a lower stability.
  - `is_due` matches `next_review_at` (due exactly at and after it); a score ≥ 0.6 gives base
    100 and never lowers strength.
  - `condition` is monotonic; `tape_strength` lies between the min and max track strength and
    is at least 1 unless every recorded track is 0; `tape_condition` is Dead exactly when
    `is_ghost`.
  - Stopping an ended session returns the same summary and applies no second penalty.
  - `recall.score`: in [0, 1], equals matched/total, case-insensitive, never lowers when text
    is appended, 0 for empty text, 1 when all terms are present.
  - `validate_side` and `validate_tape`: capacity, adjacency, key term rules, Demo mode
    minimum, and unchanged short tracks staying valid after Demo mode is turned off.
  - `virtual_now`: never decreases; equals real time at scale 1; `set_scale` keeps virtual
    time continuous.
  - `sample_tape`: valid, deterministic, one track in each of Mint, Worn (due), Warped,
    Haunted.
  - Event and recall application is idempotent per `client_event_id`.
- **Property-based (fast-check, frontend)**
  - `strength.ts` and `clock.ts` match the backend results for random inputs.
  - `effects.ts`: `effectsFor` intensity never increases with strength; reduced motion zeroes
    visual wobble and flicker; `fadeGain` is monotonic and bounded; gain is 0 when muted.
  - Countdown never goes negative and reaches zero exactly at `itemEndsAt`.
  - Optional: `eventQueue.ts` delivery order equals occurrence order, retry delay is in
    [1, 30] s and non-decreasing, queue empties after all acks.
- **Unit/API (pytest)**: each endpoint, listener scoping, 400/403/409/422 paths, recall text
  not stored.
- **Component (Vitest + RTL)**: keyboard controls, reduced-motion fallbacks, Recorder
  capacity and key term errors, typing fallback when `SpeechRecognition` is missing, the
  "The tape remembers…" toast.

## Optional (not in the MVP)

### Mixtape DJ planner (Requirement 14)
The `PlannerProvider` interface stays in the plan so the planner can be added later.
```python
class PlannerProvider(Protocol):
    def plan(self, tasks: list[TaskIn], length: TapeLength, style: FocusStyle) -> PlanOut: ...
```
`FocusStyle` presets: `pomodoro = (track 25, interlude 5)` (default), `deep_work = (track 50,
interlude 10)`. A task carries 3–5 key terms. Endpoint `POST /api/planner`
`{tasks, length, style?}` → `{plan, left_out}` (not saved).

`rule_based.py` (default):
1. `effective_track = min(style.track, side_capacity(length))` (Deep work on C60 → 30).
2. Round each task estimate up to at least the minimum track minutes.
3. Split a task longer than `effective_track` into `n = ceil(minutes / effective_track)`
   parts of near-equal length (sizes differ by at most 1), named `"<task> (part N)"`, each
   keeping the task's key terms.
4. Process tasks in input order. Try to place all of a task's parts (each followed by an
   interlude of `style.interlude`, never splitting a track across sides) on Side A then Side
   B. If the whole task does not fit, discard the attempt, add it to `left_out`, and continue
   with the next task.
5. Drop a trailing interlude on a side when it does not fit.

`llm.py` is enabled when `PLANNER_PROVIDER=llm` and an API key is set. It asks the model for a
JSON plan, validates it with `validate_tape`, and falls back to the rule-based planner on any
error.

### AI feedback on recalls and tape trading (Requirement 15)
- Feedback: `POST /api/tracks/{id}/feedback` takes the recall text, asks the LLM provider
  for two sentences about the missed terms, returns them, and stores nothing.
- Trading: `POST /api/tapes/{id}/share` returns a short link token that maps to a read-only
  plan (title, length, topics, key terms). `POST /api/shared/{token}/copy` creates a new tape
  on the caller's shelf with all tracks unrecorded.

### Other Optional items
Ghost whispers, the strength history sparkline on the J-card, and the full offline queue are
described above and in the tasks.

