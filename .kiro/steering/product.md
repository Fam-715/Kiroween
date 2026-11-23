---
inclusion: always
---

# Product: Cursed Cassette: Study Tapes That Decay As You Forget

**Hackathon:** Kiroween 2026, **Resurrection** category.
**Dead tech being resurrected:** the 1980s–90s portable cassette player and the hand-made
mixtape. We bring back what made cassettes special, recording and decay, as a learning method.

## One-line pitch
A cassette recorder for studying, back from the dead. Record what you learned in your own
voice. Forget it, and the tape decays, warps and haunts you until you review.

## The real problem
University students study hard, then forget most of it within days (the forgetting curve).
They re-read notes instead of recalling them, and they burn out by skipping breaks. Generic
timers give no feedback on whether anything was learned.

## Target users
University students (first audience: our own campus) studying for exams and assignments,
usually on a laptop, sometimes on a phone.

## Why a cassette (the resurrection story)
- A cassette *records*. Explaining a topic out loud from memory is one of the best ways to
  learn it (active recall), so the REC button is the study method.
- A tape *decays*. Real tape wears, warps and hisses over time. Memory fades the same way,
  following a forgetting curve. The tape's condition shows what you are forgetting.
- A mixtape is a *planned* sequence with a fixed length (C60 = 30 min per side, C90 = 45).
  That maps naturally to planning a study session with a fixed time budget.
- Playing back your own recording gets worse as you forget. Reviewing restores it.

## Core loop (MVP, must ship)
1. **Record a tape**: choose C60/C90/C120 with Side A and Side B. Each track is a study
   topic with 3–5 key terms. Interludes are breaks. Capacity and adjacency rules apply.
2. **Play to focus**: cassette player UI with PLAY / PAUSE / STOP / REW / FF, timer,
   interludes and the flip to Side B. Skipping a break or abandoning a session lowers the
   stability of the tracks you just studied, and the tape says "The tape remembers…".
3. **REC to recall**: when a track ends, press REC and explain the topic from memory
   (30–90 s). Audio is recorded with MediaRecorder and stored only in the browser
   (IndexedDB). Speech is transcribed with the Web Speech API, with a typing fallback.
   Score = the fraction of key terms found in the transcript (case-insensitive, simple
   matching).
4. **Decay**: each track has a memory strength 0–100 following R(t) = e^(−t/S), where S is
   stability in days. A good recall (score ≥ 0.6) raises S, a poor one lowers it, within
   bounds. Strength maps to the conditions Mint / Worn / Warped / Haunted / Dead. The tape's
   condition comes from its tracks' strengths.
5. **Decayed playback**: playing back a recording adds hiss, wobble and distortion based on
   the track's current condition.
6. **Restore**: re-recording a track resets its strength and updates S (spaced repetition).
   The app shows when the next review is due.
7. **Haunted shelf**: tapes with tracks due for review look haunted. Fully forgotten tapes
   become ghosts.
8. **Demo helpers**: Demo mode (tracks as short as 1 minute), a "Load sample tape" button
   (four tracks at different strengths, no audio), and a clearly labelled "Demo time warp"
   (1 day = 1 minute). All are off by default, so judges can see decay in a short demo.

Supporting features: procedural focus audio (brown noise, rain, lo-fi, all generated in the
browser, no copyrighted music) and liner notes (a J-card per tape).

## Optional (only if time allows)
- Mixtape DJ planner and focus styles (25/5, 50/10), with an optional LLM provider.
- AI feedback on recalls.
- Full offline queue with backoff and "unsynced" strength.
- Ghost whispers at low strength, and the strength history sparkline.
- Mixtape trading: share a read-only tape plan with a friend.
- Mobile PWA install and offline mode.

## Non-goals
- No user accounts or passwords. Judges must be able to test instantly.
- No streaming of real songs or Spotify integration.
- No Sony or "Walkman" branding anywhere (trademark). Say "cassette player".
- No uploading of recall audio. Recall text is scored and discarded.

## Privacy
Voice recordings stay in the browser (IndexedDB). Only the recall text is sent to the
backend to be scored, and it is not stored. Browser speech recognition may send audio to the
browser vendor's service, and the app says so before first use.

## Tone and design
Spooky, nostalgic, a little funny, never gory. Think a 1980s cassette player found in an
abandoned dorm. The horror always reflects app state (a forgotten topic = a scarier tape), so
the spooky design serves the function.

## Judging reminders (each criterion is 20%)
Potential impact, use of Kiro, design polish, innovation, presentation. Prefer finished and
polished over more features. The demo video should show: record a tape, recall a track,
turn on time warp, watch the tape decay and the shelf turn haunted, then restore a track.
