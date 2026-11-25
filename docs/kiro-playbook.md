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
| 2026-11-23 | Fam | Steering | Wrote product.md, tech.md and structure.md (always included). Kiro understood the product, stack and vocabulary (tape, side, track, interlude, health) from the first chat. |
| 2026-11-23 | Fam | Spec review | Used the Review button on requirements.md. Kiro rebalanced tape health (skip break -15 → -12) and added focus styles (Pomodoro 25/5, Deep work 50/10). |
| 2026-11-23 | Fam | Spec / PBT | Asked Kiro to make the requirements testable. It added a property-based test note to every requirement (e.g. health always 0–100, any generated plan is valid). |
| 2026-11-23 | Fam | Spec review | Our review caught edge cases: Deep work tracks (50 min) don't fit on a C60 side (30 min), and tasks under 10 min break the minimum track length. Kiro fixed the planner rules and added example tests for both. |
| 2026-11-23 | Fam | Spec / tasks | Cut scope to fit 11 days. Kiro reorganised tasks into 3 MVP phases with a demo checkpoint, plus an Optional list. Moved effects and the offline queue from the backend to the frontend. |
| 2026-11-23 | Fam | Steering | Kiro damaged spec files twice by editing Markdown with PowerShell scripts (it recovered both times). We added a steering rule to tech.md: edit files with Kiro's file tools only. |
| 2026-11-24 | Fam | Spec pivot | Pivoted from a cassette focus timer to record → decay → restore so the cassette's real features drive learning. Kiro listed 15 conflicts and open questions with defaults before editing. |
| 2026-11-24 | Fam | Spec review | Judges couldn't test quickly (10-min minimum tracks), so we added Demo mode, Load sample tape and Demo time warp. |
| 2026-11-24 | Fam | Spec consistency check | Asked Kiro for a read-only cross-check of requirements, design and tasks. It found 7 real issues (double abandon penalty from duplicate "stop", Demo mode needed in phase 1 but built in phase 2, tapes Dead but not ghosts). All fixed before writing code. |
| 2026-11-24 | Fam | Agent hook | Created a read-only spec coverage hook (File Saved → Ask Kiro) and narrowed its file pattern to requirements.md and design.md so task checkbox updates don't trigger it. It was disabled at first; after enabling and reloading, a Kiro edit to design.md triggered it ("1 hook triggered"). It read requirements.md and tasks.md, treated Req 1–13 as MVP and 14–15 as Optional, and reported no gaps. |
| 2026-11-24 | Fam | Spec task execution | Ran Task 1 (scaffold) with "Start task" from the spec's task list. Kiro created the FastAPI backend and Vite/React frontend, theme tokens from the design, and passing tests on both sides. It worked around PowerShell blocking npm.ps1 by using npm.cmd on its own. |
| 2026-11-24 | Fam | Spec task + PBT | Ran Task 2.1 (schedule.py). Kiro wrote 7 Hypothesis property tests (valid tapes pass, over-capacity fails, remaining = capacity − total, demo-mode minimums). It changed validate_side's signature to take tape length, so we updated design.md to keep the spec in sync. |
| 2026-11-24 | Fam | Agent hook | Updating design.md triggered our spec coverage hook automatically. It found a real gap: requirement 12.11 wasn't referenced by any task. We added it to task 9.1. |
| 2026-11-24 | Fam | Spec task + PBT | Ran Task 2.2 (strength.py: forgetting curve, stability, conditions, ghost rule). Kiro delegated to a sub-agent, which wrote Hypothesis property tests (strength 0–100 and non-increasing over time, stability bounds, penalties never raise stability, monotonic condition). It skips values within 1e-6 days of the due boundary to avoid float rounding noise. 21 tests pass across repeated runs. |
| 2026-11-24 | Fam | Spec task + PBT | Ran Task 2.3 (recall.py, key-term scoring). Kiro filled two spec gaps on its own (duplicate terms count once, empty terms are ignored). Our manual check found that "cells" doesn't match "cell" under strict whole-word matching, which would feel unfair in real speech. We updated the spec to accept simple plurals ("cell" matches "cells"). |
| 2026-11-24 | Fam | Spec task + PBT | Ran Task 2.4 (clock.py, virtual time for the Demo time warp). Kiro wrote the 4 required Hypothesis properties plus 2 of its own (time advances at the new scale; unsupported scales are rejected). Task 2 (all backend domain logic) is complete: 38 tests pass. |
| 2026-11-24 | Fam | Spec task execution | Ran Task 3 (SQLModel tables, X-Listener-Id dependency). 48 tests passed, but our review found the real app never created its tables (create_db_and_tables wasn't called), and that tasks 4 and 8 had parent text Kiro would skip. |
| 2026-11-24 | Fam | Spec agent vs Default | The "Start task" session runs as the Spec agent and refused a fix outside the task list, though it planned the exact edits. In a Default-agent session Kiro added a startup lifespan with a test and split tasks 4 and 8 into 4.1/4.2 and 8.1/8.2. |
| 2026-11-24 | Fam | Spec task execution | Ran Task 4.1 (Tape API). 59 tests pass; we smoke-tested create, 422 rule errors, listener isolation and delete. Kiro noted the J-card stats (Req 11.4) weren't in its task; our check found no backend task covered them, so we added them to task 5. Also added a steering rule for the Windows test command after repeated garbled terminal output. |
| 2026-11-24 | Fam | Spec task execution | Ran Task 4.2 (settings API, Demo mode). 66 tests pass. Our review spotted that the frontend's useVirtualClock (task 7.2) needs real_now/virtual_now/time_scale from /api/settings before the time warp task, so we added the read-only clock fields now to avoid an integration break at the demo checkpoint. |
| 2026-11-25 | Fam | Spec task + PBT | Ran Task 5 (Session API). 84 tests pass, including a Hypothesis test that any pattern of duplicate event deliveries gives the same final state. Our walkthrough confirmed the penalties (skip break ×0.9, abandon ×0.8, applied once) and the J-card stats. Kiro chose to auto-abandon a stale open session when a tape is restarted, so a closed browser tab can't lock the tape. |
| 2026-11-25 | Fam | Spec task execution | Ran Task 6 (Recall API). We verified the privacy promise directly: after a recall, the text appears in no database table, only the score and matched/missed terms. This completes the phase 1 backend (tasks 1–6). |
| 2026-11-25 | Fam | Spec change + hook | Our walkthrough found a single failed recall (score 0) instantly killed the track and could turn the whole tape into a ghost. We changed the rule so a poor recall floors at strength 20 (Warped) and tapes only die through decay. Kiro updated requirements, design, code and property tests together, and the spec coverage hook confirmed no gaps. 96 tests pass. |