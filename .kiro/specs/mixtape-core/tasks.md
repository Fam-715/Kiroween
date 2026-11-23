# Implementation Plan

Eleven days. Tasks are split into **MVP** (must ship) and **Optional** (only if time
allows), and the MVP is ordered so a playable demo exists as early as possible. Task
numbers are stable labels, not the execution order; follow the order they appear in.

Effects and the offline queue run only in the browser, so they live only in the frontend
(task 7.2). The backend only needs idempotent events (task 6).

## MVP

### Phase 1: Playable demo (target: days 1–4)

- [ ] 1. Scaffold the project
  - Create `backend/` with FastAPI, SQLModel, pytest, Hypothesis (managed with uv) and a
    health check endpoint `GET /api/health`.
  - Create `frontend/` with Vite + React + TypeScript, Tailwind, Framer Motion, Vitest,
    React Testing Library, fast-check.
  - Add `.env.example` files and CORS for the frontend dev origin.
  - _Requirements: none (setup)_

- [ ] 2. Backend domain logic
- [ ] 2.1 Implement `domain/schedule.py` (side capacity, side and tape validation)
  - Property tests: random valid tapes pass; adding any item over capacity fails; remaining
    minutes equals capacity minus total; cross-side track pairs are not adjacent.
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.7_
- [ ] 2.2 Implement `domain/health.py` (named delta constants, `apply`, `apply_all`,
  condition mapping)
  - Deltas: skip interlude -12, skip track -4, abandon -20, complete interlude +5, clean
    side +10; a stop with ≤ 50% remaining has no delta.
  - Property tests: health always in [0, 100] with per-event clamping; condition is
    monotonic; skips never raise and completions never lower health; Dead stays Dead.
  - _Requirements: 5.1–5.9, 5.11_

- [ ] 3. Persistence and listener scoping
- [ ] 3.1 SQLModel tables (including `client_event_id`) and DB session dependency
  - _Requirements: 2.6, 8.3, 9.4_
- [ ] 3.2 `X-Listener-Id` dependency that validates UUID v4 and returns 400 otherwise
  - Tests: missing header, malformed header (property test over non-UUID strings), other
    listener's tape returns 404.
  - _Requirements: 1.2, 1.3, 1.4_

- [ ] 4. Tape API
  - Implement `GET/POST /api/tapes`, `GET/PUT/DELETE /api/tapes/{id}` with 422 rule
    violations in `{rule, side, message}` format. Deleting a tape deletes its sessions.
  - _Requirements: 2.1–2.6, 8.1, 8.4_

- [ ] 7. Frontend foundation
- [ ] 7.1 `useListenerId` hook and typed API client that sends `X-Listener-Id`
  - _Requirements: 1.1, 1.2_
- [ ] 7.2 Frontend domain modules: `health.ts` (mirrors backend deltas), `effects.ts`
  (`effectsFor`, `fadeGain`, numeric table in design.md)
  - These exist only in the frontend; there is no backend effects module.
  - fast-check property tests: clamping and delta parity; effect intensity never increases
    with health; reduced motion zeroes wobble, spin and flicker; fade gain is monotonic and
    bounded; gain is 0 when muted and never above volume.
  - _Requirements: 5.7, 5.10, 6.1–6.5, 7.4, 7.5_
- [ ] 7.3 Theme tokens, fonts and base layout (shelf / recorder / player routes)
  - _Requirements: 6.6_

- [ ] 8. Recorder UI (manual recording first)
  - Side columns, add/reorder/remove items, live tape-remaining bars, inline rule errors.
  - _Requirements: 2.1–2.7_

- [ ] 6. Session API
  - Start (409 when Dead), events (idempotent on `client_event_id`, returns
    `{health, condition}`), stop (abandon rule, clean side bonus, summary), and automatic
    session end after the last item on Side B.
  - Tests: duplicate event IDs applied once; property test over duplicate/reordered
    delivery patterns giving the same final health.
  - _Requirements: 4.1, 4.7, 4.8, 5.1–5.7, 5.9, 8.3, 9.4_

- [ ] 9. Player
- [ ] 9.1 `useTapePlayer` state machine with timestamp-based countdown and reload resume
  - Property tests: countdown never negative or above the item duration; every item ends
    in exactly one state for any button sequence.
  - _Requirements: 4.1–4.8, 4.10_
- [ ] 9.2 `CassettePlayer` component: SVG cassette, reels, LCD, buttons, flip animation,
  keyboard controls, aria labels
  - _Requirements: 4.6, 4.9_
- [ ] 9.3 Send events with `client_event_id` and reconcile health with the API response
  - Simple retry only: a failed event is retried in order at a fixed interval (about 5 s)
    for a few attempts. The timer and audio never stop on network failure.
  - _Requirements: 5.10, 9.1_

**Demo checkpoint (end of phase 1):** record a tape, press PLAY, skip a break and watch
health change.

### Phase 2: Complete the core experience (target: days 5–8)

- [ ] 10. Audio engine
  - Brown noise, rain, lo-fi loop; 2 s linear fade on interludes; volume 0–100% and mute;
    start only on PLAY.
  - _Requirements: 7.1–7.5_

- [ ] 5. Mixtape DJ planner (rule-based only)
- [ ] 5.1 `PlannerProvider` protocol, `FocusStyle` presets (Pomodoro 25/5 default, Deep
  work 50/10) and rule-based planner
  - Effective track length = min(style track, side capacity); round estimates under 10 up
    to 10; split into near-equal parts; place each task atomically; skip a task that does
    not fit and keep trying later tasks in order.
  - Property tests: output always passes `validate_tape`; every track in [10, effective
    track length]; parts sum to `max(estimate, 10)`; task order preserved; included +
    left-out names equal the input; a left-out task has no parts in the plan; planner is
    deterministic.
  - Example tests: Deep work on C60 gives 30-minute tracks; a 5-minute task becomes 10; a
    large task is left out while a later small task is still included.
  - _Requirements: 3.1–3.8, 3.9_
- [ ] 5.3 `POST /api/planner` endpoint (`style` optional, defaults to Pomodoro)
  - _Requirements: 3.1, 3.2_
- [ ] 8.1 Mixtape DJ panel in the Recorder: task list and focus style selector in,
  editable plan out (validated on edit), "left out" notice
  - _Requirements: 3.1, 3.2, 3.11_

- [ ] 11. Haunted effects by condition (without ghost whispers)
  - Apply `effectsFor` values to visuals and the audio chain (hiss, reel and pitch wobble,
    colour bleed, flicker, shadow figures), reduced motion fallbacks, condition text always
    visible.
  - _Requirements: 6.1–6.3, 6.4 (shadow figures only), 6.5, 6.6_

- [ ] 12. Shelf and liner notes (without sparkline)
  - Tape shelf with ghost rendering for Dead tapes, J-card with stats, delete with
    confirmation.
  - Property test: total focus minutes equals the sum of completed track durations.
  - _Requirements: 8.1–8.4, 5.9_

### Phase 3: Ship (target: days 9–11)

- [ ] 13. Deploy and polish
  - Deploy backend (Render) and frontend (Vercel), set env vars, smoke test on desktop and
    phone, write README setup steps, capture screenshots for Devpost.
  - Deploy early (day 9 at the latest) and keep days 10–11 for polish and the write-up.
  - _Requirements: all MVP_

## Optional (only if time allows, in priority order)

- [ ] O1. Ghost whispers in Haunted
  - Generated band-passed noise bursts per the effects table (one burst every 20–45 s,
    1.5–3 s long, gain 0.08), off when muted.
  - _Requirements: 6.4_
- [ ] O2. Health history sparkline on the J-card
  - _Requirements: 8.2_
- [ ] O3. Optional LLM planner (task 5.2) with validation and fallback
  - Test: a provider that raises or returns invalid JSON falls back to rule-based.
  - _Requirements: 3.9, 3.10_
- [ ] O4. Full offline queue (replaces the simple retry in 9.3)
  - `frontend/src/domain/eventQueue.ts` (frontend only): persisted queue in `localStorage`,
    exponential backoff 1 s to 30 s, "unsynced" predicted health, drop on 4xx, resume on
    reload.
  - fast-check property tests: order preserved; delay in [1, 30] s and non-decreasing;
    queue empty after all acks; prediction equals applying events in order.
  - _Requirements: 9.2, 9.3, 9.5, 9.6, 9.7, 9.8_
