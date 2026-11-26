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

## Try it quickly (for judges)
In **Settings**:
- **Load sample tape**: creates a tape with tracks that are Mint, due, Warped and Haunted.
- **Demo mode**: allows tracks as short as 1 minute, so you can reach REC fast.
- **Demo time warp**: makes 1 day pass every minute, so you can watch tapes decay. Off by
  default and clearly labelled.

## Privacy
Your voice recordings stay in your browser (IndexedDB). Only the recall text is sent to the
server to be scored, and it is not stored. Your browser's speech recognition may send audio
to its vendor's service (Chrome and Edge). If your browser does not support it, you can
type your recall instead.

## Live demo
_Coming soon._

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
See [`.kiro/`](.kiro) for our steering docs, specs and hooks, and
[`docs/kiro-playbook.md`](docs/kiro-playbook.md) for our workflow.

## License
[MIT](LICENSE)
