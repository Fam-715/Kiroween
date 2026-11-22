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
│   │   ├── api/            # Routers: tapes.py, sessions.py, planner.py
│   │   ├── domain/         # Pure logic: health.py, schedule.py, sides.py
│   │   ├── planner/        # PlannerProvider interface, rule_based.py, llm.py
│   │   ├── models.py       # SQLModel tables
│   │   ├── schemas.py      # Pydantic request/response models
│   │   └── db.py           # Engine and session dependency
│   ├── tests/              # pytest + Hypothesis, mirrors app/ layout
│   ├── pyproject.toml
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/     # CassettePlayer/, TapeShelf/, JCard/, Recorder/
│   │   ├── domain/         # Pure TS logic mirrored from backend (health prediction)
│   │   ├── audio/          # Web Audio engine: noise, rain, lofi loop, distortion
│   │   ├── api/            # Typed API client
│   │   ├── hooks/          # useTapePlayer, useListenerId, useReducedMotion
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
  (focus block), **interlude** (break), **session** (one play-through), **health**.
