# Implementation Plan

- [ ] 1. Scaffold the project
  - Create `backend/` with FastAPI, SQLModel, pytest, Hypothesis (managed with uv) and a
    health check endpoint `GET /api/health`.
  - Create `frontend/` with Vite + React + TypeScript, Tailwind, Framer Motion, Vitest,
    React Testing Library, fast-check.
  - Add `.env.example` files and CORS for the frontend dev origin.
  - _Requirements: none (setup)_

- [ ] 2. Backend domain logic
- [ ] 2.1 Implement `domain/schedule.py` (side capacity, side and tape validation)
  - Property tests: random valid tapes pass; adding any item over capacity fails.
  - _Requirements: 2.2, 2.3, 2.4, 2.5_
- [ ] 2.2 Implement `domain/health.py` (deltas, clamping, condition mapping)
  - Property tests: health always in [0, 100]; condition is monotonic.
  - _Requirements: 5.1–5.7_

- [ ] 3. Persistence and listener scoping
- [ ] 3.1 SQLModel tables and DB session dependency
  - _Requirements: 2.6, 8.3_
- [ ] 3.2 `X-Listener-Id` dependency that validates UUID v4 and returns 400 otherwise
  - Tests: missing header, malformed header, other listener's tape returns 404.
  - _Requirements: 1.2, 1.3, 1.4_

- [ ] 4. Tape API
  - Implement `GET/POST /api/tapes`, `GET/PUT/DELETE /api/tapes/{id}` with 422 rule
    violations in `{rule, side, message}` format.
  - _Requirements: 2.1–2.6, 8.1, 8.4_

- [ ] 5. Mixtape DJ planner
- [ ] 5.1 `PlannerProvider` protocol and rule-based planner
  - Property tests: output always passes `validate_tape`; task order preserved; focus
    minutes ≤ requested; left-out tasks reported.
  - _Requirements: 3.1–3.5_
- [ ] 5.2 Optional LLM planner with validation and fallback
  - Test: a provider that raises or returns invalid JSON falls back to rule-based.
  - _Requirements: 3.6_
- [ ] 5.3 `POST /api/planner` endpoint
  - _Requirements: 3.1_

- [ ] 6. Session API
  - Start (409 when Dead), events (returns `{health, condition}`), stop (abandon rule,
    clean side bonus, summary).
  - _Requirements: 4.1, 4.7, 5.1–5.5, 5.8, 8.3_

- [ ] 7. Frontend foundation
- [ ] 7.1 `useListenerId` hook and typed API client that sends `X-Listener-Id`
  - _Requirements: 1.1, 1.2_
- [ ] 7.2 `frontend/src/domain/health.ts` mirroring backend deltas
  - fast-check property test for clamping and parity with the delta table.
  - _Requirements: 5.6, 5.9_
- [ ] 7.3 Theme tokens, fonts and base layout (shelf / recorder / player routes)
  - _Requirements: 6.6_

- [ ] 8. Recorder UI
  - Side columns, add/reorder/remove items, live tape-remaining bars, inline rule errors.
  - Mixtape DJ panel: task list in, editable plan out, "left out" notice.
  - _Requirements: 2.1–2.7, 3.7_

- [ ] 9. Player
- [ ] 9.1 `useTapePlayer` state machine with timestamp-based countdown and reload resume
  - Property test: countdown never negative.
  - _Requirements: 4.1–4.7, 4.9_
- [ ] 9.2 `CassettePlayer` component: SVG cassette, reels, LCD, buttons, flip animation,
  keyboard controls, aria labels
  - _Requirements: 4.6, 4.8_
- [ ] 9.3 Send events to the API, reconcile health, queue and retry on network failure
  - _Requirements: 5.9_

- [ ] 10. Audio engine
  - Brown noise, rain, lo-fi loop; fade on interludes; volume and mute; start only on PLAY.
  - _Requirements: 7.1–7.5_

- [ ] 11. Haunted effects by condition
  - Visual and audio effect levels for Worn / Warped / Haunted, ghost whispers, reduced
    motion fallbacks, condition text always visible.
  - _Requirements: 6.1–6.6_

- [ ] 12. Shelf and liner notes
  - Tape shelf with ghost rendering for Dead tapes, J-card with stats and health sparkline,
    delete with confirmation.
  - _Requirements: 8.1–8.4, 5.8_

- [ ] 13. Deploy and polish
  - Deploy backend (Render) and frontend (Vercel), set env vars, smoke test on desktop and
    phone, write README setup steps, capture screenshots for Devpost.
  - _Requirements: all_
