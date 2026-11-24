---
inclusion: always
---

# Tech stack and conventions

## Stack
| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Strict TS, function components and hooks only |
| Styling | Tailwind CSS | Theme tokens in `tailwind.config.ts`, no inline hex colours in components |
| Animation | Framer Motion | Reels, tape wobble, J-card flips |
| Audio | Web Audio API (no audio files needed) | All focus audio is generated in the browser. Playback of recall recordings goes through Web Audio too |
| Recall capture | MediaRecorder + IndexedDB + Web Speech API | Recall audio is stored only in the browser. Typing fallback when speech is unsupported or the mic is denied |
| Frontend tests | Vitest + React Testing Library + fast-check | fast-check for property-based tests |
| Backend | Python 3.12 + FastAPI | Async endpoints, Pydantic v2 models |
| Database | SQLite via SQLModel | One file DB; swap for Postgres only if hosting needs it |
| Backend tests | pytest + Hypothesis | Hypothesis for property-based tests |
| AI (Optional) | Pluggable `PlannerProvider` interface | Mixtape DJ planner and recall feedback are Optional. The rule-based planner must work with no API key. An LLM provider is optional, enabled by env var |
| Hosting | Frontend on Vercel, backend on Render (or Fly.io) | Must stay live until 29 Jan 2027 |

## Identity without accounts
- On first visit the frontend creates a random `listener_id` (UUID v4) and stores it in
  `localStorage`. It is sent as the `X-Listener-Id` header on every API call.
- The backend scopes all data by `listener_id`. No passwords, no emails, no personal data.
- Recall audio never leaves the browser. The recall text is sent to the backend to be
  scored, and it is never stored or logged.

## Rules for generated code
- Keep business rules (memory strength and decay, stability updates, recall scoring,
  virtual time, scheduling) in pure functions with no I/O, so they can be property-tested:
  - Backend: `backend/app/domain/`
  - Frontend: `frontend/src/domain/`
- The backend is the source of truth for scores, stability and strength. The frontend may
  predict strength for instant feedback but must reconcile with the API response.
- Memory decay uses virtual time. Demo time warp is allowed only when the backend env var
  `ALLOW_TIME_WARP=true`. The focus session timer always uses real time.
- Every API endpoint has a Pydantic request and response model and at least one pytest.
- Every domain function has at least one property-based test (Hypothesis or fast-check).
- Respect `prefers-reduced-motion`: disable wobble and reel spin, keep state changes visible
  through colour and text.
- All interactive controls are keyboard reachable with visible focus and `aria-label`s.
  Space = play/pause, Arrow keys = REW/FF, R = REC.
- Audio never autoplays; it starts only after the user presses PLAY. The microphone is used
  only after the user presses REC. Recordings play only after the user presses play on them.
- Config via environment variables only (`.env`, never committed). Provide `.env.example`.
- Edit files with Kiro's file editing tools, not PowerShell or shell scripts. Shell commands
  are only for running builds, tests and dev servers.

## Commands
- Backend: `cd backend && uv run uvicorn app.main:app --reload` and `uv run pytest`
- Frontend: `cd frontend && npm run dev` and `npm test`
- In Kiro's terminal on Windows, run backend tests with `.\.venv\Scripts\python.exe -m pytest -q` from `backend/` (`uv run pytest` gives garbled output there).
