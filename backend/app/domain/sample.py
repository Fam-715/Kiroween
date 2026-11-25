"""The sample tape: four tracks seeded at different memory strengths. No I/O.

`sample_tape(virtual_now)` is deterministic. See design.md, "domain/sample.py".
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from app.domain import schedule

SAMPLE_TITLE = "Sample: Biology Basics"
SAMPLE_LENGTH = "C60"


@dataclass(frozen=True)
class SeededMemory:
    """Memory state seeded for one track. `last_reviewed_at = virtual_now - age`."""

    base_strength: int
    stability_days: float
    last_reviewed_at: datetime
    review_count: int
    score: float
    matched_terms: tuple[str, ...]
    missed_terms: tuple[str, ...]


@dataclass(frozen=True)
class SampleTrack:
    side: str
    position: int
    item: schedule.Item
    memory: SeededMemory


@dataclass(frozen=True)
class TapeSpec:
    title: str
    length: str
    is_sample: bool
    side_a: tuple[schedule.Item, ...]
    side_b: tuple[schedule.Item, ...]
    tracks: tuple[SampleTrack, ...]

    def as_tape(self) -> schedule.Tape:
        return schedule.Tape(self.title, self.length, self.side_a, self.side_b)


# name, key terms, stability (days), base, age (days), matched term count
_TRACKS: tuple[tuple[str, tuple[str, ...], float, int, float, int], ...] = (
    (
        "Photosynthesis",
        ("chlorophyll", "light reactions", "Calvin cycle", "glucose"),
        10.0,
        100,
        1.0,
        3,
    ),
    ("Cell respiration", ("mitochondria", "glycolysis", "ATP", "Krebs cycle"), 3.0, 100, 1.2, 3),
    ("Enzymes", ("substrate", "active site", "catalyst", "denaturation"), 2.0, 100, 2.5, 3),
    (
        "DNA replication",
        ("helicase", "polymerase", "primer", "leading strand", "Okazaki fragments"),
        1.5,
        40,
        2.5,
        2,
    ),
)
_LAYOUT = (("A", (0, None, 1)), ("B", (2, None, 3)))
_INTERLUDE_MINUTES = 5
_TRACK_MINUTES = 10


def sample_tape(virtual_now: datetime) -> TapeSpec:
    sides: dict[str, list[schedule.Item]] = {"A": [], "B": []}
    tracks: list[SampleTrack] = []
    for side, order in _LAYOUT:
        for position, idx in enumerate(order):
            if idx is None:
                sides[side].append(schedule.Item(kind="interlude", minutes=_INTERLUDE_MINUTES))
                continue
            name, terms, stability, base, age, matched = _TRACKS[idx]
            item = schedule.Item(
                kind="track", minutes=_TRACK_MINUTES, name=name, key_terms=terms
            )
            sides[side].append(item)
            memory = SeededMemory(
                base_strength=base,
                stability_days=stability,
                last_reviewed_at=virtual_now - timedelta(days=age),
                review_count=1,
                score=matched / len(terms),
                matched_terms=terms[:matched],
                missed_terms=terms[matched:],
            )
            tracks.append(SampleTrack(side, position, item, memory))
    return TapeSpec(
        title=SAMPLE_TITLE,
        length=SAMPLE_LENGTH,
        is_sample=True,
        side_a=tuple(sides["A"]),
        side_b=tuple(sides["B"]),
        tracks=tuple(tracks),
    )
