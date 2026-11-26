# 📼 Cursed Cassette: Study Tapes That Decay As You Forget

> A cassette recorder for studying, back from the dead. Record what you learned in your own
> voice. Forget it, and the tape decays, warps and haunts you until you review.

**Kiroween 2026 · Resurrection category**

Cursed Cassette resurrects what made cassettes special, recording and decay, and uses them
as a study method. Record a tape of study topics, focus on them, then press REC and explain
each topic from memory. Each track has a memory strength that fades over time. Review it
and the tape is restored. Forget it and the tape warps, hisses and haunts your shelf.

## How it works
1. **Record a tape**: C60 / C90 / C120 with Side A and Side B. Each track is a topic with
   3–5 key terms. Interludes are breaks.
2. **Play to focus**: PLAY, PAUSE, STOP, REW, FF and the flip to Side B. Skip a break and
   "the tape remembers".
3. **REC to recall**: explain the topic from memory for 30–90 seconds. We score how many
   key terms you mentioned.
4. **Decay**: strength follows a forgetting curve. Good recalls make a memory last longer.
5. **Decayed playback**: your own recording plays back with hiss, wobble and distortion as
   you forget.
6. **Restore**: re-record a track to bring it back. The app shows when to review next.
7. **Haunted shelf**: tapes with tracks due look haunted. Forgotten tapes become ghosts.

No sign-up needed. Open the app and start recording.

## Live demo
**https://kiroween-liart.vercel.app/**

The backend runs on Render's free plan and sleeps after 15 minutes without visitors. If the
first load seems stuck, wait up to a minute and refresh. Use Chrome or Edge for voice recall;
other browsers fall back to typing.

## Try it in 2 minutes (for judges)
1. Open the live demo and click the **⚙ Settings** button.
2. Click **Load sample tape**. It creates "Sample: Biology Basics" with four tracks that are
   Mint, Worn (due), Warped and Haunted.
3. Turn on **Demo time warp** (1 day passes every minute, labelled "TIME WARP ON"). Watch
   the strengths drop and the tape's condition change.
4. Open the **Haunted** track (DNA replication) and recall it: say or type "helicase,
   polymerase, primer, leading strand, Okazaki fragments". It jumps back to Mint, and its
   next review moves further out.
5. To try the full loop, turn on **Demo mode** (tracks as short as 1 minute), record your
   own tape, press PLAY, and press REC when the track ends.

All demo helpers are off by default and clearly labelled.

## Privacy
Your voice recordings stay in your browser (IndexedDB). Only the recall text is sent to the
server to be scored, and it is not stored. Your browser's speech recognition may send audio
to its vendor's service (Chrome and Edge). If your browser does not support it, you can
type your recall instead.

## Built with
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Web Audio API,
  MediaRecorder, Web Speech API, IndexedDB. Tests: Vitest, React Testing Library, fast-check.
- **Backend:** Python 3.12, FastAPI, SQLModel, SQLite, uv. Tests: pytest, Hypothesis.
- **Hosting:** Vercel (frontend), Render (backend).
- **Built in:** [Kiro](https://kiro.dev), with spec-driven development.

## Running locally

**Backend** (Python 3.12, [uv](https://docs.astral.sh/uv/))
```bash
cd backend
cp .env.example .env
uv run uvicorn app.main:app --reload
uv run pytest
```
Set `ALLOW_TIME_WARP=true` in `.env` to enable the Demo time warp toggle.

**Frontend** (Node 20+)
```bash
cd frontend
npm install
npm run dev
npm test
```

## Deployment
**Backend on Render** (web service)
- Root directory: `backend`
- Build command: `pip install uv && uv sync --frozen --no-dev`
- Start command: `uv run --no-dev uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment variables:
  - `PYTHON_VERSION=3.12.7`
  - `ALLOW_TIME_WARP=true`
  - `CORS_ORIGINS=<the Vercel URL>`

The free Render server sleeps after 15 minutes without traffic, so the first request after
a pause can take about 50 seconds.

**Frontend on Vercel**
- Root directory: `frontend`
- Framework preset: Vite
- Environment variable: `VITE_API_BASE_URL=https://cursed-cassette-api.onrender.com`

`frontend/vercel.json` rewrites every route to `index.html`, so `react-router-dom` routes
work on direct visits and page reloads.

## How we used Kiro
The whole app was built in Kiro by a team of three students. Everything Kiro used is in
[`.kiro/`](.kiro), and our running log of what worked and what didn't is in
[`docs/kiro-playbook.md`](docs/kiro-playbook.md) and [`docs/kiro-log/`](docs/kiro-log).

| Kiro feature | Where | How we used it |
|---|---|---|
| **Spec-driven development** | [`.kiro/specs/mixtape-core/`](.kiro/specs/mixtape-core) | 15 requirements → design → task list. Every feature was built with **Start task** from the spec, one branch and one pull request per task. When we changed a rule (for example, a failed recall now floors at Warped instead of killing the track), we changed the requirement first and let Kiro update the design, code and tests together. |
| **Spec review** | requirements.md, design.md | Before writing code, we asked Kiro for a read-only consistency check of requirements, design and tasks. It found 7 real issues, including a double penalty from a repeated "stop" event. |
| **Steering** | [`.kiro/steering/`](.kiro/steering) | `product.md`, `tech.md` and `structure.md` are always included, so Kiro knows the product and vocabulary (tape, side, track, interlude). `design-system.md` loads only for frontend files (`fileMatch`). We added rules when Kiro went wrong, such as "edit files with Kiro's file tools, not shell scripts". |
| **Agent hooks** | [`.kiro/hooks/spec-coverage-check.json`](.kiro/hooks/spec-coverage-check.json) | A read-only hook runs whenever `requirements.md` or `design.md` is saved and reports requirements that no task covers. It caught a real gap: the rule that time warp must not speed up the focus timer had no task. |
| **Property-based testing** | `backend/tests/`, `frontend/tests/` | Every requirement has a property statement. Kiro wrote Hypothesis and fast-check tests for them: strength stays between 0 and 100 and never rises on its own, tapes always fit their side, duplicate network events apply only once, and the frontend maths matches the backend. |
| **Custom agent** | [`.kiro/agents/pbt-reviewer.md`](.kiro/agents/pbt-reviewer.md) | A read-only reviewer that compares our code and tests with the spec's properties and lists missing property tests. |
| **MCP** | [`.kiro/settings/mcp.json`](.kiro/settings/mcp.json) | The fetch MCP server let Kiro check our browser API research (Web Speech, MediaRecorder, IndexedDB) against MDN. |

## License
[MIT](LICENSE)
