# Requirements Document

## Introduction

Cursed Cassette: Study Tapes That Decay As You Forget. It is a cassette recorder for
studying, back from the dead. A student records a tape of study topics (tracks), plays it as
a focus session, then presses REC to explain each topic from memory. The recall is scored
against the topic's key terms. Each track has a memory strength that decays over time like a
forgotten memory. Review the track and it is restored. Forget it and the tape warps, hisses
and haunts the shelf until it is reviewed.

This spec covers the MVP: recording a tape, the focus player, break discipline, REC recall
with scoring, memory decay and restoring, decayed playback, the haunted shelf with liner
notes, procedural focus audio, and demo helpers (demo mode, time warp and a sample tape). No
accounts are used; data is scoped by an anonymous listener ID. The Mixtape DJ planner, AI
feedback on recalls, the full offline queue, ghost whispers, the strength sparkline and tape
trading are Optional.

## Glossary

- **Tape**: a saved study plan with a length (C60, C90 or C120) and two sides.
- **Side**: half of a tape. Capacity is half the tape length (C60 = 30 min per side).
- **Track**: a focus block on one study topic, with a name, a duration and 3–5 key terms.
  The duration is 10–50 minutes, or 1–50 minutes while Demo mode is on.
- **Key term**: a word or phrase (1–40 characters) the student should be able to mention
  when explaining the topic.
- **Interlude**: a break with a duration of 3–15 minutes.
- **Item**: a track or an interlude.
- **Session**: one play-through of a tape.
- **Recall**: one REC attempt in which the student explains a track's topic from memory.
- **Score**: the fraction of a track's key terms found in the recall transcript (0 to 1).
- **Stability (S)**: how many days a memory lasts, as used in R(t) = e^(−t/S). Bounded to
  0.25–60 days. A new track starts at 1.0 day.
- **Strength**: integer 0–100 per recorded track, from its base strength decayed over time.
- **Condition**: Mint (80–100), Worn (50–79), Warped (20–49), Haunted (1–19), Dead (0).
- **Unrecorded track**: a track that has never been recalled. It has no strength.
- **Due**: a recorded track is due for review when its unrounded strength is 70 or lower.
- **Ghost**: a tape with at least one recorded track where every recorded track is Dead.
- **Abandoned session**: a session stopped while more than half of its planned time remains.
- **Virtual time**: the clock used for memory decay. It equals real time, unless Demo time
  warp is on.
- **Demo mode**: a per-listener setting, off by default, that allows tracks as short as 1
  minute.
- **Demo time warp**: a per-listener setting, off by default, that makes virtual time run
  1440 times faster than real time (1 day = 1 minute).
- **Pending event**: a session event or recall that the frontend has not yet had confirmed
  by the API.

## Requirements

### Requirement 1: Anonymous listener identity

**User Story:** As a student, I want to start using the app immediately without signing up,
so that there is no barrier to starting a study session.

#### Acceptance Criteria

1. WHEN a user visits the app for the first time THEN the system SHALL generate a UUID v4
   listener ID and store it in browser local storage.
2. WHEN the frontend calls the API THEN it SHALL send the listener ID in the
   `X-Listener-Id` header.
3. IF a request has a missing or malformed `X-Listener-Id` THEN the system SHALL respond
   with HTTP 400.
4. WHEN a listener requests tapes, sessions, recalls or settings THEN the system SHALL
   return only records that belong to that listener ID.

_Property (PBT): for any two distinct listener IDs and any set of created tapes, every list
response contains only tapes created under the requesting ID. For any string that is not a
UUID v4, the response is 400._

### Requirement 2: Record a tape

**User Story:** As a student, I want to build a tape of study topics and breaks, so that my
study session has a clear plan and a fixed length.

#### Acceptance Criteria

1. WHEN the user creates a tape THEN the system SHALL require a title (1–60 characters) and
   a length of C60, C90 or C120.
2. WHEN the user adds a track THEN the system SHALL require a topic name (1–40 characters),
   a duration between 10 and 50 minutes (between 1 and 50 minutes while Demo mode is on),
   and 3 to 5 key terms of 1–40 characters each, unique when compared ignoring case.
3. WHEN the user adds an interlude THEN the system SHALL require a duration between 3 and
   15 minutes.
4. IF adding an item would make a side's total duration exceed the side capacity THEN the
   system SHALL reject the item and show the remaining minutes on that side.
5. IF two tracks would be adjacent on the same side without an interlude between them THEN
   the system SHALL reject the save with a message explaining the rule. Tracks that are
   last on Side A and first on Side B are not adjacent.
6. WHEN a tape is saved THEN the system SHALL mark every track as unrecorded with stability
   1.0 day, and the tape condition SHALL be Mint.
7. WHILE recording THEN the UI SHALL show a live "tape remaining" counter for each side,
   equal to side capacity minus the sum of that side's item durations.
8. WHEN a saved tape is edited and a track's key terms change THEN the system SHALL reset
   that track to unrecorded. A track whose key terms did not change SHALL keep its memory.

_Property (PBT): for any sequence of add attempts, every accepted side has total duration
<= capacity, the remaining counter equals capacity minus total, and every saved tape has
no adjacent tracks on the same side. A track with 2 or 6 key terms, or with duplicate terms
ignoring case, is always rejected. Track duration limits follow Demo mode. Adding an item
that fits and then removing it restores the previous remaining value._

### Requirement 3: Play to focus

**User Story:** As a student, I want to control my study session with cassette buttons, so
that studying feels tactile and fun.

#### Acceptance Criteria

1. WHEN the user presses PLAY on a saved tape THEN the system SHALL start a session and
   begin a countdown for the first item on Side A.
2. WHEN the user presses PAUSE THEN the countdown SHALL stop, and PLAY SHALL resume it from
   the remaining time.
3. WHEN the user presses REW during an item THEN the countdown for that item SHALL restart
   from its full duration.
4. WHEN the user presses FF THEN the current item SHALL be marked skipped and the next item
   SHALL start.
5. WHEN a track's countdown reaches zero THEN the track SHALL be marked completed, a chime
   SHALL play, a REC prompt for that track SHALL be shown, and the next item SHALL start
   automatically.
6. WHEN an interlude's countdown reaches zero THEN the interlude SHALL be marked completed
   and the next item SHALL start automatically.
7. WHEN the last item on Side A ends THEN the UI SHALL show a "flip the tape" animation and
   wait for the user to press PLAY to start Side B.
8. WHEN the last item on Side B ends THEN the session SHALL end and be saved.
9. WHEN the user presses STOP THEN the session SHALL end and be saved.
10. The player SHALL support keyboard controls: Space = play/pause, Left = REW, Right = FF,
    Escape = STOP, R = REC.
11. WHEN the browser tab is hidden or reloaded THEN the countdown SHALL stay accurate,
    because it is calculated from timestamps rather than counted in intervals.
12. The session countdown SHALL always use real time and SHALL NOT be affected by Demo time
    warp.

_Property (PBT): for any sequence of PLAY, PAUSE, REW, FF and STOP events, every item ends
in exactly one of completed, skipped or not played; the remaining time is never negative
or greater than the item duration; remaining time computed from timestamps equals the
elapsed-time model regardless of how many tick or visibility events occur._

### Requirement 4: Break discipline

**User Story:** As a student, I want skipping breaks or giving up to have a visible,
memorable consequence, so that I look after my memory as well as my time.

#### Acceptance Criteria

1. WHEN an interlude is skipped (FF) THEN the system SHALL multiply the stability of every
   track completed so far in the session by 0.9.
2. WHEN a track is skipped (FF) THEN the system SHALL multiply the stability of every track
   completed so far in the session by 0.95.
3. WHEN a session is abandoned THEN the system SHALL multiply the stability of every track
   completed in that session by 0.8.
4. WHEN a session is stopped with half or less of its planned time remaining THEN the
   system SHALL NOT apply a penalty because of the stop.
5. The system SHALL keep stability within 0.25–60 days after every penalty, and a penalty
   SHALL NOT increase stability.
6. WHEN a penalty is applied THEN the API response SHALL list each affected track with its
   stability before and after.
7. WHEN an interlude is skipped THEN the UI SHALL show the message "The tape remembers…"
   with the number of affected tracks, and SHALL briefly glitch each affected track on the
   tape display.
8. WHERE the user has `prefers-reduced-motion` enabled THEN the UI SHALL replace the glitch
   with a static highlight on the affected tracks, and SHALL still show the message as text.
9. The penalty factors SHALL be defined as named constants in one place in the domain code,
   so they can be tuned without changing other logic.
10. WHEN a stop is requested for a session that has already ended THEN the system SHALL
    return the saved summary and SHALL NOT apply a penalty again.

_Property (PBT): for any stability in 0.25–60 and any penalty, the result is in 0.25–60 and
is not greater than the input; penalties apply only to tracks completed in the session;
applying the same event ID twice has the same result as applying it once._

### Requirement 5: REC to recall

**User Story:** As a student, I want to explain a topic from memory in my own voice, so that
I practise recalling it and the tape can tell how well I remember.

#### Acceptance Criteria

1. WHEN a track ends THEN the UI SHALL show a REC prompt for that track until the next
   track starts.
2. WHEN the user presses REC on a track, from the REC prompt or from the track list of any
   saved tape at any time, THEN the system SHALL start a recall for that track.
3. WHEN a recall starts THEN the system SHALL ask for microphone permission if needed, and
   SHALL record with MediaRecorder only after that REC press.
4. WHILE recording THEN the UI SHALL show "REC" and the elapsed time as text, with a guide
   of 30–90 seconds.
5. WHEN a recording reaches 90 seconds THEN the system SHALL stop it automatically.
6. WHEN a recording stops after less than 30 seconds THEN the UI SHALL show a hint to say
   more, and SHALL still accept the recall.
7. WHEN a recording stops THEN the system SHALL store the audio only in the browser
   (IndexedDB) under the track ID, replacing any earlier recording, and SHALL NOT upload it.
8. WHERE the Web Speech API is supported THEN the system SHALL transcribe while recording
   and show the transcript in an editable text box before submitting.
9. IF the Web Speech API is unsupported, speech recognition fails, or the microphone is
   denied THEN the system SHALL show a text box so the user can type the recall instead, and
   SHALL still score it.
10. WHEN the user submits a recall THEN the frontend SHALL send the text (at most 5000
    characters) and its source (speech or typed) to the API, and the backend SHALL score it
    and SHALL NOT store the text.
11. The score SHALL equal the number of key terms found in the text divided by the number of
    key terms. A term is found when it appears in the text, ignoring case and punctuation,
    as a whole word or phrase, or when its last word is followed by a simple plural suffix
    "s" or "es" (e.g. "cell" matches "cells").
12. WHEN a recall is scored THEN the UI SHALL show the score as a percentage, with the
    matched and missed key terms.
13. WHEN a user first uses speech recognition THEN the UI SHALL state that the browser may
    send audio to its vendor's speech service, and that recordings stay on this device.
14. The REC controls SHALL be keyboard reachable with visible focus and `aria-label`s.

_Property (PBT): for any key terms and any text, the score is in [0, 1] and equals
matched/total; changing the case of the text does not change the score; appending text
never lowers the score; an empty text scores 0; a text that contains every key term scores
1; each term counts at most once._

### Requirement 6: Memory strength and decay

**User Story:** As a student, I want each topic to fade as I forget it, so that I can see
what I need to review.

#### Acceptance Criteria

1. The system SHALL store for each recorded track a base strength (0–100), a stability in
   days, and the virtual time of its last review.
2. The strength at virtual time t SHALL be the base strength multiplied by e^(−Δ/S), rounded
   half up to an integer, where Δ is the number of days since the last review (never
   negative) and S is the stability.
3. Strength SHALL always be an integer between 0 and 100 inclusive.
4. The system SHALL map strength to a condition: Mint (80–100), Worn (50–79), Warped
   (20–49), Haunted (1–19), Dead (0).
5. WHEN a recall is scored THEN the system SHALL set the last review time to the current
   virtual time, and the base strength to 100 if the score is at least 0.6, or to the score
   times 100 rounded half up otherwise.
6. WHEN a recall is scored THEN the system SHALL multiply stability by a factor that depends
   on the score and clamp the result to 0.25–60 days. The factor SHALL be 0.5 to 0.95 below
   a score of 0.6, rising with the score, and 1.2 to 2.5 from 0.6 up, rising with the score.
7. WHEN a track is recalled for the first time THEN the system SHALL apply the stability
   factor to the current stability, which starts at 1.0 day.
8. IF a track has been recalled before and its decay factor e^(−Δ/S) is above 0.9 THEN the
   system SHALL NOT let a recall with a score of 0.6 or more raise stability.
9. The system SHALL treat a recorded track as due when its unrounded strength is 70 or
   lower.
10. The tape condition SHALL come from the mean of its recorded tracks' strengths, rounded
    half up, and SHALL be Mint when no track is recorded.
11. The tape condition SHALL be Dead only when the tape is a ghost. IF the rounded mean of
    the recorded tracks' strengths is 0 and at least one recorded track is not Dead THEN the
    tape condition SHALL be Haunted.
12. The backend SHALL be the source of truth for strength, stability and scores. The
    frontend MAY predict strength between API calls from the values the API returned, and
    SHALL replace the prediction with the API value after each response.
13. The memory constants (initial and bounds of stability, pass score, due strength, decay
    threshold and score factors) SHALL be defined as named constants in one place in the
    domain code.

_Property (PBT): for any base, stability and elapsed time, strength is an integer in 0–100;
strength never increases as time increases (decay is monotonic); stability after any recall
or penalty is within 0.25–60; for the same state and elapsed time, a higher score never
produces a lower stability; the condition function is total and monotonic in strength; the
tape strength lies between the lowest and highest track strength, and is at least 1 unless
every recorded track is 0; the tape condition is Dead exactly when the tape is a ghost; a
track is due exactly when its unrounded strength is 70 or lower._

### Requirement 7: Decayed playback

**User Story:** As a student, I want to hear my own recall played back worse as I forget,
so that forgetting feels real and I want to fix it.

#### Acceptance Criteria

1. WHEN the user presses PLAY on a track's recording THEN the system SHALL play the audio
   stored in IndexedDB through the Web Audio API, and SHALL NOT start it automatically.
2. WHEN a recording plays THEN the system SHALL apply hiss, speed wobble, pitch wobble and
   distortion according to the track's current condition, using the effects table in the
   design.
3. WHILE a track is Mint THEN playback SHALL be clean.
4. WHILE a track is Dead THEN playback SHALL be static only, with no voice audible.
5. WHEN a recording plays THEN the UI SHALL show the track's condition and strength as
   text.
6. IF no recording is stored on this device for a track (a sample tape, another device, or
   cleared browser data) THEN the UI SHALL show "No recording on this device" and offer REC.
7. WHEN a track, tape or listener data is deleted THEN the system SHALL delete the matching
   recordings from IndexedDB.
8. WHERE the user has `prefers-reduced-motion` enabled THEN the system SHALL disable visual
   wobble during playback, and SHALL keep the audio effects and the condition text.

_Property (PBT): for any strength 0–100, the effect settings are a pure function of
condition; no effect value decreases as strength decreases; with reduced motion on, visual
wobble and reel spin are 0; Dead has no voice gain._

### Requirement 8: Restore and spaced review

**User Story:** As a student, I want to restore a decayed track by reviewing it, and to know
when to review next, so that I remember it for longer each time.

#### Acceptance Criteria

1. WHEN the user re-records a track THEN the system SHALL run the same recall flow as in
   Requirement 5 and update the track as in Requirement 6.
2. WHEN a re-recording is saved THEN the new audio SHALL replace the previous recording.
3. WHEN the user opens a track THEN the UI SHALL show its strength, condition, stability,
   number of reviews and the time of its next review.
4. The next review time SHALL be the last review time plus S × ln(base ÷ 70) days when the
   base strength is above 70, and SHALL be the last review time otherwise.
5. WHEN the next review time has passed THEN the track SHALL show as "due now".
6. The system SHALL allow a recall at any time, whether or not the track is due.
7. WHEN a recall is scored THEN the system SHALL record its time, score, matched and missed
   terms, and strength and stability before and after.

_Property (PBT): a track is due at virtual time t exactly when t is at or after its next
review time; a recall with a score of 0.6 or more always produces base strength 100 and
never produces a lower strength than before the review; the next review time is never before
the last review time._

### Requirement 9: Haunted presentation driven by condition

**User Story:** As a student, I want the player to look and sound worse when the tape is in
bad shape, so that the feedback is felt, not just read.

#### Acceptance Criteria

1. WHILE a tape is Mint THEN the player SHALL render clean visuals and audio.
2. WHILE a tape is Worn THEN the system SHALL add light tape hiss and slight reel wobble.
3. WHILE a tape is Warped THEN the system SHALL add pitch wobble to audio, colour bleed and
   flicker to the player.
4. WHILE a tape is Haunted THEN the system SHALL add shadow figures in the player window and
   (Optional — ship only if time allows) occasional ghost whispers (generated audio).
5. WHERE the user has `prefers-reduced-motion` enabled THEN the system SHALL replace motion
   effects with static visual cues and SHALL keep the condition visible as text.
6. The current condition SHALL always be shown as text, not only by colour or animation.

_Property (PBT): for any strength 0–100, the effect settings are a pure function of
condition; effect intensity never decreases as strength decreases; with reduced motion on,
no setting enables wobble or reel spin._

### Requirement 10: Procedural focus audio

**User Story:** As a student, I want background focus sound, so that I can concentrate
without finding music elsewhere.

#### Acceptance Criteria

1. The system SHALL offer at least three generated sound beds: brown noise, rain, lo-fi loop.
2. The system SHALL generate all focus audio with the Web Audio API and SHALL NOT use
   copyrighted music.
3. Focus audio SHALL start only after the user presses PLAY.
4. WHEN an interlude starts THEN the sound bed SHALL fade out over 2 seconds, and WHEN the
   next track starts THEN it SHALL fade back in.
5. The user SHALL be able to set volume (0–100%) and mute.
6. WHILE a recall is recording THEN the system SHALL mute the sound bed so it is not picked
   up by the microphone.

_Property (PBT): for any time t during a fade, gain lies between the start and end gain and
is monotonic; gain is 0 whenever muted and never exceeds the chosen volume._

### Requirement 11: Haunted shelf and liner notes

**User Story:** As a student, I want to see which tapes are fading and how each session
went, so that I know what to review and can see my progress.

#### Acceptance Criteria

1. The system SHALL show all of the listener's tapes on a shelf, each with title, length,
   condition and the number of tracks due.
2. WHEN a tape has at least one due track THEN its shelf spine SHALL look haunted, and SHALL
   show "N due" as text.
3. WHEN a tape is a ghost THEN the shelf SHALL show it as a translucent ghost labelled
   "Forgotten".
4. WHEN the user opens a tape THEN the system SHALL show its liner notes as a J-card:
   number of sessions, total focus minutes, tracks completed and skipped, each track's
   strength, condition and next review time, and
   (Optional — ship only if time allows) a strength history chart.
5. WHEN a session ends THEN the system SHALL record its start time, end time, completed
   items, skipped items, and the penalties applied.
6. WHEN the user confirms deletion of a tape THEN the system SHALL delete the tape, its
   sessions and its recalls, and SHALL delete its recordings from IndexedDB.

_Property (PBT): for any set of recorded sessions, total focus minutes equals the sum of
completed track durations, and completed plus skipped counts never exceed the number of
items in the tape. The due count equals the number of recorded tracks with unrounded
strength 70 or lower._

### Requirement 12: Demo mode, time warp and sample tape

**User Story:** As a judge or presenter, I want to reach REC quickly and see decay in a short
demo, so that I can try the whole loop in a few minutes.

#### Acceptance Criteria

1. The system SHALL provide a "Demo mode" setting, off by default, stored per listener.
2. WHILE Demo mode is on THEN the system SHALL accept track durations from 1 to 50
   minutes, and the UI SHALL show a "Demo mode" label as text.
3. WHEN Demo mode is turned off THEN tapes already saved with shorter tracks SHALL remain
   playable and editable, tracks whose duration is unchanged SHALL stay valid when the tape
   is saved, and new or changed tracks SHALL need at least 10 minutes.
4. The backend SHALL read `ALLOW_TIME_WARP` from the environment, and the deployed backend
   SHALL set it to true.
5. WHERE `ALLOW_TIME_WARP` is true THEN the UI SHALL show a clearly labelled "Demo time
   warp" toggle, off by default, stored per listener.
6. IF `ALLOW_TIME_WARP` is not true THEN the system SHALL hide the toggle and SHALL respond
   with HTTP 403 to a request that turns time warp on.
7. WHILE Demo time warp is on THEN virtual time SHALL run 1440 times faster than real time,
   and strength, due times and condition SHALL use virtual time.
8. WHEN Demo time warp is turned on or off THEN virtual time SHALL stay continuous, with no
   jump, and the UI SHALL show a "TIME WARP ON" label as text while it is on.
9. The system SHALL provide a "Load sample tape" button. WHEN it is pressed THEN the system
   SHALL create a new tape of four tracks with seeded recalls, timestamps and no audio: one
   Mint, one Worn that is due for review, one Warped and one Haunted.
10. The sample tape SHALL be the same each time (apart from IDs) and SHALL pass the tape
    rules in Requirement 2 without Demo mode.
11. The session countdown (Requirement 3) SHALL NOT be affected by Demo time warp.

_Property (PBT): virtual time never decreases as real time increases; with time warp off,
virtual elapsed time equals real elapsed time; with time warp on, it is 1440 times real
elapsed time; turning warp on or off does not change virtual time at that moment; the sample
tape is valid, deterministic, and has exactly one track in each of Mint, Worn (due), Warped
and Haunted at the moment it is created._

### Requirement 13: Playing through network failures

**User Story:** As a student, I want my session to keep running when my connection drops,
so that a bad network never interrupts my focus or loses my progress.

#### Acceptance Criteria

1. WHEN the API is unreachable during a session THEN the timer, controls, focus audio and
   local recording SHALL keep working without interruption.
2. WHEN a session event or recall cannot be delivered THEN the frontend SHALL retry it in
   order at a fixed interval of about 5 seconds for a few attempts, and the UI SHALL show a
   recall as "scoring pending" until it is delivered.
3. WHEN the same client event ID is received more than once THEN the backend SHALL apply it
   only once.
4. (Optional — ship only if time allows) WHEN an event or recall cannot be delivered THEN
   the frontend SHALL add it to a pending queue, persisted in local storage, with a
   client-generated ID.
5. (Optional — ship only if time allows) WHILE pending items exist THEN the frontend SHALL
   retry delivery with exponential backoff (1 s, doubling to a maximum of 30 s) and SHALL
   deliver them in the order they occurred.
6. (Optional — ship only if time allows) WHILE the API is unreachable THEN the frontend
   SHALL show a predicted strength labelled "unsynced" in text.
7. (Optional — ship only if time allows) WHEN the connection returns and all pending items
   are delivered THEN the frontend SHALL replace the predicted strength with the value
   returned by the API.
8. (Optional — ship only if time allows) IF the user closes or reloads the page with pending
   items THEN the system SHALL resume delivery of the persisted queue on the next visit.
9. (Optional — ship only if time allows) IF a pending item is rejected with an HTTP 4xx
   response THEN the frontend SHALL drop it and SHALL NOT retry it.

_Property (PBT): for any event sequence and any pattern of delivery failures and duplicates,
the final backend state equals applying each event exactly once in order. Optional: delivery
order equals occurrence order, the queue is empty once every item is acknowledged, and the
predicted strength equals the backend result for the same events._

### Requirement 14: Mixtape DJ (automatic planning)

**User Story:** As a student with a list of topics, I want the app to build a tape for me, so
that I don't have to plan the session myself.

#### Acceptance Criteria

1. (Optional — ship only if time allows) WHEN the user submits 1–10 tasks (name, estimated
   minutes and 3–5 key terms), a tape length and a focus style THEN the system SHALL return a
   valid tape plan that satisfies all rules in Requirement 2.
2. (Optional — ship only if time allows) WHEN the user does not choose a focus style THEN
   the system SHALL use Pomodoro (25/5). The focus styles are Pomodoro (track 25, interlude
   5) and Deep work (track 50, interlude 10).
3. (Optional — ship only if time allows) WHEN a focus style is chosen THEN the planner SHALL
   use the smaller of the style's track length and the side capacity as the maximum track
   duration, and the style's interlude length between tracks on the same side.
4. (Optional — ship only if time allows) The planner SHALL keep tasks in the order the user
   gave them.
5. (Optional — ship only if time allows) WHEN a task estimate is under the minimum track
   duration THEN the planner SHALL round it up to that minimum.
6. (Optional — ship only if time allows) WHEN a task is longer than the maximum track
   duration THEN the planner SHALL split it into multiple tracks named "<task> (part N)",
   each at least the minimum track duration and at most the maximum, whose durations sum to
   the (rounded) task estimate. Each part SHALL keep the task's key terms.
7. (Optional — ship only if time allows) WHEN a task does not fit in the space remaining on
   the tape THEN the planner SHALL skip that whole task, add it to the left-out list, and
   keep trying each later task in order, so that the included tasks keep their original
   relative order.
8. (Optional — ship only if time allows) The planner SHALL return the names of all left-out
   tasks, and SHALL NOT include part of a task unless all of its parts fit.
9. (Optional — ship only if time allows) WHEN no LLM provider is configured THEN the system
   SHALL use the rule-based planner and the feature SHALL still work.
10. (Optional — ship only if time allows) WHEN an LLM provider is configured and returns an
    invalid plan or fails THEN the system SHALL fall back to the rule-based planner.
11. (Optional — ship only if time allows) WHEN a plan is generated THEN the user SHALL be
    able to edit it before saving it, and the edited plan SHALL be validated by the
    Requirement 2 rules.

_Property (PBT): for any task list (1–10 tasks, 1–240 minutes each), any tape length and any
focus style, the plan is valid under Requirement 2 and every track is at most the maximum
track duration; included plus left-out task names equal the input names with no duplicates;
included tasks keep input order; the parts of each included task sum to the rounded estimate;
a left-out task never has parts in the plan; a task that is left out would not have fitted in
the space remaining at the time it was tried; the planner is deterministic for the same
input._

### Requirement 15: Optional extras

**User Story:** As a student, I want feedback on what I missed and a way to share a tape, so
that I can study with friends.

#### Acceptance Criteria

1. (Optional — ship only if time allows) WHERE an LLM provider is configured AND the user
   asks for feedback on a scored recall THEN the system SHALL return short feedback on the
   missed key terms, and SHALL NOT store the recall text.
2. (Optional — ship only if time allows) WHERE no LLM provider is configured THEN the system
   SHALL hide the feedback control.
3. (Optional — ship only if time allows) WHEN the user shares a tape THEN the system SHALL
   create a read-only link to the tape plan (title, length, topics and key terms), without
   recordings, strengths or recall history.
4. (Optional — ship only if time allows) WHEN a friend opens a shared link THEN the system
   SHALL let them copy the plan into their own shelf as a new tape.

_Property (PBT): a shared plan contains no recall, strength or listener data; copying a shared
plan creates a valid tape under Requirement 2 with all tracks unrecorded._
