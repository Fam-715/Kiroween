# Demo video script: Cursed Cassette

**Target length:** 2:50, never over 3:00. Check the current limit on the Kiroween rules page
before uploading.
**Upload:** YouTube (Public or Unlisted), then paste the link into Devpost.
**Narration:** about 330 words (about 2:20 spoken at 140 words a minute, leaving time for pauses). Speak slowly and leave a beat of
silence after each scene change.

---

## Before you record

**One day before**
- [ ] Every feature in the scenes below is merged and live (see "Features each scene needs").
- [ ] Do one full rehearsal with a timer. Cut words, not scenes, if you run long.
- [ ] Pick a sound for the play scene (brown noise is the safest on most speakers).

**Ten minutes before**
- [ ] Open `https://cursed-cassette-api.onrender.com/api/health`. The free server sleeps
      after 15 minutes and takes about 50 s to wake up. Wait for `{"status":"ok"}`.
- [ ] Open the live site in a **new Incognito/InPrivate window**, so you start as a fresh
      listener with an empty shelf.
- [ ] Browser zoom 110–125% so text is readable in the video. Hide bookmarks.
- [ ] Turn on Windows **Do not disturb**. Close Discord, WhatsApp and email.
- [ ] Allow the microphone for the site once, so the permission pop-up doesn't appear on camera.
- [ ] Prepare the Kiro window: `tasks.md` open on the Task list view, the `.kiro` folder
      expanded in the Explorer.

**Recording**
- Screen: Xbox Game Bar (**Win + Alt + R** to start/stop) or OBS. 1080p, 30 fps.
- Voice: record the narration separately after the screen capture if you can. It's much
  easier to get a clean take, and you can trim pauses.
- Edit: CapCut or Clipchamp (built into Windows). Add the title card and captions there.

---

## Scenes

| # | Time | Scene | Needs |
|---|---|---|---|
| 1 | 0:00–0:15 | Hook | title card |
| 2 | 0:15–0:45 | Record a tape | Recorder, Demo mode (done) |
| 3 | 0:45–1:25 | Play and REC | player 9.1–9.3, recall 10/11, focus audio 16 |
| 4 | 1:25–2:05 | Time warp: the tape decays | sample tape 14.2/14.3, time warp 14.1, haunted effects 17, decayed playback 12 |
| 5 | 2:05–2:20 | Restore | recall 10 |
| 6 | 2:20–2:50 | Built with Kiro | Kiro IDE |
| 7 | 2:50–3:00 | End card | title card |

### 1. Hook (0:00–0:15)
**Screen:** dark title card: "Cursed Cassette" in the app's title font, then a slow zoom on
the live app's cassette.

> You study for hours, and a week later most of it is gone. Nothing warns you.
> So we brought back the cassette tape, because tapes do two things your notes don't.
> They record. And they decay.

### 2. Record a tape (0:15–0:45)
**Screen:** Settings → turn on **Demo mode** (the header shows DEMO MODE). Recorder → title
"Biology Midterm", C60. Add a track "Cells" with 3 key terms (nucleus, membrane, ribosome),
an interlude, a second track. Show the "min left" bar filling. Save.

> A study session is a mixtape. Each track is a topic with three to five key terms.
> Interludes are your breaks, and the tape has a fixed length, so you plan honestly.
> Demo mode lets us use one-minute tracks for this video.

### 3. Play and REC (0:45–1:25)
**Screen:** open the tape in the cassette player. Press PLAY: reels spin, the LCD counts
down, focus audio fades in. Skip ahead (or wait) to the end of the track: the chime plays and
the REC prompt appears. Press REC and say: "The nucleus holds DNA, the membrane controls what
enters, and ribosomes build proteins." Show the transcript, the score (3 of 3 terms) and the
strength going to 100, Mint.

> Press play and focus. The sound is generated in your browser: brown noise, rain or lo-fi.
> When a track ends, the cassette asks you to record. You explain the topic from memory,
> out loud, which is one of the best ways to learn.
> We match your words against the key terms. Your voice stays on your device; only the
> score goes to the server.

### 4. Time warp: the tape decays (1:25–2:05)
**Screen:** Settings → **Load sample tape**, then turn on **Demo time warp** (TIME WARP ON
label). Show the sample tape: Photosynthesis Mint, Cell respiration Worn and due, Enzymes
Warped, DNA replication Haunted. Let it run 20–30 s so numbers visibly drop. Open the
Haunted track: the visuals flicker and bleed, then press play on its recording: it hisses
and wobbles.

> Every track follows a forgetting curve. Time warp turns a day into a minute, so you can
> watch it happen. Mint becomes Worn, then Warped, then Haunted.
> Skip a break, and the tape remembers: it decays faster.
> And your own recording decays with it. The more you forget, the more it warps.

### 5. Restore (2:05–2:20)
**Screen:** on the Haunted track, press REC (or type) and recall all the key terms. The
strength jumps back to 100, Mint, and the next review date moves further out.

> Review it, and the tape heals. Each good recall makes the memory last longer, so the next
> review comes later. That's spaced repetition, hidden inside a cassette.

### 6. Built with Kiro (2:20–2:50)
**Screen:** Kiro. Show each item for 3–5 seconds:
1. `.kiro/steering/` (product.md, tech.md, design-system.md with fileMatch).
2. `.kiro/specs/mixtape-core/` requirements → design → Task list with "Task completed" on
   most tasks.
3. A property-based test file (for example `backend/tests/domain/test_strength.py`) and the
   green test run.
4. `.kiro/hooks/spec-coverage-check.json`, and a chat where "1 hook triggered" found a gap.
5. `.kiro/agents/pbt-reviewer.md` and `.kiro/settings/mcp.json`.

> We built it in Kiro with spec-driven development. Fifteen requirements became a design and
> a task list, and every task ran from the spec.
> Steering keeps Kiro on our product and style. Property-based tests check the maths:
> strength always stays between zero and a hundred, and memory never recovers on its own.
> A hook re-checks that every requirement has a task whenever the spec changes, and a
> read-only custom agent reviews our test coverage.

### 7. End card (2:50–3:00)
**Screen:** title card with the live URL `kiroween-liart.vercel.app`, the GitHub repo link,
and the three team members' names.

> Cursed Cassette. Record what you learned. Forget it, and the tape remembers.

---

## If a feature isn't ready on recording day

| Missing | Do this instead |
|---|---|
| Voice recall (task 11) | Type the recall in scene 3. Say "or type it" instead of "out loud". |
| Decayed playback (task 12) | Cut the last two sentences of scene 4. Show the condition labels only. |
| Haunted visuals (task 17) | Show the condition text and strength numbers dropping. |
| Load sample tape button (14.3) | Record the sample tape on camera before scene 4 and use Demo mode. Don't call the API by hand on camera. |
| Real shelf (task 15) | Open the tape directly from the Recorder after saving. |

Never show placeholder data as if it were real. If something is faked for the video, cut it.

## Devpost text to reuse
- **Live demo:** https://kiroween-liart.vercel.app/ (first load can take up to a minute
  while the free server wakes up).
- **Try it in 2 minutes:** Settings → Load sample tape → turn on Demo time warp → watch the
  tracks decay → open the Haunted track and recall it.
