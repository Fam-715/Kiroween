# Demo video script: Cursed Cassette

**Target length:** 2:50, never over 3:00.
**Upload:** YouTube, **Public** (the rules require it), then paste the link into Devpost.
Recording and editing help: [`video/recording-guide.md`](video/recording-guide.md).
**Narration:** about 330 words (about 2:20 at 140 words a minute, leaving room for pauses).
Speak slowly and leave a beat of silence after each scene change.

Every feature below is merged and live, so no fallbacks are needed.

---

## Before you record

**The day before**
1. Open `https://cursed-cassette-api.onrender.com/api/health` and wait for `{"status":"ok"}`.
2. Do one full rehearsal with a timer. Cut words, not scenes, if you run long.

**On recording day: set up the Haunted recording first (about 10 minutes, off camera)**
Decayed playback needs a voice recording on a track that is *still* Haunted, but a good
recall restores the track to Mint. So prepare it in the same window you will record in:
1. Open the live site in a **new Incognito window** in Chrome. Allow the microphone once,
   so the pop-up never appears on camera.
2. Gear icon → **Load sample tape**.
3. On the J-card, press **● REC** on **DNA replication** → **● REC (speak your recall)** →
   **OK, start recording**. Say something *weak*, e.g. "Um… it copies the DNA, I think."
   Press **■ Stop**, then **Submit recall**. A poor recall drops the track to Warped and
   saves your voice on this device.
4. Gear icon → turn on **Demo time warp** (TIME WARP ON appears). Wait 3–5 minutes until DNA
   replication shows **HAUNTED** again. Leave time warp on.
5. Keep this window open for every scene. The recording only exists in this browser.

**Ten minutes before**
- Browser zoom 110–125%, bookmarks bar hidden, F11 full screen.
- Windows **Do not disturb** on. Discord, WhatsApp and email closed.
- Kiro window ready: `tasks.md` on the Task list view, `.kiro` folder expanded.
- Focus sound: **Brown noise** is the safest on most speakers.

---

## Scenes

| # | Time | Scene | What's on screen |
|---|---|---|---|
| 1 | 0:00–0:15 | Hook | title card, then the shelf |
| 2 | 0:15–0:45 | Record a tape | Demo mode → Recorder → save |
| 3 | 0:45–1:25 | Play and REC | player → track ends → chime → voice recall → score → skip a break |
| 4 | 1:25–2:05 | The tape decays | sample tape under time warp → Haunted player → decayed playback |
| 5 | 2:05–2:20 | Restore | good recall on the Haunted track → Mint |
| 6 | 2:20–2:50 | Built with Kiro | Kiro IDE |
| 7 | 2:50–3:00 | End card | `docs/video/end-card.html` |

### 1. Hook (0:00–0:15)
**Screen:** `docs/video/title-card.html` (F11, about 6 s), then the live site's shelf.

> You study for hours, and a week later most of it is gone. Nothing warns you.
> So we brought back the cassette tape, because tapes do two things your notes don't.
> They record. And they decay.

### 2. Record a tape (0:15–0:45)
**Clicks:**
1. Gear icon → **Demo mode** toggle on (the header shows DEMO MODE) → **Close**.
2. **Recorder** (top right). Title `Biology Midterm`, length C60.
3. **Add a track** on Side A: minutes `1`, topic `Cells`, key terms `nucleus`, `membrane`,
   `ribosome` (type each one and press **Add**).
4. **Add an interlude**: minutes `3`.
5. **Add a track**: minutes `1`, topic `Genetics`, terms `gene`, `allele`, `chromosome`.
6. Point at the **minutes remaining** bar, then **Save tape** ("Tape saved…").

> A study session is a mixtape. Each track is a topic with three to five key terms.
> Interludes are your breaks, and the tape has a fixed length, so you plan honestly.
> Demo mode lets us use one-minute tracks for this video.

### 3. Play and REC (0:45–1:25)
**Clicks:**
1. **Shelf** → the Biology Midterm tape (its J-card) → **Play tape**.
2. **▶ PLAY**: the reels spin, the LCD counts down and the focus sound fades in.
3. Wait for the track to end (1 minute; speed this part up 4× in editing). The **chime**
   plays and the **REC** prompt appears under the LCD.
4. **REC** → **● REC (speak your recall)** → say: "The nucleus holds DNA, the membrane
   controls what goes in and out, and ribosomes build proteins." → **■ Stop**. The
   transcript appears; fix any wrong word → **Submit recall**.
5. Hold on the result: **Score 100%**, all three terms matched → **MINT**.
6. Close the panel. The interlude is now playing: press **FF** to skip it. The toast **"The
   tape remembers… Memory span −10% on 1 track"** appears and Cells glitches on the tape map.
7. **STOP**.

> Press play and focus. The sound is generated in your browser.
> When a track ends, the cassette asks you to record. You explain the topic from memory,
> out loud, which is one of the best ways to learn.
> We match your words against the key terms. Your voice stays on your device; only the
> score goes to the server.
> Skip a break, and the tape remembers: what you studied fades faster.

### 4. The tape decays (1:25–2:05)
**Clicks** (time warp is already on from the preparation):
1. **Shelf** → **Sample: Biology Basics**. Show Photosynthesis **MINT**, Cell respiration
   **WORN**, Enzymes **WARPED**, DNA replication **HAUNTED**, and the **TIME WARP ON** badge.
   Let it sit 15–20 s so the numbers visibly drop (speed up 2× in editing).
2. **Play tape** → **▶ PLAY**, then **FF** until the LCD shows **DNA replication** (press
   PLAY again at **FLIP TAPE**). The cassette flickers, the label bleeds red and teal, shadow
   figures appear, and the LCD says **Condition: HAUNTED**. **STOP**.
3. **Back to the J-card** → **▶ Play** on DNA replication: your weak recording plays back
   hissing, wobbling and distorted. Raise the clip volume here in editing.

> Every track follows a forgetting curve. Time warp turns a day into a minute, so you can
> watch it happen. Mint becomes Worn, then Warped, then Haunted.
> And your own recording decays with it. The more you forget, the more it warps.

### 5. Restore (2:05–2:20)
**Clicks:** on the J-card, **● REC** on **DNA replication** → speak (or type): "Helicase
unzips the DNA, a primer starts it, DNA polymerase builds the leading strand, and the
lagging strand is made in Okazaki fragments." → **Submit recall** → a high score, back to
**MINT**, and the next review moves further out.

> Review it, and the tape heals. Each good recall makes the memory last longer, so the next
> review comes later. That's spaced repetition, hidden inside a cassette.

### 6. Built with Kiro (2:20–2:50)
**Screen:** Kiro. Show each item for 3–5 seconds:
1. `.kiro/steering/` (product.md, tech.md, design-system.md with fileMatch).
2. `.kiro/specs/mixtape-core/` requirements → design → Task list with "Task completed" on
   every MVP task.
3. A property-based test file (`backend/tests/domain/test_strength.py`) and a green test run
   (111 backend and 196 frontend tests).
4. `.kiro/hooks/spec-coverage-check.json`, and a chat where "1 hook triggered" found a gap.
5. `.kiro/agents/pbt-reviewer.md` and `.kiro/settings/mcp.json`.

> We built it in Kiro with spec-driven development. Fifteen requirements became a design and
> a task list, and every task ran from the spec.
> Steering keeps Kiro on our product and style. Property-based tests check the maths:
> strength always stays between zero and a hundred, and memory never recovers on its own.
> A hook re-checks that every requirement has a task whenever the spec changes, and a
> read-only custom agent reviews our test coverage.

### 7. End card (2:50–3:00)
**Screen:** `docs/video/end-card.html` with the team names filled in (F11, about 8 s).

> Cursed Cassette. Record what you learned. Forget it, and the tape remembers.

---

## If something goes wrong on recording day

| Problem | Do this |
|---|---|
| The mic or speech doesn't work | Type the recall in scenes 3 and 5. Say "or type it" instead of "out loud". |
| DNA replication isn't Haunted yet | Wait longer with time warp on, or show the Haunted player and skip decayed playback. |
| The first page load is slow | The free server was asleep. Open `/api/health` first and wait for `{"status":"ok"}`. |
| You switched windows | The voice recording only lives in the browser that made it. Redo the preparation in the recording window. |

Never show placeholder data as if it were real. If something is faked for the video, cut it.

## Devpost text to reuse
- **Live demo:** https://kiroween-liart.vercel.app/ (first load can take up to a minute
  while the free server wakes up).
- **Try it in 2 minutes:** Settings → Load sample tape → turn on Demo time warp → watch the
  tracks decay → Play tape and skip to the Haunted track → back on the J-card, REC it.
