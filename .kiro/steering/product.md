---
inclusion: always
---

# Product: Cursed Cassette

**Hackathon:** Kiroween 2026, **Resurrection** category.
**Dead tech being resurrected:** the 1980s–90s portable cassette player and the hand-made mixtape.

## One-line pitch
A focus timer for students, built as a haunted cassette player. Each study session is a
mixtape you record and play: tracks are focus blocks, interludes are breaks. Treat the tape
well and it plays clean. Skip your breaks or abandon sessions and the tape warps, hisses
and becomes haunted.

## The real problem
University students struggle to start and sustain focused study, and they burn out by
skipping breaks. Generic Pomodoro timers are easy to ignore and give no emotional feedback.

## Target users
University students (first audience: our own campus) studying for exams and assignments,
usually on a laptop, sometimes on a phone.

## Why a cassette (the resurrection story)
- A mixtape was a *planned* sequence with a fixed length (C60 = 30 min per side, C90 = 45).
  That maps naturally to planning a study session with a fixed time budget.
- Tape degrades physically when mistreated. We use that as a feedback loop: "tape health"
  reflects study habits (skipped breaks, abandoned sessions, overruns).
- Modern additions: an AI "Mixtape DJ" that turns a task list into a session plan,
  generated (non-copyrighted) ambient focus audio, and session history as "liner notes".

## Core features (MVP, must ship)
1. **Record a mixtape**: choose tape length (C60/C90/C120), add tracks (focus blocks named
   after tasks) and interludes (breaks). Or ask the Mixtape DJ to generate one.
2. **Play the tape**: cassette player UI with PLAY / PAUSE / STOP / REW / FF.
   PLAY starts the current block, FF skips it, REW restarts it, STOP ends the session.
   Side A to Side B flip in the middle of the session.
3. **Tape health (0–100)**: drops when breaks are skipped, sessions abandoned or focus
   blocks overrun; recovers slowly when breaks are taken. Health drives visual and audio
   distortion (wobble, hiss, colour bleed, ghost whispers at low health).
4. **Procedural focus audio**: brown/pink noise, rain and a simple lo-fi loop generated in
   the browser with the Web Audio API. No copyrighted music, ever.
5. **Liner notes**: per-tape history (tracks finished, time focused, health over time) shown
   as a cassette J-card. A shelf shows all past tapes; dead tapes become "haunted".

## Stretch features (only after MVP is done and deployed)
- Shareable mixtape plans (link to a read-only tape template).
- Study-group "tape trading": a friend can play your tape plan.
- Mobile PWA install and offline mode.

## Non-goals
- No user accounts or passwords. Judges must be able to test instantly.
- No streaming of real songs or Spotify integration.
- No Sony or "Walkman" branding anywhere (trademark). Say "cassette player".

## Tone and design
Spooky, nostalgic, a little funny, never gory. Think a 1980s cassette player found in an
abandoned dorm. The horror always reflects app state (bad habits = scarier tape), so the
spooky design serves the function.

## Judging reminders (each criterion is 20%)
Potential impact, use of Kiro, design polish, innovation, presentation. Prefer finished and
polished over more features.
