# Implementation Plan

Eleven days. Tasks are split into **MVP** (must ship) and **Optional** (only if time
allows), and the MVP is ordered so a playable demo exists as early as possible. Task numbers
are stable labels, not the execution order; follow the order they appear in.

The core loop: record a tape → play to focus → REC to recall → score → decay → restore.

Effects and the offline queue run only in the browser (frontend domain). The backend owns
scoring, stability and strength, and applies each event once (idempotent on
`client_event_id`).

## MVP

### Phase 1: Playable demo (target: days 1–4)

- [x] 1. Scaffold the project
  - Create `backend/` with FastAPI, SQLModel, pytest, Hypothesis (managed with uv) and a
    health check endpoint `GET /api/health`.
  - Create `frontend/` with Vite + React + TypeScript, Tailwind, Framer Motion, Vitest,
    React Testing Library, fast-check.
  - Add `.env.example` files (backend includes `ALLOW_TIME_WARP=false`) and CORS for the
    frontend dev origin.
  - _Requirements: none (setup)_

- [x] 2. Backend domain logic (pure functions)
- [x] 2.1 `domain/schedule.py` (side capacity, minimum track minutes by Demo mode, side and
  tape validation including 3–5 unique key terms)
  - Property tests: random valid tapes pass; adding any item over capacity fails; remaining
    minutes equals capacity minus total; cross-side track pairs are not adjacent; 2 or 6
    key terms or case-insensitive duplicates are rejected; the track minimum follows Demo
    mode; unchanged short tracks stay valid after Demo mode is turned off, new or changed
    ones do not.
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.7, 12.2, 12.3_
- [x] 2.2 `domain/strength.py` (named constants, `decay_ratio`, `strength_at`, `condition`,
  `stability_factor`, `review`, `apply_penalty`, `is_due`, `next_review_at`,
  `tape_strength`, `tape_condition`, `is_ghost`)
  - Property tests: strength is an integer in 0–100 and non-increasing over time; stability
    stays in [0.25, 60] after any review or penalty; penalties never raise stability; a
    higher score never gives a lower stability; a score ≥ 0.6 gives base 100; due matches
    next review time; condition is monotonic; tape strength is between the min and max
    track strength and at least 1 unless every recorded track is 0; the tape condition is
    Dead exactly when the tape is a ghost.
  - _Requirements: 4.1–4.5, 4.9, 6.1–6.11, 6.13, 8.4, 8.5_
- [x] 2.3 `domain/recall.py` (`normalize`, `score` with whole-word/phrase matching)
  - Property tests: score in [0, 1] and equals matched/total; case-insensitive; appending
    text never lowers it; empty text scores 0; all terms present scores 1; "cell" does not
    match "excellent" or "cellular"; appending "s" to a single-word term in the text still
    matches (plural rule: "cell" matches "cells", "process" matches "processes").
  - _Requirements: 5.11_
- [x] 2.4 `domain/clock.py` (`virtual_now`, `set_scale`; scale 1 until task 14)
  - Property tests: virtual time never decreases; scale 1 equals real time; scale 1440 is 1440
    times real elapsed; `set_scale` keeps virtual time continuous.
  - _Requirements: 12.7, 12.8_

- [x] 3. Persistence and listener scoping
- [x] 3.1 SQLModel tables (Listener, Tape, TapeItem with memory fields, Recall, Session,
  SessionEvent) and DB session dependency
  - _Requirements: 2.6, 11.5, 13.3_
- [x] 3.2 `X-Listener-Id` dependency that validates UUID v4, returns 400 otherwise, and
  creates the Listener row with defaults on first use
  - Tests: missing header, malformed header (property test over non-UUID strings), other
    listener's tape returns 404.
  - _Requirements: 1.2, 1.3, 1.4_

- [ ] 4. Tape and settings APIs
- [ ] 4.1 Tape API
  - Implement `GET/POST /api/tapes`, `GET/PUT/DELETE /api/tapes/{id}` with 422 rule
    violations in `{rule, side, message}` format. Responses include each track's `memory`
    and the tape's strength, condition, due count, next review and ghost flag at virtual now.
    Deleting a tape deletes its sessions and recalls. A PUT that changes key terms resets
    that track. A PUT returns 409 while a session is in progress. A PUT treats tracks with
    an unchanged id and duration as exempt from the 10-minute minimum.
  - Tests: PUT during an active session returns 409; editing a tape saved in Demo mode after
    Demo mode is off keeps unchanged short tracks valid.
  - _Requirements: 2.1–2.8, 6.2–6.4, 6.10–6.12, 11.1, 11.6, 12.3_
- [ ] 4.2 Settings API (Demo mode)
  - `GET/PUT /api/settings` with the per-listener `demo_mode` setting. The tape API reads it
    to set the track minimum. The time warp fields are added in task 14.1.
  - _Requirements: 12.1, 12.2_

- [ ] 5. Session API
  - Start, events (`complete` and `skip` only; idempotent on `client_event_id`; returns the
    `penalty` list with stability before and after), and automatic session end after the last
    item on Side B.
  - `POST /api/sessions/{id}/stop` is the only way to stop a session. It applies the abandon
    rule once, saves `abandoned` and `stop_penalty` on the session, and returns the summary.
    A second call returns the saved summary with no new penalty.
  - Tests: duplicate event IDs applied once; property test over duplicate delivery patterns
    giving the same final state; penalties only affect tracks completed in the session; a
    second stop applies no second penalty.
  - _Requirements: 3.1, 3.8, 3.9, 4.1–4.6, 4.9, 4.10, 13.3_

- [ ] 6. Recall API
  - `POST /api/tracks/{id}/recalls` `{client_event_id, text, source}`: scores, updates the
    track via `review`, stores a Recall row without the text, returns
    `{score, matched, missed, memory}`. Idempotent on `client_event_id`. Text limit 5000
    characters.
  - Tests: text is never stored; duplicate IDs applied once; re-recording after a long time
    raises stability, spam re-recording does not.
  - _Requirements: 5.10, 5.11, 6.5–6.8, 8.1, 8.4–8.7, 13.3_

- [ ] 7. Frontend foundation
- [x] 7.1 `useListenerId` hook and typed API client that sends `X-Listener-Id`
  - _Requirements: 1.1, 1.2_
- [ ] 7.2 `domain/strength.ts`, `domain/clock.ts` (mirror the backend) and the
  `useVirtualClock` hook (loads `/api/settings`, tracks the server offset, returns
  `virtualNow()` on a slow tick)
  - fast-check property tests: parity with backend results (shared test vectors), decay is
    monotonic, strength in 0–100, virtual time never decreases.
  - Hook test: `virtualNow()` follows the server clock offset and scale.
  - _Requirements: 6.2–6.4, 6.12, 12.7_
- [ ] 7.3 `domain/effects.ts` (`effectsFor`, `fadeGain`; numeric table in design.md)
  - fast-check property tests: effect intensity never increases with strength; reduced
    motion zeroes visual wobble and flicker; fade gain is monotonic and bounded; gain is 0
    when muted and never above volume; Dead has no voice gain.
  - _Requirements: 7.2–7.4, 7.8, 9.1–9.5, 10.4, 10.5_
- [x] 7.4 Theme tokens, fonts and base layout (shelf / recorder / player routes)
  - _Requirements: 9.6_

- [ ] 8. Recorder UI and Demo mode toggle
- [ ] 8.1 Recorder UI
  - Side columns, add/reorder/remove items, key terms chips (3–5), live tape-remaining bars,
    inline rule errors, and the Demo mode minimum (1 minute) when enabled.
  - _Requirements: 2.1–2.8_
- [ ] 8.2 Demo mode toggle: `Settings` panel with the "Demo mode" toggle (labelled as text while on)
  - The time warp toggle and "Load sample tape" button are added in task 14.3.
  - _Requirements: 12.1, 12.2, 12.3_

- [ ] 9. Player
- [ ] 9.1 `useTapePlayer` state machine with timestamp-based countdown and reload resume
  - Property tests: countdown never negative or above the item duration; every item ends in
    exactly one state for any button sequence.
  - _Requirements: 3.1–3.9, 3.11, 3.12, 12.11_
- [ ] 9.2 `CassettePlayer` component: SVG cassette, reels, LCD, buttons (including REC),
  flip animation, tape map of tracks, keyboard controls, aria labels
  - _Requirements: 3.7, 3.10_
- [ ] 9.3 Send events with `client_event_id`, show the REC prompt when a track ends, and
  retry failed events in order at a fixed interval (about 5 s, a few attempts)
  - Play a simple completion chime when a track or interlude ends (a two-tone Web Audio
    oscillator beep of about 0.4 s, created on the first PLAY press). Task 16 can improve it.
  - The timer and audio never stop on network failure.
  - _Requirements: 3.5, 5.1, 13.1, 13.2_

- [ ] 10. Typed recall and strength display
  - `RecallPanel` with the typing path only (the same panel will gain voice in task 11):
    submit text, show the score, matched and missed terms. Show each track's strength,
    condition, stability and next review on the tape page, updated with `strength.ts` between
    API calls and replaced by API values. REC is reachable from the player prompt and from any
    track in the track list, and by keyboard (R).
  - Recall submits use the same simple retry as events (in order, about every 5 s, a few
    attempts). Show "scoring pending" until the response arrives.
  - Test: an unreachable API shows "scoring pending", then the score once delivered.
  - _Requirements: 5.1, 5.2, 5.9, 5.10, 5.12, 5.14, 6.12, 8.3, 8.6, 13.2_

**Demo checkpoint (end of phase 1):** record a tape with key terms, press PLAY, finish a
track (turn on Demo mode to use 1-minute tracks), press REC and type a recall, see the score
and the track's strength, then skip a break and watch stability drop in the response.

### Phase 2: Voice, decay, demo helpers and shelf (target: days 5–8)

- [ ] 11. Voice recall
  - `audio/recordingStore.ts` (IndexedDB), `useRecall` with MediaRecorder, Web Speech
    transcription into an editable box, 90 s auto-stop, under-30 s hint, typing fallback when
    unsupported or denied, the one-time speech service notice, and muting the sound bed while
    recording.
  - Component tests: typing fallback when `SpeechRecognition` is missing; mic denied.
  - A re-recording replaces the previous audio for the track.
  - _Requirements: 5.2–5.9, 5.13, 8.2, 10.6_
- [ ] 12. Decayed playback
  - `audio/decayedPlayback.ts`: play a stored recording through hiss, speed and pitch wobble
    and distortion by the track's current condition; static only when Dead; "No recording on
    this device" with REC; delete recordings when tracks or tapes are deleted.
  - _Requirements: 7.1–7.8, 11.6_
- [ ] 13. Break-skip feedback
  - Toast "The tape remembers…" with the affected count, a 1.2 s glitch on the affected
    tracks in the tape map, and a static outline with reduced motion.
  - Component test: the toast and affected tracks show after a skipped interlude.
  - _Requirements: 4.7, 4.8_
- [ ] 14. Demo settings
- [ ] 14.1 Backend: extend `GET/PUT /api/settings` (from task 4.2) with time warp (scale 1 or
  1440 with continuous virtual time, `time_warp_allowed` from `ALLOW_TIME_WARP`, 403 when it
  is not true)
  - Tests: 403 when not allowed; virtual time continuous across toggles.
  - _Requirements: 12.4–12.8_
- [ ] 14.2 Backend: `domain/sample.py` and `POST /api/tapes/sample`
  - Property tests: the sample is valid, deterministic, and has exactly one Mint, one Worn
    (due), one Warped and one Haunted track at creation.
  - _Requirements: 12.9, 12.10_
- [ ] 14.3 Frontend `Settings`: add the "Demo time warp" toggle (hidden when not allowed, with
  a "TIME WARP ON" label) and the "Load sample tape" button to the panel from task 8.2
  - _Requirements: 12.5, 12.8, 12.9_
- [ ] 15. Haunted shelf, J-card and restore
  - Shelf spines with condition, "N due" labels and haunted look, ghost rendering for
    Forgotten tapes, J-card with stats and per-track strength and next review, REC and PLAY
    recording buttons, delete with confirmation (also deletes recordings).
  - Property test: total focus minutes equals the sum of completed track durations; the due
    count equals tracks with unrounded strength ≤ 70.
  - _Requirements: 6.10, 6.11, 8.1–8.7, 11.1–11.6_
- [ ] 16. Procedural focus audio
  - Brown noise, rain, lo-fi loop; 2 s linear fade on interludes; volume 0–100% and mute;
    start only on PLAY. Improve the simple completion chime from task 9.3 if time allows.
  - _Requirements: 10.1–10.5_
- [ ] 17. Haunted effects by condition (without ghost whispers)
  - Apply `effectsFor` values to visuals and the audio chain (hiss, reel and pitch wobble,
    colour bleed, flicker, shadow figures), reduced motion fallbacks, condition text always
    visible.
  - _Requirements: 9.1–9.3, 9.4 (shadow figures only), 9.5, 9.6_

If phase 2 slips, cut in this order: task 17 visuals (keep the condition text), then the
lo-fi loop and rain in task 16 (keep brown noise), then the shelf polish in task 15.

### Phase 3: Ship (target: days 9–11)

- [ ] 18. Deploy and polish
  - Deploy backend (Render) with `ALLOW_TIME_WARP=true`, and frontend (Vercel). Set env vars.
  - Smoke test on desktop and phone (HTTPS microphone permission, Chrome speech, Firefox
    typing fallback).
  - Write README setup steps and a judge guide (Demo mode, Load sample tape, Demo time warp).
  - Record the demo video using the sample tape and time warp, and capture screenshots for
    Devpost.
  - Deploy early (day 9 at the latest) and keep days 10–11 for polish and the write-up.
  - _Requirements: all MVP_

## Optional (only if time allows, in priority order)

- [ ] O1. Ghost whispers in Haunted
  - Generated band-passed noise bursts per the effects table (one burst every 20–45 s,
    1.5–3 s long, gain 0.08), off when muted.
  - _Requirements: 9.4_
- [ ] O2. Strength history sparkline on the J-card
  - _Requirements: 11.4_
- [ ] O3. Full offline queue (replaces the simple retry in 9.3 and task 10)
  - `frontend/src/domain/eventQueue.ts` (frontend only): persisted queue in `localStorage`,
    exponential backoff 1 s to 30 s, "unsynced" predicted strength, drop on 4xx, resume on
    reload.
  - fast-check property tests: order preserved; delay in [1, 30] s and non-decreasing; queue
    empty after all acks; prediction equals applying events in order.
  - _Requirements: 13.4–13.9_
- [ ] O4. Mixtape DJ planner with focus styles
  - `PlannerProvider` protocol, `FocusStyle` presets (Pomodoro 25/5 default, Deep work
    50/10), rule-based planner, `POST /api/planner`, and the DJ panel in the Recorder.
  - Property tests: output always passes `validate_tape`; every track at most the maximum
    track duration; parts sum to the rounded estimate; task order preserved; included +
    left-out names equal the input; a left-out task has no parts in the plan; deterministic.
  - _Requirements: 14.1–14.8, 14.11_
- [ ] O5. Optional LLM planner with validation and fallback
  - Test: a provider that raises or returns invalid JSON falls back to rule-based.
  - _Requirements: 14.9, 14.10_
- [ ] O6. AI feedback on recalls
  - `POST /api/tracks/{id}/feedback` with an LLM provider; control hidden without one.
  - _Requirements: 15.1, 15.2_
- [ ] O7. Mixtape trading
  - Read-only share link and "copy to my shelf"; no recordings, strengths or history shared.
  - _Requirements: 15.3, 15.4_

