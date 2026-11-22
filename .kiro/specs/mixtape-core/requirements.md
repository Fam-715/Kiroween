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
- **Session**: one play-through of a tape.
- **Health**: integer 0–100 stored per tape.

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
4. The system SHALL only return tapes and sessions that belong to the requesting listener ID.

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
   the system SHALL reject the save with a message explaining the rule.
6. WHEN a tape is saved THEN the system SHALL set its health to 100.
7. WHILE recording THEN the UI SHALL show a live "tape remaining" counter for each side.

### Requirement 3: Mixtape DJ (automatic planning)

**User Story:** As a student with a list of tasks, I want the app to build a mixtape for me,
so that I don't have to plan the session myself.

#### Acceptance Criteria

1. WHEN the user submits 1–10 tasks (name and estimated minutes) and a tape length THEN the
   system SHALL return a valid tape plan that satisfies all rules in Requirement 2.
2. The planner SHALL keep tasks in the order the user gave them.
3. The planner SHALL split a task longer than 50 minutes into multiple tracks named
   "<task> (part N)".
4. IF the tasks do not fit on the tape THEN the planner SHALL include as many as fit, and
   return the names of the tasks that were left out.
5. WHEN no LLM provider is configured THEN the system SHALL use the rule-based planner and
   the feature SHALL still work.
6. WHEN an LLM provider is configured and returns an invalid plan or fails THEN the system
   SHALL fall back to the rule-based planner.
7. The user SHALL be able to edit the generated plan before saving it.

### Requirement 4: Play the tape

**User Story:** As a student, I want to control my session with cassette buttons, so that
studying feels tactile and fun.

#### Acceptance Criteria

1. WHEN the user presses PLAY on a saved tape THEN the system SHALL start a session and
   begin a countdown for the first item on Side A.
2. WHEN the user presses PAUSE THEN the countdown SHALL stop, and PLAY SHALL resume it.
3. WHEN the user presses REW during an item THEN the countdown for that item SHALL restart.
4. WHEN the user presses FF THEN the current item SHALL be marked skipped and the next item
   SHALL start.
5. WHEN an item's countdown reaches zero THEN the item SHALL be marked completed, a chime
   SHALL play, and the next item SHALL start automatically.
6. WHEN the last item on Side A ends THEN the UI SHALL show a "flip the tape" animation and
   wait for the user to press PLAY to start Side B.
7. WHEN the user presses STOP THEN the session SHALL end and be saved.
8. The player SHALL support keyboard controls: Space = play/pause, Left = REW, Right = FF,
   Escape = STOP.
9. WHEN the browser tab is hidden or reloaded THEN the countdown SHALL stay accurate,
   because it is calculated from timestamps rather than counted in intervals.

### Requirement 5: Tape health

**User Story:** As a student, I want the tape to react to my habits, so that skipping breaks
or giving up has a visible, memorable consequence.

#### Acceptance Criteria

1. WHEN an interlude is skipped (FF) THEN health SHALL decrease by 15.
2. WHEN a track is skipped (FF) THEN health SHALL decrease by 5.
3. WHEN a session is stopped with more than half of its planned time remaining THEN health
   SHALL decrease by 20.
4. WHEN an interlude is completed THEN health SHALL increase by 5.
5. WHEN a full side is completed with no skips THEN health SHALL increase by 10.
6. Health SHALL always stay between 0 and 100 inclusive.
7. The system SHALL map health to a condition: Mint (80–100), Worn (50–79), Warped (20–49),
   Haunted (1–19), Dead (0).
8. WHEN a tape's health reaches 0 THEN the tape SHALL become Dead and SHALL NOT be playable,
   and it SHALL appear as a ghost on the shelf.
9. The backend SHALL be the source of truth for health; the frontend SHALL update to the
   value returned by the API after each event.

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

### Requirement 7: Procedural focus audio

**User Story:** As a student, I want background focus sound, so that I can concentrate
without finding music elsewhere.

#### Acceptance Criteria

1. The system SHALL offer at least three generated sound beds: brown noise, rain, lo-fi loop.
2. The system SHALL generate all audio with the Web Audio API and SHALL NOT use copyrighted
   music.
3. Audio SHALL start only after the user presses PLAY.
4. WHEN an interlude starts THEN the sound bed SHALL fade out over 2 seconds, and fade back
   in when the next track starts.
5. The user SHALL be able to set volume and mute.

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
4. The user SHALL be able to delete a tape after confirming.
