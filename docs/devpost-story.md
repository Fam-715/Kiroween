# Devpost submission draft: Cursed Cassette

Copy each section into the matching Devpost field. Before submitting, update the numbers
marked **[update]** and remove any feature that didn't ship.

---

## Project name
Cursed Cassette: Study Tapes That Decay As You Forget

## Elevator pitch (tagline)
A cassette recorder for studying, back from the dead. Record what you learned in your own
voice. Forget it, and the tape decays, warps and haunts you until you review.

## Category
Resurrection

## Built with (tags)
kiro, react, typescript, vite, tailwindcss, framer-motion, web-audio-api, mediarecorder,
web-speech-api, indexeddb, python, fastapi, sqlmodel, sqlite, hypothesis, fast-check,
vitest, pytest, vercel, render

## Try it out (links)
- Live demo: https://kiroween-liart.vercel.app/
- Source code: https://github.com/Fam-715/Kiroween
- Demo video: **[add YouTube link]**

---

## Inspiration
We're three university students, and we all know the feeling: you study a topic for hours,
and a week later most of it is gone. Nothing warns you. Your notes look exactly as fresh as
the day you wrote them, so you re-read them instead of testing yourself, and you skip
breaks because a timer can't tell you whether any of it stuck.

Then we thought about cassette tapes. A cassette does two things your notes don't: it
**records**, and it **decays**. Real tape wears, warps and hisses over time, which is
exactly what memory does. Explaining a topic out loud from memory is one of the best ways
to learn it, and a mixtape is a planned sequence with a fixed length, just like a study
session. So we resurrected the cassette, not as nostalgia, but as a study method.

## What it does
- **Record a tape.** Pick a C60, C90 or C120 tape with Side A and Side B. Each track is a
  study topic with 3–5 key terms; interludes are breaks. The tape has a fixed length, so
  you plan an honest session.
- **Play to focus.** A cassette player with PLAY, PAUSE, STOP, REW, FF and the flip to Side
  B, with focus sound (brown noise, rain or lo-fi) generated live in the browser. Skip a
  break and "the tape remembers": those tracks will fade faster.
- **REC to recall.** When a track ends, press REC and explain the topic from memory. Your
  speech is transcribed (or you can type), and we score how many key terms you mentioned.
  Your voice recording never leaves your device, and the server never stores your recall
  text, only the score.
- **Decay.** Every track has a memory strength from 0 to 100 that follows a forgetting
  curve. Strength sets the condition: Mint, Worn, Warped, Haunted, Dead. A good recall
  makes the memory last longer; a poor one shortens it.
- **Decayed playback.** Play back your own recording and it hisses, wobbles and distorts as
  you forget.
- **Restore.** Review a track and it comes back to Mint, and the next review moves further
  out. That's spaced repetition, hidden inside a cassette.
- **Haunted shelf.** Tapes with tracks due for review look haunted. Tapes you forget
  completely become ghosts.
- **Demo helpers for judges.** Demo mode (1-minute tracks), a sample tape with tracks at
  every condition, and a clearly labelled time warp where one day passes every minute.

## How we built it
We built the whole app in **Kiro**, using spec-driven development from the first day.

1. **Steering first.** We wrote `product.md`, `tech.md` and `structure.md` as always-on
   steering, so Kiro understood the product and our vocabulary (tape, side, track,
   interlude) from its first chat. A `design-system.md` steering file loads only when
   frontend files are open.
2. **Spec before code.** We wrote 15 requirements, each with an acceptance list and a
   property-based testing statement, then a design and a task list. Before writing any
   code, we asked Kiro for a read-only consistency check across all three files. It found
   7 real problems, such as a session "stop" that could apply the abandon penalty twice.
3. **One task, one branch, one pull request.** Each of us ran tasks with **Start task**
   from the spec, opened a pull request, and the team lead reviewed and merged it. Kiro's
   `tasks.meta.json` keeps a record of which chat session built each task.
4. **Property-based tests for the maths.** The decay model is the heart of the app, so
   Kiro wrote Hypothesis (Python) and fast-check (TypeScript) property tests: strength
   always stays between 0 and 100, it never increases on its own, every saved tape fits its
   side, duplicate network events apply exactly once, and the frontend's prediction matches
   the backend for the same inputs. **[update: test counts, e.g. 111 backend and 101
   frontend tests]**
5. **A hook that guards the spec.** An agent hook runs whenever `requirements.md` or
   `design.md` is saved and reports any requirement that no task covers. It caught a real
   gap: the rule that time warp must never speed up the focus timer had no task.
6. **A custom agent and MCP.** A read-only `pbt-reviewer` agent compares the code with the
   spec's properties and lists missing property tests. The fetch MCP server let Kiro check
   our Web Speech, MediaRecorder and IndexedDB research against MDN.

**Stack:** React 18, TypeScript, Vite, Tailwind and Framer Motion on the frontend, using the
Web Audio, MediaRecorder, Web Speech and IndexedDB browser APIs. Python 3.12, FastAPI,
SQLModel and SQLite on the backend. Deployed on Vercel and Render. No accounts: each browser
gets an anonymous listener ID.

## Challenges we ran into
- **Changing the idea halfway through planning.** Our first spec was a cassette-themed
  focus timer. We realised the cassette's real features, recording and decay, should drive
  the learning, so we pivoted to record → decay → restore. Kiro listed 15 conflicts and
  open questions before changing the spec, which made the pivot safe.
- **A rule that felt fair on paper but not in practice.** Originally, one failed recall
  dropped a track straight to Dead and could turn a whole tape into a ghost. In a
  walkthrough that felt punishing, so we changed the requirement: a poor recall now floors
  at Warped, and tapes only die by being forgotten. Kiro updated the requirement, design,
  code and property tests together, and the hook confirmed nothing was left uncovered.
- **Speech isn't spelling.** Strict key-term matching meant "cells" didn't count for
  "cell". We changed the spec to accept simple plurals.
- **Windows and tooling surprises.** Kiro once damaged spec files by editing Markdown with
  shell scripts, so we added a steering rule to use Kiro's file tools only. Node 26's
  built-in `localStorage` broke our tests until we pointed them back at jsdom's.
- **Deployment details.** A single trailing slash in our CORS setting blocked every request
  from the live site. We found it by testing each origin against the live server.
- **Making decay demo-able.** Forgetting takes days, and judges have minutes. We added Demo
  mode, a sample tape and a virtual clock (time warp) that keeps time continuous when you
  switch it on and off.

## Accomplishments that we're proud of
- The cassette isn't decoration. Recording, decay, playback and the tape's length are each
  a real part of the learning method.
- Privacy by design: your voice stays in your browser, and the server never stores what you
  said, only the score. We tested that directly against the database.
- The maths is checked by property-based tests on both the backend and frontend, and the
  two must agree.
- Three students, three Kiro workflows, one spec: every feature traces back to a
  requirement.

## What we learned
- Writing the spec first was slower on day one and much faster afterwards. Most of our
  bugs were caught in the spec review, before any code existed.
- Steering works best when you add a rule the moment Kiro does something you didn't want.
- Property-based tests found edge cases we would never have written examples for, such as
  floating-point noise right at the "due for review" boundary.
- Kiro's Spec agent stays strictly inside the task list; for fixes outside it, we used the
  Default agent.
- How the forgetting curve and spaced repetition actually work, which has already changed
  how we study.

## What's next for Cursed Cassette
- Ghost whispers: faint fragments of your old recording on Haunted tapes.
- A strength history chart on each tape's J-card.
- Full offline support, so you can study with no connection and sync later.
- An AI "mixtape DJ" that plans your study tapes from a syllabus, and AI feedback on
  what your recall missed.
- Sharing tapes with classmates.
