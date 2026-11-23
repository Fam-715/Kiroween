---
inclusion: fileMatch
fileMatchPattern: 'frontend/src/**/*.{tsx,css}'
---

# Design System — "Dead Format" Cassette Aesthetic

All frontend UI follows this system. The product looks like a haunted vintage cassette collection: near-black plum interfaces, cassette-plastic surfaces, and condition-based visual effects.

## Colour Tokens

Use these names in CSS custom properties / Tailwind tokens.

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | near-black plum, e.g. `#1A1220` | Page background |
| `--color-surface` | off-white cassette plastic, e.g. `#EDE6D6` | Cards, cassette bodies, panels |
| `--color-label-orange` | orange, e.g. `#E8722C` | Primary labels, category tags |
| `--color-label-teal` | teal, e.g. `#2C8C8C` | Secondary labels, info tags |
| `--color-lcd-green` | LCD green, e.g. `#7DF07D` | Readouts, counters, LCD text |
| `--color-danger` | blood red, e.g. `#8A0B0B` | Danger ONLY — destructive actions, "Dead" condition, irreversible states |

Never use `--color-danger` for decoration, emphasis, or non-destructive UI. Blood-red is reserved for danger.

## Fonts

| Font | Role |
|---|---|
| **VT323** | LCD-style readouts, counters, track numbers, status displays |
| **Special Elite** | Typed label text: tape names, categories, buttons |
| **Caveat** | Handwritten J-card notes, user annotations, margin scrawl |
| **Creepster** | Titles only (logo, page titles). Never body text or UI labels |

Pair with a neutral fallback stack for long-form reading if needed; the themed faces are for identity elements, not paragraphs.

## Spacing

- Base unit: **8px**. All margins, padding, and gaps are multiples of it (8, 16, 24, 32, 48).
- Cassette cards: 24px internal padding, 16px gap in grids.
- Page gutters: 32px desktop, 16px mobile.
- Touch targets: minimum 48×48px.

## Visual Effects per Condition

Each cassette in the collection has a condition. Apply only the effects listed for that condition:

- **Mint** — Clean: no filters, subtle plastic sheen (soft highlight gradient), perfectly aligned.
- **Worn** — Slightly faded colours (reduced saturation ~80%), light scuff overlay, small corner wear.
- **Warped** — Slight skew/rotation (1–3°), uneven drop shadow, hue shift on the plastic, slight wobble on hover.
- **Haunted** — Soft green glow, occasional drifting specks, faint whisper-glyphs at low opacity, subtle breathing scale animation.
- **Dead** — Monochrome/greyscale, heavy damage (cracks, tears), blood-red condition stamp, no animation.

## Accessibility Rules (required, not optional)

1. **Condition is always shown as text.** Never rely on the visual effect alone to convey condition — every card includes a visible text label (e.g. "Worn") in Special Elite. Effects are decoration; the text is the information.
2. **Reduced motion:** honour `prefers-reduced-motion: reduce`. Disable all wobble, flicker, drift, and breathing animations; keep static condition effects (desaturation, greyscale, glow) but remove anything that moves or pulses.
3. **Flicker/flash animations must run at 8 Hz or less** to stay below photosensitive-triggering frequencies. Any flickering effect (Haunted, Dead transitions) must have a period of at least 125 ms between intensity changes.
4. Maintain at least WCAG AA contrast (4.5:1) for text; LCD green on near-black plum passes, but never place orange or teal text below AA on dark backgrounds without a lighter variant.
5. Danger actions combine colour with an icon or text so blood-red is never the only signal.
