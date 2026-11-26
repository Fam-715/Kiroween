# How to make the demo video (step by step)

Everything here uses free tools that come with Windows 11: **Snipping Tool** (screen
recording), **Sound Recorder** (voice) and **Clipchamp** (editing). Total time: about 2–3
hours the first time.

Files in this folder:
- `title-card.html`: the opening card (cassette with spinning reels and the title).
- `end-card.html`: the closing card with the links. **Edit the TEAM names first** (open it
  in Kiro, near the bottom).
- `transcript.txt`: the narration, for YouTube captions.
- The scenes, timings and narration are in [`../demo-script.md`](../demo-script.md).

---

## 0. Before you start
Record only when the features each scene needs are live (see the table in
`demo-script.md`). For anything that isn't ready, use the fallback in that file. **Never
show something that doesn't really work.**

## 1. Get the browser ready (10 min)
1. Open `https://cursed-cassette-api.onrender.com/api/health` and wait for
   `{"status":"ok"}` (the free server can take a minute to wake up).
2. Open Edge or Chrome in a **new InPrivate/Incognito window**, so the shelf starts empty.
   Allow the microphone for the site once, so the pop-up doesn't appear on camera.
3. Zoom to **125%** (Ctrl and +), press **F11** for full screen.
4. Windows: turn on **Do not disturb** (click the clock, bell icon). Close Discord, WhatsApp
   and email. Put your phone on silent.

## 2. Record the screen clips (45 min)
Record **one clip per scene**, not one long take. Short clips are easy to redo.

1. Press **Win + Shift + R** (Snipping Tool, record mode). Drag to select the whole screen.
2. In the Snipping Tool bar, turn **system audio on** (so the focus sound and chime are
   captured) and the **microphone off** (you'll record your voice separately).
3. Click **Start**, wait 2 seconds, do the scene's actions slowly, wait 2 seconds, then
   **Stop**. Save it as `scene2.mp4`, `scene3.mp4` and so on.
4. Move the mouse slowly and deliberately. Pause on anything important (the score, the
   condition changing) for 2 seconds.

| Clip | What to record (details in `demo-script.md`) |
|---|---|
| `title.mp4` | Open `title-card.html` in the browser, F11, record 6 s |
| `scene2.mp4` | Settings → Demo mode on → Recorder → build and save a tape |
| `scene3.mp4` | Open the tape → PLAY → track ends → chime → REC → recall → score and Mint |
| `scene4.mp4` | Settings → Load sample tape → Demo time warp on → watch strengths fall (record ~40 s; you'll speed it up) → open the Haunted track |
| `scene5.mp4` | Recall the Haunted track → back to Mint, next review moves out |
| `scene6.mp4` | Kiro: `.kiro/steering`, the spec Task list, a property test file and a green test run, the hook file, `pbt-reviewer.md`, `mcp.json` (3–5 s each) |
| `end.mp4` | Open `end-card.html`, F11, record 8 s |

## 3. Record your voice (20 min)
1. Open **Sound Recorder** (search for it in Start). Use a headset mic or hold your phone
   close if your laptop mic is noisy. Pick a quiet room; soft furnishings help.
2. Record **one file per scene**, reading the narration from `demo-script.md`. Speak a bit
   slower than normal and smile; it really does sound friendlier.
3. If you stumble, pause, then repeat the sentence. You'll cut the mistake in editing.

## 4. Edit in Clipchamp (45–60 min)
1. Open **Clipchamp** → **Create a new video**. Check the ratio is **16:9**.
2. Drag all clips and voice files into **Your media**, then onto the timeline in order:
   title → scene 2 → … → scene 6 → end.
3. Put each voice file on the audio track under its scene. Trim the screen clip to match the
   voice (select the clip, drag its edges).
4. **Long waits** (time warp, the track counting down): select the clip → **Speed** → 2× to
   4×. Add a small text label like "Time warp: 1 day = 1 minute" so it's clear.
5. **Volume:** select each screen clip and lower its volume to about **20%**, so the focus
   sound sits under your voice. Raise it briefly for the chime and the decayed playback.
6. **Captions:** leave them for YouTube (step 5), it's more accurate.
7. Check the **total length is under 2:55** (shown under the timeline).
8. **Don't add music** from the internet or Clipchamp's library. The rules forbid
   copyrighted music, and the app's own generated sound is enough.
9. **Export** → **1080p**.

## 5. Upload to YouTube (15 min)
1. YouTube → **Create → Upload video**, choose the exported file.
2. **Title:** `Cursed Cassette: Study Tapes That Decay As You Forget | Kiroween 2026`
3. **Description:**
   ```
   A cassette recorder for studying, back from the dead. Record what you learned in your
   own voice. Forget it, and the tape decays, warps and haunts you until you review.

   Try it: https://kiroween-liart.vercel.app/
   Code: https://github.com/Fam-715/Kiroween

   Built with Kiro for the Kiroween 2026 hackathon (Resurrection category).
   ```
4. **Audience:** "No, it's not made for kids".
5. **Visibility: Public** (the rules require public, not unlisted).
6. **Captions:** after upload, open the video in YouTube Studio → **Subtitles** → **Add
   language: English** → **Add** → **Upload file** → **Without timing** → choose
   `transcript.txt`. YouTube matches it to your voice automatically. If you changed any
   words while recording, edit `transcript.txt` to match first.
7. Open the video link in an **Incognito window** to check it plays for someone who isn't
   logged in. Then paste the link into Devpost.

## Checklist before submitting
- [ ] Under 3:00 (aim for 2:50)
- [ ] Shows the app actually working, end to end
- [ ] Shows how you used Kiro (scene 6)
- [ ] No copyrighted music, no third-party logos
- [ ] Public on YouTube, link works in Incognito
- [ ] Team names on the end card are correct
