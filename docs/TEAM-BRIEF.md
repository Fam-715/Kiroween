# Team Brief: Cursed Cassette (Kiroween 2026)

> **How to use this file:** give this whole file to your own Claude (paste it in, or attach
> it) at the start of a conversation, then say who you are, for example
> *"I'm Teammate A. Help me with my next task."* Section 9 tells Claude how to help.
>
> Last updated: 24 November 2026. The team lead keeps this file current on `main`.

---

## 1. The hackathon in 60 seconds

- **Event:** Kiroween 2026 (Devpost), run by AWS/Kiro. https://kiroween.devpost.com
- **Category:** Resurrection: bring a dead technology back to life with today's tech.
- **Team:** 3 members, all students. We're also entering **Best Student Project:
  Resurrection** ($1,500 + Kiro Pro Max).
- **Deadline:** Friday **4 Dec 2026, 2:00 PM Pacific** = **Saturday 5 Dec, 6:00 AM Malaysia
  time**. Our internal deadline is **Friday 4 Dec, 8:00 PM MYT**. No extensions.
- **Kiro credits:** each member can request **4,000 free credits** via the form on the
  Resources tab (ID check; Devpost name must match your ID exactly). Request deadline:
  **1 Dec 12:00 PM PT = 2 Dec 4:00 AM MYT**. Redeem by 4 Dec. Until then we each have 50
  free credits.

### The rule that matters most
The project must be **built with Kiro**. *"Insufficient use of Kiro will result in
disqualification."* So **application code and Kiro configuration are created in Kiro**.
Other AI tools (like Claude) are fine for research, writing, planning and reviewing.

### How we're judged (each 20%)
| Criterion | What judges look for |
|---|---|
| Potential Impact | Real problem, real audience, would people use it? |
| Technological Implementation | How deeply and in how many ways we used **Kiro** |
| Design | Complete, polished, intentional product |
| Innovation / Idea | Creative, novel, unusual combination |
| Presentation | Demo video shows it working end to end; clear pitch |

### What we must submit
- [ ] Public GitHub repo with an **MIT license** (done) and the **`/.kiro` folder** at the
      root (never gitignored)
- [ ] Working **live URL** that stays up until **29 Jan 2027**
- [ ] **Demo video under 3 minutes** on YouTube (public), no copyrighted music, no
      trademarks (no "Sony", "Walkman", "TDK"…)
- [ ] Text description (drafted on Devpost)
- [ ] **"How we used Kiro" write-up**: specs, hooks, steering, MCP, property-based testing,
      custom agents, powers, IDE vs CLI
- [ ] Student details for all 3: LinkedIn, student email, year and degree, school
- [ ] Bonus: a **blog post** (Medium/dev.to) and a **social post starting with
      #KiroweenHackathon26**, written in our own words

---

## 2. The product

**Cursed Cassette: Study Tapes That Decay As You Forget**

> A cassette recorder for studying, back from the dead. Record what you learned in your own
> voice. Forget it, and the tape decays, warps and haunts you until you review.

**Why it's a resurrection:** cassettes *recorded* your voice and physically *decayed*. We
use exactly those two features as a learning method: **active recall** (explain from memory)
and **spaced repetition** (review before you forget).

### The core loop
1. **Record a tape:** C60/C90/C120 with Side A and Side B. Each track = a study topic with
   3–5 key terms. Interludes = breaks.
2. **Play to focus:** cassette controls PLAY / PAUSE / STOP / REW / FF, flip to Side B.
3. **REC to recall:** when a track ends, explain the topic from memory (30–90 s). The
   browser transcribes it (Web Speech API, typing fallback). Score = key terms mentioned.
4. **Decay:** each track's memory strength (0–100) fades on a forgetting curve
   R(t) = e^(−t/S). Good recalls make it last longer.
5. **Decayed playback:** your own recording plays back with hiss, wobble and distortion as
   you forget.
6. **Restore:** re-record to bring a track back; the app shows when to review next.
7. **Haunted shelf:** tapes with due tracks look haunted; forgotten tapes become ghosts.
8. **For judges:** "Demo mode" (1-minute tracks), "Load sample tape", "Demo time warp"
   (1 day per minute).

**Conditions:** Mint (80–100) → Worn (50–79) → Warped (20–49) → Haunted (1–19) → Dead (0).
A tape is Dead (a ghost) only when every recorded track is Dead.

**Privacy:** recordings stay in the browser (IndexedDB). Only the transcript is sent to be
scored, and it isn't stored. No accounts: an anonymous listener ID in localStorage.

### Tech stack
| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript, Tailwind, Framer Motion |
| Audio | Web Audio API (all sounds generated, no music files), MediaRecorder, Web Speech API |
| Backend | Python 3.12, FastAPI, SQLModel, SQLite (managed with `uv`) |
| Tests | pytest + Hypothesis, Vitest + fast-check (**property-based testing everywhere**) |
| Hosting | Vercel (frontend), Render (backend) |

### Where the source of truth lives
| File | What it is |
|---|---|
| `.kiro/steering/product.md` | Product vision (always loaded by Kiro) |
| `.kiro/steering/tech.md` | Stack and coding rules |
| `.kiro/steering/structure.md` | Folder layout and vocabulary |
| `.kiro/specs/mixtape-core/requirements.md` | What the app must do (15 numbered requirements) |
| `.kiro/specs/mixtape-core/design.md` | How it's built (data model, API, formulas, effects table) |
| `.kiro/specs/mixtape-core/tasks.md` | The build plan (tasks 1–18 + Optional O1–O7) |
| `docs/team-workflow.md` | Git branches and Pull Requests, step by step |
| `docs/kiro-playbook.md` | Kiro features to use + the team lead's log |

If this brief and the spec ever disagree, **the spec wins**.

---

## 3. Current status (24 Nov)

- ✅ Idea, name and pitch decided; Devpost draft started
- ✅ Steering docs and the full `mixtape-core` spec written, reviewed and consistency-checked
  with Kiro (pivot from "focus timer" to "record → decay → restore"; 7 cross-file issues
  found and fixed before any code)
- ✅ Repo, MIT license, team workflow guide
- ✅ Team lead's 4,000 hackathon credits have arrived
- ✅ Spec coverage agent hook working (`.kiro/hooks/spec-coverage-check.json`)
- ✅ **Task 1 (scaffold) merged to `main`. The build has started.** Backend and frontend
  tests pass.
- ✅ Teammate A: fetch MCP server + browser API research (PR #1, merged)
- 🔄 Teammate B: design-system steering (PR to open after moving sound notes to
  `docs/design/sounds.md`)
- ▶️ Next: Team lead → 2.1; Teammate A → 7.1 (API client, needed by B's UI); Teammate B →
  7.4 (theme and layout). See section 6.

**Setup after pulling `main`:** in the Kiro terminal run `cd backend` then `uv sync`, and
`cd frontend` then `npm.cmd install`. If PowerShell blocks `npm`, use `npm.cmd`.

**Merging during the build:** every "Start task" ticks a box in `tasks.md` and updates
`tasks.meta.json`, so branches touch the same files. Before opening a PR, use **Branch →
Update from main** in GitHub Desktop. In `tasks.md` conflicts, keep both ticked boxes. Ask
the team lead about `tasks.meta.json` conflicts.

---

## 4. Roles

| Person | Owns | Kiro features they showcase |
|---|---|---|
| **Team lead** | Backend, spec, merging PRs, demo video, write-up | Specs, hooks, task execution |
| **Teammate A** | Recording, speech, audio, data, research | MCP, custom agents, property-based tests |
| **Teammate B** | Visual design, UI components, haunted effects | Steering (fileMatch), powers, UI building |

---

## 5. Task list by person

Branch names: `<yourname>/<task>`. Full Git steps: `docs/team-workflow.md`.
**Always paste Kiro prompts from a code block** so asterisks and paths aren't stripped.

### Teammate A

**A1. MCP setup + browser research** (in progress) · branch `<name>/mcp-setup`
- `.kiro/settings/mcp.json` with the fetch server; `docs/research/browser-apis.md`
- Make sure the **fetch MCP server shows as connected** in Kiro's MCP Servers panel
  (needs `uv` installed; restart Kiro after installing). Re-run the research **using the MCP
  tool** and screenshot it.

**A2. Custom agent** · branch `<name>/pbt-agent`
```text
Create a workspace custom agent in .kiro/agents/pbt-reviewer.md. Its job: review domain code in backend/app/domain/ and frontend/src/domain/ and suggest missing property-based tests (Hypothesis/fast-check) based on the requirements in .kiro/specs/mixtape-core/requirements.md. Include our steering files as resources. Use your file editing tools only.
```
Check it appears in the agent picker (bottom of the Kiro chat, "Workspace" group).

**A3. Sample tape content** · branch `<name>/sample-tape`
The spec already fixes the sample tape (design.md → sample tape table: Photosynthesis,
Cell respiration, Enzymes, DNA replication). Use Claude to write a realistic 60-second
spoken explanation for each of those 4 topics that mentions *some* of each track's key
terms (copy the key terms from design.md). Save as `docs/research/sample-content.md`. These
are used to test recall scoring and to rehearse the demo video.

**A4. Better MCP server (after task 1 is built)** · branch `<name>/playwright-mcp`
Add the Playwright MCP server so Kiro can open the running app in a browser and check the UI.
This gives a strong answer to the write-up question "what did MCP make possible?"

### Teammate B

**B1. Design-system steering** (in progress) · branch `<name>/design-system`
- `.kiro/steering/design-system.md`. Front matter must be exactly:
```yaml
---
inclusion: fileMatch
fileMatchPattern:
  - "frontend/src/**/*.tsx"
  - "frontend/src/**/*.css"
---
```

**B2. Clickable prototype** · branch `<name>/prototype`
```text
Build a single standalone file docs/prototype/cassette-player.html (plain HTML, CSS and JS, no build step) showing an original SVG cassette player with spinning reels, an LCD countdown, PLAY/PAUSE/STOP/REW/FF/REC buttons, and a dropdown to switch between Mint, Worn, Warped, Haunted and Dead conditions with the matching visual effects from .kiro/steering/design-system.md. Respect prefers-reduced-motion. No brand names or logos. Use your file editing tools only.
```
Open it in a browser and screenshot each condition (for Devpost and design review).

**B3. Sound design notes** · branch `<name>/sounds`
With Claude: list the sounds the app needs (button clunk, REC beep, tape stop, hiss, chime…)
and describe how to generate each with the Web Audio API (no audio files). Save as
`docs/design/sounds.md`.

**B4. Try a Kiro power** · branch `<name>/power`
Browse https://kiro.dev/powers or the powers panel in Kiro (ghost icon with a lightning
bolt). Install one relevant to React/frontend or testing, use it on a small task, and log
what it did.

### Team lead
- Review and merge PRs; keep this brief and the spec current
- Create agent hooks (spec consistency check; tests on save once code exists)
- Run **task 1 (scaffold)**, merge it, then announce "build starts"
- `docs/demo-script.md` (3-minute storyboard), Devpost text, social and blog posts

---

## 6. Build phase: who runs which spec tasks (once task 1 is merged)

Tasks are in `.kiro/specs/mixtape-core/tasks.md`. Run each task **from Kiro's task list**
(that's how spec-driven development shows up for judges), one task per branch where possible.

| Order | Team lead (backend) | Teammate A (frontend logic + audio) | Teammate B (UI + visuals) |
|---|---|---|---|
| **First, alone** | **1** Scaffold → merge to `main` | wait, then pull | wait, then pull |
| Phase 1 | **2.1–2.4** domain, **3** persistence, **4** tape API, **4.1** settings API (Demo mode), **5** session API, **6** recall API | **7.1** API client, **7.2** strength/clock + `useVirtualClock`, **7.3** effects, **9.1** player state machine, **9.3** events + chime | **7.4** theme/layout, **8** Recorder UI, **8.1** Demo mode toggle, **9.2** CassettePlayer, **10** RecallPanel (typed) |
| Phase 2 | **14.1** time warp, **14.2** sample tape | **11** voice recall, **12** decayed playback, **16** focus audio | **13** break-skip feedback, **14.3** Settings UI, **15** shelf + J-card, **17** haunted effects |
| Phase 3 | **18** deploy, video, write-up | smoke test speech/mic on phones and browsers | screenshots, Devpost gallery, polish |

**Dependencies:** nobody starts until task 1 is merged. Teammate B's UI tasks use Teammate
A's 7.1 API client; merge 7.1 early. Frontend tasks that call the API need the lead's
endpoints merged (or use mock data until then).

**Cut order if we're late:** task 17 visuals (keep condition text) → lo-fi/rain audio (keep
brown noise) → shelf polish. Optional tasks O1–O7 only if everything else is done.

### Timeline (Malaysia time)
| Date | Goal |
|---|---|
| 24–25 Nov | Setup tasks A1–A3, B1–B4; spec hook; **task 1 scaffold merged** |
| 25–29 Nov | Phase 1 → **demo checkpoint**: record tape, play, REC (typed), see score and strength |
| 30 Nov–2 Dec | Phase 2: voice, decay playback, demo settings, shelf, effects |
| 2 Dec | **Deployed live** |
| 3–4 Dec | Polish, video, write-up, blog and social posts |
| **4 Dec 8 PM** | **Submit** (hard deadline 5 Dec 6 AM MYT) |

---

## 7. Rules for everyone

1. **Branches + Pull Requests only.** Never commit to `main` directly. Pull `main` before
   starting each task.
2. **During setup tasks, only add new files.** Don't edit `.kiro/specs/**`, `product.md`,
   `tech.md`, `structure.md`, `README.md` or `docs/kiro-playbook.md` unless the lead says so.
3. **Build in Kiro.** App code and `.kiro/` configuration are made by Kiro. Use Claude for
   research, drafting, planning prompts and reviewing Kiro's output.
4. **Kiro in Supervised mode** while learning. Review diffs before accepting. Kiro must edit
   files with its file tools, not PowerShell scripts (it's in our steering).
5. **Log every Kiro session** in `docs/kiro-log/<yourname>.md`:
   ```markdown
   | Date | Kiro feature | What I asked | What happened / what I learned |
   |---|---|---|---|
   ```
   Log problems and fixes too. These become our write-up.
6. **Screenshot interesting Kiro moments** (spec review, hooks firing, MCP calls, PBT
   failures) into `docs/screenshots/`.
7. **No secrets** in the repo (`.env` is gitignored; only commit `.env.example`).
8. **No copyrighted or trademarked material**: no brand names, logos, songs or traced
   artwork. Sounds are generated in code or CC0 with sources noted.
9. **Save credits:** start a new Kiro chat session per task; don't paste huge files.

---

## 8. Kiro features we must show (write-up checklist)

| Feature | Owner | Status |
|---|---|---|
| Steering (always) | Lead | ✅ product, tech, structure |
| Steering (fileMatch) | B | 🔄 design-system.md |
| Spec-driven development + Review | Lead | ✅ mixtape-core (incl. consistency check) |
| Task execution from spec | Everyone | ⏳ starts with task 1 |
| Agent hooks | Lead | 🔄 spec-check hook |
| MCP | A | 🔄 fetch → Playwright later |
| Custom agent | A | ⏳ pbt-reviewer |
| Property-based testing | Everyone | ⏳ in every domain task |
| Kiro powers | B | ⏳ |
| Kiro CLI (compare with IDE) | anyone | ⏳ optional |

---

## 9. Instructions for Claude (read this if you're the AI assistant)

You're helping one member of a 3-person student team on the Kiroween 2026 hackathon.

**Do:**
- Help with the member's tasks in sections 5 and 6: explain steps simply, write **prompts
  for them to paste into Kiro** (always in a code block), review what Kiro produced against
  the spec, and help debug errors they paste in.
- Help with research, sample content, writing (Devpost text, blog, video script) and Git
  questions (they use **GitHub Desktop** on **Windows**; see `docs/team-workflow.md`).
- Check suggestions against the spec files listed in section 2. Ask the member to paste
  the relevant spec section if you need it.
- Keep scope tight: the deadline is 4 Dec. Prefer finishing MVP tasks over adding features.
- Point out anything that could break hackathon rules (trademarks, copyrighted assets,
  missing `.kiro` usage, secrets in the repo).

**Don't:**
- Don't write application code for the member to paste into the repo by hand. App code is
  generated in Kiro so it counts as Kiro usage. You can explain code, review it, and write
  Kiro prompts.
- Don't change the product direction, spec or stack. Suggest changes to the member, who
  raises them with the team lead.
- Don't suggest paid APIs or services. The app must work free, without API keys.
- Don't use the words "Walkman", "Sony" or other brand names in anything for the project.

**The member's setup:** Windows, PowerShell, GitHub Desktop, Kiro IDE, Python 3.12 + uv,
Node.js 20+. They're students, so explain step by step.

---

## 10. Glossary

| Term | Meaning |
|---|---|
| Tape | A study session plan: length C60/C90/C120, Side A + Side B |
| Track | A study topic with 3–5 key terms and a focus duration |
| Interlude | A break between tracks |
| Recall | One REC attempt: explaining a track from memory |
| Score | Fraction of key terms mentioned in a recall (0–1) |
| Strength | How well a track is remembered right now (0–100) |
| Stability | How slowly strength decays, in days |
| Condition | Mint / Worn / Warped / Haunted / Dead |
| Due | A track whose unrounded strength has fallen to 70 or below: time to review |
| Ghost | A tape where every recorded track is Dead |
| Virtual time | Clock used by the Demo time warp |
| Steering | Markdown files in `.kiro/steering/` that Kiro always (or conditionally) reads |
| Spec | requirements + design + tasks in `.kiro/specs/mixtape-core/` |
| Hook | An automation in `.kiro/hooks/` that Kiro runs on events (e.g. file save) |
| MCP | Plug-ins that give Kiro extra tools (e.g. fetch web pages, control a browser) |
| PBT | Property-based testing: tests that check rules hold for many random inputs |
