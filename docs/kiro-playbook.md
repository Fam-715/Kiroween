# Kiro Playbook (team notes)

Technological Implementation (use of Kiro) is 20% of the score, and "insufficient use of
Kiro" is a Stage 1 disqualification. Use as many Kiro features as make sense, and **log
what happened** below as you go — this log becomes the Devpost write-up.

## 1. Steering (`.kiro/steering/`)
Already drafted: `product.md`, `tech.md`, `structure.md` (all `inclusion: always`).
Ideas to add in Kiro:
- `audio.md` with `inclusion: fileMatch` and `fileMatchPattern: "frontend/src/audio/**"`
  so audio rules only load when editing audio code.
- `design-system.md` for colours, fonts and the haunted effect levels.

## 2. Spec (`.kiro/specs/mixtape-core/`)
- Open the spec in Kiro, review `requirements.md` → `design.md` → `tasks.md`, and let Kiro
  refine them before running tasks.
- Run tasks one at a time from `tasks.md`. Note which tasks Kiro got right first time and
  where you had to steer it.
- Consider a second spec later (e.g. `haunted-effects`) to show spec-per-feature.

## 3. Agent hooks (create in Kiro's Agent Hooks panel)
| Hook | Trigger | Action |
|---|---|---|
| Backend tests | Save `backend/**/*.py` | Run `uv run pytest` and fix failures |
| Frontend tests | Save `frontend/src/**/*.{ts,tsx}` | Run `npm test -- --run` for related tests |
| Domain parity | Save `backend/app/domain/health.py` | Update `frontend/src/domain/health.ts` to match |
| API docs sync | Save `backend/app/api/**` | Update the API table in `design.md` |
| A11y check | Save `frontend/src/components/**` | Check aria labels, focus states, reduced motion |

## 4. MCP
Candidates: a GitHub MCP server (issues/PRs), a Playwright/browser MCP for checking the UI,
docs MCP for FastAPI/React references. Write down what each one let you do.

## 5. Property-based testing
Planned properties are listed in `design.md` → Testing strategy. Record any bug a property
test caught that unit tests missed — judges ask about this specifically.

## 6. Kiro powers / custom agents / Crew
Try at least one and note how it compared (e.g. a custom "audio engineer" agent for the
Web Audio code, or Kiro CLI for running tasks).

## Write-up log
| Date | Who | Kiro feature | What happened / what we learned |
|---|---|---|---|
| | | | |
