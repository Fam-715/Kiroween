---
inclusion: always
---

# Project structure

```
/
├── .kiro/                  # Kiro specs, steering, hooks (never gitignored)
├── backend/
│   ├── app/
│   │   ├── main.py         # FastAPI app, CORS, router registration
│   │   ├── api/            # Routers: tapes.py, sessions.py, recalls.py, settings.py
│   │   │                   #   (Optional: planner.py)
│   │   ├── domain/         # Pure logic: schedule.py, strength.py, recall.py, clock.py,
│   │   │                   #   sample.py
│   │   ├── planner/        # Optional: PlannerProvider interface, rule_based.py, llm.py
│   │   ├── models.py       # SQLModel tables
│   │   ├── schemas.py      # Pydantic request/response models
│   │   └── db.py           # Engine and session dependency
│   ├── tests/              # pytest + Hypothesis, mirrors app/ layout
│   ├── pyproject.toml
│   └── .env.example        # includes ALLOW_TIME_WARP
├── frontend/
│   ├── src/
│   │   ├── components/     # CassettePlayer/, RecallPanel/, TapeShelf/, JCard/,
│   │   │                   #   Recorder/, Settings/, Toast/
│   │   ├── domain/         # Pure TS logic: strength.ts, clock.ts (mirrored from backend),
│   │   │                   #   effects.ts (frontend only), eventQueue.ts (Optional)
│   │   ├── audio/          # Web Audio engine (noise, rain, lofi), recordingStore.ts
│   │   │                   #   (IndexedDB), decayedPlayback.ts
│   │   ├── api/            # Typed API client
│   │   ├── hooks/          # useTapePlayer, useRecall, useListenerId, useReducedMotion,
│   │   │                   #   useVirtualClock
│   │   ├── styles/
│   │   └── main.tsx
│   ├── tests/
│   └── package.json
├── docs/                   # Kiro playbook, write-up notes, screenshots for Devpost
├── LICENSE
└── README.md
```

## Naming
- Python: `snake_case` files and functions, `PascalCase` classes.
- TypeScript: `PascalCase` component folders with `index.tsx`, `camelCase` functions.
- Domain vocabulary is shared between frontend and backend: **tape**, **side**, **track**
  (a study topic with key terms), **interlude** (break), **session** (one play-through),
  **recall** (one REC attempt), **score**, **strength** (0–100), **stability** (days),
  **condition** (Mint/Worn/Warped/Haunted/Dead), **due**, **virtual time**.
- The old term "health" is retired. Use strength for a track and condition for a tape.
