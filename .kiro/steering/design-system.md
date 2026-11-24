---
inclusion: fileMatch
fileMatchPattern:
  - "frontend/src/**/*.tsx"
  - "frontend/src/**/*.css"
---

# Design System — Cursed Cassette

## 1. Visual mood
An original retro-horror take on the 1980s portable cassette player: a machine found in an
abandoned dorm. Dark, nostalgic, a little funny, never gory. All artwork is drawn from
scratch (SVG/CSS). No brand names, no logos, no traced artwork — the component is always "cassette player". The horror always reflects app
state: a forgotten topic looks scarier, so the spooky design serves the function.

## 2. Colour palette (Tailwind tokens)
Define in `tailwind.config.ts`. Never use inline hex colours in components.

| Token | Hex | Usage |
|---|---|---|
| `plum-950` | `#1A1220` | Page background (near-black plum) |
| `plum-900` | `#241A2E` | Raised panels, shelves |
| `plastic-100` | `#EDE6D6` | Cassette body, off-white plastic |
| `plastic-300` | `#D9CFBA` | Plastic edges, worn detail |
| `label-orange` | `#E8722C` | Primary labels, Side A, category tags |
| `label-teal` | `#2C8C8C` | Secondary labels, Side B, info tags |
| `lcd-green` | `#7DF07D` | LCD digits, countdown, strength readout |
| `danger` | `#8A0B0B` | Danger only: Dead condition, destructive actions |

Text must meet WCAG AA contrast (4.5:1). `lcd-green` and off-white on `plum-950` pass;
`label-orange`/`label-teal` on dark backgrounds need their lighter variants (`#F5935C`,
`#5FBDBD`) for text. Danger is never the only signal — pair it with an icon or text.

## 3. Typography
| Font | Role |
|---|---|
| **VT323** | LCD digits, countdown, counters, track numbers |
| **Special Elite** | Typed labels: tape titles, buttons, tags, condition text |
| **Caveat** | Handwritten J-card notes and annotations |
| **Creepster** | Titles only (logo, page titles). Never body or UI labels |

Long-form reading uses a plain neutral sans; the themed faces carry identity, not paragraphs.

## 4. Cassette player component
- Cassette drawn as inline SVG: two reels that spin during playback; spin speed and wobble
  are driven by the track's condition via `effectsFor`.
- LCD strip shows the countdown (VT323, `lcd-green`), side indicator (A/B) and a small
  "TIME WARP ON" flag when active.
- Buttons: PLAY, PAUSE, STOP, REW, FF, REC — each 48×48px minimum, keyboard reachable,
  with visible focus and an `aria-label`. Space = play/pause, arrows = REW/FF, R = REC.
- REC is visually distinct (blood-red ring) but labelled in text.
- Track map under the player; skipping a break glitches affected tracks for 1.2 s
  (static outline under reduced motion) with the "The tape remembers…" toast.
- Audio never autoplays; the mic opens only after the REC press.

## 5. Effects by condition
Driven by `domain/effects.ts`: `effectsFor(strength, reducedMotion)`. Values never decrease
as strength decreases; audio effects are unchanged by reduced motion; visual wobble, spin and
flicker are 0 under reduced motion; colour bleed stays as a static cue. Condition text is
always rendered (Special Elite), never animation-only.

| Condition (strength) | Visual | Audio |
|---|---|---|
| Mint (80–100) | Clean plastic, subtle sheen, no filters | No hiss, no wobble |
| Worn (50–79) | Subtle grain, slightly faded colour | Hiss 0.02, distortion 0.05 |
| Warped (20–49) | 1–3° skew, chromatic aberration (2px bleed), 4 Hz flicker | Hiss 0.05, speed wobble ±6%, pitch ±25 cents, distortion 0.20 |
| Haunted (1–19) | Vignette, shadow silhouettes in cassette window, 4px bleed, 8 Hz flicker | Hiss 0.10, speed wobble ±12%, pitch ±60 cents, distortion 0.45, optional whisper burst |
| Dead (0) | Monochrome, blood-red "Dead" stamp, no animation | Static only (noise 0.15, voice 0) |

Flicker never exceeds 8 Hz (≥125 ms per change), keeping it below photosensitive-trigger
rates.

## 6. Motion rules (Framer Motion)
- Use Framer Motion for reel spin, tape wobble, J-card flips, shelf ghost drift and the
  break-skip glitch. Keep animations short (150–400 ms, glitch 1.2 s).
- Every animation must respect `prefers-reduced-motion` via `useReducedMotion`: disable
  wobble, spin, flicker and drift; state changes stay visible through colour and static
  effects. The condition text is always visible without animation.
- Transitions use `ease-out` for entering, `ease-in` for exiting; no bounce on controls.
- The Haunted breathing/scale effect is subtle (≤2%) and off under reduced motion.

## 7. Layout and spacing
- Base unit 8px; margins, padding and gaps are multiples (8, 16, 24, 32, 48).
- Player centred with 32px page gutters (16px mobile); cassette cards 24px padding,
  16px grid gap.
- Shelf is a responsive grid of cassette spines (min 200px), due tapes badged "N due",
  ghost tapes translucent with the "Forgotten" label.

**Do:** condition as text, `effectsFor` as the single source of effect values, Tailwind
tokens for colour, keyboard controls with `aria-label`s, humour in copy.

**Don't:** brand names or logos, inline hex colours, gore, autoplaying audio, effects above
8 Hz flicker, danger red outside danger contexts, animation as the only carrier of meaning.
