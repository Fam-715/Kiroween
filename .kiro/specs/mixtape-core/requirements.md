# Requirements Document

## Introduction

Cursed Cassette is a focus timer for students that resurrects the portable cassette player
and the mixtape. A study session is planned as a mixtape (tracks = focus blocks,
interludes = breaks) and played on a haunted cassette player. A "tape health" score reacts
to study habits and drives the spooky visual and audio distortion.

This spec covers the MVP: recording a tape, the Mixtape DJ planner, playback, tape health,
procedural audio, and liner notes. No accounts are used; data is scoped by an anonymous
listener ID.

## Glossary

- **Tape**: a saved session plan with a length (C60, C90 or C120) and two sides.
- **Side**: half of a tape. Capacity is half the tape length (C60 = 30 min per side).
- **Track**: a focus block with a name (usually a task) and a duration of 10–50 minutes.
- **Interlude**: a break with a duration of 3–15 minutes.
- **Item**: a track or an interlude.
- **Session**: one play-through of a tape.
- **Health**: integer 0–100 stored per tape.
- **Focus style**: a preset pair of track length and interlude length used by the Mixtape DJ:
  Pomodoro (25/5), Deep work (50/10).
- **Abandoned session**: a session stopped while more than half of its planned time remains.
- **Effective track length**: the smaller of the focus style's track length and the side
  capacity of the chosen tape (for example, Deep work on C60 gives 30, not 50).
- **Pending event**: a session event that the frontend has not yet had confirmed by the API.

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
4. WHEN a listener requests tapes or sessions THEN the system SHALL return only records
   that belong to that listener ID.

_Property (PBT): for any two distinct listener IDs and any set of created tapes, every list
response contains only tapes created under the requesting ID. For any string that is not a
UUID v4, the response is 400._

### Requirement 2: Record a mixtape manually

**User Story:** As a student, I want to build a mixtape of focus blocks and breaks, so that
my study session has a clear plan and a fixed length.

#### Acceptance Criteria

1. WHEN the user creates a tape THEN the system SHALL require a title (1–60 characters) and
   a length of C60, C90 or C120.
2. WHEN the user adds a track THEN the system SHALL require a name (1–40 characters) and a
   duration between 10 and 50 minutes.
3. WHEN the user adds an interlude THEN the system SHALL require a duration between 3 and
   15 minutes.
4. IF adding an item would make a side's total duration exceed the side capacity THEN the
   system SHALL reject the item and show the remaining minutes on that side.
5. IF two tracks would be adjacent on the same side without an interlude between them THEN
   the system SHALL reject the save with a message explaining the rule. Tracks that are
   last on Side A and first on Side B are not adjacent.
6. WHEN a tape is saved THEN the system SHALL set its health to 100.
7. WHILE recording THEN the UI SHALL show a live "tape remaining" counter for each side,
   equal to side capacity minus the sum of that side's item durations.

_Property (PBT): for any sequence of add attempts, every accepted side has total duration
<= capacity, the remaining counter equals capacity minus total, and every saved tape has
no adjacent tracks on the same side. Adding an item that fits and then removing it restores
the previous remaining value._

### Requirement 3: Mixtape DJ (automatic planning)

**User Story:** As a student with a list of tasks, I want the app to build a mixtape for me,
so that I don't have to plan the session myself.

#### Acceptance Criteria

1. WHEN the user submits 1–10 tasks (name and estimated minutes), a tape length and a focus
   style THEN the system SHALL return a valid tape plan that satisfies all rules in
   Requirement 2.
2. WHEN the user does not choose a focus style THEN the system SHALL use Pomodoro (25/5).
3. WHEN a focus style is chosen THEN the planner SHALL use the effective track length as the
   maximum track duration and the style's interlude length as the interlude duration
   between tracks on the same side.
4. The planner SHALL keep tasks in the order the user gave them.
5. WHEN a task estimate is under 10 minutes THEN the planner SHALL round it up to 10
   minutes before planning.
6. WHEN a task is longer than the effective track length THEN the planner SHALL split it
   into multiple tracks named "<task> (part N)", each between 10 minutes and the effective
   track length, whose durations sum to the (rounded) task estimate.
7. WHEN a task does not fit in the space remaining on the tape THEN the planner SHALL skip
   that whole task, add it to the left-out list, and keep trying each later task in order,
   so that the included tasks keep their original relative order.
8. The planner SHALL return the names of all left-out tasks, and SHALL NOT include part of
   a task unless all of its parts fit.
9. WHEN no LLM provider is configured THEN the system SHALL use the rule-based planner and
   the feature SHALL still work.
10. WHEN an LLM provider is configured and returns an invalid plan or fails THEN the system
    SHALL fall back to the rule-based planner.
11. WHEN a plan is generated THEN the user SHALL be able to edit it before saving it, and
    the edited plan SHALL be validated by the Requirement 2 rules.

_Property (PBT): for any task list (1–10 tasks, 1–240 minutes each), any tape length and
any focus style, the plan is valid under Requirement 2 and every track is at most the
effective track length; included plus left-out task names equal the input names with no
duplicates; included tasks keep input order; the parts of each included task sum to
max(estimate, 10); a left-out task never has parts in the plan; a task that is left out
would not have fitted in the space remaining at the time it was tried; the planner is
deterministic for the same input._

### Requirement 4: Play the tape

**User Story:** As a student, I want to control my session with cassette buttons, so that
studying feels tactile and fun.

#### Acceptance Criteria

1. WHEN the user presses PLAY on a saved, non-Dead tape THEN the system SHALL start a
   session and begin a countdown for the first item on Side A.
2. WHEN the user presses PAUSE THEN the countdown SHALL stop, and PLAY SHALL resume it from
   the remaining time.
3. WHEN the user presses REW during an item THEN the countdown for that item SHALL restart
   from its full duration.
4. WHEN the user presses FF THEN the current item SHALL be marked skipped and the next item
   SHALL start.
5. WHEN an item's countdown reaches zero THEN the item SHALL be marked completed, a chime
   SHALL play, and the next item SHALL start automatically.
6. WHEN the last item on Side A ends THEN the UI SHALL show a "flip the tape" animation and
   wait for the user to press PLAY to start Side B.
7. WHEN the last item on Side B ends THEN the session SHALL end and be saved.
8. WHEN the user presses STOP THEN the session SHALL end and be saved.
9. The player SHALL support keyboard controls: Space = play/pause, Left = REW, Right = FF,
   Escape = STOP.
10. WHEN the browser tab is hidden or reloaded THEN the countdown SHALL stay accurate,
    because it is calculated from timestamps rather than counted in intervals.

_Property (PBT): for any sequence of PLAY, PAUSE, REW, FF and STOP events, every item ends
in exactly one of completed, skipped or not played; the remaining time is never negative
or greater than the item duration; remaining time computed from timestamps equals the
elapsed-time model regardless of how many tick or visibility events occur._

### Requirement 5: Tape health

**User Story:** As a student, I want the tape to react to my habits, so that skipping breaks
or giving up has a visible, memorable consequence.

#### Acceptance Criteria

1. WHEN an interlude is skipped (FF) THEN health SHALL decrease by 12.
2. WHEN a track is skipped (FF) THEN health SHALL decrease by 4.
3. WHEN a session is abandoned (stopped with more than half of its planned time remaining)
   THEN health SHALL decrease by 20.
4. WHEN a session is stopped with half or less of its planned time remaining THEN health
   SHALL NOT decrease because of the stop.
5. WHEN an interlude is completed THEN health SHALL increase by 5.
6. WHEN a full side is completed with no skips THEN health SHALL increase by 10.
7. WHEN several health events occur THEN the system SHALL apply each change in event order
   and clamp the result to 0–100 after each event, so that health SHALL always stay between
   0 and 100 inclusive.
8. The system SHALL map health to a condition: Mint (80–100), Worn (50–79), Warped (20–49),
   Haunted (1–19), Dead (0).
9. WHEN a tape's health reaches 0 THEN the tape SHALL become Dead and SHALL NOT be playable,
   and it SHALL appear as a ghost on the shelf.
10. The backend SHALL be the source of truth for health; the frontend SHALL update to the
    value returned by the API after each event.
11. The health deltas SHALL be defined as named constants in one place in the domain code,
    so they can be tuned without changing other logic.

_Balance rationale: two skipped interludes drop a fresh tape from 100 to 76 (Worn), so
skipping breaks is noticed but not fatal. A skipped track costs less than a skipped break
because the product's aim is to protect breaks. One abandoned session (-20) plus one skipped
interlude (-12) reaches 68, and a diligent student recovers about +5 per break and +10 per
clean side._

_Property (PBT): for any starting health 0–100 and any event sequence, health is always an
integer in 0–100; the condition function is total and monotonic in health; a skip never
increases health and a completion never decreases it; a Dead tape stays Dead and rejects
PLAY; the frontend prediction equals the backend result for the same events._

### Requirement 6: Haunted presentation driven by health

**User Story:** As a student, I want the player to look and sound worse when the tape is in
bad shape, so that the feedback is felt, not just read.

#### Acceptance Criteria

1. WHILE a tape is Mint THEN the player SHALL render clean visuals and audio.
2. WHILE a tape is Worn THEN the system SHALL add light tape hiss and slight reel wobble.
3. WHILE a tape is Warped THEN the system SHALL add pitch wobble to audio, colour bleed and
   flicker to the player.
4. WHILE a tape is Haunted THEN the system SHALL add occasional ghost whispers (generated
   audio) and shadow figures in the player window.
5. WHERE the user has `prefers-reduced-motion` enabled THEN the system SHALL replace motion
   effects with static visual cues and SHALL keep the condition visible as text.
6. The current condition SHALL always be shown as text, not only by colour or animation.

_Property (PBT): for any health 0–100, the effect settings are a pure function of
condition; effect intensity never decreases as health decreases; with reduced motion on,
no setting enables wobble or reel spin._

### Requirement 7: Procedural focus audio

**User Story:** As a student, I want background focus sound, so that I can concentrate
without finding music elsewhere.

#### Acceptance Criteria

1. The system SHALL offer at least three generated sound beds: brown noise, rain, lo-fi loop.
2. The system SHALL generate all audio with the Web Audio API and SHALL NOT use copyrighted
   music.
3. Audio SHALL start only after the user presses PLAY.
4. WHEN an interlude starts THEN the sound bed SHALL fade out over 2 seconds, and WHEN the
   next track starts THEN it SHALL fade back in.
5. The user SHALL be able to set volume (0–100%) and mute.

_Property (PBT): for any time t during a fade, gain lies between the start and end gain and
is monotonic; gain is 0 whenever muted and never exceeds the chosen volume._

### Requirement 8: Liner notes and tape shelf

**User Story:** As a student, I want to see my past tapes and how each session went, so that
I can see my progress.

#### Acceptance Criteria

1. The system SHALL show all of the listener's tapes on a shelf, each with title, length and
   condition.
2. WHEN the user opens a tape THEN the system SHALL show its liner notes as a J-card:
   number of sessions, total focus minutes, tracks completed and skipped, and a health
   history chart.
3. WHEN a session ends THEN the system SHALL record its start time, end time, completed
   items, skipped items, and health before and after.
4. WHEN the user confirms deletion of a tape THEN the system SHALL delete the tape and its
   sessions.

_Property (PBT): for any set of recorded sessions, total focus minutes equals the sum of
completed track durations, and completed plus skipped counts never exceed the number of
items in the tape._

### Requirement 9: Playing through network failures

**User Story:** As a student, I want my session to keep running when my connection drops,
so that a bad network never interrupts my focus or loses my progress.

#### Acceptance Criteria

1. WHEN the API is unreachable during a session THEN the timer, controls and audio SHALL
   keep working without interruption.
2. WHEN a session event cannot be delivered THEN the frontend SHALL add it to a pending
   queue, persisted in local storage, with a client-generated event ID.
3. WHILE pending events exist THEN the frontend SHALL retry delivery with exponential
   backoff (1 s, doubling to a maximum of 30 s) and SHALL deliver events in the order they
   occurred.
4. WHEN the same event ID is received more than once THEN the backend SHALL apply it only
   once.
5. WHILE the API is unreachable THEN the frontend SHALL show a predicted health value
   labelled "unsynced" in text.
6. WHEN the connection returns and all pending events are delivered THEN the frontend SHALL
   replace the predicted health with the value returned by the API.
7. IF the user closes or reloads the page with pending events THEN the system SHALL
   resume delivery of the persisted queue on the next visit.
8. IF a pending event is rejected with an HTTP 4xx response THEN the
   frontend SHALL drop it and SHALL NOT retry it.

_Property (PBT): for any event sequence and any pattern of delivery failures and
duplicates, the final backend health equals applying each event exactly once in order;
delivery order equals occurrence order; the queue is empty once every event has been
acknowledged; the predicted health equals the backend result for the same events._
