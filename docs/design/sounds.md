# Sound design notes: Cursed Cassette

All sounds are generated with the Web Audio API. No audio files, no samples, no third-party
music. Numbers are starting values to tune by ear.

## Rules for every sound

- Create one shared AudioContext and call `resume()` inside the first user click or key
  press (browsers block audio until then). Focus audio starts only on PLAY.
- Route everything through one master GainNode so mute and volume (0 to 100%) work in one
  place.
- Interface sounds are short (under 400 ms), quiet and never use a pure sine tone alone.
- Keep one shared white-noise buffer (2 seconds, looped) and reuse it. Do not generate it
  per sound.
- Respect the Settings volume and mute. Interface sounds stay quieter than recorded voice.
- No brand names, jingles or recognisable melodies.

## Interface sounds

| Sound | Used when | How to generate |
|---|---|---|
| Button clunk | PLAY, PAUSE, STOP, FF, REW pressed | Short noise burst (30 ms) through a lowpass filter at about 900 Hz, plus a low triangle oscillator at 90 Hz dropping to 50 Hz over 60 ms. Gain envelope: instant attack, 80 ms exponential decay. |
| REC press | REC pressed | Same clunk, then a heavier second click 40 ms later (louder, filter at 600 Hz). |
| REC beep | Recording starts | Square oscillator at 880 Hz for 120 ms, lowpass at 3 kHz, gain 0.08, 10 ms attack and 30 ms release. |
| REC stop | Recording ends | Two short 660 Hz beeps, 90 ms each, 60 ms apart. |
| Tape stop | STOP, or tape ends mid-play | Play the hiss buffer or current source and ramp playbackRate from 1 to 0.05 over 500 ms with an exponential curve, while ramping gain to 0. |
| Rewind and fast-forward whirr | Holding REW or FF | Sawtooth oscillator at 140 Hz (REW) or 260 Hz (FF) through a bandpass at 1.2 kHz, with a slow 6 Hz LFO on frequency for the motor wobble. Stop with a 150 ms fade. |
| Side flip | Flip to Side B | Clunk, then a short rattle: three 20 ms noise bursts 50 ms apart with a highpass filter at 2 kHz. |
| Track-end chime | Track finished, REC prompt appears | Two triangle notes (E5 then B5), 200 ms each, with a 600 ms exponential decay. Soft gain 0.06. |
| Restore chime | Recall score is good, strength restored | Three rising triangle notes (C5, E5, G5), 120 ms apart, slightly detuned by 5 cents for a warm, old feel. |
| Break-skip sting | "The tape remembers…" toast | Low sawtooth at 70 Hz for 400 ms with a bandpass sweep from 200 Hz to 800 Hz, plus a quiet noise swell. Unsettling but short. |

## Focus audio (played during tracks, task 16)

| Sound | How to generate |
|---|---|
| Brown noise | White noise buffer integrated: each sample is the previous sample plus a small random step, then scaled back. Loop it. Keep gain low (0.15 or less). This one must always work, even if the others are cut. |
| Rain | White noise through a highpass at 1 kHz and a lowpass at 8 kHz, with a slow random gain LFO (0.1 to 0.3 Hz) for gusts. Add sparse short noise ticks at random 50 to 300 ms intervals for drops. |
| Lo-fi loop | A looping chord pattern from oscillators (triangle, 2 or 3 notes per chord) through a lowpass at 1.5 kHz, a slow tape wobble LFO on detune (about 10 cents, 0.5 Hz), and quiet vinyl-style crackle from sparse noise ticks. First thing to cut if the schedule slips. |
| Interlude fades | Fade focus audio in and out with a 2 second linear ramp on its gain node at interlude boundaries. |

## Decay effects on playback (tasks 12 and 17)

These come from the effects table in the mixtape-core design. Use those exact values, not
the ones here.

| Effect | How to generate |
|---|---|
| Hiss | Looping noise buffer through a highpass at 3 kHz, mixed in at the hiss gain for the condition. |
| Speed wobble | LFO (low-frequency oscillator, about 0.5 to 2 Hz) connected to the source's playbackRate with depth set by the wobble percent. |
| Pitch wobble | A second LFO connected to detune, depth in cents. |
| Distortion | WaveShaperNode with a soft-clipping curve. Amount controlled by the distortion value. |
| Dead tape | Static only: white noise at gain 0.15, voice gain 0. |
| Ghost whispers (optional) | Bandpassed noise bursts (formant filters near 500 Hz and 1.8 kHz) with slow gain swells, every 20 to 45 seconds. Only if time allows. |

## Testing checklist

- Audio does not start before a user gesture, and the first click does not fail silently.
- Mute silences everything, including the hiss during decayed playback.
- No clipping when several sounds overlap (keep master gain at 0.8 or less).
- Sounds still work on a phone (iOS Safari needs the first `resume()` inside a tap).
