# 📼 Cursed Cassette

> Your study session is a mixtape. Treat it well, or it will haunt you.

**Kiroween 2026 · Resurrection category**

Cursed Cassette resurrects the portable cassette player and the hand-made mixtape as a
focus timer for students. Plan a study session as a mixtape — tracks are focus blocks,
interludes are breaks — and play it on a haunted cassette player. Skip your breaks or
abandon a session and the tape warps, hisses and eventually becomes a ghost.

## Features (MVP)
- **Record a mixtape**: C60 / C90 / C120 tapes with Side A and Side B.
- **Mixtape DJ**: turn a task list into a session plan automatically.
- **Cassette controls**: PLAY, PAUSE, STOP, REW, FF, and flipping the tape.
- **Tape health**: your habits decide whether the tape stays Mint or turns Haunted.
- **Generated focus audio**: brown noise, rain and a lo-fi loop made in the browser.
  No copyrighted music.
- **Liner notes**: J-card history for every tape on your shelf.

No sign-up needed. Open the app and press PLAY.

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

**Frontend** (Node 20+)
```bash
cd frontend
npm install
npm run dev
npm test
```

## How we used Kiro
See [`.kiro/`](.kiro) for our steering docs, specs and hooks, and
[`docs/kiro-playbook.md`](docs/kiro-playbook.md) for our workflow.

## License
[MIT](LICENSE)
